/**
 * Shape a raw `sites` row into the object the rest of the app works with:
 * SQLite integers become booleans, JSON columns are parsed, and the stored
 * basic-auth password is never exposed (only the username).
 */
function parseSite(row) {
  if (!row) return null;
  return {
    ...row,
    spa_mode: !!row.spa_mode,
    cache_enabled: !!row.cache_enabled,
    maintenance_mode: !!row.maintenance_mode,
    ssl_enabled: !!row.ssl_enabled,
    basic_auth: row.basic_auth ? { username: JSON.parse(row.basic_auth).username } : null,
    custom_headers: JSON.parse(row.custom_headers || '[]'),
    redirects: JSON.parse(row.redirects || '[]'),
  };
}

/**
 * Same as parseSite but keeps the basic-auth password — needed when a
 * container is (re)created, because nginx.js writes the .htpasswd from it.
 */
function parseSiteForContainer(row) {
  if (!row) return null;
  const site = parseSite(row);
  if (row.basic_auth) {
    try { site.basic_auth = JSON.parse(row.basic_auth); } catch { site.basic_auth = null; }
  }
  return site;
}

module.exports = { parseSite, parseSiteForContainer };
