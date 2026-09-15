const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { nanoid } = require('nanoid');
const db = require('../db');
const { siteDir, appDir, applySiteSettings, runBuildStep } = require('../docker');
const { requireSiteAccess, requireRole } = require('../auth');
const { fireWebhooks } = require('../webhooks');
const { sendAlert } = require('../alerts');
const { assertPublicUrl } = require('../validate');
const { atomicExtract, inspectZip } = require('../extract');
const { asyncHandler } = require('../async-handler');
const { dirSizeBytes } = require('../disk');
const { deployLimiter } = require('../rate-limit');

const HISTORY_KEEP = 5; // zips to retain per site
const MB = 1024 * 1024;
const QUOTA_BYTES = (() => { const n = Number(process.env.SITE_DISK_QUOTA_MB); return (Number.isFinite(n) && n > 0 ? n : 2048) * MB; })();

/**
 * Per-site disk quota: the new deploy's uncompressed size plus everything the
 * site already keeps on disk except the directory being replaced.
 * Throws an error with .status = 413 when the quota would be exceeded.
 */
function assertQuota(siteId, zipPath, targetDir) {
  const { totalBytes } = inspectZip(zipPath);
  const dir = siteDir(siteId);
  let existing = 0;
  for (const name of fs.existsSync(dir) ? fs.readdirSync(dir) : []) {
    const full = path.join(dir, name);
    if (path.resolve(full) === path.resolve(targetDir)) continue; // replaced by this deploy
    existing += dirSizeBytes(full);
  }
  // The zip itself is kept in history/ as well.
  let zipSize = 0;
  try { zipSize = fs.statSync(zipPath).size; } catch {}
  const projected = existing + totalBytes + zipSize;
  if (projected > QUOTA_BYTES) {
    const err = new Error(`Site would use ${Math.round(projected / MB)} MB, quota is ${Math.round(QUOTA_BYTES / MB)} MB — delete old deployments or ask an admin to raise SITE_DISK_QUOTA_MB`);
    err.status = 413;
    throw err;
  }
}

const limitDeploys = deployLimiter();

function historyDir(siteId) {
  return path.join(siteDir(siteId), 'history');
}

function logActivity(siteId, siteName, event, detail, actor = 'system') {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor) VALUES (?, ?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null, actor);
  } catch {}
}

function saveDeployment(siteId, filename, size) {
  const id = nanoid(10);
  db.prepare('INSERT INTO deployments (id, site_id, filename, size) VALUES (?, ?, ?, ?)')
    .run(id, siteId, filename, size);

  // Prune oldest beyond HISTORY_KEEP
  const old = db.prepare(
    `SELECT id, filename FROM deployments WHERE site_id = ?
     ORDER BY deployed_at DESC LIMIT -1 OFFSET ${HISTORY_KEEP}`
  ).all(siteId);
  for (const d of old) {
    const f = path.join(historyDir(siteId), d.filename);
    try { fs.unlinkSync(f); } catch {}
    db.prepare('DELETE FROM deployments WHERE id = ?').run(d.id);
  }
  return id;
}

const router = Router();

// GET /api/deploy — global deployment history (filtered by site access)
router.get('/', requireRole('admin', 'editor'), (req, res) => {
  const rows = req.user?.role === 'admin'
    ? db.prepare(`SELECT d.id, d.site_id, d.filename, d.size, d.deployed_at,
          s.name AS site_name, s.domain AS site_domain
        FROM deployments d JOIN sites s ON s.id = d.site_id
        ORDER BY d.deployed_at DESC LIMIT 200`).all()
    : db.prepare(`SELECT d.id, d.site_id, d.filename, d.size, d.deployed_at,
          s.name AS site_name, s.domain AS site_domain
        FROM deployments d JOIN sites s ON s.id = d.site_id
        INNER JOIN site_permissions sp ON sp.site_id = d.site_id AND sp.user_id = ?
        ORDER BY d.deployed_at DESC LIMIT 200`).all(req.user?.id);
  res.json(rows);
});

