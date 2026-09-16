const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/**
 * Blocks the classic cookie-riding CSRF: an attacker's page can make the
 * browser fire a cross-site POST/PUT/PATCH/DELETE that automatically
 * carries the panel's session cookie (SameSite=Lax still allows simple
 * top-level navigations/forms), but a plain HTML form cannot set a JSON
 * content type or a custom header — only same-origin JS can, and that's
 * exactly what the panel's own fetch/XHR calls do.
 *
 * Requires EITHER `Content-Type: application/json` OR
 * `X-Requested-With: grimport` on every mutating /api/* request that rides
 * on a cookie session. Exempted:
 *  - non-mutating methods (GET/HEAD/OPTIONS/…) — never state-changing.
 *  - anything outside /api — static/SPA pages, not API mutations.
 *  - Bearer-token requests — CI/API-token clients aren't browsers with an
 *    ambient cookie jar, so there's nothing here to forge.
 */
function csrfProtection(req, res, next) {
  if (!MUTATING_METHODS.has(req.method)) return next();
  if (!req.path.startsWith('/api/')) return next();
  if (req.headers.authorization?.startsWith('Bearer ')) return next();

  const contentType = String(req.headers['content-type'] || '').toLowerCase();
  const hasJsonType = contentType.includes('application/json');
  const hasHeader = req.headers['x-requested-with'] === 'grimport';
  if (hasJsonType || hasHeader) return next();

  return res.status(403).json({ error: 'Missing X-Requested-With header' });
}

module.exports = { csrfProtection };
