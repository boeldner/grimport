const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');

// Directories we never want to sweep into a backup archive.
const SKIP_DIR_NAMES = new Set(['node_modules', 'tmp', '.git']);

/**
 * Recursively add a directory's contents into an AdmZip instance under
 * `zipPrefix`, skipping SKIP_DIR_NAMES anywhere in the tree.
 */
function addDirToZip(zip, dir, zipPrefix) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP_DIR_NAMES.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const zipPath = zipPrefix ? `${zipPrefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      addDirToZip(zip, full, zipPath);
    } else if (entry.isFile()) {
      zip.addLocalFile(full, path.dirname(zipPath) === '.' ? '' : path.dirname(zipPath));
    }
  }
}

/**
 * Build an AdmZip archive containing `supervisor.db` (at the archive root)
 * plus the full `sites/` tree (under a `sites/` prefix), skipping
 * node_modules/tmp/.git wherever they appear.
 *
 * NOTE: adm-zip is synchronous. For very large site trees this will block
 * the event loop for the duration of the archive build. Acceptable for a
 * self-hosted single-tenant panel today; if site data grows large, switch
 * to a streaming archiver (e.g. `archiver`) run off the main thread.
 */
function buildZip(dbPath, sitesDir) {
  const zip = new AdmZip();
  if (dbPath && fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath);
  }
  if (sitesDir && fs.existsSync(sitesDir)) {
    addDirToZip(zip, sitesDir, 'sites');
  }
  return zip;
}

/** Build the backup archive fully in memory and return it as a Buffer. */
function buildBackupBuffer({ dbPath, sitesDir }) {
  const zip = buildZip(dbPath, sitesDir);
  return zip.toBuffer();
}

/**
 * Create a backup archive on disk under `destDir`.
 * Returns { path, name, size, timestamp }.
 */
function createBackup(destDir, { dbPath, sitesDir } = {}) {
  fs.mkdirSync(destDir, { recursive: true });
  const zip = buildZip(dbPath, sitesDir);
  const timestamp = Date.now();
  const iso = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  const name = `backup-${iso}.zip`;
  const dest = path.join(destDir, name);
  zip.writeZip(dest);
  const { size } = fs.statSync(dest);
  return { path: dest, name, size, timestamp };
}

/** List backup archives in `dir`, newest first. */
function listBackups(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.startsWith('backup-') && f.endsWith('.zip'))
    .map(f => {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      return { name: f, size: stat.size, created: Math.floor(stat.mtimeMs / 1000) };
    })
    .sort((a, b) => b.created - a.created);
}

/** Keep the `keepN` newest backups in `dir`, delete the rest. Returns deleted filenames. */
function pruneBackups(dir, keepN) {
  const backups = listBackups(dir);
  const toDelete = backups.slice(Math.max(0, keepN));
  for (const b of toDelete) {
    try { fs.unlinkSync(path.join(dir, b.name)); } catch {}
  }
  return toDelete.map(b => b.name);
}

/**
 * Start (or no-op) a scheduled backup job. Reads `backup_interval_hours`
 * (0 = off) and `backup_keep` from the `settings` table via `getSetting`,
 * and re-checks them on every tick (so changing settings takes effect on
 * the next run without a restart). The timer is unref'd so it never keeps
 * the process alive on its own.
 */
function startScheduledBackups({ db, destDir, dbPath, sitesDir, checkIntervalMs = 60 * 60 * 1000 }) {
  const getSetting = (key) => db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value;

  let lastRunAt = 0;
  const timer = setInterval(() => {
    const hours = Number(getSetting('backup_interval_hours'));
    if (!Number.isFinite(hours) || hours <= 0) return;
    const intervalMs = hours * 60 * 60 * 1000;
    if (Date.now() - lastRunAt < intervalMs) return;

    lastRunAt = Date.now();
    try {
      createBackup(destDir, { dbPath, sitesDir });
      const keepRaw = Number(getSetting('backup_keep'));
      const keep = Number.isFinite(keepRaw) && keepRaw > 0 ? Math.floor(keepRaw) : 7;
      pruneBackups(destDir, keep);
    } catch (err) {
      console.error('[backups] scheduled backup failed:', err.message);
    }
  }, checkIntervalMs);
  timer.unref();
  return timer;
}

module.exports = { createBackup, pruneBackups, listBackups, buildBackupBuffer, startScheduledBackups };
