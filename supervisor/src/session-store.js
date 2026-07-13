/**
 * Session store backed by the app's existing better-sqlite3 connection.
 *
 * Replaces connect-sqlite3 (which pulls the async node-sqlite3 native module —
 * fragile to build/resolve on some Node/Alpine combos and the cause of a
 * startup crash: "this.db.exec is not a function"). This store reuses the
 * single better-sqlite3 instance already opened in db.js, so there is no second
 * native dependency and no separate database connection.
 */

const { Store } = require('express-session');
const db = require('./db');

const DEFAULT_TTL_MS = 8 * 60 * 60 * 1000; // matches the session cookie maxAge

db.exec(`CREATE TABLE IF NOT EXISTS sessions (
  sid     TEXT PRIMARY KEY,
  expires INTEGER NOT NULL,
  data    TEXT NOT NULL
)`);

function expiryFromSession(sess) {
  if (sess?.cookie?.expires) {
    const t = new Date(sess.cookie.expires).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const maxAge = sess?.cookie?.maxAge;
  return Date.now() + (typeof maxAge === 'number' ? maxAge : DEFAULT_TTL_MS);
}

class BetterSqliteStore extends Store {
  constructor() {
    super();
    this._get = db.prepare('SELECT data, expires FROM sessions WHERE sid = ?');
    this._set = db.prepare(
      `INSERT INTO sessions (sid, expires, data) VALUES (@sid, @expires, @data)
       ON CONFLICT(sid) DO UPDATE SET expires = @expires, data = @data`
    );
    this._del = db.prepare('DELETE FROM sessions WHERE sid = ?');
    this._touch = db.prepare('UPDATE sessions SET expires = ? WHERE sid = ?');
    this._pruneStmt = db.prepare('DELETE FROM sessions WHERE expires < ?');
    this._all = db.prepare('SELECT data FROM sessions WHERE expires >= ?');

    // Opportunistic cleanup of expired rows every 15 minutes.
    this._timer = setInterval(() => this.prune(), 15 * 60 * 1000);
    if (this._timer.unref) this._timer.unref();
  }

  prune() {
    try { this._pruneStmt.run(Date.now()); } catch { /* non-fatal */ }
  }

  get(sid, cb) {
    try {
      const row = this._get.get(sid);
      if (!row) return cb(null, null);
      if (row.expires < Date.now()) {
        this._del.run(sid);
        return cb(null, null);
      }
      return cb(null, JSON.parse(row.data));
    } catch (err) {
      return cb(err);
    }
  }

  set(sid, sess, cb) {
    try {
      this._set.run({ sid, expires: expiryFromSession(sess), data: JSON.stringify(sess) });
      return cb?.(null);
    } catch (err) {
      return cb?.(err);
    }
  }

  destroy(sid, cb) {
    try {
      this._del.run(sid);
      return cb?.(null);
    } catch (err) {
      return cb?.(err);
    }
  }

  touch(sid, sess, cb) {
    try {
      this._touch.run(expiryFromSession(sess), sid);
      return cb?.(null);
    } catch (err) {
      return cb?.(err);
    }
  }

  all(cb) {
    try {
      const rows = this._all.all(Date.now());
      return cb(null, rows.map(r => JSON.parse(r.data)));
    } catch (err) {
      return cb(err);
    }
  }

  clear(cb) {
    try {
      db.exec('DELETE FROM sessions');
      return cb?.(null);
    } catch (err) {
      return cb?.(err);
    }
  }

  length(cb) {
    try {
      const row = db.prepare('SELECT COUNT(*) AS n FROM sessions').get();
      return cb(null, row.n);
    } catch (err) {
      return cb(err);
    }
  }
}

module.exports = { BetterSqliteStore };
