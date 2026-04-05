const express = require('express');
const path = require('path');
const db = require('./db');
const { sessionMiddleware, requireAuth } = require('./auth');

const app = express();
const PORT = 3000;

// ── Security headers ───────────────────────────────────────
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=63072000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '1mb' }));
app.use(sessionMiddleware);

// ── Public routes (no auth) ────────────────────────────────
app.use('/api/auth', require('./routes/auth'));

// Config — non-sensitive, reads from DB settings (set in db.js)
app.get('/api/config', (req, res) => {
  const siteBaseDomain = db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()?.value || '';
  const acmeEmail = db.prepare("SELECT value FROM settings WHERE key = 'acme_email'").get()?.value || process.env.ACME_EMAIL || '';
  res.json({
    version: '0.5.1',
    siteBaseDomain,
    supervisorDomain: process.env.SUPERVISOR_DOMAIN || 'localhost',
    acmeEmail,
    sslReady: !!acmeEmail,
  });
});

app.get('/api/health', (req, res) => res.json({ ok: true, version: '0.5.1' }));

// ── Protected routes ───────────────────────────────────────
app.use('/api/sites',    requireAuth, require('./routes/sites'));
app.use('/api/deploy',   requireAuth, require('./routes/deploy'));
app.use('/api/settings', requireAuth, require('./routes/settings'));
app.use('/api/dns',       requireAuth, require('./routes/dns'));
app.use('/api/analytics', requireAuth, require('./routes/analytics'));
app.use('/api/uptime',   requireAuth, require('./routes/uptime'));
app.use('/api/activity', requireAuth, require('./routes/activity'));

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

async function start() {
  await reconcile();
  startAnalyticsJob();
  startUptimeJob();
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Webhost supervisor running on :${PORT}`);
  });
}

start().catch(err => {
  console.error('Startup failed:', err);
  process.exit(1);
});
