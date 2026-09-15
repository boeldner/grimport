const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireRole, requireSiteRole, authz, isPanelAdmin } = require('../auth');
const { asyncHandler } = require('../async-handler');
const { PLATFORM_ROLES, PRESETS, legacyRoleFor, effectiveCapabilities, parseCaps } = require('../authz');
const { createInvitations } = require('../invitations');
const { notify } = require('../notify');
const { removeSiteResources, siteDir } = require('../docker');
const fs = require('fs');

const router = Router();
const invitations = createInvitations(db);

function logActivity(event, detail, actor, targetUserId = null) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(null, 'grimport', event, detail || null, actor || 'system', targetUserId);
  } catch {}
}

/** Kill every session of a user (their session rows carry userId in the JSON). */
function destroyUserSessions(userId) {
  const rows = db.prepare('SELECT sid, data FROM sessions').all();
  let n = 0;
  for (const r of rows) {
    try { if (JSON.parse(r.data)?.userId === userId) { db.prepare('DELETE FROM sessions WHERE sid = ?').run(r.sid); n++; } } catch {}
  }
  return n;
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    display_name: u.display_name || null,
    email: u.email || null,
    role: u.role,
    platform_role: u.platform_role || (u.role === 'admin' ? 'admin' : 'guest'),
    status: u.status || 'active',
    capabilities: isPanelAdmin(u) ? null : effectiveCapabilities(u),
    capabilities_override: parseCaps(u.capabilities),
    created_at: u.created_at,
    last_login_at: u.last_login_at || null,
    totp_enabled: !!u.totp_secret,
  };
}

// GET /api/users — list (admin) with owned sites + memberships
router.get('/', requireRole('admin'), (req, res) => {
  const users = db.prepare('SELECT * FROM users ORDER BY created_at ASC').all();
  const result = users.map(u => {
    const out = publicUser(u);
    if (isPanelAdmin(u)) { out.sites = 'all'; return out; }
    const owned = db.prepare('SELECT id, name FROM sites WHERE owner_id = ?').all(u.id);
    const member = db.prepare('SELECT m.site_id AS id, s.name, m.site_role FROM site_members m JOIN sites s ON s.id = m.site_id WHERE m.user_id = ?').all(u.id);
    out.owned_sites = owned;
    out.member_sites = member;
    out.sites = [...owned.map(s => s.id), ...member.map(s => s.id)];
    return out;
  });
  res.json(result);
});

// GET /api/users/presets — capability presets for the invite/edit forms
router.get('/presets', requireRole('admin'), (req, res) => {
  res.json({ presets: PRESETS, platform_roles: PLATFORM_ROLES });
});

// GET /api/users/lookup?q= — minimal directory for member pickers (any human user)
router.get('/lookup', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const rows = db.prepare("SELECT id, username, display_name, platform_role FROM users WHERE status = 'active' AND (username LIKE ? OR display_name LIKE ?) ORDER BY username LIMIT 20").all(`%${q}%`, `%${q}%`);
  res.json(rows.map(r => ({ id: r.id, username: r.username, display_name: r.display_name || null, platform_role: r.platform_role })));
});

// ── Invitations (admin) ──────────────────────────────────

router.get('/invitations', requireRole('admin'), (req, res) => {
  res.json(invitations.list());
});

