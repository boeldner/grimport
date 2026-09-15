/**
 * Authorization model (docs/roadmap/multi-user-platform.md section 2).
 *
 * Platform roles: owner (exactly one) > admin > member > guest.
 *   owner/admin  run the panel and have implicit `owner` rights on every site
 *                ("support access", always logged and visible to the site owner)
 *   member       invited friend: creates sites within a quota and owns them
 *   guest        no sites of their own, only roles granted on other people's sites
 * Site roles (site_members / sites.owner_id): owner > editor > viewer.
 *
 * `users.role` (admin | editor | viewer) is kept as the legacy "effective" role
 * so older code paths and API tokens keep working; it is derived from the
 * platform role and never edited directly any more.
 *
 * Every function takes the db handle from the caller-supplied `db` (default:
 * the app DB) so the matrix is unit-testable against an in-memory database.
 */

const PLATFORM_ROLES = ['owner', 'admin', 'member', 'guest'];
const SITE_ROLES = ['viewer', 'editor', 'owner'];
const SITE_RANK = { viewer: 1, editor: 2, owner: 3 };

// Capability presets. Admins/owners are unlimited (see effectiveCapabilities).
const PRESETS = {
  beginner: {
    runtimes: ['static'],
    max_sites: 3,
    max_upload_mb: 100,
    disk_quota_mb: 1000,
    custom_domains: 'approval',
    api_tokens: true,
    webhooks: false,
    advanced_ui: false,
  },
  maker: {
    runtimes: ['static', 'php', 'node', 'python'],
    max_sites: 10,
    max_upload_mb: 250,
    disk_quota_mb: 5000,
    custom_domains: 'approval',
    api_tokens: true,
    webhooks: true,
    advanced_ui: true,
  },
};
const UNLIMITED = {
  runtimes: ['static', 'php', 'node', 'python'],
  max_sites: Infinity,
  max_upload_mb: 250,
  disk_quota_mb: Infinity,
  custom_domains: 'free',
  api_tokens: true,
  webhooks: true,
  advanced_ui: true,
};

function legacyRoleFor(platformRole) {
  if (platformRole === 'owner' || platformRole === 'admin') return 'admin';
  if (platformRole === 'member') return 'editor';
  return 'viewer';
}

function isPanelAdmin(user) {
  return !!user && (user.platform_role === 'owner' || user.platform_role === 'admin' || (!user.platform_role && user.role === 'admin'));
}

