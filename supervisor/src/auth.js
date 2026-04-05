const session = require('express-session');
const SQLiteStore = require('connect-sqlite3')(session);
const crypto = require('crypto');
const path = require('path');
const db = require('./db');

const DB_PATH = process.env.DATA_PATH
  ? path.join(process.env.DATA_PATH, '..', 'supervisor.db')
  : path.join(__dirname, '../../data/supervisor.db');

const sessionMiddleware = session({
  store: new SQLiteStore({ db: 'supervisor.db', dir: path.dirname(DB_PATH) }),
  secret: process.env.SUPERVISOR_SECRET || 'changeme',
  resave: false,
  saveUninitialized: false,
  name: 'wh.sid',
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    // secure: true requires HTTPS — enabled automatically in production via Traefik
    maxAge: 8 * 60 * 60 * 1000, // 8 hours
  },
});

function requireAuth(req, res, next) {
  if (req.session?.authenticated) return next();
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    const hash = crypto.createHash('sha256').update(auth.slice(7)).digest('hex');
    const row = db.prepare('SELECT id FROM api_tokens WHERE token_hash = ?').get(hash);
    if (row) {
      db.prepare('UPDATE api_tokens SET last_used = unixepoch() WHERE id = ?').run(row.id);
      return next();
    }
  }
  res.status(401).json({ error: 'Unauthorized' });
}

module.exports = { sessionMiddleware, requireAuth };
