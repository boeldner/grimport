const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const DB_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, '..', 'supervisor.db')
  : path.join(__dirname, '../../data/supervisor.db');

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'supervisor.db', dir: path.dirname(DB_PATH) }),
  secret: process.env.SUPERVISOR_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  name: 'wh.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // secure: true requires HTTPS — enabled automatically in production via Traefik
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
});

function requireAuth(req, res, next) {
  if (req.session?.userId) {
    req.user = { id: req.session.userId, role: req.session.role, username: req.session.username };
    return next();
  }
  // Legacy session support (single-password sessions before v0.7)
  if (req.session?.authenticated) {
    const admin = db.prepare("SELECT id, username, role FROM users WHERE role = 'admin' LIMIT 1").get();
    if (admin) {
      req.user = admin;
      req.session.userId = admin.id;
      req.session.role = admin.role;
      req.session.username = admin.username;
      return next();
    }
  }
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const hash = crypto.createHash('sha256').update(auth.slice(7)).digest('hex');
    const row = db.prepare('SELECT id FROM api_tokens WHERE token_hash = ?').get(hash);
    if (row) {
      db.prepare('UPDATE api_tokens SET last_used = unixepoch() WHERE id = ?').run(row.id);
      // API tokens act as admin
      req.user = { id: 'token', role: 'admin', username: 'api' };
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized' });
}

function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (!roles.includes(req.user.role)) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

/**
 * Checks that the current user can access a specific site.
 * Admins can access all sites. Editors/viewers need a site_permissions entry.
 */
function requireSiteAccess(paramName = 'id') {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'admin') return next();
    const siteId = req.params[paramName];
    const perm = db.prepare(
      'SELECT 1 FROM site_permissions WHERE user_id = ? AND site_id = ?'
    ).get(req.user.id, siteId);
    if (!perm) return res.status(403).json({ error: 'Forbidden' });
    next();
  };
}

module.exports = { sessionMiddleware, requireAuth, requireRole, requireSiteAccess };
