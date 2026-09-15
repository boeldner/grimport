// Demo data seed for screenshots and manual review.
// Fills a fresh Grimport database with fictional sites, deployments,
// activity, notifications, tokens and users — all with fixed ids so
// screenshots.js can rely on them.
//
// Safe to re-run: rows keyed by a fixed id use INSERT OR REPLACE / OR IGNORE.
// The autoincrement tables (activity, notifications, uptime_checks) have no
// natural key, so the demo rows for these fixed site ids are deleted and
// re-inserted each run instead — same end state, and timestamps stay
// relative to "now".
'use strict';

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to seed demo data: NODE_ENV=production.');
  process.exit(1);
}
if (!process.env.DATA_PATH) {
  console.error('Refusing to seed demo data: DATA_PATH is not set.');
  process.exit(1);
}

const fs = require('fs');
const bcrypt = require('bcryptjs');

fs.mkdirSync(process.env.DATA_PATH, { recursive: true });

// Creates the schema (if needed) and the initial admin user.
const db = require('../src/db');

const now = Math.floor(Date.now() / 1000);
const HOUR = 3600;
const DAY = 86400;

// ---------------------------------------------------------------- sites ---
const SITES = [
  {
    id: 's1aaaaaaaa', name: 'Bakery landing', domain: 'bakery.demo.test',
    runtime: 'static', spa_mode: 1,
  },
  {
    id: 's2bbbbbbbb', name: 'Board-game club', domain: 'boardgames.demo.test',
    runtime: 'static', maintenance_mode: 1, ssl_enabled: 1,
    basic_auth: JSON.stringify({ username: 'club', password: 'demo' }),
  },
  {
    id: 's3cccccccc', name: 'Weather API', domain: 'weather-api.demo.test',
    runtime: 'node',
  },
  {
    id: 's4dddddddd', name: 'Sourdough diary', domain: 'sourdough.demo.test',
    runtime: 'php', preview_container_id: 'demo-preview',
    preview_domain: 'preview-sourdough.demo.test',
  },
  {
    id: 's5eeeeeeee', name: 'Reading list', domain: 'reading.demo.test',
    runtime: 'python', spa_mode: 1,
  },
];

const insertSite = db.prepare(`
  INSERT OR REPLACE INTO sites
    (id, name, domain, runtime, spa_mode, maintenance_mode, ssl_enabled, basic_auth,
     preview_container_id, preview_domain)
  VALUES
    (@id, @name, @domain, @runtime, @spa_mode, @maintenance_mode, @ssl_enabled, @basic_auth,
     @preview_container_id, @preview_domain)
`);
for (const s of SITES) {
  insertSite.run({
    id: s.id,
    name: s.name,
    domain: s.domain,
    runtime: s.runtime,
    spa_mode: s.spa_mode || 0,
    maintenance_mode: s.maintenance_mode || 0,
    ssl_enabled: s.ssl_enabled || 0,
    basic_auth: s.basic_auth || null,
    preview_container_id: s.preview_container_id || null,
    preview_domain: s.preview_domain || null,
  });
}

// ----------------------------------------------------------- deployments --
const DEPLOYMENTS = [
  { id: 'dep-s1-v3', site_id: 's1aaaaaaaa', filename: 'bakery-v3.zip', size: 2400000, deployed_at: now - HOUR },
  { id: 'dep-s1-v2', site_id: 's1aaaaaaaa', filename: 'bakery-v2.zip', size: 2200000, deployed_at: now - DAY },
  { id: 'dep-s4-v1', site_id: 's4dddddddd', filename: 'sourdough.zip', size: 12300000, deployed_at: now - 2 * HOUR },
];
const insertDeployment = db.prepare(`
  INSERT OR REPLACE INTO deployments (id, site_id, filename, size, deployed_at)
  VALUES (@id, @site_id, @filename, @size, @deployed_at)
`);
for (const d of DEPLOYMENTS) insertDeployment.run(d);

// -------------------------------------------------------------- activity --
// No natural unique key on this table — clear the demo rows before
// re-inserting so re-running the script doesn't pile up duplicates.
db.prepare(`DELETE FROM activity WHERE site_id IN ('s1aaaaaaaa','s2bbbbbbbb') OR site_name = 'grimport'`).run();

const ACTIVITY = [
  { site_id: 's1aaaaaaaa', site_name: 'Bakery landing', event: 'deployed', detail: 'bakery-v3.zip', level: 'info', actor: 'owner', created_at: now - HOUR },
  { site_id: 's2bbbbbbbb', site_name: 'Board-game club', event: 'down', detail: 'No response from boardgames.demo.test', level: 'error', actor: 'system', created_at: now - 3 * HOUR },
  { site_id: 's2bbbbbbbb', site_name: 'Board-game club', event: 'up', detail: 'boardgames.demo.test is back online', level: 'info', actor: 'system', created_at: now - 2 * HOUR },
  { site_id: null, site_name: 'grimport', event: 'images_pulled', detail: 'nginx:alpine, node:22-alpine', level: 'info', actor: 'owner', created_at: now - 5 * HOUR },
  { site_id: 's2bbbbbbbb', site_name: 'Board-game club', event: 'container_recreated', detail: 'nginx:alpine', level: 'info', actor: 'system', created_at: now - 2 * HOUR - 60 },
];
const insertActivity = db.prepare(`
  INSERT INTO activity (site_id, site_name, event, detail, level, actor, created_at)
  VALUES (@site_id, @site_name, @event, @detail, @level, @actor, @created_at)
`);
for (const a of ACTIVITY) insertActivity.run(a);

