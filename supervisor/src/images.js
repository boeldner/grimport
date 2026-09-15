/**
 * Site container image updates.
 *
 * Every site runs in its own container from a floating tag (nginx:alpine,
 * php:8.3-apache, node:22-alpine, python:3.12-slim). Pulling a tag refreshes
 * the local image, but running containers keep the image ID they were
 * created with — so over time they drift behind security fixes. This module
 * detects that drift (container image ID vs. local image ID for the same tag)
 * and recreates containers one at a time so at most one site is briefly down.
 *
 * Dependencies are injected so the module is unit-testable without Docker.
 */

// nginx-unprivileged runs as uid 101 and listens on 8080; the generated
// nginx.conf and the Traefik service port label match (see container-spec.js).
const STATIC_IMAGE = 'nginxinc/nginx-unprivileged:alpine';
const PREVIEW_IMAGE = STATIC_IMAGE;
const RUNTIME_IMAGES = {
  static: STATIC_IMAGE,
  php:    'php:8.3-apache',
  node:   'node:22-alpine',
  python: 'python:3.12-slim',
};

function imageForRuntime(runtime) {
  return RUNTIME_IMAGES[runtime || 'static'] || STATIC_IMAGE;
}

function shortId(id) {
  if (!id) return null;
  return String(id).replace(/^sha256:/, '').slice(0, 12);
}

/**
 * createImageUpdater({ docker, db, recreate, parseSite, log })
 *   docker    — dockerode-like: getContainer(id).inspect(), getImage(tag).inspect(), pull(tag, cb)
 *   db        — better-sqlite3 handle with a `sites` table
 *   recreate  — async (site) => newContainerId; stops/removes old container, creates a new one
 *   parseSite — (row) => site object as used by docker.js (booleans, parsed JSON)
 */