// Store uploads in /tmp — they're extracted immediately and deleted
const upload = multer({
  dest: '/tmp/webhost-uploads/',
  limits: { fileSize: 250 * 1024 * 1024 }, // 250MB max
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/zip' || file.originalname.endsWith('.zip')) {
      cb(null, true);
    } else {
      cb(new Error('Only .zip files are accepted'));
    }
  },
});

// POST /api/deploy/:id — upload a zip and deploy it to a site
router.post('/:id', requireSiteAccess(), requireRole('admin', 'editor'), limitDeploys, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Site not found' });
  }

  const runtime = row.runtime || 'static';
  // php and static both use html/; node and python use app/
  const isAppRuntime = runtime === 'node' || runtime === 'python';

  try {
    const targetDir = path.resolve(isAppRuntime
      ? appDir(req.params.id)
      : path.join(siteDir(req.params.id), 'html'));

    // Quota + limits first, then non-destructive extract (throws before
    // touching the live dir if the zip is bad).
    assertQuota(req.params.id, req.file.path, targetDir);
    const { fileCount } = atomicExtract(req.file.path, targetDir);

    const site = {
      ...row,
      spa_mode: !!row.spa_mode,
      cache_enabled: !!row.cache_enabled,
      maintenance_mode: !!row.maintenance_mode,
      ssl_enabled: !!row.ssl_enabled,
      custom_headers: row.custom_headers || '[]',
      redirects: row.redirects || '[]',
    };

    // Run build step for app runtimes (node/python) if build_cmd is set
    if (isAppRuntime && row.build_cmd) {
      await runBuildStep(site);
    }

    const newContainerId = await applySiteSettings(site);
    if (newContainerId) {
      db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newContainerId, req.params.id);
    }

    // Success — now persist history + notify.
    const hDir = historyDir(req.params.id);
    fs.mkdirSync(hDir, { recursive: true });
    const historyFilename = `${nanoid(10)}.zip`;
    fs.copyFileSync(req.file.path, path.join(hDir, historyFilename));
    fs.unlinkSync(req.file.path);

    saveDeployment(req.params.id, historyFilename, req.file.size);
    logActivity(req.params.id, row.name, 'deployed', req.file.originalname, req.user?.username || 'system');
    fireWebhooks('deploy', req.params.id, row.name, req.file.originalname);

    res.json({ ok: true, files: fileCount });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('Deploy error:', err);
    fireWebhooks('deploy_failed', req.params.id, row.name, err.message);
    sendAlert('deploy_failed', { siteName: row.name, detail: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
}));

