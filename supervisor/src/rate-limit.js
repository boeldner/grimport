/**
 * Rate limiting helpers (express-rate-limit).
 *
 * Keys: the session user, else the Bearer token (hashed prefix, never the
 * token itself), else the client IP. Limits are env-configurable and switched
 * off with 0 or under NODE_ENV=test so the test suite never trips them.
 */
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');

function envInt(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/** Stable per-principal key for a request. */
function principalKey(req) {
  const uid = req.user?.id && req.user.id !== 'token' ? req.user.id : req.session?.userId;
  if (uid) return `u:${uid}`;
  const auth = req.headers?.authorization;
  if (auth && auth.startsWith('Bearer ')) {
    return `t:${crypto.createHash('sha256').update(auth.slice(7)).digest('hex').slice(0, 16)}`;
  }
  return `ip:${req.ip || req.socket?.remoteAddress || 'unknown'}`;
}

/**
 * makeLimiter({ envName, defaultMax, windowMs, message, skip })
 * Returns an express middleware; a no-op when disabled.
 */
function makeLimiter({ envName, defaultMax, windowMs, message, skip }) {
  const max = process.env.NODE_ENV === 'test' ? 0 : envInt(envName, defaultMax);
  if (!max) {
    const noop = (req, res, next) => next();
    noop.disabled = true;
    return noop;
  }
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: principalKey,
    skip: skip || (() => false),
    handler: (req, res) => res.status(429).json({ error: message }),
  });
}

/** 600 requests / 15 min per principal on /api (health excluded). */
function apiLimiter() {
  return makeLimiter({
    envName: 'API_RATE_LIMIT',
    defaultMax: 600,
    windowMs: 15 * 60 * 1000,
    message: 'Too many requests',
    skip: req => req.path === '/health' || req.path === '/api/health',
  });
}

/** 30 deploys / 10 min per principal (zip, URL, rollback). */
function deployLimiter() {
  return makeLimiter({
    envName: 'DEPLOY_RATE_LIMIT',
    defaultMax: 30,
    windowMs: 10 * 60 * 1000,
    message: 'Too many deploys, try again later',
  });
}

module.exports = { principalKey, makeLimiter, apiLimiter, deployLimiter, envInt };
