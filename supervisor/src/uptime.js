const http = require('http');
const https = require('https');
const Dockerode = require('dockerode');
const db = require('./db');
const { fireWebhooks } = require('./webhooks');
const { eventEnabled } = require('./notification-prefs');
const { sendAlert } = require('./alerts');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
const NETWORK = process.env.DOCKER_NETWORK || 'webhost-net';
const TRAEFIK = process.env.TRAEFIK_CONTAINER || 'webhost-traefik';
const CHECK_INTERVAL_MS = 60 * 1000;
const PROBE_TIMEOUT_MS = 5000;
// Body Traefik (Go's http.NotFound) returns when no router matches the Host.
const TRAEFIK_NOT_FOUND = '404 page not found';

function logActivity(siteId, siteName, event, detail) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail) VALUES (?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null);
  } catch {}
}

// Fan out to the site owner + members (and admins) — see notify.js.
const { notify } = require('./notify');
function addNotification(type, title, detail, data) {
  notify({ type, title, detail, data, siteId: data?.siteId || null });
}

/**
 * One HTTP(S) request, never throws. Resolves { status, body, location, ms }
 * or { error }. `hostHeader` is the site's domain so Traefik picks the right
 * router; `servername` sets SNI for the https hop.
 */
function httpProbe({ protocol = 'http', host, port, path = '/', hostHeader, servername, timeoutMs = PROBE_TIMEOUT_MS }) {
  return new Promise(resolve => {
    const start = Date.now();
    const mod = protocol === 'https' ? https : http;
    const req = mod.request({
      host, port, path, method: 'GET',
      headers: { Host: hostHeader, 'User-Agent': 'grimport-uptime/1', Accept: '*/*' },
      servername, rejectUnauthorized: false, timeout: timeoutMs,
    }, res => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', c => { if (body.length < 256) body += c; });
      res.on('end', () => resolve({ status: res.statusCode, body, location: res.headers.location, ms: Date.now() - start }));
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', err => resolve({ error: err }));
    req.end();
  });
}

/** Did the site itself answer? Traefik's own errors (no router, bad gateway) count as down. */
function interpretResponse(r) {
  if (!r || r.error) return false;
  if (r.status === 404 && r.body.trim() === TRAEFIK_NOT_FOUND) return false;
  if (r.status === 502 || r.status === 503 || r.status === 504) return false;
  return true;
}

function healthPath(site) {
  const rt = site.runtime || 'static';
  // nginx-based runtimes serve /__health (200 even in maintenance mode);
  // node/python apps have no such route, so any answer on / counts.
  return rt === 'node' || rt === 'python' ? '/' : '/__health';
}

/**
 * Probe through Traefik: the supervisor sits on the management network only,
 * site containers live on their own per-site networks (see networks.js), so
 * the edge router is the one hop that can still reach every site. Follows the
 * http -> https redirect Traefik issues for SSL sites (SNI = site domain).
 * Resolves { up, latency } or null when Traefik itself is unreachable.
 */
async function probeViaTraefik(site, { host = TRAEFIK, httpPort = 80, httpsPort = 443 } = {}) {
  const path = healthPath(site);
  let r = await httpProbe({ host, port: httpPort, path, hostHeader: site.domain });
  if (r.error) return null;
  if ([301, 302, 307, 308].includes(r.status) && /^https:\/\//i.test(r.location || '')) {
    const viaTls = await httpProbe({ protocol: 'https', host, port: httpsPort, path, hostHeader: site.domain, servername: site.domain });
    if (!viaTls.error) r = viaTls;
  }
  return { up: interpretResponse(r), latency: r.ms ?? null };
}

/** Legacy fallback: a container still attached to the management network (pre-0.11 layout, or dev without Traefik). */
async function probeDirect(site) {
  let ip = null;
  try {
    const info = await docker.getContainer(site.container_id).inspect();
    ip = info.NetworkSettings.Networks[NETWORK]?.IPAddress || null;
  } catch { return null; }
  if (!ip) return null;
  const r = await httpProbe({ host: ip, port: 80, path: healthPath(site), hostHeader: site.domain });
  return { up: !r.error && r.status < 500, latency: r.ms ?? null };
}

async function checkSite(site) {
  if (!site.container_id) return;

  let result = await probeViaTraefik(site);
  if (!result) result = await probeDirect(site);
  const up = !!result?.up;
  const latency = up ? (result.latency ?? null) : null;

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
      sendAlert('site_down', { siteName: site.name, detail: `No response from ${site.domain}` });
    }
    if (!wasUp && up) {
      logActivity(site.id, site.name, 'up', `${site.domain} is back online`);
      addNotification('site_up', `${site.name} is back online`, site.domain, { siteId: site.id, domain: site.domain });
      fireWebhooks('site_up', site.id, site.name, site.domain);
      sendAlert('site_up', { siteName: site.name, detail: `${site.domain} is back online` });
    }
  }
}

async function runChecks() {
  const sites = db.prepare("SELECT id, name, domain, container_id, runtime FROM sites WHERE status IS NULL OR status != 'suspended'").all();
  await Promise.allSettled(sites.map(s => checkSite(s)));
}

function startUptimeJob() {
  setTimeout(() => {
    runChecks();
    setInterval(runChecks, CHECK_INTERVAL_MS);
  }, 10_000);
}

module.exports = { startUptimeJob, httpProbe, interpretResponse, probeViaTraefik, healthPath, TRAEFIK_NOT_FOUND };
