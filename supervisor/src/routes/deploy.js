const { Router } = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');
const { nanoid } = require('nanoid');
const db = require('../db');
const { siteDir, appDir, applySiteSettings, runBuildStep } = require('../docker');
const { requireSiteRole, requireRole, authz, isPanelAdmin } = require('../auth');
const { notify } = require('../notify');
const { fireWebhooks } = require('../webhooks');
const { sendAlert } = require('../alerts');
const { assertPublicUrl } = require('../validate');
const { atomicExtract, inspectZip } = require('../extract');
const { asyncHandler } = require('../async-handler');
const { dirSizeBytes } = require('../disk');
const { stageScanAndDecide } = require('../quarantine');

/** Shared response handling for a scanned deploy. Returns true when the request was answered (pending/blocked). */
function respondIfHeld(res, decision) {
  if (decision.outcome === 'blocked') {
    res.status(422).json({ error: 'Deploy blocked by the content scanner', verdict: 'blocked', findings: decision.findings, review_id: decision.reviewId });
    return true;
  }
  if (decision.outcome === 'pending') {
    res.status(202).json({ ok: true, pending_review: true, verdict: 'review', findings: decision.findings, review_id: decision.reviewId,
      message: 'Waiting for review by the owner — the live site is unchanged' });
    return true;
  }
  return false;
}
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

function logActivity(siteId, siteName, event, detail, actor = 'system', targetUserId = null) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null, actor, targetUserId);
  } catch {}
}

// Support mode: an admin acting on someone else's site — log the owner as
// target and tell them what happened.
function supportTrail(req, row, event, detail) {
  const ownerId = row.owner_id || null;
  logActivity(row.id, row.name, event, detail, req.user?.username || 'system', req.supportMode ? ownerId : null);
  if (req.supportMode && ownerId) {
    notify({ type: 'support_action', title: `${req.user.username} (support) — ${event.replace(/_/g, ' ')} on ${row.name}`, detail: detail || null, data: { siteId: row.id, actor: req.user.username, event }, userIds: [ownerId], admins: false, force: true });
  }
}

