/**
 * Analytics engine — parses nginx access logs from site containers,
 * aggregates into hourly buckets in SQLite.
 *
 * Nginx combined log format (with Docker timestamp prefix):
 * 2026-04-03T14:45:00.123Z 172.18.0.2 - - [03/Apr/2026:14:45:00 +0000] "GET / HTTP/1.1" 200 1078 "-" "UA"
 */

const Dockerode = require('dockerode');
const db = require('./db');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

// Demux Docker's multiplexed log stream (8-byte header per frame)
function demuxBuffer(buf) {
  const lines = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (offset + 8 + size > buf.length) break;
    const text = buf.slice(offset + 8, offset + 8 + size).toString('utf8');
    lines.push(...text.split('\n').filter(Boolean));
    offset += 8 + size;
  }
  return lines;
}

// Parse a single nginx log line.
// Docker prepends an ISO timestamp: "2026-04-03T14:45:00.123456789Z <rest of line>"
// We use that timestamp rather than the nginx time for reliability.
const LOG_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.\d+Z\s+\S+ - \S+ \[[^\]]+\] "(?:\S+) [^"]*" (\d{3}) (\d+)/;

function parseLine(line) {
  const m = LOG_RE.exec(line);
  if (!m) return null;
  const ts = Math.floor(new Date(m[1] + 'Z').getTime() / 1000);
  if (isNaN(ts)) return null;
  const status = parseInt(m[2]);
  const bytes  = parseInt(m[3]);
  return { ts, status, bytes };
}

function hourOf(ts) {
  return ts - (ts % 3600);
}

// Fetch and process logs for a single site since last cursor position
async function processSite(site) {
  if (!site.container_id) return;

  const cursor = db.prepare('SELECT last_ts FROM analytics_cursor WHERE site_id = ?').get(site.id);
  const since = cursor ? cursor.last_ts : 0;

  let buf;
  try {
    buf = await docker.getContainer(site.container_id).logs({
      stdout: true,
      stderr: false,
      timestamps: true,
      since,
    });
  } catch {
    return; // container may be stopped
  }

  const lines = demuxBuffer(Buffer.isBuffer(buf) ? buf : Buffer.from(buf));
  if (!lines.length) return;

  // Aggregate into hourly buckets
  const buckets = new Map(); // hour -> {requests,bytes,ok,redirects,client_err,server_err}
  let maxTs = since;

  for (const line of lines) {
    const entry = parseLine(line);
    if (!entry) continue;
    if (entry.ts <= since) continue;  // skip already-processed lines (since is inclusive in Docker API)
    if (entry.ts > maxTs) maxTs = entry.ts;

    const hour = hourOf(entry.ts);
    if (!buckets.has(hour)) {
      buckets.set(hour, { requests: 0, bytes: 0, ok: 0, redirects: 0, client_err: 0, server_err: 0 });
    }
    const b = buckets.get(hour);
    b.requests++;
    b.bytes += entry.bytes;
    if      (entry.status < 300) b.ok++;
    else if (entry.status < 400) b.redirects++;
    else if (entry.status < 500) b.client_err++;
    else                         b.server_err++;
  }

  if (!buckets.size) return;

  // Upsert each bucket
  const upsert = db.prepare(`
    INSERT INTO analytics_hourly (site_id, hour, requests, bytes, ok, redirects, client_err, server_err)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(site_id, hour) DO UPDATE SET
      requests   = requests   + excluded.requests,
      bytes      = bytes      + excluded.bytes,
      ok         = ok         + excluded.ok,
      redirects  = redirects  + excluded.redirects,
      client_err = client_err + excluded.client_err,
      server_err = server_err + excluded.server_err
  `);

  const upsertMany = db.transaction((siteId, buckets) => {
    for (const [hour, b] of buckets) {
      upsert.run(siteId, hour, b.requests, b.bytes, b.ok, b.redirects, b.client_err, b.server_err);
    }
  });

  upsertMany(site.id, buckets);

  // Advance cursor
  db.prepare(`
    INSERT INTO analytics_cursor (site_id, last_ts) VALUES (?, ?)
    ON CONFLICT(site_id) DO UPDATE SET last_ts = excluded.last_ts
  `).run(site.id, maxTs);
}

// Run a full pass over all sites
async function runPass() {
  const sites = db.prepare('SELECT id, container_id FROM sites WHERE container_id IS NOT NULL').all();
  await Promise.allSettled(sites.map(processSite));
}

// Prune data older than 30 days
function pruneOld() {
  const cutoff = Math.floor(Date.now() / 1000) - 30 * 24 * 3600;
  db.prepare('DELETE FROM analytics_hourly WHERE hour < ?').run(hourOf(cutoff));
}

// Start background job — poll every 60 seconds
function startAnalyticsJob() {
  runPass().catch(err => console.error('[analytics] pass error:', err));
  setInterval(() => {
    runPass().catch(err => console.error('[analytics] pass error:', err));
  }, 60_000);

  // Prune once a day
  setInterval(pruneOld, 24 * 60 * 60 * 1000);
}

module.exports = { startAnalyticsJob, runPass };
