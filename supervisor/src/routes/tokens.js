/**
 * Per-user API tokens: every human user manages their own. A token can never
 * grant more than its owner has: role capped at the owner's legacy role, site
 * scope limited to sites the owner can access. Admin-wide listing/revocation
 * stays under /api/settings/tokens.
 */
const { Router } = require('express');
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireHumanSession, authz, isPanelAdmin } = require('../auth');

const router = Router();
router.use(requireHumanSession);

function shape(t) {
  return { ...t, site_scope: t.site_scope ? JSON.parse(t.site_scope) : 'all' };
}

router.get('/', (req, res) => {
  if (req.user.capabilities && req.user.capabilities.api_tokens === false) return res.json([]);
  const rows = db.prepare('SELECT id, name, role, site_scope, expires_at, created_at, last_used, oauth_client_id FROM api_tokens WHERE user_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(rows.map(shape));
});

router.post('/', (req, res) => {
  if (req.user.capabilities && req.user.capabilities.api_tokens === false) return res.status(403).json({ error: 'API tokens are not enabled for your account' });
  const { name, role, site_scope, expires_in_days } = req.body || {};
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });

  const order = { viewer: 1, editor: 2, admin: 3 };
  const wanted = ['admin', 'editor', 'viewer'].includes(role) ? role : req.user.role;
  const tokenRole = order[wanted] <= order[req.user.role] ? wanted : req.user.role;

  const accessible = authz.accessibleSiteIds(req.user); // null = all (admins)
  let siteScopeValue = null;
  if (Array.isArray(site_scope) && site_scope.length) {
    const ids = site_scope.map(String);
    if (accessible !== null && ids.some(id => !accessible.includes(id))) return res.status(403).json({ error: 'site_scope contains a site you cannot access' });
    const placeholders = ids.map(() => '?').join(',');
    const found = db.prepare(`SELECT id FROM sites WHERE id IN (${placeholders})`).all(...ids);
    if (found.length !== ids.length) return res.status(400).json({ error: 'site_scope contains an unknown site id' });
    siteScopeValue = JSON.stringify(ids);
  } else if (!isPanelAdmin(req.user)) {
    // Non-admins: "all" means "all of my sites right now" — pin it so a later
    // membership does not silently widen an old token.
    siteScopeValue = JSON.stringify(accessible || []);
  }

  let expiresAt = null;
  if (expires_in_days !== undefined && expires_in_days !== null && expires_in_days !== '') {
    const days = Number(expires_in_days);
    if (!Number.isFinite(days) || days <= 0) return res.status(400).json({ error: 'expires_in_days must be a positive number' });
    expiresAt = Math.floor(Date.now() / 1000) + Math.round(days * 86400);
  }

  const token = 'grim_' + nanoid(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = nanoid(10);
  db.prepare('INSERT INTO api_tokens (id, name, token_hash, role, site_scope, expires_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(id, name.trim(), hash, tokenRole, siteScopeValue, expiresAt, req.user.id);
  res.status(201).json({ id, name: name.trim(), role: tokenRole, site_scope: siteScopeValue ? JSON.parse(siteScopeValue) : 'all', expires_at: expiresAt, token });
});

router.delete('/:id', (req, res) => {
  const r = db.prepare('DELETE FROM api_tokens WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.status(r.changes ? 200 : 404).json(r.changes ? { ok: true } : { error: 'Token not found' });
});

module.exports = router;