// --------------------------------------------------------- notifications --
db.prepare(`DELETE FROM notifications WHERE type = 'site_down' AND data LIKE '%s2bbbbbbbb%'`).run();
db.prepare(`DELETE FROM notifications WHERE type = 'unknown_domain' AND data LIKE '%blog.demo.test%'`).run();

const insertNotification = db.prepare(`
  INSERT INTO notifications (type, title, detail, data, created_at)
  VALUES (@type, @title, @detail, @data, @created_at)
`);
insertNotification.run({
  type: 'site_down',
  title: 'Board-game club is down',
  detail: 'No response from boardgames.demo.test',
  data: JSON.stringify({ siteId: 's2bbbbbbbb' }),
  created_at: now - 3 * HOUR,
});
insertNotification.run({
  type: 'unknown_domain',
  title: 'Unknown domain request',
  detail: 'blog.demo.test is not configured',
  data: JSON.stringify({ domain: 'blog.demo.test' }),
  created_at: now - 6 * HOUR,
});

// -------------------------------------------------------------- webhooks --
db.prepare(`
  INSERT OR REPLACE INTO webhooks (id, name, url, events, enabled)
  VALUES ('wh-team-chat', 'Team chat', 'https://chat.example.test/hooks/demo',
          '["deploy","rollback","site_down","site_up"]', 1)
`).run();

// ------------------------------------------------------------ api tokens --
db.prepare(`
  INSERT OR REPLACE INTO api_tokens (id, name, token_hash, role, site_scope, expires_at)
  VALUES ('tok-laptop-cli', 'laptop-cli', 'deadbeef', 'admin', NULL, NULL)
`).run();
db.prepare(`
  INSERT OR REPLACE INTO api_tokens (id, name, token_hash, role, site_scope, expires_at)
  VALUES ('tok-ci-deploy', 'ci-deploy', 'cafebabe', 'editor', @site_scope, @expires_at)
`).run({
  site_scope: JSON.stringify(['s1aaaaaaaa', 's4dddddddd']),
  expires_at: now + 30 * DAY,
});

// ----------------------------------------------------------------- users --
const passwordHash = bcrypt.hashSync('demo-password', 4);
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password_hash, role)
  VALUES ('user-anna', 'anna', @hash, 'editor')
`).run({ hash: passwordHash });
db.prepare(`
  INSERT OR REPLACE INTO users (id, username, password_hash, role)
  VALUES ('user-ben', 'ben', @hash, 'viewer')
`).run({ hash: passwordHash });

db.prepare(`INSERT OR IGNORE INTO site_permissions (user_id, site_id) VALUES ('user-anna', 's1aaaaaaaa')`).run();

// --------------------------------------------------------- uptime checks --
db.prepare(`DELETE FROM uptime_checks WHERE site_id IN ('s1aaaaaaaa','s2bbbbbbbb')`).run();

const insertUptime = db.prepare(`
  INSERT INTO uptime_checks (site_id, checked_at, up, latency_ms)
  VALUES (@site_id, @checked_at, @up, @latency_ms)
`);
const CHECK_COUNT = 48;
const CHECK_INTERVAL = 30 * 60; // 30 minutes apart, covering the last 24h
for (let i = 0; i < CHECK_COUNT; i++) {
  const checked_at = now - (CHECK_COUNT - 1 - i) * CHECK_INTERVAL;

  // s1: always up, latency 40-90ms
  insertUptime.run({
    site_id: 's1aaaaaaaa',
    checked_at,
    up: 1,
    latency_ms: 40 + Math.floor(Math.random() * 51),
  });

  // s2: every 7th check is down
  const s2Down = (i + 1) % 7 === 0;
  insertUptime.run({
    site_id: 's2bbbbbbbb',
    checked_at,
    up: s2Down ? 0 : 1,
    latency_ms: s2Down ? null : 40 + Math.floor(Math.random() * 51),
  });
}

// ------------------------------------------------------------- settings --
db.prepare(`INSERT OR REPLACE INTO settings (key, value) VALUES ('onboarding_done', '1')`).run();

console.log(
  `[demo-seed] ${SITES.length} sites, ${DEPLOYMENTS.length} deployments, ` +
  `${ACTIVITY.length} activity rows, 2 notifications, 1 webhook, 2 api tokens, ` +
  `2 users, ${CHECK_COUNT * 2} uptime checks seeded into ${process.env.DATA_PATH}`
);
