const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const express = require('express');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-oauth-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');
process.env.SUPERVISOR_DOMAIN = 'localhost';

const db = require('../src/db');
const { requireAuth } = require('../src/auth');
const oauth = require('../src/mcp/oauth');

const bcrypt = require('bcryptjs');
const hash = bcrypt.hashSync('pw', 4);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status) VALUES ('u-carla', 'carla', ?, 'editor', 'member', '{}', 'active')`).run(hash);
db.prepare(`INSERT OR REPLACE INTO users (id, username, password_hash, role, platform_role, capabilities, status) VALUES ('u-off', 'off', ?, 'editor', 'member', '{}', 'disabled')`).run(hash);
db.prepare(`INSERT INTO sites (id, name, domain, owner_id) VALUES ('s-c', 'Carla site', 'c.test', 'u-carla')`).run();
db.prepare(`INSERT INTO sites (id, name, domain) VALUES ('s-o', 'Other', 'o.test')`).run();

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const b64url = b => b.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function pkce() {
  const verifier = b64url(crypto.randomBytes(32));
  return { verifier, challenge: b64url(crypto.createHash('sha256').update(verifier).digest()) };
}
const REDIRECT = 'https://claude.ai/api/mcp/auth_callback';

test('register client, consent code, PKCE exchange, refresh rotation, revoke', async () => {
  const client = await oauth.clientsStore.registerClient({ redirect_uris: [REDIRECT], client_name: 'Claude', token_endpoint_auth_method: 'none' });
  assert.match(client.client_id, /^gc_/);
  assert.deepStrictEqual((await oauth.clientsStore.getClient(client.client_id)).redirect_uris, [REDIRECT]);
  assert.strictEqual(await oauth.clientsStore.getClient('nope'), undefined);

  const { verifier, challenge } = pkce();
  assert.throws(() => oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-carla', codeChallenge: challenge, redirectUri: 'https://evil.test/cb' }), /not registered/);
  assert.throws(() => oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-carla', codeChallenge: 'short', redirectUri: REDIRECT }), /code_challenge/);
  const code = oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-carla', codeChallenge: challenge, redirectUri: REDIRECT, scope: 'grimport' });

  assert.strictEqual(await oauth.provider.challengeForAuthorizationCode(client, code), challenge);
  await assert.rejects(oauth.provider.challengeForAuthorizationCode({ ...client, client_id: 'gc_other' }, code), /Invalid or expired/);

  const tokens = await oauth.provider.exchangeAuthorizationCode(client, code, verifier, REDIRECT);
  assert.match(tokens.access_token, /^grim_/);
  assert.match(tokens.refresh_token, /^grimr_/);
  assert.strictEqual(tokens.token_type, 'bearer');
  await assert.rejects(oauth.provider.exchangeAuthorizationCode(client, code, verifier, REDIRECT), /Invalid or expired/, 'code is single use');

  // The access token is a normal api_tokens row, pinned to carla's role and sites.
  const row = db.prepare('SELECT * FROM api_tokens WHERE token_hash = ?').get(sha256(tokens.access_token));
  assert.strictEqual(row.user_id, 'u-carla');
  assert.strictEqual(row.oauth_client_id, client.client_id);
  assert.strictEqual(row.role, 'editor');
  assert.deepStrictEqual(JSON.parse(row.site_scope), ['s-c']);
  assert.match(row.name, /^Claude via Claude/);
  assert.ok(row.expires_at > Math.floor(Date.now() / 1000));

  const info = await oauth.provider.verifyAccessToken(tokens.access_token);
  assert.strictEqual(info.clientId, client.client_id);
  await assert.rejects(oauth.provider.verifyAccessToken('grim_nope'), /Unknown token/);

  // requireAuth accepts it like any other token, scoped to carla's site.
  const app = express();
  app.get('/api/who', requireAuth, (req, res) => res.json({ id: req.user.id, role: req.user.role, scope: req.user.tokenSiteScope, owner: req.user.tokenOwner?.username }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  try {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/who`, { headers: { Authorization: `Bearer ${tokens.access_token}` } });
    const who = await res.json();
    assert.deepStrictEqual(who, { id: 'token', role: 'editor', scope: ['s-c'], owner: 'carla' });
  } finally { server.close(); }

  // Refresh rotates both tokens; the old pair stops working.
  const next = await oauth.provider.exchangeRefreshToken(client, tokens.refresh_token);
  assert.notStrictEqual(next.access_token, tokens.access_token);
  await assert.rejects(oauth.provider.verifyAccessToken(tokens.access_token), /Unknown token/);
  await assert.rejects(oauth.provider.exchangeRefreshToken(client, tokens.refresh_token), /Invalid refresh token/);
  await assert.rejects(oauth.provider.exchangeRefreshToken({ ...client, client_id: 'gc_x' }, next.refresh_token), /Invalid refresh token/);
  assert.ok(await oauth.provider.verifyAccessToken(next.access_token));

  // Revoking the access token also drops its refresh token.
  await oauth.provider.revokeToken(client, { token: next.access_token });
  await assert.rejects(oauth.provider.verifyAccessToken(next.access_token), /Unknown token/);
  await assert.rejects(oauth.provider.exchangeRefreshToken(client, next.refresh_token), /Invalid refresh token/);
});

