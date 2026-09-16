/**
 * Login lockout — tracks failed login attempts per key (a username or an
 * IP address, callers keep those in separate namespaces, e.g. `user:admin`
 * / `ip:1.2.3.4`) and escalates a lockout window once a threshold is hit.
 *
 * This sits BEHIND the existing express-rate-limit login limiter in
 * routes/auth.js (a flat "10 attempts / 15 min per IP" outer guard) as a
 * second, per-account layer with an escalating penalty — repeated offenders
 * get locked out for longer each time, instead of always the same 15
 * minutes.
 *
 * Rule: after THRESHOLD (5) failures within WINDOW_MS (15 min) of the last
 * failure, the key is locked for 2^(failures - THRESHOLD) minutes, capped
 * at MAX_LOCK_MINUTES (60). Below the threshold, a failure more than
 * WINDOW_MS after the previous one resets the counter to 1 (stale attempts
 * don't accumulate forever). Once a key has crossed the threshold it keeps
 * escalating on every further failure regardless of gap — the whole point
 * of the escalation is to keep climbing for a repeat offender who keeps
 * retrying right as each lock expires (lock lengths quickly exceed 15
 * minutes, so gating escalation on WINDOW_MS there would cap it at ~8
 * minutes in practice and the 60-minute cap would never be reached). Only
 * a successful login (clearAttempts) resets an escalated key.
 *
 * Every function takes an optional `now` (ms epoch) so tests can drive the
 * clock deterministically instead of depending on wall time.
 */
const db = require('./db');

const WINDOW_MS = 15 * 60 * 1000;
const THRESHOLD = 5;
const MAX_LOCK_MINUTES = 60;

const _get = db.prepare('SELECT key, failures, locked_until, updated_at FROM login_attempts WHERE key = ?');
const _upsert = db.prepare(`
  INSERT INTO login_attempts (key, failures, locked_until, updated_at)
  VALUES (@key, @failures, @locked_until, @updated_at)
  ON CONFLICT(key) DO UPDATE SET failures = @failures, locked_until = @locked_until, updated_at = @updated_at
`);
const _delete = db.prepare('DELETE FROM login_attempts WHERE key = ?');

/**
 * Returns { locked: false } or { locked: true, retryAfterSeconds, lockedUntil }.
 * Never mutates state — safe to call before attempting a login.
 */
function checkLocked(key, now = Date.now()) {
  const row = _get.get(key);
  if (!row || !row.locked_until || row.locked_until <= now) {
    return { locked: false };
  }
  return {
    locked: true,
    lockedUntil: row.locked_until,
    retryAfterSeconds: Math.max(1, Math.ceil((row.locked_until - now) / 1000)),
  };
}

/**
 * Records one failed attempt for `key`. Returns
 * { failures, lockedUntil, isThresholdFailure } where isThresholdFailure is
 * true exactly on the failure that first crosses THRESHOLD (i.e. the 5th),
 * so callers can fire a one-time alert instead of one per subsequent lock.
 */
function recordFailure(key, now = Date.now()) {
  const row = _get.get(key);
  const belowThreshold = !row || row.failures < THRESHOLD;
  const staleWindow = belowThreshold && (!row || (now - row.updated_at) > WINDOW_MS);
  const failures = staleWindow ? 1 : row.failures + 1;

  let lockedUntil = null;
  if (failures >= THRESHOLD) {
    const lockMinutes = Math.min(MAX_LOCK_MINUTES, Math.pow(2, failures - THRESHOLD));
    lockedUntil = now + lockMinutes * 60 * 1000;
  }

  _upsert.run({ key, failures, locked_until: lockedUntil, updated_at: now });
  return { failures, lockedUntil, isThresholdFailure: failures === THRESHOLD };
}

/** Clears all tracked failures for `key` (called on a successful login). */
function clearAttempts(key) {
  _delete.run(key);
}

module.exports = { checkLocked, recordFailure, clearAttempts, WINDOW_MS, THRESHOLD, MAX_LOCK_MINUTES };
