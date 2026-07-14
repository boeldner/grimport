// NOTE: mounted behind requireRole('admin') in index.js — all routes here are admin-only.
const { Router } = require('express');
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
    'SELECT id, name, role, created_at, last_used FROM api_tokens ORDER BY created_at DESC'
  ).all();
  res.json(tokens);
});

// POST /api/settings/tokens
router.post('/tokens', (req, res) => {
  const { name, role } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const tokenRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'admin';
  const token = 'grim_' + nanoid(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = nanoid(10);
  db.prepare('INSERT INTO api_tokens (id, name, token_hash, role) VALUES (?, ?, ?, ?)').run(id, name.trim(), hash, tokenRole);
  res.json({ id, name: name.trim(), role: tokenRole, token }); // token shown once
});

// DELETE /api/settings/tokens/:id
router.delete('/tokens/:id', (req, res) => {
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

module.exports = router;
