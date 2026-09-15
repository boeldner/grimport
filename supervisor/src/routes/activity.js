const { Router } = require('express');
const db = require('../db');
const { requireRole, authz, isPanelAdmin } = require('../auth');

const router = Router();

// GET /api/activity?limit=50&site_id=&level=
//
// The Activity nav item is NOT admin-gated in the frontend (public/app.js
// applyRoleUI / public/index.html — the "Activity" nav-item has no
// nav-admin class, unlike Domains/Settings). Editors and viewers do use
// this view. To avoid both (a) breaking that legitimate access and
// (b) leaking cross-tenant audit rows, non-admins are scoped here to
// activity for sites they hold a site_permissions grant on (same pattern
// as analytics.js GET /overview). Admins see everything, unfiltered.
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const siteId = req.query.site_id;
  const level  = req.query.level; // optional filter: info | warn | error
  const isAdmin = isPanelAdmin(req.user);
  const permittedIds = authz.accessibleSiteIds(req.user); // null for admins
  if (!isAdmin && siteId && !permittedIds.includes(siteId)) return res.status(403).json({ error: 'Forbidden' });

  let rows;
  if (isAdmin) {
    if (siteId && level) {
      rows = db.prepare('SELECT * FROM activity WHERE site_id = ? AND level = ? ORDER BY created_at DESC LIMIT ?').all(siteId, level, limit);
    } else if (siteId) {
      rows = db.prepare('SELECT * FROM activity WHERE site_id = ? ORDER BY created_at DESC LIMIT ?').all(siteId, limit);
    } else if (level) {
      rows = db.prepare('SELECT * FROM activity WHERE level = ? ORDER BY created_at DESC LIMIT ?').all(level, limit);
    } else {
      rows = db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT ?').all(limit);
    }
  } else if (permittedIds.length === 0) {
    rows = [];
  } else {
    const placeholders = permittedIds.map(() => '?').join(',');
    if (siteId && level) {
      rows = db.prepare(`SELECT * FROM activity WHERE site_id = ? AND level = ? AND site_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`).all(siteId, level, ...permittedIds, limit);
    } else if (siteId) {
      rows = db.prepare(`SELECT * FROM activity WHERE site_id = ? AND site_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`).all(siteId, ...permittedIds, limit);
    } else if (level) {
      rows = db.prepare(`SELECT * FROM activity WHERE level = ? AND site_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`).all(level, ...permittedIds, limit);
    } else {
      rows = db.prepare(`SELECT * FROM activity WHERE site_id IN (${placeholders}) ORDER BY created_at DESC LIMIT ?`).all(...permittedIds, limit);
    }
  }

  res.json(rows);
});

// GET /api/activity/export.csv — full, unfiltered audit log as CSV download.
// Admin-only: this is a cross-tenant raw dump (every site + system event),
// unlike the filtered list above. Matches the smoke-test requirement that a
// viewer/editor token gets 403 here.
router.get('/export.csv', requireRole('admin'), (req, res) => {
  const rows = db.prepare('SELECT * FROM activity ORDER BY created_at DESC').all();

  const headers = ['id', 'created_at_iso', 'level', 'actor', 'fn', 'event', 'site_name', 'site_id', 'detail', 'duration_ms'];
  const escape = v => {
    if (v == null) return '';
    const s = String(v).replace(/"/g, '""');
    return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s;
  };

  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      if (h === 'created_at_iso') return escape(new Date(r.created_at * 1000).toISOString());
      return escape(r[h === 'created_at_iso' ? 'created_at' : h]);
    }).join(',')),
  ];

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="grimport-audit-${new Date().toISOString().slice(0,10)}.csv"`);
  res.send(lines.join('\r\n'));
});

module.exports = router;
