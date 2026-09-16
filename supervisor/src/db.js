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

  -- Login lockout: escalating lockout per failed-login key (username or IP).
  -- See src/lockout.js.
  CREATE TABLE IF NOT EXISTS login_attempts (
    key          TEXT PRIMARY KEY,
    failures     INTEGER NOT NULL DEFAULT 0,
    locked_until INTEGER,
    updated_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );

  -- One-time TOTP recovery codes (bcrypt-hashed), 8 minted whenever a user
  -- enables 2FA. Each can be used once in place of a TOTP code.
  CREATE TABLE IF NOT EXISTS recovery_codes (
    id         TEXT PRIMARY KEY,
    user_id    TEXT NOT NULL,
    code_hash  TEXT NOT NULL,
    used_at    INTEGER,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
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
try { db.exec("ALTER TABLE api_tokens ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'"); } catch {}
// site_scope: JSON array of site ids, or NULL = all sites (least-privilege scoping for CI tokens)
try { db.exec('ALTER TABLE api_tokens ADD COLUMN site_scope TEXT'); } catch {}
// expires_at: unix seconds, NULL = never expires
try { db.exec('ALTER TABLE api_tokens ADD COLUMN expires_at INTEGER'); } catch {}
// totp_secret: base32-encoded TOTP secret, NULL = 2FA not enabled for this user
try { db.exec('ALTER TABLE users ADD COLUMN totp_secret TEXT'); } catch {}

// ── Multi-user platform (Phase 2) ──────────────────────────────────────────
// Platform roles + capabilities on users, site ownership + membership roles,
// per-user notifications and tokens, invitations, domain requests.
try { db.exec("ALTER TABLE users ADD COLUMN platform_role TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN capabilities TEXT NOT NULL DEFAULT '{}'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN display_name TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN email TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN totp_secret TEXT"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN last_login_at INTEGER"); } catch {}
try { db.exec("ALTER TABLE users ADD COLUMN invited_by TEXT"); } catch {}
try { db.exec("ALTER TABLE sites ADD COLUMN owner_id TEXT"); } catch {}
try { db.exec("ALTER TABLE sites ADD COLUMN status TEXT NOT NULL DEFAULT 'active'"); } catch {}
// Per-site allow-list of extra external-script/form hosts (JSON array) —
// see src/scanner.js and docs/wiki/Security-Model.md "Content safety".
try { db.exec("ALTER TABLE sites ADD COLUMN scan_allowlist TEXT"); } catch {}
try { db.exec("ALTER TABLE notifications ADD COLUMN user_id TEXT"); } catch {}
try { db.exec("ALTER TABLE api_tokens ADD COLUMN user_id TEXT"); } catch {}
try { db.exec("ALTER TABLE activity ADD COLUMN target_user_id TEXT"); } catch {}
db.exec(`
  CREATE TABLE IF NOT EXISTS site_members (
    site_id   TEXT NOT NULL,
    user_id   TEXT NOT NULL,
    site_role TEXT NOT NULL DEFAULT 'viewer',   -- owner | editor | viewer
    added_by  TEXT,
    added_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (site_id, user_id)
  );
  CREATE TABLE IF NOT EXISTS invitations (
    id            TEXT PRIMARY KEY,
    token_hash    TEXT NOT NULL UNIQUE,
    label         TEXT NOT NULL,
    platform_role TEXT NOT NULL DEFAULT 'member',
    capabilities  TEXT NOT NULL DEFAULT '{}',
    created_by    TEXT,
    created_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    expires_at    INTEGER NOT NULL,
    used_by       TEXT,
    used_at       INTEGER
  );
  CREATE TABLE IF NOT EXISTS domain_requests (
    id           TEXT PRIMARY KEY,
    site_id      TEXT NOT NULL,
    domain       TEXT NOT NULL,
    requested_by TEXT,
    status       TEXT NOT NULL DEFAULT 'pending',   -- pending | approved | rejected
    decided_by   TEXT,
    decided_at   INTEGER,
    note         TEXT,
    created_at   INTEGER NOT NULL DEFAULT (unixepoch())
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, created_at);
  CREATE INDEX IF NOT EXISTS idx_site_members_user ON site_members(user_id);

  -- Content scanner quarantine (Phase 4, docs/roadmap/multi-user-platform.md
  -- section 8/9): one row per deploy that the scanner flagged. status
  -- 'pending' is the only one meaningfully "open" — a pending_html/ dir sits
  -- alongside the site until an admin approves or rejects it.
  CREATE TABLE IF NOT EXISTS deploy_reviews (
    id         TEXT PRIMARY KEY,
    site_id    TEXT NOT NULL,
    filename   TEXT NOT NULL,
    size       INTEGER NOT NULL DEFAULT 0,
    verdict    TEXT NOT NULL,               -- review | blocked (clean never gets a row)
    findings   TEXT NOT NULL DEFAULT '[]',  -- JSON array of { category, severity, file, line?, detail }
    status     TEXT NOT NULL DEFAULT 'pending', -- pending | approved | rejected
    created_by TEXT,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    decided_by TEXT,
    decided_at INTEGER,
    note       TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_deploy_reviews_site ON deploy_reviews(site_id, status);
`);

// One-time backfill of the new columns from the legacy role model.
// Runs until every user has a platform_role; idempotent afterwards.
(function migrateToPlatformRoles() {
  const pending = db.prepare('SELECT id, role, created_at FROM users WHERE platform_role IS NULL ORDER BY created_at ASC, rowid ASC').all();
  if (!pending.length) return;
  const hasOwner = db.prepare("SELECT 1 FROM users WHERE platform_role = 'owner'").get();
  let ownerAssigned = !!hasOwner;
  const set = db.prepare('UPDATE users SET platform_role = ? WHERE id = ?');
  for (const u of pending) {
    let pr;
    if (u.role === 'admin') { pr = ownerAssigned ? 'admin' : 'owner'; ownerAssigned = true; }
    else pr = 'guest'; // editors/viewers keep their per-site grants as site roles below
    set.run(pr, u.id);
  }
  // site_permissions -> site_members (editor grant -> editor, viewer -> viewer)
  const grants = db.prepare('SELECT sp.user_id, sp.site_id, u.role FROM site_permissions sp JOIN users u ON u.id = sp.user_id').all();
  const ins = db.prepare('INSERT OR IGNORE INTO site_members (site_id, user_id, site_role) VALUES (?, ?, ?)');
  for (const g of grants) ins.run(g.site_id, g.user_id, g.role === 'editor' ? 'editor' : 'viewer');
  console.log(`[migrate] platform roles assigned to ${pending.length} user(s), ${grants.length} site grant(s) migrated`);
})();
// Sites and tokens without an owner belong to the platform owner.
(function backfillOwnership() {
  const owner = db.prepare("SELECT id FROM users WHERE platform_role = 'owner' LIMIT 1").get();
  if (!owner) return;
  db.prepare('UPDATE sites SET owner_id = ? WHERE owner_id IS NULL').run(owner.id);
  db.prepare('UPDATE api_tokens SET user_id = ? WHERE user_id IS NULL').run(owner.id);
})();

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
  const adminId = nanoid(10);
  db.prepare('INSERT INTO users (id, username, password_hash, role, platform_role) VALUES (?, ?, ?, ?, ?)')
    .run(adminId, 'admin', hash, 'admin', 'owner');
  db.prepare('UPDATE sites SET owner_id = ? WHERE owner_id IS NULL').run(adminId);
  db.prepare('UPDATE api_tokens SET user_id = ? WHERE user_id IS NULL').run(adminId);
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
