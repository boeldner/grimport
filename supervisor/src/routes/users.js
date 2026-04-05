const { Router } = require('express');
const bcrypt = require('bcryptjs');
const { nanoid } = require('nanoid');
const db = require('../db');
const { requireRole } = require('../auth');

const router = Router();

// GET /api/users — list all users (admin only)
router.get('/', requireRole('admin'), (req, res) => {
  const users = db.prepare(
    'SELECT id, username, role, created_at FROM users ORDER BY created_at ASC'
  ).all();
  // Attach site assignments for each non-admin user
  const result = users.map(u => {
    if (u.role === 'admin') return { ...u, sites: 'all' };
    const siteIds = db.prepare('SELECT site_id FROM site_permissions WHERE user_id = ?')
      .all(u.id).map(r => r.site_id);
    return { ...u, sites: siteIds };
  });
  res.json(result);
});

// POST /api/users — create user (admin only)
router.post('/', requireRole('admin'), async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'username and password required' });
  if (!['admin', 'editor', 'viewer'].includes(role)) return res.status(400).json({ error: 'role must be admin, editor, or viewer' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) return res.status(409).json({ error: 'Username already taken' });

  const hash = await bcrypt.hash(password, 12);
  const id = nanoid(10);
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(id, username, hash, role);
  res.status(201).json({ id, username, role });
});

// PATCH /api/users/:id — update user (admin can update anyone; users can update own password)
router.patch('/:id', async (req, res) => {
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });

  const isSelf = req.user.id === target.id;
  const isAdmin = req.user.role === 'admin';
  if (!isAdmin && !isSelf) return res.status(403).json({ error: 'Forbidden' });

  const updates = {};

  if (req.body.password) {
    if (req.body.password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (isSelf && !isAdmin) {
      // Must provide current password when changing own password as non-admin
      if (!req.body.current_password) return res.status(400).json({ error: 'current_password required' });
      const valid = await bcrypt.compare(req.body.current_password, target.password_hash);
      if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });
    }
    updates.password_hash = await bcrypt.hash(req.body.password, 12);
  }

  if (req.body.role && isAdmin) {
    if (!['admin', 'editor', 'viewer'].includes(req.body.role)) return res.status(400).json({ error: 'Invalid role' });
    // Prevent demoting the last admin
    if (target.role === 'admin' && req.body.role !== 'admin') {
      const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
      if (adminCount <= 1) return res.status(400).json({ error: 'Cannot demote the last admin' });
    }
    updates.role = req.body.role;
  }

  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
  db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...Object.values(updates), target.id);
  res.json({ ok: true });
});

// DELETE /api/users/:id — delete user (admin only, cannot delete self)
router.delete('/:id', requireRole('admin'), (req, res) => {
  if (req.params.id === req.user.id) return res.status(400).json({ error: 'Cannot delete yourself' });
  const target = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!target) return res.status(404).json({ error: 'User not found' });
  if (target.role === 'admin') {
    const adminCount = db.prepare("SELECT COUNT(*) as c FROM users WHERE role = 'admin'").get().c;
    if (adminCount <= 1) return res.status(400).json({ error: 'Cannot delete the last admin' });
  }
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// GET /api/users/:id/sites — get site assignments for a user
router.get('/:id/sites', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id, role FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin') return res.json({ all: true, sites: [] });
  const sites = db.prepare('SELECT site_id FROM site_permissions WHERE user_id = ?')
    .all(req.params.id).map(r => r.site_id);
  res.json({ all: false, sites });
});

// PUT /api/users/:id/sites — replace site assignments for a user
router.put('/:id/sites', requireRole('admin'), (req, res) => {
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const { site_ids } = req.body;
  if (!Array.isArray(site_ids)) return res.status(400).json({ error: 'site_ids must be an array' });

  const replace = db.transaction(ids => {
    db.prepare('DELETE FROM site_permissions WHERE user_id = ?').run(req.params.id);
    for (const siteId of ids) {
      db.prepare('INSERT OR IGNORE INTO site_permissions (user_id, site_id) VALUES (?, ?)')
        .run(req.params.id, siteId);
    }
  });
  replace(site_ids);
  res.json({ ok: true });
});

module.exports = router;
