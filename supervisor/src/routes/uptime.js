const { Router } = require('express');
const db = require('../db');

const router = Router();

// GET /api/uptime/:id?period=24h|7d|30d
router.get('/:id', (req, res) => {
  const row = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });

  const period = req.query.period || '24h';
  const hours = period === '7d' ? 168 : period === '30d' ? 720 : 24;
  const since = Math.floor(Date.now() / 1000) - hours * 3600;

  const checks = db.prepare(
    'SELECT up, latency_ms, checked_at FROM uptime_checks WHERE site_id = ? AND checked_at >= ? ORDER BY checked_at DESC'
  ).all(req.params.id, since);

  const total = checks.length;
  const upCount = checks.filter(c => c.up).length;
  const uptime = total > 0 ? ((upCount / total) * 100).toFixed(2) : null;
  const latencies = checks.filter(c => c.latency_ms !== null).map(c => c.latency_ms);
  const avgLatency = latencies.length > 0
    ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length)
    : null;

  // Last 90 checks for the status strip (most recent first)
  const strip = checks.slice(0, 90).reverse().map(c => ({ up: !!c.up, checked_at: c.checked_at }));

  // Current status
  const latest = checks[0];
  const currentStatus = latest ? (latest.up ? 'up' : 'down') : 'unknown';

  res.json({ uptime, avgLatency, total, strip, currentStatus, period });
});

// GET /api/uptime — summary for all sites
router.get('/', (req, res) => {
  const sites = db.prepare('SELECT id FROM sites').all();
  const since = Math.floor(Date.now() / 1000) - 24 * 3600;
  const result = {};
  for (const site of sites) {
    const checks = db.prepare(
      'SELECT up FROM uptime_checks WHERE site_id = ? AND checked_at >= ?'
    ).all(site.id, since);
    const latest = db.prepare(
      'SELECT up FROM uptime_checks WHERE site_id = ? ORDER BY checked_at DESC LIMIT 1'
    ).get(site.id);
    result[site.id] = {
      currentStatus: latest ? (latest.up ? 'up' : 'down') : 'unknown',
      uptime24h: checks.length > 0
        ? ((checks.filter(c => c.up).length / checks.length) * 100).toFixed(1)
        : null,
    };
  }
  res.json(result);
});

module.exports = router;
