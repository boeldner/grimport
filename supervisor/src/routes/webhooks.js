const { Router } = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { fireWebhooks } = require('../webhooks');

const router = Router();

// GET /api/settings/webhooks
router.get('/', (req, res) => {
  const rows = db.prepare('SELECT * FROM webhooks ORDER BY created_at DESC').all();
  res.json(rows.map(r => ({ ...r, events: JSON.parse(r.events), enabled: !!r.enabled })));
});

// POST /api/settings/webhooks
router.post('/', (req, res) => {
  const { name, url, events } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  if (!url?.trim()) return res.status(400).json({ error: 'url required' });
  const evts = Array.isArray(events)
    ? events
    : ['deploy', 'rollback', 'site_down', 'site_up'];

  const id = nanoid(10);
  db.prepare('INSERT INTO webhooks (id, name, url, events) VALUES (?, ?, ?, ?)')
    .run(id, name.trim(), url.trim(), JSON.stringify(evts));
  res.json({ id, name: name.trim(), url: url.trim(), events: evts, enabled: true });
});

// PATCH /api/settings/webhooks/:id — toggle enabled
router.patch('/:id', (req, res) => {
  const { enabled } = req.body;
  db.prepare('UPDATE webhooks SET enabled = ? WHERE id = ?')
    .run(enabled ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

// DELETE /api/settings/webhooks/:id
router.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM webhooks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// POST /api/settings/webhooks/:id/test — send a test payload
router.post('/:id/test', async (req, res) => {
  const wh = db.prepare('SELECT * FROM webhooks WHERE id = ?').get(req.params.id);
  if (!wh) return res.status(404).json({ error: 'Not found' });
  await fireWebhooks('deploy', 'test-site-id', 'Test Site', 'test-webhook-ping.zip');
  res.json({ ok: true });
});

module.exports = router;
