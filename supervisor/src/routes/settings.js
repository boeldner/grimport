// NOTE: mounted behind requireRole('admin') in index.js — all routes here are admin-only.
const { Router } = require('express');
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');
const { assertPublicUrl } = require('../validate');
const { asyncHandler } = require('../async-handler');
const { sendAlert, getNtfyConfig, setNtfyConfig, postNtfy, ALL_ALERT_EVENTS } = require('../alerts');
const { requireHumanSession } = require('../auth');

const router = Router();

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

// GET /api/settings
router.get('/', (req, res) => {
  res.json({
    site_base_domain: getSetting('site_base_domain'),
    default_spa_mode: getSetting('default_spa_mode') === '1',
    default_cache_enabled: getSetting('default_cache_enabled') !== '0',
    acme_email: getSetting('acme_email') || process.env.ACME_EMAIL || '',
    analytics_snippet: getSetting('analytics_snippet') || '',
    onboarding_done: getSetting('onboarding_done') === '1',
    // Owner/admin 2FA policy — see docs/wiki/Security-Model.md "Panel login".
    // Off by default so an existing install is never suddenly locked out.
    require_totp_admins: getSetting('require_totp_admins') === '1',
  });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const { site_base_domain, default_spa_mode, default_cache_enabled, acme_email, analytics_snippet, onboarding_done, require_totp_admins } = req.body;
  if (site_base_domain !== undefined) setSetting('site_base_domain', site_base_domain.trim().toLowerCase());
  if (default_spa_mode !== undefined) setSetting('default_spa_mode', default_spa_mode ? '1' : '0');
  if (default_cache_enabled !== undefined) setSetting('default_cache_enabled', default_cache_enabled ? '1' : '0');
  if (acme_email !== undefined) setSetting('acme_email', acme_email.trim().toLowerCase());
  if (analytics_snippet !== undefined) setSetting('analytics_snippet', analytics_snippet.trim());
  // onboarding_done is write-once in practice: the wizard sets it true on
  // finish/skip and never unsets it, so first-run detection never re-fires.
  if (onboarding_done !== undefined) setSetting('onboarding_done', onboarding_done ? '1' : '0');
  if (require_totp_admins !== undefined) setSetting('require_totp_admins', require_totp_admins ? '1' : '0');
  res.json({ ok: true, restart_required: acme_email !== undefined });
});

// GET /api/settings/tokens — every token on the panel (admin), with its owner
router.get('/tokens', (req, res) => {
  const tokens = db.prepare(
    `SELECT t.id, t.name, t.role, t.site_scope, t.expires_at, t.created_at, t.last_used, t.user_id, u.username AS owner
     FROM api_tokens t LEFT JOIN users u ON u.id = t.user_id ORDER BY t.created_at DESC`
  ).all();
  res.json(tokens.map(t => ({ ...t, site_scope: t.site_scope ? JSON.parse(t.site_scope) : 'all' })));
});

// GET/PUT /api/settings/policies — multi-user policies
const POLICY_DEFAULTS = { custom_domain_policy: 'approval', default_preset: 'beginner', invite_ttl_hours: 48 };
router.get('/policies', (req, res) => {
  res.json({
    custom_domain_policy: getSetting('custom_domain_policy') || POLICY_DEFAULTS.custom_domain_policy,
    default_preset: getSetting('default_preset') || POLICY_DEFAULTS.default_preset,
    invite_ttl_hours: Number(getSetting('invite_ttl_hours')) || POLICY_DEFAULTS.invite_ttl_hours,
  });
});
router.put('/policies', requireHumanSession, (req, res) => {
  const { custom_domain_policy, default_preset, invite_ttl_hours } = req.body || {};
  if (custom_domain_policy !== undefined) {
    if (!['approval', 'free'].includes(custom_domain_policy)) return res.status(400).json({ error: 'custom_domain_policy must be approval or free' });
    setSetting('custom_domain_policy', custom_domain_policy);
  }
  if (default_preset !== undefined) {
    if (!['beginner', 'maker'].includes(default_preset)) return res.status(400).json({ error: 'default_preset must be beginner or maker' });
    setSetting('default_preset', default_preset);
  }
  if (invite_ttl_hours !== undefined) {
    const n = Number(invite_ttl_hours);
    if (!Number.isFinite(n) || n < 1 || n > 720) return res.status(400).json({ error: 'invite_ttl_hours must be 1-720' });
    setSetting('invite_ttl_hours', String(Math.round(n)));
  }
  res.json({ ok: true });
});

