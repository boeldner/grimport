/**
 * Custom domain requests (panel admins decide). Approving applies the domain
 * to the site and recreates its Traefik router; rejecting leaves a note.
 */
const { Router } = require('express');
const db = require('../db');
const { requireRole, requireHumanSession } = require('../auth');
const { asyncHandler } = require('../async-handler');
const { applySiteSettings } = require('../docker');
const { parseSiteForContainer } = require('../site-model');
const { notify } = require('../notify');
const { isValidHostname } = require('../validate');

const router = Router();
router.use(requireRole('admin'));

function rows(where = '', params = []) {
  return db.prepare(
    `SELECT r.*, s.name AS site_name, s.domain AS current_domain, s.owner_id, u.username AS requested_by_name
     FROM domain_requests r JOIN sites s ON s.id = r.site_id LEFT JOIN users u ON u.id = r.requested_by
     ${where} ORDER BY r.created_at DESC`
  ).all(...params);
}

// GET /api/domains/requests?status=pending
router.get('/requests', (req, res) => {
  const status = req.query.status;
  res.json(status ? rows('WHERE r.status = ?', [status]) : rows());
});

router.post('/requests/:id/approve', requireHumanSession, asyncHandler(async (req, res) => {
  const r = db.prepare('SELECT * FROM domain_requests WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Request already ${r.status}` });
  if (!isValidHostname(r.domain)) return res.status(400).json({ error: 'Invalid domain' });
  if (db.prepare('SELECT 1 FROM sites WHERE domain = ? AND id != ?').get(r.domain, r.site_id)) return res.status(409).json({ error: 'Domain already in use' });
  const site = db.prepare('SELECT * FROM sites WHERE id = ?').get(r.site_id);
  if (!site) return res.status(404).json({ error: 'Site no longer exists' });

  db.prepare('UPDATE sites SET domain = ? WHERE id = ?').run(r.domain, site.id);
  const updated = db.prepare('SELECT * FROM sites WHERE id = ?').get(site.id);
  const newId = await applySiteSettings(parseSiteForContainer(updated));
  if (newId) db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newId, site.id);
  db.prepare("UPDATE domain_requests SET status = 'approved', decided_by = ?, decided_at = unixepoch(), note = ? WHERE id = ?").run(req.user.id, req.body?.note || null, r.id);
  db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)').run(site.id, site.name, 'domain_approved', r.domain, req.user.username, site.owner_id);
  notify({ type: 'domain_decided', title: `${r.domain} approved for ${site.name}`, detail: req.body?.note || 'Point the DNS record at this server if you have not yet', data: { siteId: site.id }, siteId: site.id, admins: false, force: true });
  res.json({ ok: true, domain: r.domain });
}));

router.post('/requests/:id/reject', requireHumanSession, (req, res) => {
  const r = db.prepare('SELECT * FROM domain_requests WHERE id = ?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  if (r.status !== 'pending') return res.status(409).json({ error: `Request already ${r.status}` });
  const site = db.prepare('SELECT id, name, owner_id FROM sites WHERE id = ?').get(r.site_id);
  db.prepare("UPDATE domain_requests SET status = 'rejected', decided_by = ?, decided_at = unixepoch(), note = ? WHERE id = ?").run(req.user.id, req.body?.note || null, r.id);
  if (site) {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)').run(site.id, site.name, 'domain_rejected', r.domain, req.user.username, site.owner_id);
    notify({ type: 'domain_decided', title: `${r.domain} was not approved for ${site.name}`, detail: req.body?.note || null, data: { siteId: site.id }, siteId: site.id, admins: false, force: true });
  }
  res.json({ ok: true });
});

module.exports = router;
