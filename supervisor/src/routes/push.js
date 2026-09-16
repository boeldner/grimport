/**
 * Per-device web push subscriptions of the signed-in user.
 *   GET    /api/push/vapid-key            public key + event groups
 *   GET    /api/push/subscriptions        this user's devices
 *   POST   /api/push/subscribe            { subscription, events?, label? } upsert by endpoint
 *   PUT    /api/push/subscriptions/:id    { events?, label? }
 *   DELETE /api/push/subscriptions/:id
 *   POST   /api/push/unsubscribe          { endpoint }
 *   POST   /api/push/test                 { endpoint? }
 */
const { Router } = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireHumanSession } = require('../auth');
const { asyncHandler } = require('../async-handler');
const push = require('../push');

const router = Router();
router.use(requireHumanSession);

const MAX_DEVICES = 20;

function parseGroups(events) {
  if (events === undefined) return undefined;
  if (events === null) return null;
  if (!push.isValidGroups(events)) throw Object.assign(new Error('events must be null or a list of known groups'), { status: 400 });
  return events;
}

router.get('/vapid-key', (req, res) => {
  res.json({ publicKey: push.vapidKeys().publicKey, groups: push.PUSH_EVENT_GROUPS });
});

router.get('/subscriptions', (req, res) => {
  res.json(push.listForUser(req.user.id));
});

router.post('/subscribe', (req, res) => {
  const { subscription, events, label } = req.body || {};
  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const auth = subscription?.keys?.auth;
  if (typeof endpoint !== 'string' || !/^https:\/\//i.test(endpoint) || endpoint.length > 2048) return res.status(400).json({ error: 'subscription.endpoint must be an https URL' });
  if (typeof p256dh !== 'string' || typeof auth !== 'string' || !p256dh || !auth) return res.status(400).json({ error: 'subscription.keys.p256dh and .auth are required' });
  let groups;
  try { groups = parseGroups(events); } catch (e) { return res.status(400).json({ error: e.message }); }
  const eventsJson = groups === undefined || groups === null ? null : JSON.stringify(groups);
  const ua = String(req.headers['user-agent'] || '').slice(0, 200);
  const lbl = label ? String(label).slice(0, 60) : null;

  const existing = db.prepare('SELECT * FROM push_subscriptions WHERE endpoint = ?').get(endpoint);
  if (existing) {
    // Same browser re-subscribing (keys can rotate) or a device handed to
    // another account: the endpoint follows whoever signs in on it.
    db.prepare('UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ?, events = ?, label = COALESCE(?, label), user_agent = ?, failures = 0 WHERE id = ?')
      .run(req.user.id, p256dh, auth, eventsJson, lbl, ua, existing.id);
    return res.json(push.shape(db.prepare('SELECT * FROM push_subscriptions WHERE id = ?').get(existing.id)));
  }
  const count = db.prepare('SELECT COUNT(*) AS c FROM push_subscriptions WHERE user_id = ?').get(req.user.id).c;
  if (count >= MAX_DEVICES) return res.status(409).json({ error: `Device limit reached (${MAX_DEVICES}); remove an old device first` });
  const id = nanoid(10);
  db.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, events, label, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, req.user.id, endpoint, p256dh, auth, eventsJson, lbl, ua);
  res.status(201).json(push.shape(db.prepare('SELECT * FROM push_subscriptions WHERE id = ?').get(id)));
});

router.put('/subscriptions/:id', (req, res) => {
  const row = db.prepare('SELECT * FROM push_subscriptions WHERE id = ? AND user_id = ?').get(req.params.id, req.user.id);
  if (!row) return res.status(404).json({ error: 'Device not found' });
  const { events, label } = req.body || {};
  let groups;
  try { groups = parseGroups(events); } catch (e) { return res.status(400).json({ error: e.message }); }
  if (groups !== undefined) db.prepare('UPDATE push_subscriptions SET events = ? WHERE id = ?').run(groups === null ? null : JSON.stringify(groups), row.id);
  if (label !== undefined) db.prepare('UPDATE push_subscriptions SET label = ? WHERE id = ?').run(label ? String(label).slice(0, 60) : null, row.id);
  res.json(push.shape(db.prepare('SELECT * FROM push_subscriptions WHERE id = ?').get(row.id)));
});

router.delete('/subscriptions/:id', (req, res) => {
  const r = db.prepare('DELETE FROM push_subscriptions WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: 'Device not found' });
});

router.post('/unsubscribe', (req, res) => {
  const endpoint = req.body?.endpoint;
  if (typeof endpoint !== 'string') return res.status(400).json({ error: 'endpoint required' });
  const r = db.prepare('DELETE FROM push_subscriptions WHERE endpoint = ? AND user_id = ?').run(endpoint, req.user.id);
  res.json({ ok: true, removed: r.changes });
});

router.post('/test', asyncHandler(async (req, res) => {
  const endpoint = typeof req.body?.endpoint === 'string' ? req.body.endpoint : null;
  const result = await push.sendTest(req.user.id, endpoint);
  if (!result.sent && !result.failed) return res.status(404).json({ error: 'No subscribed device' });
  res.json(result);
}));

module.exports = router;
