const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Point db.js at a throwaway database BEFORE requiring the store.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-sess-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const { BetterSqliteStore } = require('../src/session-store');
const store = new BetterSqliteStore();

function sess(maxAge = 1000) {
  return { cookie: { maxAge }, userId: 'u1', role: 'admin' };
}

test('set then get returns the session', () => {
  return new Promise((resolve, reject) => {
    store.set('sid-a', sess(), err => {
      if (err) return reject(err);
      store.get('sid-a', (err2, got) => {
        if (err2) return reject(err2);
        assert.strictEqual(got.userId, 'u1');
        assert.strictEqual(got.role, 'admin');
        resolve();
      });
    });
  });
});

test('destroy removes the session', () => {
  return new Promise((resolve, reject) => {
    store.set('sid-b', sess(), () => {
      store.destroy('sid-b', () => {
        store.get('sid-b', (err, got) => {
          if (err) return reject(err);
          assert.strictEqual(got, null);
          resolve();
        });
      });
    });
  });
});

test('expired session is not returned', () => {
  return new Promise((resolve, reject) => {
    store.set('sid-c', sess(-1000), () => { // already expired
      store.get('sid-c', (err, got) => {
        if (err) return reject(err);
        assert.strictEqual(got, null);
        resolve();
      });
    });
  });
});

test('missing session returns null, not error', () => {
  return new Promise((resolve, reject) => {
    store.get('nope', (err, got) => {
      if (err) return reject(err);
      assert.strictEqual(got, null);
      resolve();
    });
  });
});
