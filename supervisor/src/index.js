const express = require('express');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('./db');
const { sessionMiddleware, requireAuth, requireHumanSession } = require('./auth');
const { csrfProtection } = require('./csrf');
const { version: VERSION } = require('../package.json');

if (process.env.NODE_ENV === 'production' &&
    (!process.env.SUPERVISOR_SECRET || process.env.SUPERVISOR_SECRET === 'changeme')) {
  console.error('FATAL: SUPERVISOR_SECRET must be set to a strong value in production.');
  process.exit(1);
}

const app = express();
const PORT = 3000;

// Trust reverse proxy headers (Traefik / cloudflared / nginx)
app.set('trust proxy', 1);

// ── Security headers ───────────────────────────────────────
// A per-request nonce is generated here so the CSP below can allow just the
// inline <script> blocks in login.html/offline.html/invite.html (injected
// by the handlers further down) while still blocking any OTHER inline
// script an attacker might smuggle in (XSS payload, compromised
// dependency, etc). res.locals.cspNonce is read by those handlers.
app.use((req, res, next) => {
  const nonce = crypto.randomBytes(16).toString('base64');
  res.locals.cspNonce = nonce;
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '));
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);

// ── CSRF guard (mutating /api/* requests from a cookie session) ─
app.use(csrfProtection);

// ── Unknown domain catch-all (runs before auth, after session) ─
const { catchallMiddleware } = require('./catchall');
app.use(catchallMiddleware);

// ── HTML pages with an inline <script> — CSP forbids inline scripts
// without a nonce, so inject the one generated above by a plain string
// replace on the way out. Falls through to the normal static/SPA handling
// (via next()) if the file doesn't exist, so this is a no-op until those
// pages exist.
function serveWithNonce(filePath) {
  return (req, res, next) => {
    fs.readFile(filePath, 'utf8', (err, html) => {
      if (err) return next();
      const withNonce = html.split('<script>').join(`<script nonce="${res.locals.cspNonce}">`);
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(withNonce);
    });
  };
}
app.get('/login.html', serveWithNonce(path.join(__dirname, '../public/login.html')));
app.get('/offline.html', serveWithNonce(path.join(__dirname, '../public/offline.html')));
app.get('/invite/:token', serveWithNonce(path.join(__dirname, '../public/invite.html')));

// ── Public routes (no auth) ────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// Config — non-sensitive, reads from DB settings (set in db.js)
app.get('/api/config', (req, res) => {
  const siteBaseDomain = db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()?.value || '';
  const acmeEmail = db.prepare("SELECT value FROM settings WHERE key = 'acme_email'").get()?.value || process.env.ACME_EMAIL || '';
  res.json({
    version: VERSION,
    siteBaseDomain,
    supervisorDomain: process.env.SUPERVISOR_DOMAIN || 'localhost',
    acmeEmail,
    sslReady: !!acmeEmail,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, version: VERSION }));

// ── Debug endpoint (admin-only) ────────────────────────────
const { requireRole } = require('./auth');
const { containerStatus } = require('./docker');
const Dockerode = require('dockerode');
const _docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

app.get('/api/debug/status', requireAuth, requireRole('admin'), async (req, res) => {
  try {
    const sites = db.prepare('SELECT id, name, domain, container_id, runtime FROM sites').all();
    const siteStatus = await Promise.all(sites.map(async s => ({
      id: s.id, name: s.name, domain: s.domain, runtime: s.runtime,
      container_id: s.container_id,
      container: s.container_id ? await containerStatus(s.container_id) : { status: 'none' },
    })));

    let dockerContainers = [];
    try {
      dockerContainers = (await _docker.listContainers({
        all: true,
        filters: JSON.stringify({ label: ['webhost.site=true'] }),
      })).map(c => ({ id: c.Id.slice(0, 12), name: c.Names[0], state: c.State, status: c.Status }));
    } catch {}

    res.json({
      version: VERSION,
      uptime_s: Math.floor(process.uptime()),
      env: process.env.NODE_ENV,
      sites: siteStatus,
      docker_site_containers: dockerContainers,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Protected routes ───────────────────────────────────────
app.use('/api/sites',    requireAuth, require('./routes/sites'));
app.use('/api/deploy',   requireAuth, require('./routes/deploy'));
app.use('/api/settings/webhooks', requireAuth, requireRole('admin'), require('./routes/webhooks'));
app.use('/api/settings', requireAuth, requireRole('admin'), require('./routes/settings'));
app.use('/api/dns',       requireAuth, require('./routes/dns'));
app.use('/api/analytics', requireAuth, require('./routes/analytics'));
app.use('/api/uptime',          requireAuth, require('./routes/uptime'));
// NOT gated requireRole('admin') at the mount: public/index.html shows the
// Activity nav-item and the notification bell to every role (no nav-admin /
// admin-only class), so editors/viewers use both. Each router instead
// enforces per-route/per-row authorization internally — see the comments
// at the top of routes/activity.js and routes/notifications.js.
app.use('/api/activity',        requireAuth, require('./routes/activity'));
app.use('/api/notifications',   requireAuth, require('./routes/notifications'));
// requireHumanSession: API tokens must not create/delete users, reset
// passwords, or manage token/backup surfaces. requireAuth still allows a
// token through as a principal (so requireHumanSession can tell it apart
// from a session user) — it's requireHumanSession that draws the line.
app.use('/api/users',           requireAuth, requireHumanSession, require('./routes/users'));
app.use('/api/update',          requireAuth, requireRole('admin'), require('./routes/update'));
app.use('/api/backups',         requireAuth, requireRole('admin'), requireHumanSession, require('./routes/backups'));

// ── Static files ───────────────────────────────────────────
app.use(express.static(path.join(__dirname, '../public')));

// ── SPA + login routing ────────────────────────────────────
// All non-API routes serve the single HTML file
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ── Global error handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

// ── Reconcile containers then start ───────────────────────
const { reconcile } = require('./reconcile');
const { startAnalyticsJob } = require('./analytics');
const { startUptimeJob } = require('./uptime');
const { startScheduledBackups } = require('./backups');

const DATA_PATH = process.env.DATA_PATH || '/data/sites';
const DB_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, '..', 'supervisor.db')
  : path.join(__dirname, '../data/supervisor.db');
const BACKUP_DIR = path.join(DATA_PATH, '..', 'backups');

async function start() {
  await reconcile();
  startAnalyticsJob();
  startUptimeJob();
  startScheduledBackups({ db, destDir: BACKUP_DIR, dbPath: DB_PATH, sitesDir: DATA_PATH });
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Webhost supervisor running on :${PORT}`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
