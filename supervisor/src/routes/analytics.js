const { Router } = require('express');
const db = require('../db');
const { runPass } = require('../analytics');

const router = Router();

// GET /api/analytics/overview?period=24h|7d|30d — aggregate across all sites
router.get('/overview', async (req, res) => {
  const period = req.query.period || '24h';
  const hours = period === '7d' ? 168 : period === '30d' ? 720 : 24;
  const now   = Math.floor(Date.now() / 1000);
  const since = now - hours * 3600;
  const floor = since - (since % 3600);

  const sites = req.user?.role === 'admin'
    ? db.prepare('SELECT id, name, domain FROM sites ORDER BY name ASC').all()
    : db.prepare(`SELECT s.id, s.name, s.domain FROM sites s
        INNER JOIN site_permissions sp ON sp.site_id = s.id AND sp.user_id = ?
        ORDER BY s.name ASC`).all(req.user?.id);

  const rows = sites.map(site => {
    const totals = db.prepare(`
      SELECT
        COALESCE(SUM(requests),0)   AS requests,
        COALESCE(SUM(bytes),0)      AS bytes,
        COALESCE(SUM(ok),0)         AS ok,
        COALESCE(SUM(redirects),0)  AS redirects,
        COALESCE(SUM(client_err),0) AS client_err,
        COALESCE(SUM(server_err),0) AS server_err
      FROM analytics_hourly
      WHERE site_id = ? AND hour >= ?
    `).get(site.id, floor);

    const uptimeSince = now - hours * 3600;
    const checks = db.prepare(
      'SELECT up, latency_ms FROM uptime_checks WHERE site_id = ? AND checked_at >= ?'
    ).all(site.id, uptimeSince);
    const latest = db.prepare(
      'SELECT up FROM uptime_checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1'
    ).get(site.id);

    const uptimePct = checks.length > 0
      ? ((checks.filter(c => c.up).length / checks.length) * 100).toFixed(2)
      : null;
    const latencies = checks.filter(c => c.latency_ms !== null).map(c => c.latency_ms);
    const avgLatency = latencies.length > 0
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
      : null;

    return {
      id: site.id,
      name: site.name,
      domain: site.domain,
      requests: totals.requests,
      bytes: totals.bytes,
      ok: totals.ok,
      redirects: totals.redirects,
      client_err: totals.client_err,
      server_err: totals.server_err,
      uptime: uptimePct,
      avgLatency,
      currentStatus: latest ? (latest.up ? 'up' : 'down') : 'unknown',
    };
  });

  const grand = {
    requests:   rows.reduce((s, r) => s + r.requests, 0),
    bytes:      rows.reduce((s, r) => s + r.bytes, 0),
    ok:         rows.reduce((s, r) => s + r.ok, 0),
    redirects:  rows.reduce((s, r) => s + r.redirects, 0),
    client_err: rows.reduce((s, r) => s + r.client_err, 0),
    server_err: rows.reduce((s, r) => s + r.server_err, 0),
    sitesUp:    rows.filter(r => r.currentStatus === 'up').length,
    sitesDown:  rows.filter(r => r.currentStatus === 'down').length,
  };

  res.json({ sites: rows, grand, period });
});

// GET /api/analytics/:id?period=24h|7d|30d
router.get('/:id', async (req, res) => {
  const row = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });

  const period = req.query.period || '24h';
  const hours = period === '7d' ? 168 : period === '30d' ? 720 : 24;
  const now   = Math.floor(Date.now() / 1000);
  const since = now - hours * 3600;

  const hourlyRows = db.prepare(`
    SELECT hour, requests, bytes, ok, redirects, client_err, server_err
    FROM analytics_hourly
    WHERE site_id = ? AND hour >= ?
    ORDER BY hour ASC
  `).all(req.params.id, since - (since % 3600));

  // Also get the last-hour slice for "last 1h" summary
  const lastHour = now - 3600;
  const last1h = db.prepare(`
    SELECT
      COALESCE(SUM(requests),0)   AS requests,
      COALESCE(SUM(bytes),0)      AS bytes,
      COALESCE(SUM(ok),0)         AS ok,
      COALESCE(SUM(redirects),0)  AS redirects,
      COALESCE(SUM(client_err),0) AS client_err,
      COALESCE(SUM(server_err),0) AS server_err
    FROM analytics_hourly
    WHERE site_id = ? AND hour >= ?
  `).get(req.params.id, lastHour - (lastHour % 3600));

  const totals = db.prepare(`
    SELECT
      COALESCE(SUM(requests),0)   AS requests,
      COALESCE(SUM(bytes),0)      AS bytes,
      COALESCE(SUM(ok),0)         AS ok,
      COALESCE(SUM(redirects),0)  AS redirects,
      COALESCE(SUM(client_err),0) AS client_err,
      COALESCE(SUM(server_err),0) AS server_err
    FROM analytics_hourly
    WHERE site_id = ? AND hour >= ?
  `).get(req.params.id, since - (since % 3600));

  res.json({ hourly: hourlyRows, totals, last1h, period });
});

// POST /api/analytics/:id/refresh — force a log parse for one site
router.post('/:id/refresh', async (req, res) => {
  await runPass();
  res.json({ ok: true });
});

module.exports = router;