function createImageUpdater({ docker, db, recreate, parseSite = r => r, log = () => {} }) {
  let state = { status: 'idle', message: '', total: 0, done: 0, current: null, results: [], startedAt: null, finishedAt: null };

  function getState() { return { ...state, results: [...state.results] }; }

  async function localImageId(tag) {
    try {
      const info = await docker.getImage(tag).inspect();
      return info?.Id || null;
    } catch { return null; }
  }

  async function containerImage(containerId) {
    try {
      const info = await docker.getContainer(containerId).inspect();
      const networks = Object.keys(info?.NetworkSettings?.Networks || {});
      return { imageId: info?.Image || null, tag: info?.Config?.Image || null, running: !!info?.State?.Running, networks };
    } catch { return null; }
  }

  /**
   * Compare every site container against the local image for its runtime tag.
   * No network access — "outdated" means the local image is newer than the
   * container's image. Run pullImages() first to compare against the registry.
   */
  async function status() {
    const rows = db.prepare('SELECT * FROM sites ORDER BY created_at DESC').all();
    const tags = [...new Set(rows.map(r => imageForRuntime(r.runtime)))];
    const localIds = {};
    for (const tag of tags) localIds[tag] = await localImageId(tag);

    const sites = [];
    for (const row of rows) {
      const tag = imageForRuntime(row.runtime);
      const entry = {
        id: row.id,
        name: row.name,
        runtime: row.runtime || 'static',
        image: tag,
        container_id: row.container_id || null,
        container_image_id: null,
        local_image_id: shortId(localIds[tag]),
        running: false,
        outdated: false,
        outdated_reason: null,
        network: null,
        isolated: false,
        missing: !row.container_id,
      };
      if (row.container_id) {
        const ci = await containerImage(row.container_id);
        if (ci) {
          entry.container_image_id = shortId(ci.imageId);
          entry.running = ci.running;
          entry.network = ci.networks[0] || null;
          // Isolated = runs on its own per-site network (Phase 1 security model).
          // Legacy containers on the shared network count as outdated so the
          // rolling update migrates them.
          entry.isolated = ci.networks.length === 1 && ci.networks[0] === `webhost-site-${row.id}`;
          const imageStale = !!(localIds[tag] && ci.imageId && ci.imageId !== localIds[tag]);
          const networkStale = !entry.isolated;
          entry.outdated = imageStale || networkStale;
          entry.outdated_reason = imageStale && networkStale ? 'image+network' : imageStale ? 'image' : networkStale ? 'network' : null;
        } else {
          entry.missing = true;
        }
      }
      sites.push(entry);
    }
    return {
      images: tags.map(tag => ({ tag, local_image_id: shortId(localIds[tag]) })),
      sites,
      outdated: sites.filter(s => s.outdated).length,
      total: sites.length,
      job: getState(),
    };
  }

  function pullOne(tag) {
    return new Promise((resolve, reject) => {
      docker.pull(tag, (err, stream) => {
        if (err) return reject(err);
        if (!stream) return resolve();
        docker.modem.followProgress(stream, e => e ? reject(e) : resolve());
      });
    });
  }

  /** Pull every runtime image that at least one site uses (plus the static image). */
  async function pullImages() {
    const rows = db.prepare('SELECT DISTINCT runtime FROM sites').all();
    const tags = [...new Set([STATIC_IMAGE, ...rows.map(r => imageForRuntime(r.runtime))])];
    const pulled = [];
    for (const tag of tags) {
      const before = await localImageId(tag);
      await pullOne(tag);
      const after = await localImageId(tag);
      pulled.push({ tag, local_image_id: shortId(after), updated: !!after && after !== before });
      log('images_pulled', `${tag} ${after && after !== before ? 'updated' : 'unchanged'}`);
    }
    return pulled;
  }

  /** Recreate one site's container from the current local image. Persists the new container id. */
  async function recreateSite(siteId, actor = 'system') {
    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId);
    if (!row) throw new Error('Site not found');
    const site = parseSite(row);
    const newId = await recreate(site);
    db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newId, siteId);
    log('container_recreated', imageForRuntime(row.runtime), { siteId, siteName: row.name, actor });
    return newId;
  }

  /**
   * Rolling update: optionally pull, then recreate outdated (or explicitly
   * listed) site containers sequentially. Returns immediately; poll getState().
   */
  function run({ pull = true, siteIds = null, force = false, actor = 'system' } = {}) {
    if (state.status !== 'idle' && state.status !== 'done' && state.status !== 'error') {
      const err = new Error('Container update already in progress');
      err.status = 409;
      throw err;
    }
    state = { status: 'starting', message: 'Starting…', total: 0, done: 0, current: null, results: [], startedAt: Date.now(), finishedAt: null };

    const job = (async () => {
      try {
        if (pull) {
          state.status = 'pulling';
          state.message = 'Pulling runtime images…';
          await pullImages();
        }
        const st = await status();
        let targets = st.sites.filter(s => !s.missing);
        if (Array.isArray(siteIds)) targets = targets.filter(s => siteIds.includes(s.id));
        if (!force) targets = targets.filter(s => s.outdated);

        state.total = targets.length;
        state.status = 'recreating';
        for (const t of targets) {
          state.current = t.name;
          state.message = `Recreating ${t.name} (${state.done + 1}/${state.total})…`;
          try {
            const newId = await recreateSite(t.id, actor);
            state.results.push({ id: t.id, name: t.name, ok: true, container_id: newId });
          } catch (err) {
            state.results.push({ id: t.id, name: t.name, ok: false, error: err.message });
            log('container_recreate_failed', err.message, { siteId: t.id, siteName: t.name, actor, level: 'error' });
          }
          state.done++;
        }
        state.current = null;
        const failed = state.results.filter(r => !r.ok).length;
        state.status = 'done';
        state.message = state.total === 0
          ? 'All site containers already run the latest images.'
          : failed
            ? `Updated ${state.total - failed} of ${state.total} containers — ${failed} failed.`
            : `Updated ${state.total} container${state.total === 1 ? '' : 's'}.`;
      } catch (err) {
        state.status = 'error';
        state.message = err.message;
      } finally {
        state.finishedAt = Date.now();
      }
    })();

    return job;
  }

  return { status, pullImages, recreateSite, run, getState, imageForRuntime };
}

module.exports = { createImageUpdater, imageForRuntime, RUNTIME_IMAGES, STATIC_IMAGE, PREVIEW_IMAGE, shortId };
