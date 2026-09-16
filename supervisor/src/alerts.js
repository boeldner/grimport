/**
 * Alert dispatcher — pushes events to configured push-alert channels,
 * separate from the generic/Discord webhooks in webhooks.js.
 *
 * Currently implements one channel (ntfy — https://ntfy.sh or self-hosted,
 * plain HTTP POST, no deps). Structured so more channels (e.g. SMTP) can be
 * bolted on later: add a getXConfig() + postX(), then call it from sendAlert().
 */
const db = require('./db');
const { assertPublicUrl } = require('./validate');

// cert_expiry has no producer yet (no cert-expiry detection exists in this
// codebase) — it's accepted as a config option so the UI/route can wire it
// up when that detection lands, but nothing fires it today.
const ALL_ALERT_EVENTS = ['site_down', 'site_up', 'deploy_failed', 'cert_expiry', 'login_lockout'];

const EVENT_META = {
  site_down:     { title: 'Site down',            priority: '5', tags: 'rotating_light' },
  site_up:       { title: 'Site recovered',       priority: '3', tags: 'white_check_mark' },
  deploy_failed: { title: 'Deploy failed',        priority: '4', tags: 'x' },
  cert_expiry:   { title: 'Certificate expiring', priority: '4', tags: 'hourglass' },
  login_lockout: { title: 'Login lockout',        priority: '4', tags: 'lock' },
};

function getNtfyConfig() {
  try {
    const raw = db.prepare("SELECT value FROM settings WHERE key = 'alert_ntfy'").get()?.value;
    if (!raw) return { url: '', enabled: false, events: [] };
    const cfg = JSON.parse(raw);
    return {
      url: typeof cfg.url === 'string' ? cfg.url : '',
      enabled: !!cfg.enabled,
      events: Array.isArray(cfg.events) ? cfg.events.filter(e => ALL_ALERT_EVENTS.includes(e)) : [],
    };
  } catch {
    return { url: '', enabled: false, events: [] };
  }
}

function setNtfyConfig({ url, enabled, events }) {
  const cfg = {
    url: typeof url === 'string' ? url.trim() : '',
    enabled: !!enabled,
    events: Array.isArray(events) ? events.filter(e => ALL_ALERT_EVENTS.includes(e)) : [],
  };
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run('alert_ntfy', JSON.stringify(cfg));
  return cfg;
}

function buildNtfyMessage(event, siteName, detail) {
  const meta = EVENT_META[event] || { title: event };
  if (siteName) return `${siteName}${detail ? ` — ${detail}` : ''}`;
  return detail || meta.title;
}

/**
 * POST a single ntfy alert. Completely async — errors are swallowed
 * (fire-and-forget), never blocks the caller. Re-validates the URL against
 * the SSRF guard at send time (defense in depth alongside the config route).
 */
async function postNtfy(url, event, siteName, detail) {
  try {
    await assertPublicUrl(url);
  } catch {
    return; // unsafe/misconfigured URL — drop silently, same posture as webhooks.js
  }
  const meta = EVENT_META[event] || { title: event, priority: '3', tags: '' };
  try {
    fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'Title': `Grimport - ${meta.title}`,
        'Priority': meta.priority,
        'Tags': meta.tags,
      },
      body: buildNtfyMessage(event, siteName, detail),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => {});
  } catch {}
}

/**
 * Fire all enabled alert channels that are opted in to the given event.
 * Fire-and-forget — never throws, never awaited by producers.
 */
async function sendAlert(event, { siteName, detail } = {}) {
  if (!ALL_ALERT_EVENTS.includes(event)) return;

  const ntfy = getNtfyConfig();
  if (ntfy.enabled && ntfy.url && ntfy.events.includes(event)) {
    // Awaited here only so the SSRF check + fetch() call happen before this
    // resolves (deterministic for callers/tests) — the fetch response itself
    // is never awaited (postNtfy fires it with a timeout and swallows
    // errors). Producers call sendAlert() without awaiting it, so this never
    // blocks a request.
    await postNtfy(ntfy.url, event, siteName, detail);
  }
  // Future channels (SMTP, etc.) follow the same pattern: read config, check
  // enabled + per-event opt-in, dispatch fire-and-forget.
}

module.exports = { sendAlert, getNtfyConfig, setNtfyConfig, postNtfy, ALL_ALERT_EVENTS };
