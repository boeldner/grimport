const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { dirSizeBytes } = require('../src/disk');
const { principalKey, makeLimiter, envInt } = require('../src/rate-limit');

test('dirSizeBytes sums regular files recursively, skips symlinks, 0 for missing', () => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-disk-'));
  fs.mkdirSync(path.join(work, 'sub'), { recursive: true });
  fs.writeFileSync(path.join(work, 'a.txt'), 'x'.repeat(100));
  fs.writeFileSync(path.join(work, 'sub', 'b.txt'), 'y'.repeat(50));
  try { fs.symlinkSync(path.join(work, 'a.txt'), path.join(work, 'link')); } catch {}
  assert.strictEqual(dirSizeBytes(work), 150);
  assert.strictEqual(dirSizeBytes(path.join(work, 'missing')), 0);
});

test('principalKey prefers session user, then token hash, then IP', () => {
  assert.strictEqual(principalKey({ user: { id: 'u1' } }), 'u:u1');
  assert.strictEqual(principalKey({ session: { userId: 'u2' }, headers: {} }), 'u:u2');
  const t = principalKey({ user: { id: 'token' }, headers: { authorization: 'Bearer grim_secret' }, ip: '1.2.3.4' });
  assert.match(t, /^t:[0-9a-f]{16}$/);
  assert.ok(!t.includes('grim_secret'), 'token never appears in the key');
  assert.strictEqual(principalKey({ headers: {}, ip: '9.9.9.9' }), 'ip:9.9.9.9');
});

test('envInt parses integers and falls back on junk', () => {
  process.env.X_TEST_LIMIT = '42';
  assert.strictEqual(envInt('X_TEST_LIMIT', 5), 42);
  process.env.X_TEST_LIMIT = 'nope';
  assert.strictEqual(envInt('X_TEST_LIMIT', 5), 5);
  process.env.X_TEST_LIMIT = '0';
  assert.strictEqual(envInt('X_TEST_LIMIT', 5), 0);
  delete process.env.X_TEST_LIMIT;
  assert.strictEqual(envInt('X_TEST_LIMIT', 5), 5);
});

test('makeLimiter is a pass-through no-op when disabled (limit 0 or NODE_ENV=test)', () => {
  const prev = process.env.NODE_ENV;
  process.env.NODE_ENV = 'test';
  const mw = makeLimiter({ envName: 'X_RL', defaultMax: 10, windowMs: 1000, message: 'no' });
  assert.strictEqual(mw.disabled, true);
  let called = false;
  mw({}, {}, () => { called = true; });
  assert.strictEqual(called, true);
  process.env.NODE_ENV = 'production';
  process.env.X_RL = '0';
  assert.strictEqual(makeLimiter({ envName: 'X_RL', defaultMax: 10, windowMs: 1000, message: 'no' }).disabled, true);
  process.env.X_RL = '5';
  assert.notStrictEqual(makeLimiter({ envName: 'X_RL', defaultMax: 10, windowMs: 1000, message: 'no' }).disabled, true);
  delete process.env.X_RL;
  process.env.NODE_ENV = prev;
});
