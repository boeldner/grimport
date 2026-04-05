const { Router } = require('express');
const db = require('../db');
const { runPass } = require('../analytics');

const router = Router();

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
