const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-push-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const push = require('../src/push');
const { notify } = require('../src/notify');

const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('pw', 4);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status) VALUES ('u-admin', 'boss', ?, 'admin', 'owner', '{}', 'active')`).run(hash);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status) VALUES ('u-carla', 'carla', ?, 'editor', 'member', '{}', 'active')`).run(hash);
db.prepare(`INSERT INTO sites (id, name, domain, owner_id) VALUES ('s-c', 'Carla site', 'c.test', 'u-carla')`).run();

function addSub(id, userId, events, endpoint = `https://push.example/${id}`) {
  db.prepare('INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth, events, label) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, userId, endpoint, 'p', 'a', events === null ? null : JSON.stringify(events), id);
}

let sent = [];
let failWith = null;
push._deps.send = async (subscription, payload) => {
  if (failWith && failWith.endpoints.includes(subscription.endpoint)) { const e = new Error('gone'); e.statusCode = failWith.code; throw e; }
  sent.push({ endpoint: subscription.endpoint, payload: JSON.parse(payload) });
};

test('vapid keys are generated once and persisted', () => {
  const a = push.vapidKeys();
  const b = push.vapidKeys();
  assert.strictEqual(a.publicKey, b.publicKey);
  assert.strictEqual(db.prepare("SELECT value FROM settings WHERE key = 'vapid_public'").get().value, a.publicKey);
  assert.match(push.vapidSubject(), /^(mailto:|https:\/\/)/);
});

test('wants() honours event groups, urlFor() points at the right view', () => {
  assert.strictEqual(push.wants({ events: null }, 'site_down'), true);
  assert.strictEqual(push.wants({ events: '["deploys"]' }, 'site_down'), false);
  assert.strictEqual(push.wants({ events: '["deploys"]' }, 'deploy_review'), true);
  assert.strictEqual(push.wants({ events: '[]' }, 'something_new'), true, 'unknown types always go through');
  assert.strictEqual(push.urlFor('deploy_review', {}), '/?view=domains');
  assert.strictEqual(push.urlFor('site_down', {}), '/?view=sites');
  assert.strictEqual(push.urlFor('custom', {}), '/');
  assert.strictEqual(push.isValidGroups(['deploys', 'account']), true);
  assert.strictEqual(push.isValidGroups(['nope']), false);
});

test('fanout delivers to explicit users and admins, filtered per device, and prunes dead endpoints', async () => {
  addSub('d-admin', 'u-admin', null);
  addSub('d-admin-deploys', 'u-admin', ['deploys']);
  addSub('d-carla', 'u-carla', ['availability', 'deploys']);
  addSub('d-dead', 'u-carla', null);
  sent = [];
  failWith = { endpoints: ['https://push.example/d-dead'], code: 410 };

  const r = await push.fanout({ type: 'site_down', title: 'Carla site is down', detail: 'No response', data: { siteId: 's-c' }, userIds: ['u-carla'], admins: true });
  assert.deepStrictEqual(r, { sent: 2, failed: 1 });
  const endpoints = sent.map(s => s.endpoint).sort();
  assert.deepStrictEqual(endpoints, ['https://push.example/d-admin', 'https://push.example/d-carla']);
  assert.strictEqual(sent[0].payload.url, '/?view=sites');
  assert.strictEqual(sent[0].payload.tag, 'site_down:s-c');
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM push_subscriptions WHERE id = 'd-dead'").get().c, 0, '410 removes the subscription');
  assert.ok(db.prepare("SELECT last_used FROM push_subscriptions WHERE id = 'd-carla'").get().last_used > 0);

  failWith = null;
  sent = [];
  await push.fanout({ type: 'deploy_review', title: 'held', userIds: [], admins: true });
  assert.deepStrictEqual(sent.map(s => s.endpoint).sort(), ['https://push.example/d-admin', 'https://push.example/d-admin-deploys']);

  // notify() triggers the same fan-out without the caller waiting for it.
  sent = [];
  notify({ type: 'site_up', title: 'back', detail: 'ok', data: { siteId: 's-c' }, siteId: 's-c', force: true });
  await new Promise(r => setTimeout(r, 50));
  assert.deepStrictEqual(sent.map(s => s.endpoint).sort(), ['https://push.example/d-admin', 'https://push.example/d-carla']);
});

test('repeated transient failures eventually drop a device', async () => {
  addSub('d-flaky', 'u-carla', null);
  failWith = { endpoints: ['https://push.example/d-flaky'], code: 500 };
  for (let i = 0; i < 8; i++) await push.sendOne(db.prepare("SELECT * FROM push_subscriptions WHERE id = 'd-flaky'").get(), { title: 'x' });
  assert.strictEqual(db.prepare("SELECT COUNT(*) c FROM push_subscriptions WHERE id = 'd-flaky'").get().c, 0);
  failWith = null;
});

test('push routes: subscribe, list, update, test, unsubscribe', async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/push', (req, res, next) => { req.user = { id: 'u-carla', role: 'editor', username: 'carla' }; next(); }, require('../src/routes/push'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api/push`;
  const j = (method, p, body) => fetch(base + p, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined }).then(async r => ({ status: r.status, data: await r.json() }));
  try {
    const key = await j('GET', '/vapid-key');
    assert.strictEqual(key.data.publicKey, push.vapidKeys().publicKey);
    assert.ok(key.data.groups.deploys);

    const bad = await j('POST', '/subscribe', { subscription: { endpoint: 'http://insecure', keys: { p256dh: 'p', auth: 'a' } } });
    assert.strictEqual(bad.status, 400);
    const badGroups = await j('POST', '/subscribe', { subscription: { endpoint: 'https://push.example/phone', keys: { p256dh: 'p', auth: 'a' } }, events: ['nope'] });
    assert.strictEqual(badGroups.status, 400);

    const created = await j('POST', '/subscribe', { subscription: { endpoint: 'https://push.example/phone', keys: { p256dh: 'p1', auth: 'a1' } }, events: ['availability'], label: 'iPhone' });
    assert.strictEqual(created.status, 201);
    assert.deepStrictEqual(created.data.events, ['availability']);
    assert.strictEqual(created.data.label, 'iPhone');
    assert.strictEqual(created.data.endpoint_host, 'push.example');

    const again = await j('POST', '/subscribe', { subscription: { endpoint: 'https://push.example/phone', keys: { p256dh: 'p2', auth: 'a2' } } });
    assert.strictEqual(again.status, 200, 'same endpoint upserts');
    assert.strictEqual(again.data.id, created.data.id);
    assert.strictEqual(again.data.events, null);
    assert.strictEqual(again.data.label, 'iPhone');

    const list = await j('GET', '/subscriptions');
    assert.ok(list.data.some(d => d.id === created.data.id));
    assert.ok(list.data.every(d => d.user_id === 'u-carla'));

    const upd = await j('PUT', `/subscriptions/${created.data.id}`, { events: ['deploys', 'account'], label: 'Phone' });
    assert.deepStrictEqual(upd.data.events, ['deploys', 'account']);
    assert.strictEqual(upd.data.label, 'Phone');
    assert.strictEqual((await j('PUT', '/subscriptions/nope', { events: null })).status, 404);

    sent = [];
    const t = await j('POST', '/test', { endpoint: 'https://push.example/phone' });
    assert.strictEqual(t.data.sent, 1);
    assert.strictEqual(sent[0].payload.type, 'test');

    const un = await j('POST', '/unsubscribe', { endpoint: 'https://push.example/phone' });
    assert.strictEqual(un.data.removed, 1);
    assert.strictEqual((await j('DELETE', `/subscriptions/${created.data.id}`)).status, 404);
    assert.strictEqual((await j('POST', '/test', { endpoint: 'https://push.example/none' })).status, 404, 'no such device');
  } finally { server.close(); }
});
