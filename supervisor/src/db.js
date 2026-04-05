const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, '..', 'supervisor.db')
  : path.join(__dirname, '../../data/supervisor.db');

fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

db.exec(`
  CREATE TABLE IF NOT EXISTS sites (
    id               TEXT PRIMARY KEY,
    name             TEXT NOT NULL,
    domain           TEXT NOT NULL UNIQUE,
    spa_mode         INTEGER NOT NULL DEFAULT 0,
    basic_auth       TEXT,
    cache_enabled    INTEGER NOT NULL DEFAULT 1,
    maintenance_mode INTEGER NOT NULL DEFAULT 0,
    custom_headers   TEXT NOT NULL DEFAULT '[]',
    redirects        TEXT NOT NULL DEFAULT '[]',
    container_id     TEXT,
    ssl_enabled      INTEGER NOT NULL DEFAULT 0,
    created_at       INTEGER NOT NULL DEFAULT (unixepoch())
  );

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  -- Analytics: one row per site per hour
  CREATE TABLE IF NOT EXISTS analytics_hourly (
    site_id    TEXT NOT NULL,
    hour       INTEGER NOT NULL,  -- unix timestamp truncated to hour start
    requests   INTEGER NOT NULL DEFAULT 0,
    bytes      INTEGER NOT NULL DEFAULT 0,
    ok         INTEGER NOT NULL DEFAULT 0,  -- 2xx
    redirects  INTEGER NOT NULL DEFAULT 0,  -- 3xx
    client_err INTEGER NOT NULL DEFAULT 0,  -- 4xx
    server_err INTEGER NOT NULL DEFAULT 0,  -- 5xx
    PRIMARY KEY (site_id, hour)
  );

  -- Tracks how far we've parsed each container's logs (unix timestamp)
  CREATE TABLE IF NOT EXISTS analytics_cursor (
    site_id  TEXT PRIMARY KEY,
    last_ts  INTEGER NOT NULL DEFAULT 0
  );

  -- API tokens for CI/CD deploys
  CREATE TABLE IF NOT EXISTS api_tokens (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used  INTEGER
  );

  -- Deployment history: last N zips per site
  CREATE TABLE IF NOT EXISTS deployments (
    id         TEXT PRIMARY KEY,
    site_id    TEXT NOT NULL,
    filename   TEXT NOT NULL,
    size       INTEGER NOT NULL DEFAULT 0,
    deployed_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Uptime monitoring: one row per check
  CREATE TABLE IF NOT EXISTS uptime_checks (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id    TEXT NOT NULL,
    checked_at INTEGER NOT NULL DEFAULT (unixepoch()),
    up         INTEGER NOT NULL DEFAULT 0,  -- 1=up, 0=down
    latency_ms INTEGER                      -- null if down
  );

  -- Activity log: global event feed
  CREATE TABLE IF NOT EXISTS activity (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    site_id    TEXT,                        -- null for panel-level events
    site_name  TEXT,
    event      TEXT NOT NULL,              -- deployed | created | deleted | started | stopped | settings_changed | up | down
    detail     TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`);

// Add ssl_enabled column to existing installs (safe no-op if already present)
try { db.exec('ALTER TABLE sites ADD COLUMN ssl_enabled INTEGER NOT NULL DEFAULT 0'); } catch {}

// Seed password from env if not yet set
const existing = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
if (!existing) {
  const secret = process.env.SUPERVISOR_SECRET || 'changeme';
  const hash = bcrypt.hashSync(secret, 12);
  db.prepare("INSERT INTO settings (key, value) VALUES ('password_hash', ?)").run(hash);
  if (secret === 'changeme') {
    console.warn('[security] SUPERVISOR_SECRET is "changeme" — change it in .env before going public!');
  }
}

// Seed site_base_domain from env if not yet set
if (!db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('site_base_domain', ?)").run(
    process.env.SITE_BASE_DOMAIN || ''
  );
}

module.exports = db;
