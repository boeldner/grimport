const { Router } = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const {
  createSiteContainer,
  createPreviewContainer,
  swapPreview,
  removePreviewContainer,
  applySiteSettings,
  startSiteContainer,
  stopSiteContainer,
  removeSiteContainer,
  containerStatus,
  containerLogs,
  siteDir,
} = require('../docker');
const { fireWebhooks } = require('../webhooks');
const { requireRole, requireSiteAccess } = require('../auth');
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

// GET /api/sites — list sites (filtered by permissions for non-admins)
router.get('/', async (req, res) => {
  let rows;
  if (req.user?.role === 'admin') {
    rows = db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
  } else {
    rows = db.prepare(
      `SELECT s.* FROM sites s
       INNER JOIN site_permissions sp ON sp.site_id = s.id AND sp.user_id = ?
       ORDER BY s.created_at DESC`
    ).all(req.user?.id);
  }
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
router.get('/:id', requireSiteAccess(), async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const site = parseSite(row);
  if (site.container_id) {
    site.container = await containerStatus(site.container_id);
  }
  res.json(site);
});

// POST /api/sites — create a new site (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const { name, domain, spa_mode, cache_enabled, runtime, start_cmd, app_port } = req.body;
  if (!name || !domain) return res.status(400).json({ error: 'name and domain are required' });

  const id = nanoid(10);
  const siteRuntime = runtime || 'static';
  try {
    db.prepare(
      `INSERT INTO sites (id, name, domain, spa_mode, cache_enabled, runtime, start_cmd, app_port)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, name.trim(), domain.trim().toLowerCase(),
      spa_mode ? 1 : 0, cache_enabled !== false ? 1 : 0,
      siteRuntime, start_cmd || null, app_port || null
    );

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

// PUT /api/sites/:id — update settings (editor or admin with site access)
router.put('/:id', requireSiteAccess(), requireRole('admin', 'editor'), async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const {
    name, domain, spa_mode, cache_enabled, maintenance_mode,
    ssl_enabled, basic_auth, custom_headers, redirects,
    runtime, build_cmd, start_cmd, app_port, env_vars,
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
      redirects = COALESCE(?, redirects),
      runtime = COALESCE(?, runtime),
      build_cmd = COALESCE(?, build_cmd),
      start_cmd = COALESCE(?, start_cmd),
      app_port = COALESCE(?, app_port),
      env_vars = COALESCE(?, env_vars)
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
      const existing = row.basic_auth ? JSON.parse(row.basic_auth) : null;
      return JSON.stringify({
        username: basic_auth.username,
        password: basic_auth.password || existing?.password || '',
      });
    })(),
    custom_headers !== undefined ? JSON.stringify(custom_headers) : null,
    redirects !== undefined ? JSON.stringify(redirects) : null,
    runtime ?? null,
    build_cmd !== undefined ? (build_cmd || null) : null,
    start_cmd !== undefined ? (start_cmd || null) : null,
    app_port ?? null,
    env_vars ?? null,
    req.params.id,
  );

  const updated = parseSite(db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id));
  await applySiteSettings(updated);
  logActivity(req.params.id, updated.name, 'settings_changed', null);
  res.json(updated);
});

// POST /api/sites/:id/start
router.post('/:id/start', requireSiteAccess(), requireRole('admin', 'editor'), async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  await startSiteContainer(row.container_id);
  logActivity(req.params.id, row.name, 'started', null);
  res.json({ ok: true });
});

// POST /api/sites/:id/stop
router.post('/:id/stop', requireSiteAccess(), requireRole('admin', 'editor'), async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  await stopSiteContainer(row.container_id);
  logActivity(req.params.id, row.name, 'stopped', null);
  res.json({ ok: true });
});

// DELETE /api/sites/:id — stop + remove container, delete files (admin only)
router.delete('/:id', requireRole('admin'), async (req, res) => {
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
router.get('/:id/logs', requireSiteAccess(), async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  const logs = await containerLogs(row.container_id, Number(req.query.lines) || 100);
  res.type('text/plain').send(logs);
});

// ── Blue-green preview ─────────────────────────────────────

// POST /api/sites/:id/preview — create preview container
router.post('/:id/preview', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.preview_container_id) return res.status(409).json({ error: 'Preview already exists' });

  const { preview_domain } = req.body;
  if (!preview_domain?.trim()) return res.status(400).json({ error: 'preview_domain required' });

  // Check domain not already in use
  const conflict = db.prepare('SELECT id FROM sites WHERE domain = ? AND id != ?').get(preview_domain.trim(), row.id);
  if (conflict) return res.status(409).json({ error: 'Domain already in use' });

  db.prepare('UPDATE sites SET preview_domain = ? WHERE id = ?').run(preview_domain.trim(), row.id);
  const updated = db.prepare('SELECT * FROM sites WHERE id = ?').get(row.id);
  const site = parseSite(updated);

  const containerId = await createPreviewContainer(site);
  db.prepare('UPDATE sites SET preview_container_id = ? WHERE id = ?').run(containerId, row.id);
  logActivity(row.id, row.name, 'preview_created', preview_domain.trim());
  res.json({ ok: true, preview_container_id: containerId });
});

// POST /api/sites/:id/preview/swap — go live (swap preview → production)
router.post('/:id/preview/swap', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.preview_container_id) return res.status(404).json({ error: 'No preview to swap' });

  const site = parseSite(row);
  await swapPreview(site);
  logActivity(row.id, row.name, 'preview_swapped', `${row.preview_domain} → ${row.domain}`);
  fireWebhooks('deploy', row.id, row.name, `Live swap from ${row.preview_domain}`);
  res.json({ ok: true });
});

// DELETE /api/sites/:id/preview — discard preview
router.delete('/:id/preview', async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  const site = parseSite(row);
  await removePreviewContainer(site);
  db.prepare('UPDATE sites SET preview_container_id = NULL, preview_domain = NULL WHERE id = ?').run(row.id);
  logActivity(row.id, row.name, 'preview_removed', null);
  res.json({ ok: true });
});

module.exports = router;
