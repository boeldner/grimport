const { Router } = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const qrcode = require('qrcode');
const { nanoid, customAlphabet } = require('nanoid');
const db = require('../db');
const { logAudit } = require('../audit');
const { sendAlert } = require('../alerts');
const { checkLocked, recordFailure, clearAttempts } = require('../lockout');
const { generateSecret, buildOtpauthUrl, verifyTotp } = require('../totp');
const { requireAuth } = require('../auth');
const { asyncHandler } = require('../async-handler');

const router = Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
});

const REMEMBER_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
// Recovery codes: 10 chars from an alphabet with no ambiguous glyphs
// (no 0/O, 1/I/L), shown to the user grouped as XXXXX-XXXXX.
const RECOVERY_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
const genRecoveryCode = customAlphabet(RECOVERY_ALPHABET, 10);

function formatRecoveryCode(raw) {
  return `${raw.slice(0, 5)}-${raw.slice(5)}`;
}
function normalizeRecoveryCode(input) {
  return String(input || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

// ── Lockout helpers ─────────────────────────────────────────
// Two independent keys, so a brute force against one account doesn't need
// the attacker to spread requests across IPs, and a single noisy IP hitting
// many usernames still gets throttled even if no one account is targeted.
function userKeyFor(username) {
  return `user:${(username || '(no-username)').toLowerCase()}`;
}
function ipKeyFor(req) {
  return `ip:${req.ip}`;
}

function sendLockedResponse(res, userLock, ipLock) {
  const retryAfterSeconds = Math.max(userLock.retryAfterSeconds || 0, ipLock.retryAfterSeconds || 0);
  const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
  res.setHeader('Retry-After', String(retryAfterSeconds));
  return res.status(429).json({ error: `Too many failed logins, try again in ${minutes} minutes` });
}

/** Records a failed attempt against both the per-username and per-IP keys, alerting once when the username key first crosses the lockout threshold. */
function recordLoginFailure(req, username) {
  recordFailure(ipKeyFor(req));
  const result = recordFailure(userKeyFor(username));
  if (result.isThresholdFailure) {
    const detail = `${username || '(no username)'} from ${req.ip}`;
    sendAlert('login_lockout', { siteName: 'Panel', detail });
    logAudit({ fn: 'login_lockout', level: 'warn', detail: `Account locked after repeated failed logins: ${detail}`, actor: username || 'unknown' });
  }
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

/** Regenerates the session and writes every field a completed login needs — shared by /login (no 2FA) and /totp/verify (2FA completion). */
function finalizeSession(req, res, user, { remember = false } = {}) {
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    // Legacy flag: only set for admins. requireAuth's legacy branch grants
    // whoever holds `session.authenticated` the first admin account found —
    // so it must never be set for editor/viewer logins.
    if (user.role === 'admin') req.session.authenticated = true;
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.username = user.username;
    const now = Date.now();
    req.session.ua = String(req.headers['user-agent'] || '').slice(0, 200);
    req.session.ip = req.ip;
    req.session.createdAt = now;
    req.session.lastSeen = now;
    if (remember) req.session.cookie.maxAge = REMEMBER_MAX_AGE_MS;
    req.session.save(err2 => {
      if (err2) return res.status(500).json({ error: 'Session error' });
      logAudit({ fn: 'login', level: 'info', detail: `Login successful (${user.role})`, actor: user.username });
      res.json({ ok: true, role: user.role, username: user.username });
    });
  });
}

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password, remember } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  const uKey = userKeyFor(username);
  const iKey = ipKeyFor(req);
  const userLock = checkLocked(uKey);
  const ipLock = checkLocked(iKey);
  if (userLock.locked || ipLock.locked) return sendLockedResponse(res, userLock, ipLock);

  let user;
  if (username) {
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  } else {
    // Backward compat: no username = try admin user
    user = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  }
  if (!user) {
    logAudit({ fn: 'login', level: 'warn', detail: `Failed login for unknown user: ${username || '(no username)'}`, actor: username || 'unknown' });
    recordLoginFailure(req, username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    logAudit({ fn: 'login', level: 'warn', detail: `Failed login attempt`, actor: user.username });
    recordLoginFailure(req, user.username);
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  clearAttempts(uKey);

  if (user.totp_secret) {
    // Correct password, but 2FA is enabled — hold the login open pending a
    // TOTP/recovery code. No userId/role/authenticated set yet, so
    // requireAuth still rejects this session until /totp/verify completes it.
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.pendingTotpUserId = user.id;
      req.session.pendingRemember = !!remember;
      req.session.save(err2 => {
        if (err2) return res.status(500).json({ error: 'Session error' });
        res.json({ ok: false, totp_required: true });
      });
    });
    return;
  }

  finalizeSession(req, res, user, { remember: !!remember });
});

