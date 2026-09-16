const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-me-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const { requireAuth } = require('../src/auth');
const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('pw', 4);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status) VALUES ('u-admin', 'boss', ?, 'admin', 'owner', '{}', 'active')`).run(hash);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status, display_name) VALUES ('u-carla', 'carla', ?, 'editor', 'member', '{}', 'active', 'Carla')`).run(hash);
db.prepare(`INSERT INTO sites (id, name, domain, owner_id) VALUES ('s-c', 'Carla site', 'c.test', 'u-carla')`).run();
db.prepare(`INSERT INTO sites (id, name, domain, owner_id) VALUES ('s-a', 'Admin site', 'a.test', 'u-admin')`).run();
db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('site_base_domain', 'sites.test')`).run();

function token(userId, role) {
  const t = `grim_${crypto.randomBytes(16).toString('hex')}`;
  db.prepare('INSERT INTO api_tokens (id, name, token_hash, role, site_scope, user_id) VALUES (?, ?, ?, ?, NULL, ?)')
    .run(`t-${userId}`, 'test', crypto.createHash('sha256').update(t).digest('hex'), role, userId);
  return t;
}

async function withApp(fn) {
  const app = express();
  app.use('/api/me', requireAuth, require('../src/routes/me'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try { await fn(`http://127.0.0.1:${server.address().port}`); } finally { server.close(); }
}

test('GET /api/me describes a member token: quota, base domain, accessible sites', async () => {
  const t = token('u-carla', 'editor');
  await withApp(async base => {
    const res = await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${t}` } });
    assert.strictEqual(res.status, 200);
    const me = await res.json();
    assert.strictEqual(me.auth.kind, 'token');
    assert.strictEqual(me.auth.token_id, 't-u-carla');
    assert.deepStrictEqual(me.user, { id: 'u-carla', username: 'carla', display_name: 'Carla' });
    assert.strictEqual(me.platform_role, 'member');
    assert.strictEqual(me.role, 'editor');
    assert.deepStrictEqual(me.capabilities.runtimes, ['static']);
    assert.strictEqual(me.capabilities.max_sites, 3);
    assert.deepStrictEqual(me.quota, { sites_used: 1, sites_max: 3, sites_left: 2 });
    assert.strictEqual(me.site_base_domain, 'sites.test');
    assert.strictEqual(me.automatic_subdomain, '<slug>.sites.test');
    assert.deepStrictEqual(me.accessible_site_ids, ['s-c']);
    assert.match(me.mcp_endpoint, /\/mcp$/);
  });
});

test('GET /api/me for an admin token reports unlimited quota and every site', async () => {
  const t = token('u-admin', 'admin');
  await withApp(async base => {
    const me = await (await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${t}` } })).json();
    assert.strictEqual(me.platform_role, 'owner');
    assert.strictEqual(me.capabilities.max_sites, null);
    assert.strictEqual(me.quota.sites_max, null);
    assert.strictEqual(me.quota.sites_used, 1);
    assert.strictEqual(me.accessible_site_ids, null);
    const anon = await fetch(`${base}/api/me`);
    assert.strictEqual(anon.status, 401);
  });
});
