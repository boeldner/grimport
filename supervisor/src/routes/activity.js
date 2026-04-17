const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/activity?limit=50&site_id=&level=
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const siteId = req.query.site_id;
  const level  = req.query.level; // optional filter: info | warn | error

  let rows;
  if (siteId && level) {
    rows = db.prepare('SELECT * FROM activity WHERE site_id = ? AND level = ? ORDER BY created_at DESC LIMIT ?').all(siteId, level, limit);
  } else if (siteId) {
    rows = db.prepare('SELECT * FROM activity WHERE site_id = ? ORDER BY created_at DESC LIMIT ?').all(siteId, limit);
  } else if (level) {
    rows = db.prepare('SELECT * FROM activity WHERE level = ? ORDER BY created_at DESC LIMIT ?').all(level, limit);
  } else {
    rows = db.prepare('SELECT * FROM activity ORDER BY created_at DESC LIMIT ?').all(limit);
  }

  res.json(rows);
});

// GET /api/activity/export.csv — full audit log as CSV download (admin only)
router.get('/export.csv', (req, res) => {
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
