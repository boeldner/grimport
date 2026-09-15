const { Router } = require('express');
const db = require('../db');
const { isPanelAdmin } = require('../auth');
const { getEnabledEvents } = require('../notification-prefs');

const router = Router();

// Notifications are per user since 0.12: rows with user_id = me, plus rows
// with user_id NULL for panel admins. Everyone manages their own rows.
function scope(req) {
  return isPanelAdmin(req.user)
    ? { sql: '(user_id = ? OR user_id IS NULL)', params: [req.user.id] }
    : { sql: 'user_id = ?', params: [req.user.id] };
}

// GET /api/notifications
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const enabledTypes = getEnabledEvents();
  const sc = scope(req);
  // Bell preferences only gate the three classic event types; everything else
  // (support actions, domain requests, suspensions) is always shown.
  const classic = ['unknown_domain', 'site_down', 'site_up'];
  const hidden = classic.filter(t => !enabledTypes.includes(t));
  const typeSql = hidden.length ? `AND type NOT IN (${hidden.map(() => '?').join(',')})` : '';
  const rows = db.prepare(
    `SELECT id, type, title, detail, data, read, created_at, user_id
     FROM notifications WHERE ${sc.sql} ${typeSql}
     ORDER BY created_at DESC LIMIT ?`
  ).all(...sc.params, ...hidden, limit);
  const unread = db.prepare(`SELECT COUNT(*) AS n FROM notifications WHERE ${sc.sql} AND read = 0 ${typeSql}`).get(...sc.params, ...hidden).n;
  res.json({
    unread,
    notifications: rows.map(r => ({ ...r, data: r.data ? JSON.parse(r.data) : null, read: !!r.read })),
  });
});

router.post('/:id/read', (req, res) => {
  const sc = scope(req);
  db.prepare(`UPDATE notifications SET read = 1 WHERE id = ? AND ${sc.sql}`).run(req.params.id, ...sc.params);
  res.json({ ok: true });
});

router.post('/read-all', (req, res) => {
  const sc = scope(req);
  db.prepare(`UPDATE notifications SET read = 1 WHERE ${sc.sql}`).run(...sc.params);
  res.json({ ok: true });
});

router.delete('/', (req, res) => {
  const sc = scope(req);
  db.prepare(`DELETE FROM notifications WHERE ${sc.sql}`).run(...sc.params);
  res.json({ ok: true });
});

router.delete('/:id', (req, res) => {
  const sc = scope(req);
  db.prepare(`DELETE FROM notifications WHERE id = ? AND ${sc.sql}`).run(req.params.id, ...sc.params);
  res.json({ ok: true });
});

module.exports = router;
