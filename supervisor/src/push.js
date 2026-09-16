/**
 * Web push (VAPID). Every in-panel notification (notify.js) is also pushed to
 * the recipients' subscribed devices, filtered by the event groups each
 * device opted into. Keys are generated once and kept in the settings table,
 * so nothing has to be configured.
 */
const webpush = require('web-push');
const db = require('./db');

const PUSH_EVENT_GROUPS = {
  availability: ['site_down', 'site_up'],
  deploys: ['deploy_review', 'deploy_blocked', 'deploy_findings', 'deploy_decided'],
  requests: ['domain_request', 'domain_decided', 'unknown_domain'],
  account: ['support_action', 'site_suspended', 'site_unsuspended', 'site_transferred'],
};
const ALL_GROUPS = Object.keys(PUSH_EVENT_GROUPS);
const MAX_FAILURES = 8;

// Swappable for tests.
const _deps = {
  send: (subscription, payload, options) => webpush.sendNotification(subscription, payload, options),
};

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}
function setSetting(key, value) {
  db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, value);
}

/** VAPID key pair, generated on first use and persisted. */
function vapidKeys() {
  let publicKey = getSetting('vapid_public');
  let privateKey = getSetting('vapid_private');
  if (!publicKey || !privateKey) {
    ({ publicKey, privateKey } = webpush.generateVAPIDKeys());
    setSetting('vapid_public', publicKey);
    setSetting('vapid_private', privateKey);
  }
  return { publicKey, privateKey };
}

/** Contact for push services: mailto: from the ACME email, else the panel URL. */
function vapidSubject() {
  const email = getSetting('acme_email') || process.env.ACME_EMAIL || '';
  if (email) return `mailto:${email}`;
  if (process.env.PANEL_URL) return process.env.PANEL_URL;
  const domain = process.env.SUPERVISOR_DOMAIN || 'localhost';
  return `https://${domain}`;
}

function groupsOf(row) {
  if (!row.events) return null; // null = every group
  try { const g = JSON.parse(row.events); return Array.isArray(g) ? g : null; } catch { return null; }
}

function groupForType(type) {
  return ALL_GROUPS.find(g => PUSH_EVENT_GROUPS[g].includes(type)) || null;
}

function wants(row, type) {
  const groups = groupsOf(row);
  if (groups === null) return true;
  const g = groupForType(type);
  return g ? groups.includes(g) : true; // unknown types are always delivered
}

function urlFor(type, data) {
  switch (type) {
    case 'deploy_review': case 'deploy_blocked': case 'deploy_findings': case 'domain_request': case 'unknown_domain':
      return '/?view=domains';
    case 'site_down': case 'site_up': case 'deploy_decided': case 'domain_decided': case 'site_suspended': case 'site_unsuspended': case 'site_transferred':
      return '/?view=sites';
    case 'support_action':
      return '/?view=activity';
    default:
      return data?.siteId ? '/?view=sites' : '/';
  }
}

function adminUserIds() {
  return db.prepare("SELECT id FROM users WHERE status = 'active' AND (platform_role IN ('owner', 'admin') OR (platform_role IS NULL AND role = 'admin'))").all().map(r => r.id);
}

function shape(row) {
  let host = '';
  try { host = new URL(row.endpoint).host; } catch {}
  return {
    id: row.id,
    user_id: row.user_id,
    endpoint: row.endpoint,
    endpoint_host: host,
    label: row.label || null,
    user_agent: row.user_agent || null,
    events: groupsOf(row),
    created_at: row.created_at,
    last_used: row.last_used,
    failures: row.failures,
  };
}

/** Deliver one payload to one subscription; prunes dead subscriptions. Never throws. */
async function sendOne(row, payload) {
  const { publicKey, privateKey } = vapidKeys();
  try {
    await _deps.send(
      { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
      JSON.stringify(payload),
      { TTL: 60 * 60, vapidDetails: { subject: vapidSubject(), publicKey, privateKey } }
    );
    db.prepare('UPDATE push_subscriptions SET last_used = unixepoch(), failures = 0 WHERE id = ?').run(row.id);
    return true;
  } catch (err) {
    const code = err?.statusCode || err?.status;
    if (code === 404 || code === 410) {
      db.prepare('DELETE FROM push_subscriptions WHERE id = ?').run(row.id);
    } else {
      db.prepare('UPDATE push_subscriptions SET failures = failures + 1 WHERE id = ?').run(row.id);
      db.prepare('DELETE FROM push_subscriptions WHERE id = ? AND failures >= ?').run(row.id, MAX_FAILURES);
    }
    return false;
  }
}

/**
 * fanout({ type, title, detail, data, userIds, admins }) — same recipient
 * rules as notify(): explicit users plus every panel admin when admins=true.
 * Resolves { sent, failed }.
 */
async function fanout({ type, title, detail = null, data = null, userIds = [], admins = true }) {
  if (process.env.PUSH_DISABLED === '1') return { sent: 0, failed: 0 };
  const recipients = new Set(userIds);
  if (admins) for (const id of adminUserIds()) recipients.add(id);
  if (!recipients.size) return { sent: 0, failed: 0 };
  const placeholders = [...recipients].map(() => '?').join(',');
  const rows = db.prepare(`SELECT * FROM push_subscriptions WHERE user_id IN (${placeholders})`).all(...recipients)
    .filter(r => wants(r, type));
  if (!rows.length) return { sent: 0, failed: 0 };
  const payload = {
    title,
    body: detail || '',
    type,
    url: urlFor(type, data),
    tag: `${type}:${data?.siteId || data?.domain || ''}`,
    data: data || {},
  };
  const results = await Promise.allSettled(rows.map(r => sendOne(r, payload)));
  const sent = results.filter(r => r.status === 'fulfilled' && r.value).length;
  return { sent, failed: results.length - sent };
}

/** Test push to one user's devices (optionally one endpoint). */
async function sendTest(userId, endpoint = null) {
  const rows = endpoint
    ? db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ? AND endpoint = ?').all(userId, endpoint)
    : db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ?').all(userId);
  const payload = { title: 'Grimport push works', body: 'This device will get panel notifications.', type: 'test', url: '/', tag: 'test' };
  const results = await Promise.all(rows.map(r => sendOne(r, payload)));
  const sent = results.filter(Boolean).length;
  return { sent, failed: results.length - sent };
}

function listForUser(userId) {
  return db.prepare('SELECT * FROM push_subscriptions WHERE user_id = ? ORDER BY created_at DESC').all(userId).map(shape);
}

function isValidGroups(groups) {
  return groups === null || (Array.isArray(groups) && groups.every(g => ALL_GROUPS.includes(g)));
}

module.exports = { vapidKeys, vapidSubject, fanout, sendOne, sendTest, listForUser, shape, wants, urlFor, isValidGroups, PUSH_EVENT_GROUPS, ALL_GROUPS, _deps };
