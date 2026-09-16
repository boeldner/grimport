const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolated DB per test file (see test/users-password.test.js for the same
// pattern): point DATA_PATH at a fresh temp dir before requiring db.js so
// this file's better-sqlite3 instance never touches the real database.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-lockout-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

require('../src/db');
const { checkLocked, recordFailure, clearAttempts, THRESHOLD } = require('../src/lockout');

const MIN = 60 * 1000;
let t0 = Date.parse('2026-01-01T00:00:00Z');

test('under the threshold, the key is never locked', () => {
  const key = 'user:under-threshold';
  let now = t0;
  for (let i = 0; i < THRESHOLD - 1; i++) {
    const r = recordFailure(key, now);
    assert.strictEqual(r.lockedUntil, null);
    now += MIN;
  }
  assert.strictEqual(checkLocked(key, now).locked, false);
});

test('the 5th failure locks for 1 minute, escalating by doubling for each further failure, capped at 60', () => {
  const key = 'user:escalating';
  let now = t0;

  // Failures 1-4: no lock yet.
  for (let i = 0; i < 4; i++) { recordFailure(key, now); now += 1000; }

  // 5th failure -> locked for 2^(5-5) = 1 minute.
  const r5 = recordFailure(key, now);
  assert.strictEqual(r5.failures, 5);
  assert.strictEqual(r5.isThresholdFailure, true);
  assert.strictEqual(r5.lockedUntil, now + 1 * MIN);
  let status = checkLocked(key, now);
  assert.strictEqual(status.locked, true);
  assert.strictEqual(status.retryAfterSeconds, 60);

  // Lock expires; a 6th failure right after -> 2^(6-5) = 2 minutes.
  now = r5.lockedUntil + 1;
  const r6 = recordFailure(key, now);
  assert.strictEqual(r6.failures, 6);
  assert.strictEqual(r6.isThresholdFailure, false);
  assert.strictEqual(r6.lockedUntil, now + 2 * MIN);

  // 7th -> 4 min, 8th -> 8 min, 9th -> 16 min, 10th -> 32 min, 11th -> 64 -> capped at 60.
  now = r6.lockedUntil + 1;
  const r7 = recordFailure(key, now); assert.strictEqual(r7.lockedUntil, now + 4 * MIN);
  now = r7.lockedUntil + 1;
  const r8 = recordFailure(key, now); assert.strictEqual(r8.lockedUntil, now + 8 * MIN);
  now = r8.lockedUntil + 1;
  const r9 = recordFailure(key, now); assert.strictEqual(r9.lockedUntil, now + 16 * MIN);
  now = r9.lockedUntil + 1;
  const r10 = recordFailure(key, now); assert.strictEqual(r10.lockedUntil, now + 32 * MIN);
  now = r10.lockedUntil + 1;
  const r11 = recordFailure(key, now); assert.strictEqual(r11.lockedUntil, now + 60 * MIN, 'lock duration caps at 60 minutes');
});

test('a gap of more than 15 minutes between failures resets the counter', () => {
  const key = 'user:stale-window';
  let now = t0;
  for (let i = 0; i < 4; i++) { recordFailure(key, now); now += MIN; }

  // 20 minutes later — outside the 15-minute window — the count resets to 1.
  now += 20 * MIN;
  const r = recordFailure(key, now);
  assert.strictEqual(r.failures, 1);
  assert.strictEqual(r.lockedUntil, null);
});

test('checkLocked reports not-locked once locked_until has passed', () => {
  const key = 'user:expiry';
  let now = t0;
  for (let i = 0; i < 5; i++) { recordFailure(key, now); now += 1000; }
  const locked = checkLocked(key, now);
  assert.strictEqual(locked.locked, true);

  const after = checkLocked(key, locked.lockedUntil + 1);
  assert.strictEqual(after.locked, false);
});

test('clearAttempts removes all tracked failures for a key', () => {
  const key = 'user:clear-me';
  let now = t0;
  for (let i = 0; i < 5; i++) { recordFailure(key, now); now += 1000; }
  assert.strictEqual(checkLocked(key, now).locked, true);

  clearAttempts(key);
  assert.strictEqual(checkLocked(key, now).locked, false);
});

test('username and IP keys are tracked independently', () => {
  const userKey = 'user:isolated';
  const ipKey = 'ip:9.9.9.9';
  let now = t0;
  for (let i = 0; i < 5; i++) { recordFailure(userKey, now); now += 1000; }
  assert.strictEqual(checkLocked(userKey, now).locked, true);
  assert.strictEqual(checkLocked(ipKey, now).locked, false);
});
