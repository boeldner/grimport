const { Router } = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');
const { logAudit } = require('../audit');
const { createInvitations } = require('../invitations');
const { principalFromUser } = require('../auth');

const router = Router();
const invitations = createInvitations(db);

// ── Invitations (public: the invitee is not logged in yet) ──
router.get('/invite/:token', (req, res) => {
  res.json(invitations.peek(req.params.token));
});

const inviteLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false, message: { error: 'Too many attempts' } });
router.post('/invite/:token', inviteLimiter, async (req, res) => {
  try {
    const { username, password, display_name } = req.body || {};
    const user = await invitations.accept(req.params.token, { username, password, display_name });
    logAudit({ fn: 'invite_accepted', level: 'info', detail: `${user.username} joined as ${user.platform_role}`, actor: user.username });
    req.session.regenerate(err => {
      if (err) return res.status(500).json({ error: 'Session error' });
      req.session.userId = user.id;
      req.session.role = user.role;
      req.session.username = user.username;
      req.session.save(err2 => {
        if (err2) return res.status(500).json({ error: 'Session error' });
        res.status(201).json({ ok: true, username: user.username, role: user.role, platform_role: user.platform_role });
      });
    });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts — try again in 15 minutes' },
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  if (!password) return res.status(400).json({ error: 'Password required' });

  let user;
  if (username) {
    user = db.prepare('SELECT * FROM users WHERE username = ?').get(username);
  } else {
    // Backward compat: no username = try admin user
    user = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  }
  if (!user) {
    logAudit({ fn: 'login', level: 'warn', detail: `Failed login for unknown user: ${username || '(no username)'}`, actor: username || 'unknown' });
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    logAudit({ fn: 'login', level: 'warn', detail: `Failed login attempt`, actor: user.username });
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  if (user.status && user.status !== 'active') {
    logAudit({ fn: 'login', level: 'warn', detail: 'Login refused: account disabled', actor: user.username });
    return res.status(403).json({ error: 'Account disabled' });
  }
  db.prepare('UPDATE users SET last_login_at = unixepoch() WHERE id = ?').run(user.id);

  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    // Legacy flag: only set for admins. requireAuth's legacy branch grants
    // whoever holds `session.authenticated` the first admin account found —
    // so it must never be set for editor/viewer logins.
    if (user.role === 'admin') req.session.authenticated = true;
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.username = user.username;
    req.session.save(err2 => {
      if (err2) return res.status(500).json({ error: 'Session error' });
      logAudit({ fn: 'login', level: 'info', detail: `Login successful (${user.role})`, actor: user.username });
      res.json({ ok: true, role: user.role, username: user.username });
    });
  });
});

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
  if (!user || user.platform_role !== 'owner') return false;
  const done = db.prepare("SELECT value FROM settings WHERE key = 'onboarding_done'").get();
  if (done?.value === '1') return false;

  const baseDomain = db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()?.value || '';
  if (!baseDomain) return true;

  const secret = process.env.SUPERVISOR_SECRET || 'changeme';
  return bcrypt.compareSync(secret, user.password_hash);
}

// GET /api/auth/me
router.get('/me', (req, res) => {
  let user = null;
  if (req.session?.userId) {
    user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
  } else if (req.session?.authenticated) {
    // Legacy session — look up admin
    user = db.prepare("SELECT * FROM users WHERE role = 'admin' ORDER BY rowid ASC LIMIT 1").get();
  }
  if (!user || (user.status && user.status !== 'active')) return res.json({ authenticated: false });

  const p = principalFromUser(user);
  res.json({
    authenticated: true,
    id: user.id,
    role: p.role,
    platform_role: p.platform_role,
    capabilities: p.capabilities,
    username: user.username,
    display_name: user.display_name || null,
    needsOnboarding: computeNeedsOnboarding(user),
  });
});

module.exports = router;
