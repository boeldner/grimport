/**
 * Notification fan-out. One row per recipient:
 *   user_id NULL  -> every panel admin (owner + admins) sees it
 *   user_id <id>  -> that user only
 * Site events go to the site owner + members (skipping panel admins, who get
 * the NULL row anyway); panel events go to admins only.
 */
const db = require('./db');
const { eventEnabled } = require('./notification-prefs');
const { isPanelAdmin } = require('./authz');

const insert = db.prepare('INSERT INTO notifications (type, title, detail, data, user_id) VALUES (?, ?, ?, ?, ?)');

function siteRecipients(siteId) {
  const site = db.prepare('SELECT owner_id FROM sites WHERE id = ?').get(siteId);
  const ids = new Set();
  if (site?.owner_id) ids.add(site.owner_id);
  for (const m of db.prepare('SELECT user_id FROM site_members WHERE site_id = ?').all(siteId)) ids.add(m.user_id);
  const users = [...ids].map(id => db.prepare('SELECT id, platform_role, role, status FROM users WHERE id = ?').get(id)).filter(Boolean);
  return users.filter(u => !isPanelAdmin(u) && u.status === 'active').map(u => u.id);
}

/**
 * notify({ type, title, detail, data, siteId, userIds, admins })
 *   siteId  -> owner + members of the site receive it (plus admins unless admins:false)
 *   userIds -> explicit recipients
 *   admins  -> default true: also one NULL row for panel admins
 * Respects the bell event preferences (notification-prefs) per type.
 */
function notify({ type, title, detail = null, data = null, siteId = null, userIds = [], admins = true, force = false }) {
  if (!force && !eventEnabled(type)) return 0;
  const payload = data ? JSON.stringify(data) : null;
  const recipients = new Set(userIds);
  if (siteId) for (const id of siteRecipients(siteId)) recipients.add(id);
  let n = 0;
  try {
    if (admins) { insert.run(type, title, detail, payload, null); n++; }
    for (const uid of recipients) { insert.run(type, title, detail, payload, uid); n++; }
  } catch {}
  // Same recipients get a web push on their subscribed devices (push.js);
  // fire-and-forget so a slow push service never delays the caller.
  try {
    require('./push').fanout({ type, title, detail, data, userIds: [...recipients], admins }).catch(() => {});
  } catch {}
  return n;
}

module.exports = { notify, siteRecipients };
