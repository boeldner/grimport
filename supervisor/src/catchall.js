/**
 * Catch-all middleware — handles requests arriving for unknown domains.
 *
 * Traefik routes any unrecognised hostname to the supervisor (lowest-priority
 * router, priority=1). Here we detect whether the Host header belongs to a
 * known site or the panel itself. If it's genuinely unknown we:
 *   1. Record a notification (rate-limited: once per domain per 6 h)
 *   2. Return a branded 503 so the visitor knows the domain isn't configured yet
 */

const db = require('./db');

const RATE_LIMIT_SECONDS = 6 * 60 * 60; // 6 hours

function recordUnknownDomain(domain) {
  // Don't spam — only record once per 6 h per domain
  const recent = db.prepare(
    `SELECT id FROM notifications
     WHERE type = 'unknown_domain'
       AND json_extract(data, '$.domain') = ?
       AND created_at > unixepoch() - ?`
  ).get(domain, RATE_LIMIT_SECONDS);

  if (recent) return;

  db.prepare(
    `INSERT INTO notifications (type, title, detail, data)
     VALUES ('unknown_domain', ?, ?, ?)`
  ).run(
    `Unknown domain: ${domain}`,
    'A request arrived for a domain not connected to any site.',
    JSON.stringify({ domain })
  );
}

function catchallMiddleware(req, res, next) {
  const host = req.hostname;
  const supervisorDomain = process.env.SUPERVISOR_DOMAIN || 'localhost';

  // Let through: panel domain, localhost variants, internal health probes
  if (
    host === supervisorDomain ||
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '[::1]' ||
    !host
  ) {
    return next();
  }

  // Let through: known site domains (shouldn't normally arrive here but be safe)
  const known = db.prepare('SELECT id FROM sites WHERE domain = ?').get(host);
  if (known) return next();

  // Unknown domain — record and respond
  try { recordUnknownDomain(host); } catch {}

  res.status(503).send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Domain not connected</title>
  <style>
    *{box-sizing:border-box;margin:0;padding:0}
    body{background:#0d0d0f;color:#e2e2e2;font-family:system-ui,sans-serif;
         display:flex;align-items:center;justify-content:center;min-height:100vh}
    .box{text-align:center;max-width:420px;padding:40px 32px}
    .logo{font-size:32px;font-weight:800;letter-spacing:-0.04em;color:#fff;margin-bottom:8px}
    .logo span{color:#b91c1c}
    h1{font-size:18px;font-weight:600;margin-bottom:12px;color:#fff}
    p{font-size:14px;color:#888;line-height:1.6}
    .domain{font-family:monospace;font-size:13px;background:#1a1a1e;border:1px solid #2a2a2e;
            border-radius:6px;padding:6px 12px;display:inline-block;margin:16px 0;color:#e2e2e2}
  </style>
</head>
<body>
  <div class="box">
    <div class="logo"><span>n</span> Grimport</div>
    <div class="domain">${host}</div>
    <h1>Domain not connected</h1>
    <p>This domain is pointing at a Grimport server but hasn't been connected to a site yet.<br><br>
       Log in to your panel and create or configure a site for this domain.</p>
  </div>
</body>
</html>`);
}

module.exports = { catchallMiddleware };
