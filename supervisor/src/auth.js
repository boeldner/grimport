const session = require('express-session');
const crypto = require('crypto');
const db = require('./db');
const { BetterSqliteStore } = require('./session-store');

const sessionMiddleware = session({
  store: new BetterSqliteStore(),
  secret: process.env.SUPERVISOR_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  name: 'wh.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // Secure is OPT-IN. Most deployments terminate TLS at a proxy (Cloudflare
    // Tunnel, Traefik) and forward plain HTTP to the supervisor, so the app
    // sees an insecure connection and express-session would refuse to set a
    // Secure cookie — silently breaking login. Only enable Secure when the
    // operator explicitly opts in (SESSION_SECURE=true) AND their proxy sends
    // X-Forwarded-Proto: https (trust proxy is set below).
    secure: process.env.SESSION_SECURE === 'true',
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
    const row = db.prepare('SELECT id, role, site_scope, expires_at FROM api_tokens WHERE token_hash = ?').get(hash);
    if (row) {
      if (row.expires_at && row.expires_at < Math.floor(Date.now() / 1000)) {
        return res.status(401).json({ error: 'API token has expired' });
      }
      db.prepare('UPDATE api_tokens SET last_used = unixepoch() WHERE id = ?').run(row.id);
      // site_scope: NULL/'all' = unrestricted (matches pre-v0.9.5 tokens). Otherwise a
      // JSON array of site ids the token may act on — an ADDITIONAL restriction on top
      // of the role check, never a widening (least privilege for CI tokens).
      let tokenSiteScope = null;
      if (row.site_scope && row.site_scope !== 'all') {
        try { tokenSiteScope = JSON.parse(row.site_scope); } catch { tokenSiteScope = null; }
      }
      req.user = { id: 'token', role: row.role || 'admin', username: 'api', tokenSiteScope };
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
    const siteId = req.params[paramName];

    // Token principals have no site_permissions rows — the token's own scope
    // IS its permission grant, so check that instead of the users table.
    if (req.user.id === 'token') {
      if (req.user.tokenSiteScope) {
        if (!req.user.tokenSiteScope.includes(siteId)) {
          return res.status(403).json({ error: 'Forbidden: token is not scoped to this site' });
        }
        return next();
      }
      // Unscoped token: role gates access same as a session user would.
      if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
      return next();
    }

    if (req.user.role !== 'admin') {
      const perm = db.prepare(
        'SELECT 1 FROM site_permissions WHERE user_id = ? AND site_id = ?'
      ).get(req.user.id, siteId);
      if (!perm) return res.status(403).json({ error: 'Forbidden' });
    }
    // A token's site_scope is an ADDITIONAL restriction, applied regardless of role —
    // even an admin-role token scoped to specific sites stays limited to them.
    // (Unreachable for token principals now that the branch above handles them
    // directly; kept as a harmless double-check in case that branch changes.)
    if (req.user.tokenSiteScope && !req.user.tokenSiteScope.includes(siteId)) {
      return res.status(403).json({ error: 'Forbidden: token is not scoped to this site' });
    }
    next();
  };
}

/**
 * Blocks API token principals from routes that manage the panel's own
 * auth/backup surface (tokens, users, backups). API tokens are for
 * deploy/site operations (CI), never for self-privilege management —
 * without this a token could mint/renew itself, create admin users, or
 * download the full DB. Interactive (session) admins are unaffected.
 */
function requireHumanSession(req, res, next) {
  if (req.user?.id === 'token') {
    return res.status(403).json({ error: 'This action requires an interactive admin session, not an API token' });
  }
  next();
}

module.exports = { sessionMiddleware, requireAuth, requireRole, requireSiteAccess, requireHumanSession };
