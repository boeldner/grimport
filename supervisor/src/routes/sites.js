const { Router } = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const {
  createSiteContainer,
  applySiteSettings,
  startSiteContainer,
  stopSiteContainer,
  removeSiteContainer,
  containerStatus,
  containerLogs,
  siteDir,
} = require('../docker');
const fs = require('fs');

const router = Router();

function logActivity(siteId, siteName, event, detail) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail) VALUES (?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null);
  } catch {}
}

function parseSite(row) {
  if (!row) return null;
  return {
    ...row,
    spa_mode: !!row.spa_mode,
    cache_enabled: !!row.cache_enabled,
    maintenance_mode: !!row.maintenance_mode,
    ssl_enabled: !!row.ssl_enabled,
    basic_auth: row.basic_auth ? { username: JSON.parse(row.basic_auth).username } : null,
    custom_headers: JSON.parse(row.custom_headers),
    redirects: JSON.parse(row.redirects),
  };
}

// GET /api/sites — list all sites with live container status
router.get('/', async (req, res) => {
  const rows = db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
  const sites = await Promise.all(
    rows.map(async (row) => {
      const site = parseSite(row);
      if (site.container_id) {
        site.container = await containerStatus(site.container_id);
      } else {
        site.container = { status: 'none', running: false };
      }
      return site;
    })
  );
  res.json(sites);
});

// GET /api/sites/:id
router.get('/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const site = parseSite(row);
  if (site.container_id) {
    site.container = await containerStatus(site.container_id);
  }
  res.json(site);
});

// POST /api/sites — create a new site
router.post('/', async (req, res) => {
  const { name, domain, spa_mode, cache_enabled } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'name and domain are required' });

  const id = nanoid(10);
  try {
    db.prepare(
      `INSERT INTO sites (id, name, domain, spa_mode, cache_enabled)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, name.trim(), domain.trim().toLowerCase(), spa_mode ? 1 : 0, cache_enabled !== false ? 1 : 0);

    const site = parseSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(id));
    const containerId = await createSiteContainer(site);
    db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(containerId, id);
    site.container_id = containerId;
    site.container = await containerStatus(containerId);
    logActivity(id, name.trim(), 'created', domain.trim().toLowerCase());
    res.status(201).json(site);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    console.error('Create site error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/sites/:id — update settings
router.put('/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const {
    name, domain, spa_mode, cache_enabled, maintenance_mode,
    ssl_enabled, basic_auth, custom_headers, redirects,
  } = req.body;

  db.prepare(
    `UPDATE sites SET
      name = COALESCE(?, name),
      domain = COALESCE(?, domain),
      spa_mode = COALESCE(?, spa_mode),
      cache_enabled = COALESCE(?, cache_enabled),
      maintenance_mode = COALESCE(?, maintenance_mode),
      ssl_enabled = COALESCE(?, ssl_enabled),
      basic_auth = ?,
      custom_headers = COALESCE(?, custom_headers),
      redirects = COALESCE(?, redirects)
    WHERE id = ?`
  ).run(
    name ?? null,
    domain ? domain.trim().toLowerCase() : null,
    spa_mode !== undefined ? (spa_mode ? 1 : 0) : null,
    cache_enabled !== undefined ? (cache_enabled ? 1 : 0) : null,
    maintenance_mode !== undefined ? (maintenance_mode ? 1 : 0) : null,
    ssl_enabled !== undefined ? (ssl_enabled ? 1 : 0) : null,
    (() => {
      if (basic_auth === undefined) return row.basic_auth; // not sent — keep unchanged
      if (basic_auth === null) return null;                // explicit remove
      // basic_auth.password provided → store new; blank → keep existing password
      const existing = row.basic_auth ? JSON.parse(row.basic_auth) : null;
      return JSON.stringify({
        username: basic_auth.username,
        password: basic_auth.password || existing?.password || '',
      });
    })(),
    custom_headers !== undefined ? JSON.stringify(custom_headers) : null,
    redirects !== undefined ? JSON.stringify(redirects) : null,
    req.params.id,
  );

  const updated = parseSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id));
  await applySiteSettings(updated);
  logActivity(req.params.id, updated.name, 'settings_changed', null);
  res.json(updated);
});

// POST /api/sites/:id/start
router.post('/:id/start', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  await startSiteContainer(row.container_id);
  logActivity(req.params.id, row.name, 'started', null);
  res.json({ ok: true });
});

// POST /api/sites/:id/stop
router.post('/:id/stop', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  await stopSiteContainer(row.container_id);
  logActivity(req.params.id, row.name, 'stopped', null);
  res.json({ ok: true });
});

// DELETE /api/sites/:id — stop + remove container, delete files
router.delete('/:id', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  if (row.container_id) {
    await removeSiteContainer(row.container_id);
  }

  const dir = siteDir(req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  db.prepare('DELETE FROM sites WHERE id = ?').run(req.params.id);
  logActivity(null, row.name, 'deleted', row.domain);
  res.json({ ok: true });
});

// GET /api/sites/:id/logs
router.get('/:id/logs', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  const logs = await containerLogs(row.container_id, Number(req.query.lines) || 100);
  res.type('text/plain').send(logs);
});

module.exports = router;
