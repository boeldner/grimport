// Shared helper: which notification event types are enabled to fire/show.
// Backed by settings.key = 'notification_events' (JSON array), written by
// PUT /api/settings/notification-events.
const db = require('./db');

const ALL_EVENTS = ['unknown_domain', 'site_down', 'site_up'];

function getEnabledEvents() {
  try {
    const raw = db.prepare("SELECT value FROM settings WHERE key = 'notification_events'").get()?.value;
    if (!raw) return ALL_EVENTS.slice(); // no prefs saved yet — default all on
    const events = JSON.parse(raw);
    return Array.isArray(events) ? events : ALL_EVENTS.slice();
  } catch {
    return ALL_EVENTS.slice();
  }
}

function eventEnabled(type) {
  return getEnabledEvents().includes(type);
}

module.exports = { ALL_EVENTS, getEnabledEvents, eventEnabled };
