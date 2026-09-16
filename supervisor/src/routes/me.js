/**
 * GET /api/me — what the caller is allowed to do. Works for sessions and API
 * tokens alike and is the first thing an agent (MCP) should call so it can
 * explain limits ("you can create 1 more site") instead of running into them.
 */
const { Router } = require('express');
const db = require('../db');
const { authz } = require('../auth');
const { version } = require('../../package.json');
const { panelBaseUrl } = require('../mcp/remote');

const router = Router();

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

function finite(n) {
  return Number.isFinite(n) ? n : null; // Infinity (admins) -> null = unlimited
}

router.get('/', (req, res) => {
  const u = req.user;
  const isToken = u.id === 'token';
  const account = isToken ? u.tokenOwner : u;
  const caps = u.capabilities || {};
  const base = getSetting('site_base_domain') || null;
  const sitesUsed = account?.id ? db.prepare('SELECT COUNT(*) AS c FROM sites WHERE owner_id = ?').get(account.id).c : null;
  const accessible = authz.accessibleSiteIds(u); // null = every site

  res.json({
    authenticated: true,
    auth: {
      kind: isToken ? 'token' : 'session',
      token_id: u.tokenId || null,
      site_scope: u.tokenSiteScope || 'all',
    },
    user: account ? {
      id: account.id,
      username: account.username,
      display_name: account.display_name || null,
    } : null,
    platform_role: u.platform_role,
    role: u.role,
    capabilities: {
      runtimes: caps.runtimes || ['static'],
      max_sites: finite(caps.max_sites),
      max_upload_mb: finite(caps.max_upload_mb),
      disk_quota_mb: finite(caps.disk_quota_mb),
      custom_domains: caps.custom_domains || 'approval',
      api_tokens: caps.api_tokens !== false,
      webhooks: !!caps.webhooks,
      advanced_ui: caps.advanced_ui !== false,
    },
    quota: {
      sites_used: sitesUsed,
      sites_max: finite(caps.max_sites),
      sites_left: sitesUsed === null || !Number.isFinite(caps.max_sites) ? null : Math.max(0, caps.max_sites - sitesUsed),
    },
    site_base_domain: base,
    automatic_subdomain: base ? `<slug>.${base}` : null,
    accessible_site_ids: accessible,
    panel_url: panelBaseUrl(),
    mcp_endpoint: `${panelBaseUrl()}/mcp`,
    version,
  });
});

module.exports = router;
