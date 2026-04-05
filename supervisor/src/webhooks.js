/**
 * Webhook dispatcher — fires configured webhooks on Grimport events.
 * Supports generic JSON and Discord-formatted payloads (auto-detected by URL).
 */

const db = require('./db');

const EVENT_COLORS = {
  deploy:    0x22c55e,  // green
  rollback:  0xf59e0b,  // amber
  site_down: 0xef4444,  // red
  site_up:   0x22c55e,  // green
  created:   0x3b82f6,  // blue
  deleted:   0x6b7280,  // gray
};

function isDiscordUrl(url) {
  return url.includes('discord.com/api/webhooks') || url.includes('discordapp.com/api/webhooks');
}

function buildDiscordPayload(event, siteName, siteId, detail) {
  const color = EVENT_COLORS[event] ?? 0x6b7280;
  const label = event.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  return {
    embeds: [{
      title: `Grimport — ${label}`,
      description: siteName
        ? `**${siteName}**${detail ? `\n${detail}` : ''}`
        : (detail || label),
      color,
      footer: { text: 'Grimport' },
      timestamp: new Date().toISOString(),
    }],
  };
}

function buildGenericPayload(event, siteName, siteId, detail) {
  return {
    event,
    timestamp: new Date().toISOString(),
    site: siteName ? { id: siteId, name: siteName } : null,
    detail: detail || null,
  };
}

/**
 * Fire all enabled webhooks that subscribe to the given event.
 * Completely async — errors are swallowed (fire-and-forget).
 */
async function fireWebhooks(event, siteId, siteName, detail) {
  let webhooks;
  try {
    webhooks = db.prepare("SELECT * FROM webhooks WHERE enabled = 1").all();
  } catch { return; }

  for (const wh of webhooks) {
    try {
      const events = JSON.parse(wh.events || '[]');
      if (!events.includes(event)) continue;

      const body = isDiscordUrl(wh.url)
        ? buildDiscordPayload(event, siteName, siteId, detail)
        : buildGenericPayload(event, siteName, siteId, detail);

      fetch(wh.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => {});
    } catch {}
  }
}

module.exports = { fireWebhooks };