test('disabled accounts and expired codes get no tokens', async () => {
  const client = await oauth.clientsStore.registerClient({ redirect_uris: [REDIRECT], client_name: 'X', token_endpoint_auth_method: 'none' });
  const { verifier, challenge } = pkce();
  const code = oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-off', codeChallenge: challenge, redirectUri: REDIRECT });
  await assert.rejects(oauth.provider.exchangeAuthorizationCode(client, code, verifier, REDIRECT), /disabled/);

  const code2 = oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-carla', codeChallenge: challenge, redirectUri: REDIRECT });
  db.prepare('UPDATE oauth_codes SET expires_at = 1 WHERE code_hash = ?').run(sha256(code2));
  await assert.rejects(oauth.provider.exchangeAuthorizationCode(client, code2, verifier, REDIRECT), /expired/);
});

test('the SDK router exposes metadata, registration, authorize redirect and token exchange', async () => {
  const app = express();
  app.use(oauth.createAuthRouter({ issuerUrl: 'http://localhost:3000' }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  try {
    const meta = await (await fetch(`${base}/.well-known/oauth-authorization-server`)).json();
    assert.strictEqual(new URL(meta.issuer).origin, 'http://localhost:3000');
    assert.strictEqual(meta.token_endpoint, 'http://localhost:3000/token');
    assert.ok(meta.code_challenge_methods_supported.includes('S256'));
    const prm = await (await fetch(`${base}/.well-known/oauth-protected-resource/mcp`)).json();
    assert.strictEqual(prm.resource, 'http://localhost:3000/mcp');

    const reg = await fetch(`${base}/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: [REDIRECT], client_name: 'Claude', token_endpoint_auth_method: 'none' }) });
    assert.strictEqual(reg.status, 201);
    const client = await reg.json();
    assert.match(client.client_id, /^gc_/);
    assert.strictEqual(client.client_secret, undefined);

    const { verifier, challenge } = pkce();
    const q = new URLSearchParams({ response_type: 'code', client_id: client.client_id, redirect_uri: REDIRECT, code_challenge: challenge, code_challenge_method: 'S256', state: 'st8', scope: 'grimport' });
    const auth = await fetch(`${base}/authorize?${q}`, { redirect: 'manual' });
    assert.strictEqual(auth.status, 302);
    const loc = new URL(auth.headers.get('location'), base);
    assert.strictEqual(loc.pathname, '/oauth/consent');
    assert.strictEqual(loc.searchParams.get('client_id'), client.client_id);
    assert.strictEqual(loc.searchParams.get('state'), 'st8');
    assert.strictEqual(loc.searchParams.get('code_challenge'), challenge);

    // What the consent page does on "Allow":
    const code = oauth.issueAuthorizationCode({ clientId: client.client_id, userId: 'u-carla', codeChallenge: challenge, redirectUri: REDIRECT, scope: 'grimport' });
    const tok = await fetch(`${base}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: verifier, client_id: client.client_id, redirect_uri: REDIRECT }) });
    const tokText = await tok.text();
    assert.strictEqual(tok.status, 200, tokText);
    const tokens = JSON.parse(tokText);
    assert.match(tokens.access_token, /^grim_/);

    const bad = await fetch(`${base}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'authorization_code', code, code_verifier: 'wrong-verifier-wrong-verifier-wrong-verifier-1', client_id: client.client_id, redirect_uri: REDIRECT }) });
    assert.strictEqual(bad.status, 400);

    const refreshed = await fetch(`${base}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', refresh_token: tokens.refresh_token, client_id: client.client_id }) });
    const refText = await refreshed.text();
    assert.strictEqual(refreshed.status, 200, refText);
    assert.match(JSON.parse(refText).access_token, /^grim_/);
  } finally { server.close(); }
});
