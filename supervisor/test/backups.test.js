const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { createBackup, pruneBackups, listBackups, buildBackupBuffer } = require('../src/backups');

function mkTempDir(prefix) {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

function makeFakeDataset() {
  const root = mkTempDir('grimport-backup-src-');
  const dbPath = path.join(root, 'supervisor.db');
  fs.writeFileSync(dbPath, 'fake-sqlite-bytes');

  const sitesDir = path.join(root, 'sites');
  fs.mkdirSync(path.join(sitesDir, 'site1', 'app'), { recursive: true });
  fs.writeFileSync(path.join(sitesDir, 'site1', 'app', 'index.html'), '<h1>hi</h1>');

  // Should be skipped by the archiver.
  fs.mkdirSync(path.join(sitesDir, 'site1', 'app', 'node_modules', 'left-pad'), { recursive: true });
  fs.writeFileSync(path.join(sitesDir, 'site1', 'app', 'node_modules', 'left-pad', 'index.js'), 'module.exports = {};');
  fs.mkdirSync(path.join(sitesDir, 'tmp'), { recursive: true });
  fs.writeFileSync(path.join(sitesDir, 'tmp', 'scratch.txt'), 'scratch');

  return { root, dbPath, sitesDir };
}

test('createBackup produces a zip containing supervisor.db + a sample site file', () => {
  const { dbPath, sitesDir } = makeFakeDataset();
  const destDir = mkTempDir('grimport-backup-dest-');

  const meta = createBackup(destDir, { dbPath, sitesDir });

  assert.ok(fs.existsSync(meta.path), 'backup archive should exist on disk');
  assert.ok(meta.size > 0, 'backup archive should be non-empty');
  assert.ok(meta.name.startsWith('backup-') && meta.name.endsWith('.zip'));
  assert.ok(Number.isFinite(meta.timestamp));

  const zip = new AdmZip(meta.path);
  const names = zip.getEntries().map(e => e.entryName);
  assert.ok(names.includes('supervisor.db'), 'archive should contain supervisor.db at root');
  assert.ok(names.includes('sites/site1/app/index.html'), 'archive should contain site file under sites/');
  assert.ok(!names.some(n => n.includes('node_modules')), 'archive should skip node_modules');
  assert.ok(!names.some(n => n.startsWith('sites/tmp/')), 'archive should skip tmp dirs');
});

test('pruneBackups keeps the N newest and deletes the rest', () => {
  const destDir = mkTempDir('grimport-backup-prune-');
  const names = [];
  for (let i = 0; i < 5; i++) {
    const name = `backup-2024-01-0${i}T00-00-00-000Z.zip`;
    const full = path.join(destDir, name);
    fs.writeFileSync(full, `zip-${i}`);
    // Ensure distinct mtimes (oldest first) regardless of filesystem timestamp resolution.
    const t = new Date(2024, 0, i + 1);
    fs.utimesSync(full, t, t);
    names.push(name);
  }

  const deleted = pruneBackups(destDir, 2);

  const remaining = fs.readdirSync(destDir).sort();
  assert.strictEqual(remaining.length, 2, 'only 2 backups should remain');
  assert.deepStrictEqual(remaining, [names[3], names[4]].sort(), 'the 2 newest should remain');
  assert.strictEqual(deleted.length, 3);
});

test('listBackups returns entries newest first with name/size/created', () => {
  const destDir = mkTempDir('grimport-backup-list-');
  const older = path.join(destDir, 'backup-a.zip');
  const newer = path.join(destDir, 'backup-b.zip');
  fs.writeFileSync(older, 'aa');
  fs.writeFileSync(newer, 'bbbb');
  const t1 = new Date(2024, 0, 1);
  const t2 = new Date(2024, 0, 2);
  fs.utimesSync(older, t1, t1);
  fs.utimesSync(newer, t2, t2);

  const list = listBackups(destDir);
  assert.strictEqual(list.length, 2);
  assert.strictEqual(list[0].name, 'backup-b.zip', 'newest first');
  assert.strictEqual(list[1].name, 'backup-a.zip');
  assert.strictEqual(list[0].size, 4);
  assert.ok(Number.isFinite(list[0].created));
});

test('listBackups returns [] for a directory that does not exist', () => {
  const missing = path.join(os.tmpdir(), 'grimport-backup-missing-' + Date.now());
  assert.deepStrictEqual(listBackups(missing), []);
});

test('buildBackupBuffer returns a non-empty Buffer that is a valid zip', () => {
  const { dbPath, sitesDir } = makeFakeDataset();
  const buf = buildBackupBuffer({ dbPath, sitesDir });

  assert.ok(Buffer.isBuffer(buf));
  assert.ok(buf.length > 0);

  const zip = new AdmZip(buf);
  const names = zip.getEntries().map(e => e.entryName);
  assert.ok(names.includes('supervisor.db'));
  assert.ok(names.includes('sites/site1/app/index.html'));
});
