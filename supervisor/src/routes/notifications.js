const { Router } = require('express');
const db = require('../db');
const { requireRole } = require('../auth');
const { getEnabledEvents } = require('../notification-prefs');

const router = Router();

// The bell (public/index.html #btn-bell) has no nav-admin/admin-only class,
// so editors/viewers see and use it. GET stays open to any authenticated
// user; the mutating routes below are admin-only since notifications are a
// shared, un-scoped (no site_id) global feed and mutations here affect the
// feed for every user.

// GET /api/notifications — recent notifications (read + unread)
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  // Filter by enabled event types (setting: notification_events JSON array)
  const enabledTypes = getEnabledEvents();

  let rows;
  if (enabledTypes.length === 0) {
    rows = [];
  } else if (enabledTypes.length < 3) {
    const placeholders = enabledTypes.map(() => '?').join(',');
    rows = db.prepare(
      `SELECT id, type, title, detail, data, read, created_at
       FROM notifications
       WHERE type IN (${placeholders})
       ORDER BY created_at DESC LIMIT ?`
    ).all(...enabledTypes, limit);
  } else {
    rows = db.prepare(
      `SELECT id, type, title, detail, data, read, created_at
       FROM notifications
       ORDER BY created_at DESC LIMIT ?`
    ).all(limit);
  }

  const unread = db.prepare('SELECT COUNT(*) AS n FROM notifications WHERE read = 0').get().n;

  res.json({
    unread,
    notifications: rows.map(r => ({
      ...r,
      data: r.data ? JSON.parse(r.data) : null,
      read: !!r.read,
    })),
  });
});

// POST /api/notifications/:id/read — mark one read (admin only)
router.post('/:id/read', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/notifications/read-all (admin only)
router.post('/read-all', requireRole('admin'), (req, res) => {
  db.prepare('UPDATE notifications SET read = 1').run();
  res.json({ ok: true });
});

// DELETE /api/notifications — clear all (admin only)
router.delete('/', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM notifications').run();
  res.json({ ok: true });
});

// DELETE /api/notifications/:id (admin only)
router.delete('/:id', requireRole('admin'), (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