// POST /api/auth/totp/verify — completes a login held pending by /login when the account has TOTP enabled.
router.post('/totp/verify', loginLimiter, asyncHandler(async (req, res) => {
  const pendingId = req.session?.pendingTotpUserId;
  if (!pendingId) return res.status(400).json({ error: 'No pending login' });

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(pendingId);
  if (!user || !user.totp_secret) {
    req.session.destroy(() => {});
    return res.status(400).json({ error: 'No pending login' });
  }

  const uKey = userKeyFor(user.username);
  const iKey = ipKeyFor(req);
  const userLock = checkLocked(uKey);
  const ipLock = checkLocked(iKey);
  if (userLock.locked || ipLock.locked) return sendLockedResponse(res, userLock, ipLock);

  const { code } = req.body;
  let ok = verifyTotp(user.totp_secret, code);
  let usedRecoveryId = null;

  if (!ok && code) {
    const normalized = normalizeRecoveryCode(code);
    const unused = db.prepare('SELECT id, code_hash FROM recovery_codes WHERE user_id = ? AND used_at IS NULL').all(user.id);
    for (const rc of unused) {
      if (bcrypt.compareSync(normalized, rc.code_hash)) {
        ok = true;
        usedRecoveryId = rc.id;
        break;
      }
    }
  }

  if (!ok) {
    recordLoginFailure(req, user.username);
    logAudit({ fn: 'login', level: 'warn', detail: 'Failed TOTP/recovery-code verification', actor: user.username });
    return res.status(401).json({ error: 'Invalid code' });
  }

  clearAttempts(uKey);
  if (usedRecoveryId) {
    db.prepare('UPDATE recovery_codes SET used_at = unixepoch() WHERE id = ?').run(usedRecoveryId);
    logAudit({ fn: 'totp_recovery_used', level: 'warn', detail: 'Logged in with a recovery code', actor: user.username });
  }

  const remember = !!req.session.pendingRemember;
  finalizeSession(req, res, user, { remember });
}));

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  const username = req.session?.username || 'unknown';
  req.session.destroy(() => {
    logAudit({ fn: 'logout', level: 'info', detail: 'Session ended', actor: username });
    res.clearCookie('wh.sid');
    res.json({ ok: true });
  });
});

// First-run onboarding: show the wizard only for the admin, only once, and
// only when there's real setup left to do. Gated on all three so an
// existing/already-configured install never gets nagged:
//   1. `onboarding_done` setting unset (dismissing the wizard sets it — for
//      good; once set, this never re-evaluates the other two conditions).
//   2. AND either the admin's password still matches the seeded
//      SUPERVISOR_SECRET, or no base domain has been configured yet.
function computeNeedsOnboarding(user) {
  if (!user || user.role !== 'admin') return false;
  const done = db.prepare("SELECT value FROM settings WHERE key = 'onboarding_done'").get();
  if (done?.value === '1') return false;

  const baseDomain = db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()?.value || '';
  if (!baseDomain) return true;

  const secret = process.env.SUPERVISOR_SECRET || 'changeme';
  return bcrypt.compareSync(secret, user.password_hash);
}

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session?.pendingTotpUserId) {
    return res.json({ authenticated: false, totp_required: true });
  }

  let user = null;
  if (req.session?.userId) {
    user = db.prepare('SELECT id, username, role, password_hash, totp_secret FROM users WHERE id = ?').get(req.session.userId);
  } else if (req.session?.authenticated) {
    // Legacy session — look up admin
    user = db.prepare("SELECT id, username, role, password_hash, totp_secret FROM users WHERE role = 'admin' LIMIT 1").get();
  }
  if (!user) return res.json({ authenticated: false });

  // Owner/admin TOTP policy: when require_totp_admins is on, an admin
  // without a TOTP secret is authenticated but forced through setup before
  // using the panel — see the appended frontend block in app.js.
  const requireTotpAdmins = getSetting('require_totp_admins') === '1';
  if (requireTotpAdmins && user.role === 'admin' && !user.totp_secret) {
    return res.json({
      authenticated: true,
      totp_setup_required: true,
      id: user.id,
      role: user.role,
      username: user.username,
    });
  }

  res.json({
    authenticated: true,
    id: user.id,
    role: user.role,
    username: user.username,
    needsOnboarding: computeNeedsOnboarding(user),
    totp_enabled: !!user.totp_secret,
  });
});

// ── TOTP setup / enable / disable (session required) ───────────────

