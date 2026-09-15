const session = require('express-session');
const crypto = require('crypto');
const db = require('./db');
const { BetterSqliteStore } = require('./session-store');
const { createAuthz, legacyRoleFor, isPanelAdmin, effectiveCapabilities } = require('./authz');

const authz = createAuthz(db);

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

const getUser = db.prepare('SELECT id, username, role, platform_role, capabilities, status, display_name FROM users WHERE id = ?');

/** Shape the principal object every route sees. */
function principalFromUser(row) {
  const platform_role = row.platform_role || (row.role === 'admin' ? 'admin' : row.role === 'editor' ? 'member' : 'guest');
  return {
    id: row.id,
    username: row.username,
    display_name: row.display_name || null,
    platform_role,
    role: legacyRoleFor(platform_role),
    capabilities: effectiveCapabilities({ ...row, platform_role }),
    status: row.status || 'active',
  };
}

function requireAuth(req, res, next) {
  let row = null;
  if (req.session?.userId) {
    row = getUser.get(req.session.userId);
  } else if (req.session?.authenticated) {
    // Legacy session support (single-password sessions before v0.7)
    row = db.prepare("SELECT id, username, role, platform_role, capabilities, status, display_name FROM users WHERE role = 'admin' ORDER BY rowid ASC LIMIT 1").get();
    if (row) {
      req.session.userId = row.id;
      req.session.role = row.role;
      req.session.username = row.username;
    }
  }
  if (row) {
    if (row.status && row.status !== 'active') {
      req.session?.destroy?.(() => {});
      return res.status(401).json({ error: 'Account disabled' });
    }
    req.user = principalFromUser(row);
    return next();
  }

  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const hash = crypto.createHash('sha256').update(auth.slice(7)).digest('hex');
    const tok = db.prepare('SELECT id, role, site_scope, expires_at, user_id FROM api_tokens WHERE token_hash = ?').get(hash);
    if (tok) {
      if (tok.expires_at && tok.expires_at < Math.floor(Date.now() / 1000)) {
        return res.status(401).json({ error: 'API token has expired' });
      }
      const owner = tok.user_id ? getUser.get(tok.user_id) : null;
      if (owner && owner.status && owner.status !== 'active') {
        return res.status(401).json({ error: 'Token owner is disabled' });
      }
      db.prepare('UPDATE api_tokens SET last_used = unixepoch() WHERE id = ?').run(tok.id);
      // site_scope: NULL/'all' = unrestricted (within the owner's rights). Otherwise a
      // JSON array of site ids the token may act on — an ADDITIONAL restriction on top
      // of the role check, never a widening (least privilege for CI tokens).
      let tokenSiteScope = null;
      if (tok.site_scope && tok.site_scope !== 'all') {
        try { tokenSiteScope = JSON.parse(tok.site_scope); } catch { tokenSiteScope = null; }
      }
      const ownerPrincipal = owner ? principalFromUser(owner) : null;
      // A token never exceeds its owner's legacy role (admin > editor > viewer).
      const order = { viewer: 1, editor: 2, admin: 3 };
      const tokRole = tok.role || 'admin';
      const role = ownerPrincipal ? (order[tokRole] <= order[ownerPrincipal.role] ? tokRole : ownerPrincipal.role) : tokRole;
      req.user = {
        id: 'token',
        tokenId: tok.id,
        role,
        platform_role: ownerPrincipal?.platform_role || (role === 'admin' ? 'admin' : 'guest'),
        username: 'api',
        tokenSiteScope,
        tokenOwner: ownerPrincipal,
        capabilities: ownerPrincipal?.capabilities || effectiveCapabilities({ platform_role: 'admin' }),
        status: 'active',
      };
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
 * Site access = at least viewer on the site (owner, member, admin, or a token
 * scoped/allowed for it). Kept for backward compatibility; new code should use
 * requireSiteRole('viewer' | 'editor' | 'owner').
 */
function requireSiteAccess(paramName = 'id') {
  return authz.requireSiteRole('viewer', paramName);
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

module.exports = {
  sessionMiddleware,
  requireAuth,
  requireRole,
  requireSiteAccess,
  requireSiteRole: authz.requireSiteRole,
  requirePlatform: authz.requirePlatform,
  requireHumanSession,
  authz,
  isPanelAdmin,
  principalFromUser,
};
