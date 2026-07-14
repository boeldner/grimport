const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

// Isolated DB per test file (see test/session-store-migration.test.js for the
// same pattern): point DATA_PATH at a fresh temp dir before requiring db.js
// so this file's better-sqlite3 instance never touches the real database.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-tokens-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const { requireAuth, requireSiteAccess } = require('../src/auth');
const settingsRouter = require('../src/routes/settings');

db.prepare('INSERT INTO sites (id, name, domain) VALUES (?, ?, ?)').run('site1', 'Site One', 'site1.example.com');
db.prepare('INSERT INTO sites (id, name, domain) VALUES (?, ?, ?)').run('site2', 'Site Two', 'site2.example.com');

function makeApp() {
  const app = express();
  app.use(express.json());
  // Settings routes are admin-only in production (mounted behind requireRole('admin')
  // in index.js) — simulate that here with a fixed admin session user.
  app.use('/api/settings', (req, res, next) => { req.user = { id: 'admin1', role: 'admin', username: 'admin' }; next(); }, settingsRouter);
  // A representative per-site route, protected the same way real site routes are.
  app.get('/api/site/:id', requireAuth, requireSiteAccess('id'), (req, res) => {
    res.json({ ok: true, role: req.user.role });
  });
  return app;
}

async function withServer(fn) {
  const app = makeApp();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

async function createToken(base, body) {
  const res = await fetch(`${base}/api/settings/tokens`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const json = await res.json();
  return { status: res.status, body: json };
}

test('POST /api/settings/tokens creates a token with role, site_scope, and expires_at', async () => {
  await withServer(async (base) => {
    const { status, body } = await createToken(base, {
      name: 'ci-scoped',
      role: 'editor',
      site_scope: ['site1'],
      expires_in_days: 30,
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.role, 'editor');
    assert.deepStrictEqual(body.site_scope, ['site1']);
    assert.ok(body.expires_at > Math.floor(Date.now() / 1000));
    assert.ok(body.token.startsWith('grim_'));

    const list = await fetch(`${base}/api/settings/tokens`).then(r => r.json());
    const row = list.find(t => t.id === body.id);
    assert.strictEqual(row.role, 'editor');
    assert.deepStrictEqual(row.site_scope, ['site1']);
    assert.ok(row.expires_at);
  });
});

test('POST /api/settings/tokens rejects an unknown site id in site_scope', async () => {
  await withServer(async (base) => {
    const { status, body } = await createToken(base, { name: 'bad', site_scope: ['nope'] });
    assert.strictEqual(status, 400);
    assert.match(body.error, /unknown site/);
  });
});

test('POST /api/settings/tokens rejects a non-positive expires_in_days', async () => {
  await withServer(async (base) => {
    const { status } = await createToken(base, { name: 'bad', expires_in_days: -5 });
    assert.strictEqual(status, 400);
  });
});

test('POST /api/settings/tokens with no site_scope/expiry defaults to unrestricted, never-expiring (back-compat)', async () => {
  await withServer(async (base) => {
    const { status, body } = await createToken(base, { name: 'classic' });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.site_scope, 'all');
    assert.strictEqual(body.expires_at, null);
  });
});

test('expired token is rejected with 401', async () => {
  await withServer(async (base) => {
    const { body } = await createToken(base, { name: 'short-lived', expires_in_days: 30 });
    // Force it into the past directly (route only allows positive future expiries).
    db.prepare('UPDATE api_tokens SET expires_at = ? WHERE id = ?').run(Math.floor(Date.now() / 1000) - 10, body.id);

    const res = await fetch(`${base}/api/site/site1`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.strictEqual(res.status, 401);
    const json = await res.json();
    assert.match(json.error, /expired/i);
  });
});

test('site-scoped token is allowed on its site and forbidden on another site', async () => {
  await withServer(async (base) => {
    const { body } = await createToken(base, { name: 'scoped', role: 'admin', site_scope: ['site1'] });

    const okRes = await fetch(`${base}/api/site/site1`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.strictEqual(okRes.status, 200);

    const forbiddenRes = await fetch(`${base}/api/site/site2`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.strictEqual(forbiddenRes.status, 403);
  });
});

test('unscoped token (site_scope "all") works on any site', async () => {
  await withServer(async (base) => {
    const { body } = await createToken(base, { name: 'unscoped', role: 'admin', site_scope: 'all' });

    const res1 = await fetch(`${base}/api/site/site1`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.strictEqual(res1.status, 200);
    const res2 = await fetch(`${base}/api/site/site2`, { headers: { Authorization: `Bearer ${body.token}` } });
    assert.strictEqual(res2.status, 200);
  });
});

test('back-compat: a legacy token row with NULL site_scope/expires_at behaves as before (full access, never expires)', async () => {
  await withServer(async (base) => {
    const crypto = require('crypto');
    const legacyToken = 'grim_legacylegacylegacylegacylegacy';
    const hash = crypto.createHash('sha256').update(legacyToken).digest('hex');
    db.prepare('INSERT INTO api_tokens (id, name, token_hash, role) VALUES (?, ?, ?, ?)')
      .run('legacy1', 'legacy', hash, 'admin');
    // site_scope and expires_at are NULL by default — never explicitly set.

    const res1 = await fetch(`${base}/api/site/site1`, { headers: { Authorization: `Bearer ${legacyToken}` } });
    assert.strictEqual(res1.status, 200);
    const res2 = await fetch(`${base}/api/site/site2`, { headers: { Authorization: `Bearer ${legacyToken}` } });
    assert.strictEqual(res2.status, 200);
  });
});
