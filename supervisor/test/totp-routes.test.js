const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');

// Isolated DB per test file (see test/users-password.test.js for the same
// pattern): point DATA_PATH at a fresh temp dir before requiring db.js so
// this file's better-sqlite3 instance never touches the real database.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-totp-routes-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');
process.env.SUPERVISOR_SECRET = 'irrelevant-for-this-file';

const db = require('../src/db');
const { sessionMiddleware } = require('../src/auth');
const authRouter = require('../src/routes/auth');
const { totp: computeTotp } = require('../src/totp');

// Every test gets its own fake source IP (via X-Forwarded-For + trust
// proxy) so neither express-rate-limit's outer per-IP limiter nor this
// file's own per-IP lockout key leak state between unrelated tests that
// otherwise all originate from 127.0.0.1 in the test runner.
let nextFakeIp = 1;
function freshIp() { return `10.77.0.${nextFakeIp++}`; }

function makeApp() {
  const app = express();
  app.set('trust proxy', 1); // matches src/index.js; numeric hop count avoids express-rate-limit's permissive-trust-proxy warning
  app.use(express.json());
  app.use(sessionMiddleware);
  app.use('/api/auth', authRouter);
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

function cookieFrom(res) {
  const setCookie = res.headers.get('set-cookie');
  assert.ok(setCookie, 'expected a Set-Cookie header');
  return setCookie.split(';')[0];
}

async function post(base, urlPath, { ip, cookie, body } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${base}${urlPath}`, { method: 'POST', headers, body: JSON.stringify(body || {}) });
}

async function del(base, urlPath, { ip, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json', 'X-Forwarded-For': ip };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${base}${urlPath}`, { method: 'DELETE', headers });
}

async function get(base, urlPath, { ip, cookie } = {}) {
  const headers = { 'X-Forwarded-For': ip };
  if (cookie) headers.Cookie = cookie;
  return fetch(`${base}${urlPath}`, { headers });
}

async function login(base, ip, username, password) {
  return post(base, '/api/auth/login', { ip, body: { username, password } });
}

