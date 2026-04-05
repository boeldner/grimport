const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/notifications — recent notifications (read + unread)
router.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);

  // Filter by enabled event types (setting: notification_events JSON array)
  let enabledTypes = null;
  try {
    const raw = db.prepare("SELECT value FROM settings WHERE key = 'notification_events'").get()?.value;
    if (raw) enabledTypes = JSON.parse(raw);
  } catch {}

  let rows;
  if (enabledTypes && enabledTypes.length < 3) {
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

// POST /api/notifications/:id/read — mark one read
router.post('/:id/read', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/notifications/read-all
router.post('/read-all', (req, res) => {
  db.prepare('UPDATE notifications SET read = 1').run();
  res.json({ ok: true });
});

// DELETE /api/notifications — clear all
router.delete('/', (req, res) => {
  db.prepare('DELETE FROM notifications').run();
  res.json({ ok: true });
});

// DELETE /api/notifications/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM notifications WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

module.exports = router;