// POST /api/settings/tokens — a token must not mint new tokens (kills
// self-renewal-past-expiry and scope-escape).
router.post('/tokens', requireHumanSession, (req, res) => {
  const { name, role, site_scope, expires_in_days } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const tokenRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'admin';

  // site_scope: 'all' / undefined / null → unrestricted. A non-empty array of site ids
  // scopes the token to just those sites (see auth.js requireSiteAccess).
  let siteScopeValue = null;
  if (Array.isArray(site_scope)) {
    if (site_scope.length) {
      const ids = site_scope.map(String);
      const placeholders = ids.map(() => '?').join(',');
      const found = db.prepare(`SELECT id FROM sites WHERE id IN (${placeholders})`).all(...ids);
      if (found.length !== ids.length) return res.status(400).json({ error: 'site_scope contains an unknown site id' });
      siteScopeValue = JSON.stringify(ids);
    }
  } else if (site_scope !== undefined && site_scope !== null && site_scope !== 'all') {
    return res.status(400).json({ error: 'site_scope must be "all" or an array of site ids' });
  }

  // expires_in_days: optional number of days from now. Omitted/null/'' → never expires.
  let expiresAt = null;
  if (expires_in_days !== undefined && expires_in_days !== null && expires_in_days !== '') {
    const days = Number(expires_in_days);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: 'expires_in_days must be a positive number' });
    expiresAt = Math.floor(Date.now() / 1000) + Math.round(days * 86400);
  }

  const token = 'grim_' + nanoid(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = nanoid(10);
  db.prepare(
    'INSERT INTO api_tokens (id, name, token_hash, role, site_scope, expires_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)'
  ).run(id, name.trim(), hash, tokenRole, siteScopeValue, expiresAt, req.user.id);
  res.json({
    id,
    name: name.trim(),
    role: tokenRole,
    site_scope: siteScopeValue ? JSON.parse(siteScopeValue) : 'all',
    expires_at: expiresAt,
    token, // token shown once
  });
});

// DELETE /api/settings/tokens/:id — a token must not revoke tokens either.
router.delete('/tokens/:id', requireHumanSession, (req, res) => {
  db.prepare('DELETE FROM api_tokens WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// NOTE: password changes now go through PATCH /api/users/:id (self-service
// path, checks the `users` table — see routes/users.js). The legacy
// PUT /settings/password route (which wrote to the unused
// settings.password_hash key and never touched the row `login` reads) has
// been retired.

// PUT /api/settings/notification-events — which bell event types are enabled
router.put('/notification-events', (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || !events.every(e => ['unknown_domain', 'site_down', 'site_up'].includes(e))) {
    return res.status(400).json({ error: 'events must be an array of unknown_domain, site_down, site_up' });
  }
  setSetting('notification_events', JSON.stringify(events));
  res.json({ ok: true, events });
});

// GET /api/settings/notification-events
router.get('/notification-events', (req, res) => {
  const raw = getSetting('notification_events');
  let events;
  try {
    events = raw ? JSON.parse(raw) : ['unknown_domain', 'site_down', 'site_up'];
  } catch {
    events = ['unknown_domain', 'site_down', 'site_up'];
  }
  res.json({ events });
});

// GET /api/settings/alerts — ntfy alert-channel config
router.get('/alerts', (req, res) => {
  res.json({ ntfy: getNtfyConfig(), events: ALL_ALERT_EVENTS });
});

// PUT /api/settings/alerts — save ntfy alert-channel config
router.put('/alerts', asyncHandler(async (req, res) => {
  const { url, enabled, events } = req.body?.ntfy || req.body || {};

  if (enabled && url) {
    try { await assertPublicUrl(url); }
    catch (e) { return res.status(400).json({ error: e.message }); }
  }

  if (events !== undefined && !(Array.isArray(events) && events.every(e => ALL_ALERT_EVENTS.includes(e)))) {
    return res.status(400).json({ error: `events must be an array of ${ALL_ALERT_EVENTS.join(', ')}` });
  }

  const cfg = setNtfyConfig({ url, enabled, events });
  res.json({ ok: true, ntfy: cfg });
}));

// POST /api/settings/alerts/test — send a test ntfy alert using the saved config
router.post('/alerts/test', asyncHandler(async (req, res) => {
  const ntfy = getNtfyConfig();
  if (!ntfy.url) return res.status(400).json({ error: 'No ntfy URL configured' });

  try { await assertPublicUrl(ntfy.url); }
  catch (e) { return res.status(400).json({ error: e.message }); }

  postNtfy(ntfy.url, 'site_down', 'Test Site', 'This is a test alert from Grimport.');
  res.json({ ok: true });
}));

module.exports = router;