function createUser({ username, password, role = 'editor' }) {
  const id = nanoid(10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(id, username, bcrypt.hashSync(password, 10), role);
  return id;
}

// ── Login lockout, end to end over real HTTP ────────────────────────

test('POST /api/auth/login locks out after 5 wrong passwords, returning 429 with Retry-After', async () => {
  createUser({ username: 'lockout-user', password: 'correct-password-1' });
  const ip = freshIp();

  await withServer(async (base) => {
    for (let i = 0; i < 4; i++) {
      const res = await login(base, ip, 'lockout-user', 'wrong');
      assert.strictEqual(res.status, 401);
    }

    // 5th wrong attempt crosses the threshold and locks the account.
    const fifth = await login(base, ip, 'lockout-user', 'wrong');
    assert.strictEqual(fifth.status, 401);

    // 6th attempt (even with the CORRECT password) is now locked out.
    const sixth = await login(base, ip, 'lockout-user', 'correct-password-1');
    assert.strictEqual(sixth.status, 429);
    assert.ok(sixth.headers.get('retry-after'), 'Retry-After header must be present');
    const body = await sixth.json();
    assert.match(body.error, /Too many failed logins, try again in \d+ minutes?/);
  });
});

test('a successful login clears the lockout for that username', async () => {
  createUser({ username: 'clears-user', password: 'right-pw' });
  const ipA = freshIp();

  await withServer(async (base) => {
    for (let i = 0; i < 3; i++) await login(base, ipA, 'clears-user', 'wrong');

    const ok = await login(base, ipA, 'clears-user', 'right-pw');
    assert.strictEqual(ok.status, 200);

    // Verify from a DIFFERENT IP so the (separately-tracked, never cleared
    // by a username-scoped success) per-IP counter for ipA can't muddy the
    // result — this checks the username key specifically. 4 more wrong
    // attempts (below the threshold of 5) must still 401, not 429.
    const ipB = freshIp();
    let last;
    for (let i = 0; i < 4; i++) last = await login(base, ipB, 'clears-user', 'wrong');
    assert.strictEqual(last.status, 401);
  });
});

// ── TOTP setup / enable / login-with-2FA / recovery codes ───────────

test('TOTP setup -> enable -> login requires a code -> verify completes the session; recovery code works once', async () => {
  const userId = createUser({ username: 'totp-user', password: 'totp-pass-123', role: 'editor' });
  const ip = freshIp();

  await withServer(async (base) => {
    // Log in first (no 2FA yet) to get a session that can call /totp/setup.
    const loginRes = await login(base, ip, 'totp-user', 'totp-pass-123');
    assert.strictEqual(loginRes.status, 200);
    const cookie = cookieFrom(loginRes);

    const setupRes = await post(base, '/api/auth/totp/setup', { ip, cookie });
    assert.strictEqual(setupRes.status, 200);
    const setup = await setupRes.json();
    assert.ok(setup.secret);
    assert.ok(setup.otpauth_url.startsWith('otpauth://totp/'));
    assert.ok(setup.qr_data_url.startsWith('data:image/'));

    // Wrong code is rejected and does not enable 2FA.
    const badEnable = await post(base, '/api/auth/totp/enable', { ip, cookie, body: { code: '000000' } });
    assert.strictEqual(badEnable.status, 400);

    const validCode = computeTotp(setup.secret);
    const enableRes = await post(base, '/api/auth/totp/enable', { ip, cookie, body: { code: validCode } });
    assert.strictEqual(enableRes.status, 200);
    const enabled = await enableRes.json();
    assert.strictEqual(enabled.recovery_codes.length, 8);
    assert.match(enabled.recovery_codes[0], /^[A-Z2-9]{5}-[A-Z2-9]{5}$/);

    const row = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId);
    assert.strictEqual(row.totp_secret, setup.secret);

    // Logging in again now stops short of a full session.
    const loginAgain = await login(base, ip, 'totp-user', 'totp-pass-123');
    assert.strictEqual(loginAgain.status, 200);
    const pendingBody = await loginAgain.json();
    assert.deepStrictEqual(pendingBody, { ok: false, totp_required: true });
    const pendingCookie = cookieFrom(loginAgain);

    // /me reflects the pending-2FA state.
    const me1 = await get(base, '/api/auth/me', { ip, cookie: pendingCookie }).then(r => r.json());
    assert.deepStrictEqual(me1, { authenticated: false, totp_required: true });

    // Wrong TOTP code is rejected.
    const badVerify = await post(base, '/api/auth/totp/verify', { ip, cookie: pendingCookie, body: { code: '111111' } });
    assert.strictEqual(badVerify.status, 401);

    // Correct TOTP code completes the login.
    const verifyRes = await post(base, '/api/auth/totp/verify', { ip, cookie: pendingCookie, body: { code: computeTotp(setup.secret) } });
    assert.strictEqual(verifyRes.status, 200);
    const verified = await verifyRes.json();
    assert.strictEqual(verified.ok, true);
    const fullCookie = cookieFrom(verifyRes);

    const me2 = await get(base, '/api/auth/me', { ip, cookie: fullCookie }).then(r => r.json());
    assert.strictEqual(me2.authenticated, true);
    assert.strictEqual(me2.totp_enabled, true);

    // ── Recovery code: single use ──
    const recoveryCode = enabled.recovery_codes[3];

    const loginForRecovery = await login(base, ip, 'totp-user', 'totp-pass-123');
    const recoveryCookie = cookieFrom(loginForRecovery);

    const firstUse = await post(base, '/api/auth/totp/verify', { ip, cookie: recoveryCookie, body: { code: recoveryCode } });
    assert.strictEqual(firstUse.status, 200, 'first use of a recovery code must succeed');

    const loginAgain2 = await login(base, ip, 'totp-user', 'totp-pass-123');
    const recoveryCookie2 = cookieFrom(loginAgain2);

    const secondUse = await post(base, '/api/auth/totp/verify', { ip, cookie: recoveryCookie2, body: { code: recoveryCode } });
    assert.strictEqual(secondUse.status, 401, 'a used recovery code must not work a second time');

    // ── Disable ──
    const badDisable = await post(base, '/api/auth/totp/disable', { ip, cookie: fullCookie, body: { password: 'wrong-password' } });
    assert.strictEqual(badDisable.status, 401);

    const disableRes = await post(base, '/api/auth/totp/disable', { ip, cookie: fullCookie, body: { password: 'totp-pass-123' } });
    assert.strictEqual(disableRes.status, 200);
    const afterDisable = db.prepare('SELECT totp_secret FROM users WHERE id = ?').get(userId);
    assert.strictEqual(afterDisable.totp_secret, null);
    const remainingCodes = db.prepare('SELECT COUNT(*) AS n FROM recovery_codes WHERE user_id = ?').get(userId);
    assert.strictEqual(remainingCodes.n, 0);
  });
});

