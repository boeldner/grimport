// NOTE: mounted behind requireAuth + requireRole('admin') in index.js — all
// routes here are admin-only.
//
// RESTORE PROCEDURE (manual — no destructive restore endpoint is exposed
// here on purpose; automating an in-place restore is too risky for a
// self-hosted panel):
//   1. Stop the stack:            docker compose down
//   2. Unzip the backup somewhere:  unzip backup-....zip -d /tmp/restore
//   3. Replace the live data dir with its contents:
//        - copy /tmp/restore/supervisor.db  -> <DATA_PATH>/../supervisor.db
//        - copy /tmp/restore/sites/*        -> <DATA_PATH>/  (i.e. the sites dir)
//   4. Restart the stack:         docker compose up -d
const { Router } = require('express');
const path = require('path');
const db = require('../db');
const { createBackup, pruneBackups, listBackups, buildBackupBuffer } = require('../backups');
const { asyncHandler } = require('../async-handler');

const DATA_PATH = process.env.DATA_PATH || '/data/sites';
const DB_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, '..', 'supervisor.db')
  : path.join(__dirname, '../../data/supervisor.db');
const DEFAULT_BACKUP_DIR = path.join(DATA_PATH, '..', 'backups');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value')
    .run(key, value);
}

function backupDir() {
  return getSetting('backup_dir') || DEFAULT_BACKUP_DIR;
}

function backupKeep() {
  const n = Number(getSetting('backup_keep'));
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 7;
}

function backupIntervalHours() {
  const n = Number(getSetting('backup_interval_hours'));
  return Number.isFinite(n) && n >= 0 ? n : 0;
}

function logActivity(event, detail) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor) VALUES (?, ?, ?, ?, ?)')
      .run(null, null, event, detail || null, 'system');
  } catch {}
}

const router = Router();

// GET /api/backups — list existing backups + current schedule/retention config
router.get('/', (req, res) => {
  res.json({
    backups: listBackups(backupDir()),
    dir: backupDir(),
    backup_interval_hours: backupIntervalHours(),
    backup_keep: backupKeep(),
  });
});

// PUT /api/backups/settings — configure schedule + retention
router.put('/settings', (req, res) => {
  const { backup_interval_hours, backup_keep } = req.body;
  if (backup_interval_hours !== undefined) {
    const n = Number(backup_interval_hours);
    if (!Number.isFinite(n) || n < 0) return res.status(400).json({ error: 'backup_interval_hours must be >= 0' });
    setSetting('backup_interval_hours', String(Math.floor(n)));
  }
  if (backup_keep !== undefined) {
    const n = Number(backup_keep);
    if (!Number.isFinite(n) || n <= 0) return res.status(400).json({ error: 'backup_keep must be a positive number' });
    setSetting('backup_keep', String(Math.floor(n)));
  }
  res.json({ ok: true, backup_interval_hours: backupIntervalHours(), backup_keep: backupKeep() });
});

// POST /api/backups — create a backup now, prune to retention
router.post('/', asyncHandler(async (req, res) => {
  const meta = createBackup(backupDir(), { dbPath: DB_PATH, sitesDir: DATA_PATH });
  const deleted = pruneBackups(backupDir(), backupKeep());
  logActivity('backup_created', meta.name);
  res.json({ ok: true, backup: meta, pruned: deleted });
}));

// GET /api/backups/download — build + stream a fresh backup zip as an attachment
router.get('/download', asyncHandler(async (req, res) => {
  const buf = buildBackupBuffer({ dbPath: DB_PATH, sitesDir: DATA_PATH });
  const iso = new Date().toISOString().replace(/[:.]/g, '-');
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="backup-${iso}.zip"`);
  res.send(buf);
}));

module.exports = router;
