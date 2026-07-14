const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-notifprefs-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const settingsRouter = require('../src/routes/settings');
const { eventEnabled, getEnabledEvents } = require('../src/notification-prefs');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'admin1', role: 'admin', username: 'admin' }; next(); });
  app.use('/api/settings', settingsRouter);
  return app;
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('notification-events: defaults to all three types enabled when nothing is saved yet', () => {
  db.prepare("DELETE FROM settings WHERE key = 'notification_events'").run();
  assert.deepStrictEqual(getEnabledEvents(), ['unknown_domain', 'site_down', 'site_up']);
  assert.strictEqual(eventEnabled('site_down'), true);
});

test('PUT /api/settings/notification-events saves prefs, GET reads them back, and producers respect them', async () => {
  const app = makeApp();
  await withServer(app, async (base) => {
    const put = await fetch(`${base}/api/settings/notification-events`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['unknown_domain', 'site_up'] }),
    });
    assert.strictEqual(put.status, 200);

    const get = await fetch(`${base}/api/settings/notification-events`);
    const body = await get.json();
    assert.deepStrictEqual(body.events.sort(), ['site_up', 'unknown_domain']);
  });

  // The producers (catchall.js, uptime.js) gate on this same setting via
  // notification-prefs.eventEnabled — verify the disabled type is filtered
  // and the enabled ones pass.
  assert.strictEqual(eventEnabled('site_down'), false, 'site_down was not in the saved list');
  assert.strictEqual(eventEnabled('unknown_domain'), true);
  assert.strictEqual(eventEnabled('site_up'), true);
});

test('PUT /api/settings/notification-events rejects unknown event types', async () => {
  const app = makeApp();
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/settings/notification-events`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: ['not_a_real_event'] }),
    });
    assert.strictEqual(res.status, 400);
  });
});
