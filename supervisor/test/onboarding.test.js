const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');

// Isolated DB per test file (see test/users-password.test.js for the same
// pattern): point DATA_PATH at a fresh temp dir before requiring db.js so
// this file's better-sqlite3 instance never touches the real database.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-onboarding-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');
process.env.SUPERVISOR_SECRET = 'smoketest123';

const db = require('../src/db');
const { sessionMiddleware } = require('../src/auth');
const authRouter = require('../src/routes/auth');
const settingsRouter = require('../src/routes/settings');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
  // Settings router is normally gated by requireAuth + requireRole('admin')
  // at the mount in index.js — stand that in here since we only need the
  // onboarding_done get/set behaviour, not full auth.
  app.use('/api/settings', (req, res, next) => { req.user = { id: 'x', role: 'admin' }; next(); }, settingsRouter);
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

// Log in and return the session cookie header value for subsequent requests.
async function loginAndGetCookie(base, password) {
  const res = await fetch(`${base}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password }),
  });
  assert.strictEqual(res.status, 200, 'login should succeed');
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie, 'login must set a session cookie');
  return setCookie.split(';')[0];
}

test('GET /api/auth/me flags needsOnboarding for a fresh install (seeded password, no base domain)', async () => {
  db.prepare("DELETE FROM settings WHERE key IN ('onboarding_done', 'site_base_domain')").run();
  // Reseed base domain empty (db.js only seeds once at require time).
  db.prepare("INSERT INTO settings (key, value) VALUES ('site_base_domain', '')").run();

  const app = makeApp();
  await withServer(app, async (base) => {
    const cookie = await loginAndGetCookie(base, 'smoketest123'); // SUPERVISOR_SECRET seeded password

    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } }).then(r => r.json());
    assert.strictEqual(me.authenticated, true);
    assert.strictEqual(me.role, 'admin');
    assert.strictEqual(me.needsOnboarding, true, 'fresh install must need onboarding');
  });
});

test('onboarding_done setting suppresses needsOnboarding even on the seeded password', async () => {
  db.prepare("INSERT INTO settings (key, value) VALUES ('onboarding_done', '1') ON CONFLICT(key) DO UPDATE SET value = '1'").run();

  const app = makeApp();
  await withServer(app, async (base) => {
    const cookie = await loginAndGetCookie(base, 'smoketest123');
    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } }).then(r => r.json());
    assert.strictEqual(me.needsOnboarding, false, 'dismissed wizard must never come back');
  });
});

test('needsOnboarding is false once password is changed and a base domain is set', async () => {
  db.prepare("DELETE FROM settings WHERE key = 'onboarding_done'").run();
  db.prepare("INSERT INTO settings (key, value) VALUES ('site_base_domain', 'grim.host') ON CONFLICT(key) DO UPDATE SET value = 'grim.host'").run();
  const newHash = bcrypt.hashSync('a-real-password', 12);
  db.prepare("UPDATE users SET password_hash = ? WHERE role = 'admin'").run(newHash);

  const app = makeApp();
  await withServer(app, async (base) => {
    const cookie = await loginAndGetCookie(base, 'a-real-password');
    const me = await fetch(`${base}/api/auth/me`, { headers: { Cookie: cookie } }).then(r => r.json());
    assert.strictEqual(me.needsOnboarding, false, 'password changed + base domain set = fully configured');
  });
});

test('PUT /api/settings onboarding_done persists and GET /api/settings reflects it', async () => {
  db.prepare("DELETE FROM settings WHERE key = 'onboarding_done'").run();

  const app = makeApp();
  await withServer(app, async (base) => {
    let get = await fetch(`${base}/api/settings`).then(r => r.json());
    assert.strictEqual(get.onboarding_done, false);

    const put = await fetch(`${base}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_done: true }),
    });
    assert.strictEqual(put.status, 200);

    get = await fetch(`${base}/api/settings`).then(r => r.json());
    assert.strictEqual(get.onboarding_done, true);
  });
});