// ── Sessions ──────────────────────────────────────────────────────

test('GET/DELETE /api/auth/sessions manage only the current user\'s own sessions', async () => {
  createUser({ username: 'sess-user', password: 'sess-pass-123' });
  createUser({ username: 'other-user', password: 'other-pass-123' });
  const ip = freshIp();

  await withServer(async (base) => {
    const login1 = await login(base, ip, 'sess-user', 'sess-pass-123');
    const cookieA = cookieFrom(login1);

    const login2 = await login(base, ip, 'sess-user', 'sess-pass-123');
    const cookieB = cookieFrom(login2);
    void cookieB;

    const otherLogin = await login(base, ip, 'other-user', 'other-pass-123');
    const otherCookie = cookieFrom(otherLogin);

    const listA = await get(base, '/api/auth/sessions', { ip, cookie: cookieA }).then(r => r.json());
    assert.strictEqual(listA.sessions.length, 2, 'sess-user has 2 sessions, other-user\'s must not appear');
    const current = listA.sessions.find(s => s.current);
    assert.ok(current, 'exactly one session must be flagged current');
    const otherSid = listA.sessions.find(s => !s.current).sid;

    // Cannot delete another user's session id.
    const otherList = await get(base, '/api/auth/sessions', { ip, cookie: otherCookie }).then(r => r.json());
    const forbiddenDelete = await del(base, `/api/auth/sessions/${otherList.sessions[0].sid}`, { ip, cookie: cookieA });
    assert.strictEqual(forbiddenDelete.status, 403);

    // Can delete its own other session.
    const ownDelete = await del(base, `/api/auth/sessions/${otherSid}`, { ip, cookie: cookieA });
    assert.strictEqual(ownDelete.status, 200);

    const listAfter = await get(base, '/api/auth/sessions', { ip, cookie: cookieA }).then(r => r.json());
    assert.strictEqual(listAfter.sessions.length, 1);

    // other-user's session must be untouched throughout.
    const otherMe = await get(base, '/api/auth/me', { ip, cookie: otherCookie }).then(r => r.json());
    assert.strictEqual(otherMe.authenticated, true);
  });
});

test('POST /api/auth/sessions/revoke-others keeps only the current session', async () => {
  createUser({ username: 'revoke-user', password: 'revoke-pass-123' });
  const ip = freshIp();

  await withServer(async (base) => {
    const cookies = [];
    for (let i = 0; i < 3; i++) {
      const res = await login(base, ip, 'revoke-user', 'revoke-pass-123');
      cookies.push(cookieFrom(res));
    }
    const currentCookie = cookies[cookies.length - 1];

    const revokeRes = await post(base, '/api/auth/sessions/revoke-others', { ip, cookie: currentCookie });
    assert.strictEqual(revokeRes.status, 200);
    const revokeBody = await revokeRes.json();
    assert.strictEqual(revokeBody.revoked, 2);

    const list = await get(base, '/api/auth/sessions', { ip, cookie: currentCookie }).then(r => r.json());
    assert.strictEqual(list.sessions.length, 1);
    assert.strictEqual(list.sessions[0].current, true);

    // The older sessions are actually dead now.
    const deadMe = await get(base, '/api/auth/me', { ip, cookie: cookies[0] }).then(r => r.json());
    assert.strictEqual(deadMe.authenticated, false);
  });
});