function assertNotSuspended(req, res, row) {
  if (row.status === 'suspended' && !isPanelAdmin(req.user)) { res.status(423).json({ error: 'Site is suspended' }); return false; }
  return true;
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
router.get('/', (req, res) => {
  const scope = authz.siteScopeSql(req.user, 'd.site_id');
  const rows = db.prepare(`SELECT d.id, d.site_id, d.filename, d.size, d.deployed_at,
        s.name AS site_name, s.domain AS site_domain
      FROM deployments d JOIN sites s ON s.id = d.site_id
      WHERE ${scope.sql}
      ORDER BY d.deployed_at DESC LIMIT 200`).all(...scope.params);
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
router.post('/:id', requireSiteRole('editor'), limitDeploys, upload.single('file'), asyncHandler(async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) {
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: 'Site not found' });
  }
  if (!assertNotSuspended(req, res, row)) { try { fs.unlinkSync(req.file.path); } catch {} return; }
  const capUpload = (req.user.capabilities?.max_upload_mb || 250) * 1024 * 1024;
  if (req.file.size > capUpload) { try { fs.unlinkSync(req.file.path); } catch {} return res.status(413).json({ error: `Upload exceeds your limit of ${req.user.capabilities.max_upload_mb} MB` }); }

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
    const historyFilename = `${nanoid(10)}.zip`;
    const decision = stageScanAndDecide({ req, row, zipPath: req.file.path, targetDir, isAppRuntime, originalName: req.file.originalname, size: req.file.size, historyFilename });
    if (decision.outcome !== 'live') {
      // Keep the upload for the reviewer (pending) — blocked uploads are dropped.
      if (decision.outcome === 'pending') {
        const hDir = historyDir(req.params.id);
        fs.mkdirSync(hDir, { recursive: true });
        fs.copyFileSync(req.file.path, path.join(hDir, historyFilename));
      }
      try { fs.unlinkSync(req.file.path); } catch {}
      if (decision.outcome === 'blocked') { fireWebhooks('deploy_failed', req.params.id, row.name, 'blocked by content scanner'); }
      return respondIfHeld(res, decision);
    }
    const { fileCount } = decision;

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
    fs.copyFileSync(req.file.path, path.join(hDir, historyFilename));
    fs.unlinkSync(req.file.path);

    saveDeployment(req.params.id, historyFilename, req.file.size);
    supportTrail(req, row, 'deployed', req.file.originalname);
    fireWebhooks('deploy', req.params.id, row.name, req.file.originalname);

    res.json({ ok: true, files: fileCount, verdict: decision.verdict, findings: decision.findings });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('Deploy error:', err);
    fireWebhooks('deploy_failed', req.params.id, row.name, err.message);
    sendAlert('deploy_failed', { siteName: row.name, detail: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
}));

// GET /api/deploy/:id/history
router.get('/:id/history', requireSiteRole('viewer'), (req, res) => {
  const rows = db.prepare(
    'SELECT id, filename, size, deployed_at FROM deployments WHERE site_id = ? ORDER BY deployed_at DESC'
  ).all(req.params.id);
  res.json(rows);
});

// POST /api/deploy/:id/rollback/:deploymentId
router.post('/:id/rollback/:deploymentId', requireSiteRole('editor'), limitDeploys, asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });
  if (!assertNotSuspended(req, res, row)) return;

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

    supportTrail(req, row, 'rolled_back', dep.filename);
    fireWebhooks('rollback', req.params.id, row.name, dep.filename);
    res.json({ ok: true });
  } catch (err) {
    console.error('Rollback error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// POST /api/deploy/:id/url — deploy from a public zip URL
router.post('/:id/url', requireSiteRole('editor'), limitDeploys, asyncHandler(async (req, res) => {
  const { url } = req.body;
  if (!url || typeof url !== 'string') return res.status(400).json({ error: 'url is required' });

  let parsed, pinnedAddress;
  // TODO: connect to pinnedAddress to fully close DNS-rebinding
  try { ({ url: parsed, address: pinnedAddress } = await assertPublicUrl(url)); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.pathname.endsWith('.zip')) return res.status(400).json({ error: 'URL must point to a .zip file' });

  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });
  if (!assertNotSuspended(req, res, row)) return;

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
    const historyFilename = `${nanoid(10)}.zip`;
    const decision = stageScanAndDecide({ req, row, zipPath: tmpPath, targetDir, isAppRuntime, originalName: parsed.hostname + parsed.pathname, size: stat.size, historyFilename });
    if (decision.outcome !== 'live') {
      if (decision.outcome === 'pending') {
        const hDir = historyDir(req.params.id);
        fs.mkdirSync(hDir, { recursive: true });
        fs.copyFileSync(tmpPath, path.join(hDir, historyFilename));
      }
      try { fs.unlinkSync(tmpPath); } catch {}
      return respondIfHeld(res, decision);
    }
    const { fileCount } = decision;

    const site = { ...row, spa_mode: !!row.spa_mode, cache_enabled: !!row.cache_enabled, maintenance_mode: !!row.maintenance_mode, ssl_enabled: !!row.ssl_enabled, custom_headers: row.custom_headers || '[]', redirects: row.redirects || '[]' };
    if (isAppRuntime && row.build_cmd) await runBuildStep(site);
    const urlDeployContainerId = await applySiteSettings(site);
    if (urlDeployContainerId) {
      db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(urlDeployContainerId, req.params.id);
    }

    // Success — now persist history + notify.
    const hDir = historyDir(req.params.id);
    fs.mkdirSync(hDir, { recursive: true });
    fs.copyFileSync(tmpPath, path.join(hDir, historyFilename));
    fs.unlinkSync(tmpPath);

    saveDeployment(req.params.id, historyFilename, stat.size);
    supportTrail(req, row, 'deployed', parsed.hostname + parsed.pathname);
    fireWebhooks('deploy', req.params.id, row.name, url);

    res.json({ ok: true, files: fileCount, verdict: decision.verdict, findings: decision.findings });
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    console.error('URL deploy error:', err);
    fireWebhooks('deploy_failed', req.params.id, row.name, err.message);
    sendAlert('deploy_failed', { siteName: row.name, detail: err.message });
    res.status(err.status || 500).json({ error: err.message });
  }
}));

module.exports = router;
