/**
 * Default (Docker-backed) instance of the site-container image updater.
 * Wires images.js to the real Docker socket, the SQLite handle and the
 * container factory in docker.js. Routes import this singleton; tests build
 * their own via createImageUpdater() with fakes.
 */
const db = require('./db');
const { docker, recreateSiteContainer } = require('./docker');
const { createImageUpdater } = require('./images');
const { parseSiteForContainer } = require('./site-model');

function logActivity(event, detail, meta = {}) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, level, actor) VALUES (?, ?, ?, ?, ?, ?)')
      .run(meta.siteId || null, meta.siteName || 'grimport', event, detail || null, meta.level || 'info', meta.actor || 'system');
  } catch {}
}

const imageUpdater = createImageUpdater({
  docker,
  db,
  recreate: recreateSiteContainer,
  parseSite: parseSiteForContainer,
  log: logActivity,
});

module.exports = imageUpdater;