router.post('/invitations', requireRole('admin'), (req, res) => {
  try {
    const { label, platform_role, preset, capabilities, ttl_hours } = req.body || {};
    if (platform_role === 'admin' && req.user.platform_role !== 'owner') return res.status(403).json({ error: 'Only the owner can invite admins' });
    const inv = invitations.create({ label, platform_role, preset, capabilities, ttl_hours, created_by: req.user.id });
    const base = `${req.protocol}://${req.get('host')}`;
    logActivity('invited', `${inv.label} (${inv.platform_role})`, req.user.username);
    res.status(201).json({ ...inv, url: `${base}/invite/${inv.token}` });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.delete('/invitations/:id', requireRole('admin'), (req, res) => {
  const ok = invitations.revoke(req.params.id);
  res.status(ok ? 200 : 404).json(ok ? { ok: true } : { error: 'Invitation not found or already used' });
});

// POST /api/users — create user directly (admin; legacy path, also sets platform role)
router.post('/', requireRole('admin'), asyncHandler(async (req, res) => {
  const { username, password, role, platform_role, preset, display_name } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  const pr = platform_role || (role === 'admin' ? 'admin' : role === 'editor' ? 'member' : 'guest');
  if (!['admin', 'member', 'guest'].includes(pr)) return res.status(400).json({ error: 'platform_role must be admin, member or guest' });
  if (pr === 'admin' && req.user.platform_role !== 'owner') return res.status(403).json({ error: 'Only the owner can create admins' });
  if (password.length < 10) return res.status(400).json({ error: 'Password must be at least 10 characters' });
  const uname = String(username).trim().toLowerCase();
  if (db.prepare('SELECT id FROM users WHERE username = ?').get(uname)) return res.status(409).json({ error: 'Username already taken' });

  const hash = await bcrypt.hash(password, 12);
  const id = nanoid(10);
  const caps = JSON.stringify(PRESETS[preset] || PRESETS.beginner);
  db.prepare('INSERT INTO users (id, username, password_hash, role, platform_role, capabilities, display_name, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, uname, hash, legacyRoleFor(pr), pr, pr === 'admin' ? '{}' : caps, display_name ? String(display_name).slice(0, 64) : null, req.user.id);
  logActivity('user_created', `${uname} (${pr})`, req.user.username, id);
  res.status(201).json(publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(id)));
}));

// GET /api/users/me — own profile incl. capabilities and sites
router.get('/me', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const out = publicUser(u);
  out.owned_sites = db.prepare('SELECT id, name FROM sites WHERE owner_id = ?').all(u.id);
  out.member_sites = db.prepare('SELECT m.site_id AS id, s.name, m.site_role FROM site_members m JOIN sites s ON s.id = m.site_id WHERE m.user_id = ?').all(u.id);
  out.subdomain_base = db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()?.value || '';
  res.json(out);
});

// PATCH /api/users/:id — admin edits anyone; users edit own password/display name
router.patch('/:id', asyncHandler(async (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const isSelf = req.user.id === target.id;
  const isAdmin = isPanelAdmin(req.user);
  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  const updates = {};

  if (req.body.password) {
    if (req.body.password.length < (isSelf ? 8 : 10)) return res.status(400).json({ error: 'Password too short' });
    if (isSelf && !isAdmin) {
      if (!req.body.current_password) return res.status(400).json({ error: 'current_password required' });
      const valid = await bcrypt.compare(req.body.current_password, target.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
  }
  if (req.body.display_name !== undefined && (isSelf || isAdmin)) updates.display_name = req.body.display_name ? String(req.body.display_name).slice(0, 64) : null;
  if (req.body.email !== undefined && (isSelf || isAdmin)) updates.email = req.body.email ? String(req.body.email).slice(0, 120) : null;

  if (isAdmin) {
    const newPr = req.body.platform_role || (req.body.role ? (req.body.role === 'admin' ? 'admin' : req.body.role === 'editor' ? 'member' : 'guest') : undefined);
    if (newPr !== undefined) {
      if (!['admin', 'member', 'guest'].includes(newPr)) return res.status(400).json({ error: 'platform_role must be admin, member or guest' });
      if (target.platform_role === 'owner') return res.status(400).json({ error: 'The owner cannot be demoted' });
      if ((newPr === 'admin' || target.platform_role === 'admin') && req.user.platform_role !== 'owner') return res.status(403).json({ error: 'Only the owner can promote or demote admins' });
      updates.platform_role = newPr;
      updates.role = legacyRoleFor(newPr);
    }
    if (req.body.capabilities !== undefined) {
      if (typeof req.body.capabilities !== 'object' || req.body.capabilities === null) return res.status(400).json({ error: 'capabilities must be an object' });
      updates.capabilities = JSON.stringify(req.body.capabilities);
    }
    if (req.body.preset !== undefined) {
      if (!PRESETS[req.body.preset]) return res.status(400).json({ error: 'Unknown preset' });
      updates.capabilities = JSON.stringify(PRESETS[req.body.preset]);
    }
    if (req.body.status !== undefined && !isSelf) {
      if (!['active', 'disabled'].includes(req.body.status)) return res.status(400).json({ error: 'status must be active or disabled' });
      if (target.platform_role === 'owner') return res.status(400).json({ error: 'The owner cannot be disabled' });
      updates.status = req.body.status;
    }
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), target.id);

  if (updates.status === 'disabled') {
    destroyUserSessions(target.id);
    db.prepare('DELETE FROM api_tokens WHERE user_id = ?').run(target.id);
    for (const s of db.prepare("SELECT id, name, container_id FROM sites WHERE owner_id = ? AND status = 'active'").all(target.id)) {
      db.prepare("UPDATE sites SET status = 'suspended' WHERE id = ?").run(s.id);
      if (s.container_id) { try { const { stopSiteContainer } = require('../docker'); await stopSiteContainer(s.container_id); } catch {} }
    }
    logActivity('user_disabled', target.username, req.user.username, target.id);
  } else if (updates.status === 'active') {
    for (const s of db.prepare("SELECT id, container_id FROM sites WHERE owner_id = ? AND status = 'suspended'").all(target.id)) {
      db.prepare("UPDATE sites SET status = 'active' WHERE id = ?").run(s.id);
      if (s.container_id) { try { const { startSiteContainer } = require('../docker'); await startSiteContainer(s.container_id); } catch {} }
    }
    logActivity('user_enabled', target.username, req.user.username, target.id);
  }
  if (updates.platform_role || updates.capabilities) logActivity('user_updated', `${target.username}: ${Object.keys(updates).join(', ')}`, req.user.username, target.id);

  res.json({ ok: true });
}));

// DELETE /api/users/:id?transfer_to=<userId>&delete_sites=1
router.delete('/:id', requireRole('admin'), asyncHandler(async (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.platform_role === 'owner') return res.status(400).json({ error: 'The owner cannot be deleted' });
  if (target.platform_role === 'admin' && req.user.platform_role !== 'owner') return res.status(403).json({ error: 'Only the owner can delete admins' });

  const owned = db.prepare('SELECT * FROM sites WHERE owner_id = ?').all(target.id);
  const deleteSites = req.query.delete_sites === '1' || req.body?.delete_sites === true;
  let transferTo = req.query.transfer_to || req.body?.transfer_to || null;
  if (!deleteSites && owned.length) {
    if (!transferTo) transferTo = db.prepare("SELECT id FROM users WHERE platform_role = 'owner' LIMIT 1").get()?.id || req.user.id;
    const t = db.prepare('SELECT id, platform_role, status FROM users WHERE id = ?').get(transferTo);
    if (!t || t.status !== 'active' || !['owner', 'admin', 'member'].includes(t.platform_role)) return res.status(400).json({ error: 'transfer_to must be an active owner, admin or member' });
  }

  if (deleteSites) {
    for (const s of owned) {
      try { await removeSiteResources({ id: s.id, container_id: s.container_id, preview_container_id: s.preview_container_id }); } catch {}
      const dir = siteDir(s.id);
      if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
      db.transaction(() => {
        for (const t of ['site_permissions', 'site_members', 'domain_requests', 'deployments', 'analytics_hourly', 'analytics_cursor', 'uptime_checks']) {
          db.prepare(`DELETE FROM ${t} WHERE site_id = ?`).run(s.id);
        }
        db.prepare('DELETE FROM sites WHERE id = ?').run(s.id);
      })();
    }
  } else if (owned.length) {
    db.prepare('UPDATE sites SET owner_id = ? WHERE owner_id = ?').run(transferTo, target.id);
    db.prepare('DELETE FROM site_members WHERE user_id = ?').run(transferTo);
  }

  destroyUserSessions(target.id);
  db.transaction(() => {
    db.prepare('DELETE FROM api_tokens WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM site_members WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM site_permissions WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(target.id);
    db.prepare('DELETE FROM users WHERE id = ?').run(target.id);
  })();
  logActivity('user_deleted', `${target.username}${owned.length ? (deleteSites ? `, ${owned.length} site(s) deleted` : `, ${owned.length} site(s) transferred`) : ''}`, req.user.username, target.id);
  res.json({ ok: true, sites: owned.length, deleted_sites: deleteSites });
}));

// GET /api/users/:id/sites — sites a user owns or is a member of (admin; legacy shape kept)
router.get('/:id/sites', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id, role, platform_role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (isPanelAdmin(user)) return res.json({ all: true, sites: [] });
  const owned = db.prepare('SELECT id FROM sites WHERE owner_id = ?').all(user.id).map(r => r.id);
  const member = db.prepare('SELECT site_id FROM site_members WHERE user_id = ?').all(user.id).map(r => r.site_id);
  res.json({ all: false, sites: [...new Set([...owned, ...member])], owned, member });
});

// PUT /api/users/:id/sites — replace memberships (admin; legacy shape: ids only -> editor for members, viewer for guests)
router.put('/:id/sites', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id, role, platform_role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { site_ids, site_role } = req.body;
  if (!Array.isArray(site_ids)) return res.status(400).json({ error: 'site_ids must be an array' });
  const role = ['viewer', 'editor'].includes(site_role) ? site_role : (user.role === 'viewer' ? 'viewer' : 'editor');
  const replace = db.transaction(ids => {
    db.prepare('DELETE FROM site_members WHERE user_id = ?').run(user.id);
    for (const siteId of ids) {
      const s = db.prepare('SELECT owner_id FROM sites WHERE id = ?').get(siteId);
      if (!s || s.owner_id === user.id) continue;
      db.prepare('INSERT OR IGNORE INTO site_members (site_id, user_id, site_role, added_by) VALUES (?, ?, ?, ?)').run(siteId, user.id, role, req.user.id);
    }
  });
  replace(site_ids);
  res.json({ ok: true });
});

module.exports = router;
