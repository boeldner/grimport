const { Router } = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { nanoid } = require('nanoid');
const db = require('../db');

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
  });
});

// PUT /api/settings
router.put('/', (req, res) => {
  const { site_base_domain, default_spa_mode, default_cache_enabled, acme_email, analytics_snippet } = req.body;
  if (site_base_domain !== undefined) setSetting('site_base_domain', site_base_domain.trim().toLowerCase());
  if (default_spa_mode !== undefined) setSetting('default_spa_mode', default_spa_mode ? '1' : '0');
  if (default_cache_enabled !== undefined) setSetting('default_cache_enabled', default_cache_enabled ? '1' : '0');
  if (acme_email !== undefined) setSetting('acme_email', acme_email.trim().toLowerCase());
  if (analytics_snippet !== undefined) setSetting('analytics_snippet', analytics_snippet.trim());
  res.json({ ok: true, restart_required: acme_email !== undefined });
});

// GET /api/settings/tokens
router.get('/tokens', (req, res) => {
  const tokens = db.prepare(
    'SELECT id, name, created_at, last_used FROM api_tokens ORDER BY created_at DESC'
  ).all();
  res.json(tokens);
});

// POST /api/settings/tokens
router.post('/tokens', (req, res) => {
  const { name } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const token = 'grim_' + nanoid(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = nanoid(10);
  db.prepare('INSERT INTO api_tokens (id, name, token_hash) VALUES (?, ?, ?)').run(id, name.trim(), hash);
  res.json({ id, name: name.trim(), token }); // token shown once
});

// DELETE /api/settings/tokens/:id
router.delete('/tokens/:id', (req, res) => {
  db.prepare('DELETE FROM api_tokens WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// PUT /api/settings/password
router.put('/password', async (req, res) => {
  const { old_password, new_password } = req.body;
  if (!old_password || !new_password) return res.status(400).json({ error: 'old_password and new_password required' });
  if (new_password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const row = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  const valid = await bcrypt.compare(old_password, row.value);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(new_password, 12);
  setSetting('password_hash', hash);
  res.json({ ok: true });
});

module.exports = router;
