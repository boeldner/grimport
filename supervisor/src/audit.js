const db = require('./db');

/**
 * Write one audit entry. All fields optional except fn + level.
 */
function logAudit({ fn, level = 'info', siteId = null, siteName = null, detail = null, actor = 'system', durationMs = null }) {
  try {
    db.prepare(
      `INSERT INTO activity (site_id, site_name, event, detail, level, actor, duration_ms, fn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(siteId, siteName, fn, detail, level, actor, durationMs, fn);
  } catch (err) {
    console.error('[audit] Failed to write log entry:', err.message);
  }
}

/**
 * Wrap an async function so every call is logged to the audit trail.
 * Usage: const safe = withAudit('createSiteContainer', origFn, (args) => ({ siteId: args[0].id, siteName: args[0].name }))
 */
function withAudit(name, fn, getMeta = () => ({})) {
  return async function audited(...args) {
    const start = Date.now();
    const meta = getMeta(args) || {};
    try {
      const result = await fn(...args);
      logAudit({
        fn: name,
        level: 'info',
        siteId: meta.siteId || null,
        siteName: meta.siteName || null,
        detail: meta.detail || null,
        actor: meta.actor || 'system',
        durationMs: Date.now() - start,
      });
      return result;
    } catch (err) {
      logAudit({
        fn: name,
        level: 'error',
        siteId: meta.siteId || null,
        siteName: meta.siteName || null,
        detail: err.message,
        actor: meta.actor || 'system',
        durationMs: Date.now() - start,
      });
      throw err;
    }
  };
}

module.exports = { logAudit, withAudit };