// POST /api/auth/totp/setup — generates a secret, holds it PENDING in the
// session only (not written to users.totp_secret until /totp/enable
// verifies possession of it).
router.post('/totp/setup', requireAuth, asyncHandler(async (req, res) => {
  const secret = generateSecret();
  const label = `${req.user.username}@${process.env.SUPERVISOR_DOMAIN || 'localhost'}`;
  const otpauth_url = buildOtpauthUrl({ secret, label, issuer: 'Grimport' });

  req.session.pendingTotpSecret = secret;
  req.session.save(async err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    try {
      const qr_data_url = await qrcode.toDataURL(otpauth_url);
      res.json({ secret, otpauth_url, qr_data_url });
    } catch {
      res.status(500).json({ error: 'Failed to generate QR code' });
    }
  });
}));

// POST /api/auth/totp/enable { code } — verifies the pending secret and turns on 2FA.
router.post('/totp/enable', requireAuth, (req, res) => {
  const pending = req.session.pendingTotpSecret;
  if (!pending) return res.status(400).json({ error: 'No pending TOTP setup — call /totp/setup first' });
  if (!verifyTotp(pending, req.body?.code)) return res.status(400).json({ error: 'Invalid code' });

  const rawCodes = Array.from({ length: 8 }, () => genRecoveryCode());
  const insert = db.prepare('INSERT INTO recovery_codes (id, user_id, code_hash) VALUES (?, ?, ?)');
  const enable = db.transaction(() => {
    db.prepare('UPDATE users SET totp_secret = ? WHERE id = ?').run(pending, req.user.id);
    db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(req.user.id);
    for (const raw of rawCodes) {
      insert.run(nanoid(10), req.user.id, bcrypt.hashSync(raw, 10));
    }
  });
  enable();

  delete req.session.pendingTotpSecret;
  req.session.save(() => {
    logAudit({ fn: 'totp_enable', level: 'info', detail: 'Two-factor authentication enabled', actor: req.user.username });
    res.json({ ok: true, recovery_codes: rawCodes.map(formatRecoveryCode) });
  });
});

// POST /api/auth/totp/disable { password } — re-authenticates, then clears 2FA + recovery codes.
router.post('/totp/disable', requireAuth, asyncHandler(async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.status(404).json({ error: 'User not found' });

  const valid = await bcrypt.compare(req.body?.password || '', user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Incorrect password' });

  db.prepare('UPDATE users SET totp_secret = NULL WHERE id = ?').run(user.id);
  db.prepare('DELETE FROM recovery_codes WHERE user_id = ?').run(user.id);
  logAudit({ fn: 'totp_disable', level: 'warn', detail: 'Two-factor authentication disabled', actor: user.username });
  res.json({ ok: true });
}));

// ── Sessions (session required) ─────────────────────────────────────

// GET /api/auth/sessions — this user's own sessions (never other users').
router.get('/sessions', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sid, data FROM sessions').all();
  const list = [];
  for (const row of rows) {
    let data;
    try { data = JSON.parse(row.data); } catch { continue; }
    if (data.userId !== req.user.id) continue;
    list.push({
      sid: row.sid,
      sid_short: row.sid.slice(0, 8),
      created_at: data.createdAt || null,
      last_seen: data.lastSeen || null,
      ua: data.ua || '',
      ip: data.ip || '',
      current: row.sid === req.sessionID,
    });
  }
  list.sort((a, b) => (b.last_seen || 0) - (a.last_seen || 0));
  res.json({ sessions: list });
});

// DELETE /api/auth/sessions/:sid — revoke one of the current user's own sessions.
router.delete('/sessions/:sid', requireAuth, (req, res) => {
  const row = db.prepare('SELECT data FROM sessions WHERE sid = ?').get(req.params.sid);
  if (!row) return res.status(404).json({ error: 'Session not found' });
  let data;
  try { data = JSON.parse(row.data); } catch { return res.status(404).json({ error: 'Session not found' }); }
  if (data.userId !== req.user.id) return res.status(403).json({ error: 'Forbidden' });

  db.prepare('DELETE FROM sessions WHERE sid = ?').run(req.params.sid);
  logAudit({ fn: 'session_revoke', level: 'info', detail: `Revoked session ${req.params.sid.slice(0, 8)}…`, actor: req.user.username });
  res.json({ ok: true });
});

// POST /api/auth/sessions/revoke-others — sign out every session but this one.
router.post('/sessions/revoke-others', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sid, data FROM sessions').all();
  const del = db.prepare('DELETE FROM sessions WHERE sid = ?');
  let revoked = 0;
  for (const row of rows) {
    if (row.sid === req.sessionID) continue;
    let data;
    try { data = JSON.parse(row.data); } catch { continue; }
    if (data.userId === req.user.id) {
      del.run(row.sid);
      revoked++;
    }
  }
  logAudit({ fn: 'session_revoke_others', level: 'info', detail: `Revoked ${revoked} other session(s)`, actor: req.user.username });
  res.json({ ok: true, revoked });
});

module.exports = router;
