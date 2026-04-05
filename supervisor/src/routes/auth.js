const { Router } = require('express');
const bcrypt = require('bcryptjs');
const rateLimit = require('express-rate-limit');
const db = require('../db');

const router = Router();

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
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  req.session.authenticated = true; // kept for backward compat
  req.session.userId = user.id;
  req.session.role = user.role;
  req.session.username = user.username;
  req.session.save(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    res.json({ ok: true, role: user.role, username: user.username });
  });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('wh.sid');
    res.json({ ok: true });
  });
});

// GET /api/auth/me
router.get('/me', (req, res) => {
  if (req.session?.userId) {
    return res.json({ authenticated: true, role: req.session.role, username: req.session.username });
  }
  if (req.session?.authenticated) {
    // Legacy session — look up admin
    const admin = db.prepare("SELECT username, role FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) return res.json({ authenticated: true, role: admin.role, username: admin.username });
  }
  res.json({ authenticated: false });
});

module.exports = router;
