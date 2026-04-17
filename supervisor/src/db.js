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

  -- Notifications: bell feed (unknown domains, site down alerts)
  CREATE TABLE IF NOT EXISTS notifications (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    type       TEXT NOT NULL,              -- unknown_domain | site_down | site_up
    title      TEXT NOT NULL,
    detail     TEXT,
    data       TEXT,                       -- JSON payload (e.g. {domain:'foo.com'})
    read       INTEGER NOT NULL DEFAULT 0,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Webhooks: fire POST on events to external URLs
  CREATE TABLE IF NOT EXISTS webhooks (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL,
    url        TEXT NOT NULL,
    events     TEXT NOT NULL DEFAULT '["deploy","rollback","site_down","site_up"]',
    enabled    INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Users: multi-user accounts with roles
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'editor',  -- admin | editor | viewer
    created_at    INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- Site permissions: which sites an editor/viewer can access (admin sees all)
  CREATE TABLE IF NOT EXISTS site_permissions (
    user_id  TEXT NOT NULL,
    site_id  TEXT NOT NULL,
    PRIMARY KEY (user_id, site_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (site_id) REFERENCES sites(id) ON DELETE CASCADE
  );
`);

// Safe migrations for existing installs
try { db.exec('ALTER TABLE sites ADD COLUMN ssl_enabled INTEGER NOT NULL DEFAULT 0'); } catch {}
try { db.exec('ALTER TABLE sites ADD COLUMN preview_container_id TEXT'); } catch {}
try { db.exec('ALTER TABLE sites ADD COLUMN preview_domain TEXT'); } catch {}
try { db.exec("ALTER TABLE sites ADD COLUMN runtime TEXT NOT NULL DEFAULT 'static'"); } catch {}
try { db.exec('ALTER TABLE sites ADD COLUMN build_cmd TEXT'); } catch {}
try { db.exec('ALTER TABLE sites ADD COLUMN start_cmd TEXT'); } catch {}
try { db.exec('ALTER TABLE sites ADD COLUMN app_port INTEGER DEFAULT 3000'); } catch {}
try { db.exec("ALTER TABLE sites ADD COLUMN env_vars TEXT DEFAULT '{}'"); } catch {}
try { db.exec("ALTER TABLE activity ADD COLUMN level TEXT NOT NULL DEFAULT 'info'"); } catch {}
try { db.exec("ALTER TABLE activity ADD COLUMN actor TEXT NOT NULL DEFAULT 'system'"); } catch {}
try { db.exec("ALTER TABLE activity ADD COLUMN duration_ms INTEGER"); } catch {}
try { db.exec("ALTER TABLE activity ADD COLUMN fn TEXT"); } catch {}

// Seed first admin user from existing password_hash setting (one-time migration)
const { nanoid } = require('nanoid');
const adminExists = db.prepare("SELECT id FROM users WHERE role = 'admin'").get();
if (!adminExists) {
  const existingHash = db.prepare("SELECT value FROM settings WHERE key = 'password_hash'").get();
  let hash;
  if (existingHash) {
    hash = existingHash.value;
  } else {
    const secret = process.env.SUPERVISOR_SECRET || 'changeme';
    hash = bcrypt.hashSync(secret, 12);
    if (secret === 'changeme') {
      console.warn('[security] SUPERVISOR_SECRET is "changeme" — change it in .env before going public!');
    }
  }
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(nanoid(10), 'admin', hash, 'admin');
  console.log('[auth] Created initial admin user (username: admin)');
}

// Keep password_hash setting in sync for backward compat (unused by new auth, but harmless)
// Seed site_base_domain from env if not yet set
if (!db.prepare("SELECT value FROM settings WHERE key = 'site_base_domain'").get()) {
  db.prepare("INSERT INTO settings (key, value) VALUES ('site_base_domain', ?)").run(
    process.env.SITE_BASE_DOMAIN || ''
  );
}

module.exports = db;
