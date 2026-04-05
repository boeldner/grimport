const Dockerode = require('dockerode');
const db = require('./db');
const { fireWebhooks } = require('./webhooks');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'webhost-net';
const CHECK_INTERVAL_MS = 60 * 1000;

function logActivity(siteId, siteName, event, detail) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail) VALUES (?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null);
  } catch {}
}

function addNotification(type, title, detail, data) {
  try {
    db.prepare(`INSERT INTO notifications (type, title, detail, data) VALUES (?, ?, ?, ?)`)
      .run(type, title, detail || null, data ? JSON.stringify(data) : null);
  } catch {}
}

async function getContainerIp(containerId) {
  try {
    const info = await docker.getContainer(containerId).inspect();
    return info.NetworkSettings.Networks[NETWORK]?.IPAddress || null;
  } catch {
    return null;
  }
}

async function checkSite(site) {
  if (!site.container_id) return;

  const ip = await getContainerIp(site.container_id);
  let up = false;
  let latency = null;

  if (ip) {
    const start = Date.now();
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`http://${ip}/__health`, { signal: controller.signal });
      clearTimeout(timeout);
      latency = Date.now() - start;
      up = res.ok;
    } catch {
      up = false;
    }
  }

  db.prepare('INSERT INTO uptime_checks (site_id, checked_at, up, latency_ms) VALUES (?, unixepoch(), ?, ?)')
    .run(site.id, up ? 1 : 0, latency);

  // Prune checks older than 30 days
  db.prepare('DELETE FROM uptime_checks WHERE site_id = ? AND checked_at < unixepoch() - 2592000')
    .run(site.id);

  // Detect state change for activity log
  const prev = db.prepare(
    'SELECT up FROM uptime_checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1 OFFSET 1'
  ).get(site.id);

  if (prev != null) {
    const wasUp = !!prev.up;
    if (wasUp && !up) {
      logActivity(site.id, site.name, 'down', `No response from ${site.domain}`);
      addNotification('site_down', `${site.name} is down`, `No response from ${site.domain}`, { siteId: site.id, domain: site.domain });
      fireWebhooks('site_down', site.id, site.name, site.domain);
    }
    if (!wasUp && up) {
      logActivity(site.id, site.name, 'up', `${site.domain} is back online`);
      addNotification('site_up', `${site.name} is back online`, site.domain, { siteId: site.id, domain: site.domain });
      fireWebhooks('site_up', site.id, site.name, site.domain);
    }
  }
}

async function runChecks() {
  const sites = db.prepare('SELECT id, name, domain, container_id FROM sites').all();
  await Promise.allSettled(sites.map(s => checkSite(s)));
}

function startUptimeJob() {
  setTimeout(() => {
    runChecks();
    setInterval(runChecks, CHECK_INTERVAL_MS);
  }, 10_000);
}

module.exports = { startUptimeJob };