// GET /api/deploy/:id/history
router.get('/:id/history', requireSiteAccess(), (req, res) => {
  const rows = db.prepare(
    'SELECT id, filename, size, deployed_at FROM deployments WHERE site_id = ? ORDER BY deployed_at DESC'
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/deploy/:id/rollback/:deploymentId
router.post('/:id/rollback/:deploymentId', requireSiteAccess(), requireRole('admin', 'editor'), limitDeploys, asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });

  const dep = db.prepare('SELECT * FROM deployments WHERE id = ? AND site_id = ?')
    .get(req.params.deploymentId, req.params.id);
  if (!dep) return res.status(404).json({ error: 'Deployment not found' });

  const zipPath = path.join(historyDir(req.params.id), dep.filename);
  if (!fs.existsSync(zipPath)) return res.status(404).json({ error: 'Deployment file missing' });

  try {
    const runtime = row.runtime || 'static';
    const isAppRuntime = runtime === 'node' || runtime === 'python';
    const targetDir = path.resolve(isAppRuntime ? appDir(req.params.id) : path.join(siteDir(req.params.id), 'html'));

    atomicExtract(zipPath, targetDir);

    const site = {
      ...row,
      spa_mode: !!row.spa_mode,
      cache_enabled: !!row.cache_enabled,
      maintenance_mode: !!row.maintenance_mode,
      ssl_enabled: !!row.ssl_enabled,
      custom_headers: row.custom_headers || '[]',
      redirects: row.redirects || '[]',
    };
    if (isAppRuntime && row.build_cmd) await runBuildStep(site);
    const rollbackContainerId = await applySiteSettings(site);
    if (rollbackContainerId) {
      db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(rollbackContainerId, req.params.id);
    }

    logActivity(req.params.id, row.name, 'rolled_back', dep.filename, req.user?.username || 'system');
    fireWebhooks('rollback', req.params.id, row.name, dep.filename);
    res.json({ ok: true });
  } catch (err) {
    console.error('Rollback error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// POST /api/deploy/:id/url — deploy from a public zip URL
router.post('/:id/url', requireSiteAccess(), requireRole('admin', 'editor'), limitDeploys, asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  let parsed, pinnedAddress;
  // TODO: connect to pinnedAddress to fully close DNS-rebinding
  try { ({ url: parsed, address: pinnedAddress } = await assertPublicUrl(url)); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.pathname.endsWith('.zip')) return res.status(400).json({ error: 'URL must point to a .zip file' });

  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });

  const tmpPath = path.join('/tmp', `grimport-url-${nanoid(8)}.zip`);

  try {
    // Download zip to temp file
    await new Promise((resolve, reject) => {
      const file = fs.createWriteStream(tmpPath);
      const get = parsed.protocol === 'https:' ? https.get : http.get;
      get(url, { headers: { 'User-Agent': 'grimport-deploy' } }, response => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(tmpPath);
          return reject(new Error(`Redirects not followed — use the direct zip URL (got ${response.statusCode} to ${response.headers.location})`));
        }
        if (response.statusCode !== 200) {
          file.close();
          fs.unlinkSync(tmpPath);
          return reject(new Error(`Download failed: HTTP ${response.statusCode}`));
        }
        response.pipe(file);
        file.on('finish', () => file.close(resolve));
      }).on('error', err => { try { fs.unlinkSync(tmpPath); } catch {} reject(err); });
    });

    const stat = fs.statSync(tmpPath);
    if (stat.size > 250 * 1024 * 1024) throw new Error('Zip too large (max 250MB)');

    const runtime = row.runtime || 'static';
    const isAppRuntime = runtime === 'node' || runtime === 'python';
    const targetDir = path.resolve(isAppRuntime ? appDir(req.params.id) : path.join(siteDir(req.params.id), 'html'));

    assertQuota(req.params.id, tmpPath, targetDir);
    // Non-destructive: throws before touching live dir if the zip is bad.
    const { fileCount } = atomicExtract(tmpPath, targetDir);

    const site = { ...row, spa_mode: !!row.spa_mode, cache_enabled: !!row.cache_enabled, maintenance_mode: !!row.maintenance_mode, ssl_enabled: !!row.ssl_enabled, custom_headers: row.custom_headers || '[]', redirects: row.redirects || '[]' };
    if (isAppRuntime && row.build_cmd) await runBuildStep(site);
    const urlDeployContainerId = await applySiteSettings(site);
    if (urlDeployContainerId) {
      db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(urlDeployContainerId, req.params.id);
    }

    // Success — now persist history + notify.
    const hDir = historyDir(req.params.id);
    fs.mkdirSync(hDir, { recursive: true });
    const historyFilename = `${nanoid(10)}.zip`;
    fs.copyFileSync(tmpPath, path.join(hDir, historyFilename));
    fs.unlinkSync(tmpPath);

    saveDeployment(req.params.id, historyFilename, stat.size);
    logActivity(req.params.id, row.name, 'deployed', parsed.hostname + parsed.pathname, req.user?.username || 'system');
    fireWebhooks('deploy', req.params.id, row.name, url);

    res.json({ ok: true, files: fileCount });
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    console.error('URL deploy error:', err);
    fireWebhooks('deploy_failed', req.params.id, row.name, err.message);
    sendAlert('deploy_failed', { siteName: row.name, detail: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
}));

module.exports = router;
