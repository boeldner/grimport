const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Database = require('better-sqlite3');

// Reproduce the real-world upgrade: an existing supervisor.db already has a
// legacy connect-sqlite3 `sessions` table (sid, expired, sess). The store must
// migrate it instead of crashing with "no such column: data".
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-sessmig-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
const dbPath = path.join(work, 'supervisor.db');

// Seed the legacy table exactly as connect-sqlite3 would.
const seed = new Database(dbPath);
seed.exec('CREATE TABLE sessions (sid PRIMARY KEY, expired, sess)');
seed.prepare('INSERT INTO sessions (sid, expired, sess) VALUES (?,?,?)').run('old', 0, '{}');
seed.close();

process.env.DATA_PATH = path.join(work, 'sites'); // db.js → <..>/supervisor.db

test('store migrates a legacy connect-sqlite3 sessions table without crashing', () => {
  const { BetterSqliteStore } = require('../src/session-store');
  const store = new BetterSqliteStore(); // must not throw
  return new Promise((resolve, reject) => {
    store.set('sid-new', { cookie: { maxAge: 1000 }, userId: 'u1' }, err => {
      if (err) return reject(err);
      store.get('sid-new', (err2, got) => {
        if (err2) return reject(err2);
        assert.strictEqual(got.userId, 'u1');
        resolve();
      });
    });
  });
});
