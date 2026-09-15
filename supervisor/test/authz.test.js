const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const { createAuthz, effectiveCapabilities, legacyRoleFor, isPanelAdmin, PRESETS } = require('../src/authz');
const { createInvitations } = require('../src/invitations');

function makeDb() {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE users (id TEXT PRIMARY KEY, username TEXT, password_hash TEXT, role TEXT, platform_role TEXT, capabilities TEXT DEFAULT '{}', status TEXT DEFAULT 'active', display_name TEXT, invited_by TEXT, created_at INTEGER DEFAULT 0);
    CREATE TABLE sites (id TEXT PRIMARY KEY, name TEXT, owner_id TEXT, status TEXT DEFAULT 'active');
    CREATE TABLE site_members (site_id TEXT, user_id TEXT, site_role TEXT, added_by TEXT, added_at INTEGER DEFAULT 0, PRIMARY KEY (site_id, user_id));
    CREATE TABLE invitations (id TEXT PRIMARY KEY, token_hash TEXT UNIQUE, label TEXT, platform_role TEXT, capabilities TEXT, created_by TEXT, created_at INTEGER DEFAULT (unixepoch()), expires_at INTEGER, used_by TEXT, used_at INTEGER);
  `);
  const u = db.prepare('INSERT INTO users (id, username, role, platform_role, capabilities) VALUES (?, ?, ?, ?, ?)');
  u.run('own', 'owner', 'admin', 'owner', '{}');
  u.run('adm', 'admin2', 'admin', 'admin', '{}');
  u.run('mem', 'anna', 'editor', 'member', '{}');
  u.run('gst', 'ben', 'viewer', 'guest', '{}');
  u.run('mk', 'maker', 'editor', 'member', JSON.stringify(PRESETS.maker));
  const s = db.prepare('INSERT INTO sites (id, name, owner_id) VALUES (?, ?, ?)');
  s.run('s-anna', 'Anna site', 'mem');
  s.run('s-own', 'Owner site', 'own');
  db.prepare('INSERT INTO site_members (site_id, user_id, site_role) VALUES (?, ?, ?)').run('s-anna', 'gst', 'viewer');
  db.prepare('INSERT INTO site_members (site_id, user_id, site_role) VALUES (?, ?, ?)').run('s-own', 'mem', 'editor');
  return db;
}
const user = (db, id) => db.prepare('SELECT * FROM users WHERE id = ?').get(id);

test('legacy role mapping and admin detection', () => {
  assert.strictEqual(legacyRoleFor('owner'), 'admin');
  assert.strictEqual(legacyRoleFor('admin'), 'admin');
  assert.strictEqual(legacyRoleFor('member'), 'editor');
  assert.strictEqual(legacyRoleFor('guest'), 'viewer');
  assert.strictEqual(isPanelAdmin({ platform_role: 'owner' }), true);
  assert.strictEqual(isPanelAdmin({ platform_role: 'member' }), false);
  assert.strictEqual(isPanelAdmin({ role: 'admin' }), true, 'legacy row without platform_role');
});

test('capabilities: beginner defaults, overrides, unlimited admins, guests cannot create', () => {
  const b = effectiveCapabilities({ platform_role: 'member', capabilities: '{}' });
  assert.deepStrictEqual(b.runtimes, ['static']);
  assert.strictEqual(b.max_sites, 3);
  const o = effectiveCapabilities({ platform_role: 'member', capabilities: JSON.stringify({ max_sites: 7, runtimes: ['static', 'node'] }) });
  assert.strictEqual(o.max_sites, 7);
  assert.deepStrictEqual(o.runtimes, ['static', 'node']);
  assert.strictEqual(effectiveCapabilities({ platform_role: 'admin' }).max_sites, Infinity);
  assert.strictEqual(effectiveCapabilities({ platform_role: 'guest' }).max_sites, 0);
});

test('site roles: owner/admin implicit owner, site owner, member roles, none otherwise', () => {
  const db = makeDb(); const a = createAuthz(db);
  assert.strictEqual(a.siteRoleFor(user(db, 'own'), 's-anna'), 'owner');
  assert.strictEqual(a.siteRoleFor(user(db, 'adm'), 's-anna'), 'owner');
  assert.strictEqual(a.siteRoleFor(user(db, 'mem'), 's-anna'), 'owner');
  assert.strictEqual(a.siteRoleFor(user(db, 'mem'), 's-own'), 'editor');
  assert.strictEqual(a.siteRoleFor(user(db, 'gst'), 's-anna'), 'viewer');
  assert.strictEqual(a.siteRoleFor(user(db, 'gst'), 's-own'), null);
  assert.strictEqual(a.siteRoleFor(user(db, 'mk'), 's-anna'), null);
  assert.strictEqual(a.hasSiteRole(user(db, 'gst'), 's-anna', 'editor'), false);
  assert.strictEqual(a.hasSiteRole(user(db, 'mem'), 's-own', 'editor'), true);
});

test('support access: admin on a site they neither own nor belong to', () => {
  const db = makeDb(); const a = createAuthz(db);
  assert.strictEqual(a.isSupportAccess(user(db, 'adm'), 's-anna'), true);
  assert.strictEqual(a.isSupportAccess(user(db, 'own'), 's-own'), false);
  assert.strictEqual(a.isSupportAccess(user(db, 'mem'), 's-anna'), false);
});

test('accessible sites and scope SQL', () => {
  const db = makeDb(); const a = createAuthz(db);
  assert.strictEqual(a.accessibleSiteIds(user(db, 'own')), null);
  assert.deepStrictEqual(a.accessibleSiteIds(user(db, 'mem')).sort(), ['s-anna', 's-own']);
  assert.deepStrictEqual(a.accessibleSiteIds(user(db, 'gst')), ['s-anna']);
  assert.deepStrictEqual(a.accessibleSiteIds(user(db, 'mk')), []);
  assert.deepStrictEqual(a.siteScopeSql(user(db, 'own')), { sql: '1=1', params: [] });
  assert.deepStrictEqual(a.siteScopeSql(user(db, 'mk')), { sql: '1=0', params: [] });
  const sc = a.siteScopeSql(user(db, 'gst'), 'x.site_id');
  assert.strictEqual(sc.sql, 'x.site_id IN (?)');
});

test('tokens never exceed their owner: role capped, scope intersected, disabled owner blocks', () => {
  const db = makeDb(); const a = createAuthz(db);
  const annaTok = { id: 'token', role: 'admin', tokenSiteScope: null, tokenOwner: { ...user(db, 'mem'), role: 'editor' } };
  assert.strictEqual(a.siteRoleFor(annaTok, 's-anna'), 'owner', 'admin-role token of the site owner: owner');
  assert.strictEqual(a.siteRoleFor(annaTok, 's-own'), 'editor', 'capped by membership role');
  const viewerTok = { id: 'token', role: 'viewer', tokenSiteScope: ['s-anna'], tokenOwner: user(db, 'mem') };
  assert.strictEqual(a.siteRoleFor(viewerTok, 's-anna'), 'viewer');
  assert.strictEqual(a.siteRoleFor(viewerTok, 's-own'), null, 'outside token scope');
  assert.deepStrictEqual(a.accessibleSiteIds(viewerTok), ['s-anna']);
  db.prepare("UPDATE users SET status = 'disabled' WHERE id = 'mem'").run();
  assert.strictEqual(a.siteRoleFor({ ...annaTok, tokenOwner: user(db, 'mem') }, 's-anna'), null);
});

test('requireSiteRole middleware: 403 below threshold, sets siteRole and supportMode', () => {
  const db = makeDb(); const a = createAuthz(db);
  const run = (u, min, siteId) => new Promise(resolve => {
    const req = { user: u, params: { id: siteId } };
    const res = { status(c) { this.code = c; return this; }, json(b) { resolve({ code: this.code, body: b, req }); } };
    a.requireSiteRole(min)(req, res, () => resolve({ code: 200, req }));
  });
  return (async () => {
    let r = await run(user(db, 'gst'), 'editor', 's-anna');
    assert.strictEqual(r.code, 403);
    r = await run(user(db, 'gst'), 'viewer', 's-anna');
    assert.strictEqual(r.code, 200); assert.strictEqual(r.req.siteRole, 'viewer'); assert.strictEqual(r.req.supportMode, false);
    r = await run(user(db, 'adm'), 'owner', 's-anna');
    assert.strictEqual(r.code, 200); assert.strictEqual(r.req.supportMode, true);
    r = await run({ id: 'token', role: 'admin', tokenSiteScope: ['s-own'], tokenOwner: user(db, 'own') }, 'viewer', 's-anna');
    assert.strictEqual(r.code, 403); assert.match(r.body.error, /scoped/);
  })();
});

test('invitations: create, peek, accept once, expiry, validation', async () => {
  const db = makeDb(); const inv = createInvitations(db);
  const created = inv.create({ label: 'Carla', platform_role: 'member', preset: 'beginner', ttl_hours: 1, created_by: 'own' });
  assert.match(created.token, /^inv_/);
  assert.strictEqual(inv.peek(created.token).valid, true);
  assert.strictEqual(inv.peek('nope').valid, false);
  await assert.rejects(() => inv.accept(created.token, { username: 'C!', password: 'longenoughpw' }), /Username/);
  await assert.rejects(() => inv.accept(created.token, { username: 'carla', password: 'short' }), /10 characters/);
  await assert.rejects(() => inv.accept(created.token, { username: 'anna', password: 'longenoughpw' }), /taken/);
  const u = await inv.accept(created.token, { username: 'Carla', password: 'longenoughpw', display_name: 'Carla C' });
  assert.strictEqual(u.username, 'carla');
  assert.strictEqual(u.platform_role, 'member');
  assert.strictEqual(u.role, 'editor');
  const row = user(db, u.id);
  assert.strictEqual(row.invited_by, 'own');
  assert.deepStrictEqual(JSON.parse(row.capabilities).runtimes, ['static']);
  await assert.rejects(() => inv.accept(created.token, { username: 'dora', password: 'longenoughpw' }), /already used/);
  assert.strictEqual(inv.peek(created.token).reason, 'used');
  const expired = inv.create({ label: 'Old', ttl_hours: 1, created_by: 'own' });
  db.prepare('UPDATE invitations SET expires_at = 1 WHERE id = ?').run(expired.id);
  assert.strictEqual(inv.peek(expired.token).reason, 'expired');
  assert.strictEqual(inv.revoke(expired.id), true);
  assert.throws(() => inv.create({ label: '', created_by: 'own' }), /label/);
  assert.throws(() => inv.create({ label: 'x', platform_role: 'owner' }), /platform_role/);
});