function parseCaps(json) {
  try { const v = JSON.parse(json || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}

/** Merged capabilities for a user: preset defaults + per-user overrides; admins unlimited. */
function effectiveCapabilities(user, presetName = 'beginner') {
  if (isPanelAdmin(user)) return { ...UNLIMITED };
  const base = PRESETS[presetName] || PRESETS.beginner;
  const own = typeof user?.capabilities === 'string' ? parseCaps(user.capabilities) : (user?.capabilities || {});
  const caps = { ...base, ...own };
  if (user?.platform_role === 'guest') caps.max_sites = 0;
  return caps;
}

function maxSiteRoleForLegacy(role) {
  if (role === 'admin') return 'owner';
  if (role === 'editor') return 'editor';
  return 'viewer';
}

function minRole(a, b) {
  if (!a || !b) return null;
  return SITE_RANK[a] <= SITE_RANK[b] ? a : b;
}

function createAuthz(db) {
  const getSite = db.prepare('SELECT id, owner_id, status FROM sites WHERE id = ?');
  const getMember = db.prepare('SELECT site_role FROM site_members WHERE site_id = ? AND user_id = ?');
  const getUser = db.prepare('SELECT id, username, role, platform_role, capabilities, status, display_name FROM users WHERE id = ?');

  /** Site role of a HUMAN user on a site (ignores tokens). null when none. */
  function humanSiteRole(user, siteId) {
    if (!user) return null;
    if (isPanelAdmin(user)) return 'owner';
    const site = getSite.get(siteId);
    if (!site) return null;
    if (site.owner_id && site.owner_id === user.id) return 'owner';
    const m = getMember.get(siteId, user.id);
    return m ? m.site_role : null;
  }

  /**
   * Effective site role for the request principal.
   * Tokens: min(token role, owner's role on the site), and only inside the
   * token's site scope. Unscoped tokens of a panel admin behave as before.
   */
  function siteRoleFor(user, siteId) {
    if (!user) return null;
    if (user.id === 'token') {
      if (user.tokenSiteScope && !user.tokenSiteScope.includes(siteId)) return null;
      const tokenRole = maxSiteRoleForLegacy(user.role);
      const owner = user.tokenOwner ? (user.tokenOwner.id ? user.tokenOwner : getUser.get(user.tokenOwner)) : null;
      if (!owner) {
        // Legacy / ownerless token (pre-0.12 rows, or owner since deleted):
        // admin tokens act as a panel admin, others only inside an explicit scope.
        if (user.role === 'admin') return 'owner';
        return user.tokenSiteScope ? tokenRole : null;
      }
      if (owner.status && owner.status !== 'active') return null;
      const ownerRole = humanSiteRole(owner, siteId);
      return minRole(tokenRole, ownerRole);
    }
    return humanSiteRole(user, siteId);
  }

  function hasSiteRole(user, siteId, min) {
    const r = siteRoleFor(user, siteId);
    return !!r && SITE_RANK[r] >= SITE_RANK[min];
  }

  /** Is this admin acting on a site they neither own nor are a member of? */
  function isSupportAccess(user, siteId) {
    if (!user || user.id === 'token' || !isPanelAdmin(user)) return false;
    const site = getSite.get(siteId);
    if (!site) return false;
    if (site.owner_id === user.id) return false;
    return !getMember.get(siteId, user.id);
  }

  /** Site ids a user can see (admins: null = all). */
  function accessibleSiteIds(user) {
    if (!user) return [];
    if (user.id === 'token') {
      const owner = user.tokenOwner ? (user.tokenOwner.id ? user.tokenOwner : getUser.get(user.tokenOwner)) : null;
      const base = owner ? accessibleSiteIds(owner) : (user.role === 'admin' ? null : []);
      if (user.tokenSiteScope) return base === null ? [...user.tokenSiteScope] : base.filter(id => user.tokenSiteScope.includes(id));
      return base;
    }
    if (isPanelAdmin(user)) return null;
    const owned = db.prepare('SELECT id FROM sites WHERE owner_id = ?').all(user.id).map(r => r.id);
    const member = db.prepare('SELECT site_id FROM site_members WHERE user_id = ?').all(user.id).map(r => r.site_id);
    return [...new Set([...owned, ...member])];
  }

  /** SQL fragment + params to restrict a query on sites.id / a site_id column. */
  function siteScopeSql(user, column = 's.id') {
    const ids = accessibleSiteIds(user);
    if (ids === null) return { sql: '1=1', params: [] };
    if (!ids.length) return { sql: '1=0', params: [] };
    return { sql: `${column} IN (${ids.map(() => '?').join(',')})`, params: ids };
  }

  /** Express middleware: require at least `min` site role on req.params[param]. */
  function requireSiteRole(min = 'viewer', param = 'id') {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const siteId = req.params[param];
      const role = siteRoleFor(req.user, siteId);
      if (!role) {
        if (req.user.id === 'token' && req.user.tokenSiteScope && !req.user.tokenSiteScope.includes(siteId)) {
          return res.status(403).json({ error: 'Forbidden: token is not scoped to this site' });
        }
        return res.status(403).json({ error: 'Forbidden' });
      }
      if (SITE_RANK[role] < SITE_RANK[min]) return res.status(403).json({ error: `Forbidden: needs ${min} access to this site` });
      req.siteRole = role;
      req.supportMode = isSupportAccess(req.user, siteId);
      next();
    };
  }

  function requirePlatform(...roles) {
    return (req, res, next) => {
      if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
      const pr = req.user.platform_role || (req.user.role === 'admin' ? 'admin' : 'guest');
      if (!roles.includes(pr)) return res.status(403).json({ error: 'Forbidden' });
      next();
    };
  }

  function siteOwnerId(siteId) {
    return getSite.get(siteId)?.owner_id || null;
  }

  return { siteRoleFor, hasSiteRole, humanSiteRole, isSupportAccess, accessibleSiteIds, siteScopeSql, requireSiteRole, requirePlatform, siteOwnerId };
}

module.exports = {
  PLATFORM_ROLES, SITE_ROLES, SITE_RANK, PRESETS, UNLIMITED,
  legacyRoleFor, isPanelAdmin, effectiveCapabilities, parseCaps, maxSiteRoleForLegacy, minRole, createAuthz,
};
