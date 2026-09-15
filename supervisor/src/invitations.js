/**
 * Link-only invitations. The token is random, shown once, stored hashed.
 * Accepting creates the user with the platform role and capabilities the
 * inviter chose. Expired or used invitations are refused.
 */
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const { PLATFORM_ROLES, PRESETS, legacyRoleFor } = require('./authz');

const DEFAULT_TTL_HOURS = 48;
const USERNAME_RE = /^[a-z0-9][a-z0-9._-]{2,31}$/;

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function createInvitations(db) {
  function create({ label, platform_role = 'member', preset = 'beginner', capabilities = {}, ttl_hours = DEFAULT_TTL_HOURS, created_by = null }) {
    if (!label || !String(label).trim()) throw Object.assign(new Error('label required'), { status: 400 });
    if (!['member', 'guest', 'admin'].includes(platform_role)) throw Object.assign(new Error('platform_role must be member, guest or admin'), { status: 400 });
    const base = PRESETS[preset] || PRESETS.beginner;
    const caps = { ...base, ...(capabilities && typeof capabilities === 'object' ? capabilities : {}) };
    const ttl = Number(ttl_hours);
    const hours = Number.isFinite(ttl) && ttl > 0 && ttl <= 24 * 30 ? ttl : DEFAULT_TTL_HOURS;
    const token = 'inv_' + nanoid(32);
    const id = nanoid(10);
    const expiresAt = Math.floor(Date.now() / 1000) + Math.round(hours * 3600);
    db.prepare('INSERT INTO invitations (id, token_hash, label, platform_role, capabilities, created_by, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(id, hashToken(token), String(label).trim(), platform_role, JSON.stringify(caps), created_by, expiresAt);
    return { id, token, label: String(label).trim(), platform_role, capabilities: caps, expires_at: expiresAt };
  }

  function list() {
    return db.prepare('SELECT id, label, platform_role, capabilities, created_by, created_at, expires_at, used_by, used_at FROM invitations ORDER BY created_at DESC').all()
      .map(r => ({ ...r, capabilities: JSON.parse(r.capabilities || '{}'), expired: !r.used_at && r.expires_at < Math.floor(Date.now() / 1000) }));
  }

  function revoke(id) {
    return db.prepare('DELETE FROM invitations WHERE id = ? AND used_at IS NULL').run(id).changes > 0;
  }

  /** Public lookup for the accept page. */
  function peek(token) {
    const row = db.prepare('SELECT id, label, platform_role, expires_at, used_at FROM invitations WHERE token_hash = ?').get(hashToken(String(token || '')));
    if (!row) return { valid: false, reason: 'unknown' };
    if (row.used_at) return { valid: false, reason: 'used' };
    if (row.expires_at < Math.floor(Date.now() / 1000)) return { valid: false, reason: 'expired' };
    return { valid: true, label: row.label, platform_role: row.platform_role, expires_at: row.expires_at };
  }

  async function accept(token, { username, password, display_name }) {
    const row = db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(hashToken(String(token || '')));
    if (!row) throw Object.assign(new Error('Invitation not found'), { status: 404 });
    if (row.used_at) throw Object.assign(new Error('Invitation already used'), { status: 410 });
    if (row.expires_at < Math.floor(Date.now() / 1000)) throw Object.assign(new Error('Invitation expired'), { status: 410 });
    const uname = String(username || '').trim().toLowerCase();
    if (!USERNAME_RE.test(uname)) throw Object.assign(new Error('Username: 3-32 characters, lowercase letters, digits, dot, dash or underscore'), { status: 400 });
    if (!password || String(password).length < 10) throw Object.assign(new Error('Password must be at least 10 characters'), { status: 400 });
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(uname)) throw Object.assign(new Error('Username already taken'), { status: 409 });
    const hash = await bcrypt.hash(String(password), 12);
    const id = nanoid(10);
    const tx = db.transaction(() => {
      db.prepare('INSERT INTO users (id, username, password_hash, role, platform_role, capabilities, status, display_name, invited_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
        .run(id, uname, hash, legacyRoleFor(row.platform_role), row.platform_role, row.capabilities, 'active', display_name ? String(display_name).trim().slice(0, 64) : null, row.created_by);
      db.prepare('UPDATE invitations SET used_by = ?, used_at = unixepoch() WHERE id = ?').run(id, row.id);
    });
    tx();
    return { id, username: uname, platform_role: row.platform_role, role: legacyRoleFor(row.platform_role) };
  }

  return { create, list, revoke, peek, accept };
}

module.exports = { createInvitations, hashToken, DEFAULT_TTL_HOURS, USERNAME_RE, PLATFORM_ROLES };
