/**
 * Deploy review queue (panel admins). A pending review holds a member's
 * upload in <site>/pending_html (or pending_app) while the live site keeps
 * serving the previous content. Approving promotes it and records the
 * deployment; rejecting discards it. See quarantine.js for how rows are created.
 */
const { Router } = require('express');
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireRole, requireHumanSession } = require('../auth');
const { asyncHandler } = require('../async-handler');
const { promoteDirectory } = require('../extract');
const { siteDir, appDir, applySiteSettings, runBuildStep } = require('../docker');
const { parseSiteForContainer } = require('../site-model');
const { notify } = require('../notify');
const { pendingDir } = require('../quarantine');

const router = Router();
router.use(requireRole('admin'));

const HISTORY_KEEP = 5;

function shape(r) {
  let findings = [];
  try { findings = JSON.parse(r.findings || '[]'); } catch {}
  return { ...r, findings, findings_count: findings.length };
}

function rows(where = '', params = []) {
  return db.prepare(
    `SELECT r.*, s.name AS site_name, s.domain AS site_domain, s.owner_id, s.runtime, u.username AS created_by_name
     FROM deploy_reviews r JOIN sites s ON s.id = r.site_id LEFT JOIN users u ON u.id = r.created_by
     ${where} ORDER BY r.created_at DESC LIMIT 200`
  ).all(...params).map(shape);
}

// GET /api/reviews?status=pending
router.get('/', (req, res) => {
  const status = req.query.status;
  res.json(status ? rows('WHERE r.status = ?', [status]) : rows());
});

// GET /api/reviews/:id/download — the exact zip that was uploaded
router.get('/:id/download', (req, res) => {
  const r = db.prepare('SELECT * FROM deploy_reviews WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  const file = path.join(siteDir(r.site_id), 'history', r.filename);
  if (!fs.existsSync(file)) return res.status(404).json({ error: 'Upload no longer stored' });
  res.setHeader('Content-Disposition', `attachment; filename="review-${r.id}.zip"`);
  res.type('application/zip');
  fs.createReadStream(file).pipe(res);
});

router.post('/:id/approve', requireHumanSession, asyncHandler(async (req, res) => {
  const r = db.prepare('SELECT * FROM deploy_reviews WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Review already ${r.status}` });
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(r.site_id);
  if (!site) return res.status(404).json({ error: 'Site no longer exists' });
  const isApp = site.runtime === 'node' || site.runtime === 'python';
  const pending = pendingDir(site.id, isApp);
  if (!fs.existsSync(pending)) return res.status(410).json({ error: 'Pending files are gone — ask for a new upload' });
  const targetDir = path.resolve(isApp ? appDir(site.id) : path.join(siteDir(site.id), 'html'));

  promoteDirectory(pending, targetDir);
  const forContainer = parseSiteForContainer(site);
  if (isApp && site.build_cmd) await runBuildStep(forContainer);
  const newContainerId = await applySiteSettings(forContainer);
  if (newContainerId) db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newContainerId, site.id);

  // Now it is a real deployment: record it and prune history like deploy.js does.
  const depId = nanoid(10);
  db.prepare('INSERT INTO deployments (id, site_id, filename, size) VALUES (?, ?, ?, ?)').run(depId, site.id, r.filename, r.size || 0);
  const old = db.prepare(`SELECT id, filename FROM deployments WHERE site_id = ? ORDER BY deployed_at DESC LIMIT -1 OFFSET ${HISTORY_KEEP}`).all(site.id);
  for (const d of old) {
    try { fs.unlinkSync(path.join(siteDir(site.id), 'history', d.filename)); } catch {}
    db.prepare('DELETE FROM deployments WHERE id = ?').run(d.id);
  }

  db.prepare("UPDATE deploy_reviews SET status = 'approved', decided_by = ?, decided_at = unixepoch(), note = ? WHERE id = ?").run(req.user.id, req.body?.note || null, r.id);
  db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)').run(site.id, site.name, 'deploy_approved', r.filename, req.user.username, site.owner_id);
  notify({ type: 'deploy_decided', title: `Your upload to ${site.name} is live`, detail: req.body?.note || `Approved by ${req.user.username}`, data: { siteId: site.id, reviewId: r.id }, siteId: site.id, admins: false, force: true });
  res.json({ ok: true, deployment_id: depId });
}));

router.post('/:id/reject', requireHumanSession, (req, res) => {
  const r = db.prepare('SELECT * FROM deploy_reviews WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Review already ${r.status}` });
  const site = db.prepare('SELECT id, name, runtime, owner_id FROM sites WHERE id = ?').get(r.site_id);
  if (site) {
    const isApp = site.runtime === 'node' || site.runtime === 'python';
    fs.rmSync(pendingDir(site.id, isApp), { recursive: true, force: true });
    try { fs.unlinkSync(path.join(siteDir(site.id), 'history', r.filename)); } catch {}
  }
  db.prepare("UPDATE deploy_reviews SET status = 'rejected', decided_by = ?, decided_at = unixepoch(), note = ? WHERE id = ?").run(req.user.id, req.body?.note || null, r.id);
  if (site) {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)').run(site.id, site.name, 'deploy_rejected', req.body?.note || r.filename, req.user.username, site.owner_id);
    notify({ type: 'deploy_decided', title: `Your upload to ${site.name} was not approved`, detail: req.body?.note || 'Contact the panel owner for details', data: { siteId: site.id, reviewId: r.id }, siteId: site.id, admins: false, force: true });
  }
  res.json({ ok: true });
});

module.exports = router;
