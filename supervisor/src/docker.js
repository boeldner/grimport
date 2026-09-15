const Dockerode = require('dockerode');
const path = require('path');
const fs = require('fs');
const { generateNginxConfig, generateHtpasswd, generateErrorHtml, ERROR_PAGES } = require('./nginx');
const { RUNTIME_IMAGES, STATIC_IMAGE, PREVIEW_IMAGE } = require('./images');
const spec = require('./container-spec');
const { createNetworks } = require('./networks');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

// Management network (Traefik + supervisor). Site containers never join it —
// each site gets its own network from networks.js (docs/wiki/Security-Model.md).
const NETWORK = process.env.DOCKER_NETWORK || 'webhost-net';
const LETSENCRYPT_MODE = !!process.env.ACME_EMAIL;
const DATA_PATH = process.env.DATA_PATH || '/data/sites';
// HOST_DATA_PATH must be the path on the Docker host (not inside this container),
// because bind-mounts in dynamically created containers are resolved by the host daemon.
const HOST_DATA_PATH = process.env.HOST_DATA_PATH || DATA_PATH;

// Per-container resource caps (env-overridable; per-user quotas come in Phase 2).
const num = (v, d) => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : d; };
const LIMITS = {
  static: { memoryMb: num(process.env.SITE_MEMORY_STATIC_MB, 256), cpus: num(process.env.SITE_CPUS, 0.5), pids: num(process.env.SITE_PIDS, 256) },
  app:    { memoryMb: num(process.env.SITE_MEMORY_APP_MB, 512),    cpus: num(process.env.SITE_CPUS, 0.5), pids: num(process.env.SITE_PIDS, 256) },
};
// uid/gid the node/python containers run as (see container-spec.js)
const APP_UID = 1000;
const APP_GID = 1000;

const networks = createNetworks({ docker });

function siteDir(siteId) {
  return path.join(DATA_PATH, siteId);
}

function appDir(siteId) {
  return path.join(DATA_PATH, siteId, 'app');
}

function previewDir(siteId) {
  return path.join(DATA_PATH, siteId, 'preview_html');
}

function limitsFor(runtime) {
  return runtime && runtime !== 'static' ? LIMITS.app : LIMITS.static;
}

function specOpts(site, network) {
  return { hostDataPath: HOST_DATA_PATH, network, letsencrypt: LETSENCRYPT_MODE, limits: limitsFor(site.runtime) };
}

/**
 * Make a directory tree owned by the app container's uid so a non-root
 * node/python process can write there (npm install, sqlite files, uploads).
 * Best-effort: on macOS dev boxes or when not running as root this is a no-op.
 */
function chownTree(dir, uid = APP_UID, gid = APP_GID) {
  const walk = p => {
    try { fs.chownSync(p, uid, gid); } catch { return; }
    let entries = [];
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(full);
      else { try { fs.chownSync(full, uid, gid); } catch {} }
    }
  };
  if (typeof process.getuid === 'function' && process.getuid() !== 0) return; // not root: can't chown
  walk(dir);
}

function pullImage(image) {
  return new Promise(resolve => {
    docker.pull(image, (err, stream) => {
      if (err || !stream) return resolve(); // image may already be local; createContainer will tell
      docker.modem.followProgress(stream, resolve);
    });
  });
}

/**
 * Write nginx config to disk for this site.
 */
function writeNginxConfig(site) {
  const dir = siteDir(site.id);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'nginx.conf'), generateNginxConfig(site));
  // Always write .htpasswd — empty if no auth, populated if basic_auth is set
  const auth = site.basic_auth;
  const htpasswd = (auth && auth.username && auth.password)
    ? generateHtpasswd(auth.username, auth.password)
    : '';
  fs.writeFileSync(path.join(dir, '.htpasswd'), htpasswd);
  // Write default error pages — only if site doesn't have custom ones
  const htmlDir = path.join(dir, 'html');
  fs.mkdirSync(htmlDir, { recursive: true });
  for (const [code, { title, desc }] of Object.entries(ERROR_PAGES)) {
    const file = path.join(htmlDir, `${code}.html`);
    if (!fs.existsSync(file)) {
      fs.writeFileSync(file, generateErrorHtml(Number(code), title, desc));
    }
  }
}

/**
 * Ensure the site's private network exists and Traefik is attached.
 * Static sites and previews live on `internal` networks (no egress at all);
 * app runtimes get a routable bridge fenced by the egress guard.
 */
async function prepareSiteNetwork(site) {
  const runtime = site.runtime || 'static';
  const { name } = await networks.ensureSiteNetwork(site.id, { internal: runtime === 'static' });
  await networks.connectTraefik(name);
  return name;
}

/**
 * Create and start a site container.
 * Branches on site.runtime: static uses nginx; php/node/python use an app container.
 * Returns the container ID.
 */
async function createSiteContainer(site) {
  const runtime = site.runtime || 'static';
  if (runtime !== 'static') return createAppContainer(site);
  const dir = siteDir(site.id);
  const htmlDir = path.join(dir, 'html');
  const maintenanceDir = path.join(dir, 'maintenance');

  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(maintenanceDir, { recursive: true });
  writeNginxConfig(site);

  // Copy the default page into html dir if it's empty
  const defaultPage = path.join(DATA_PATH, '..', 'default-page');
  if (fs.existsSync(defaultPage) && fs.readdirSync(htmlDir).length === 0) {
    fs.cpSync(defaultPage, htmlDir, { recursive: true });
  }

  await pullImage(STATIC_IMAGE);
  const network = await prepareSiteNetwork(site);
  const container = await docker.createContainer(spec.buildSiteContainerSpec(site, specOpts(site, network)));
  await container.start();
  return container.id;
}

/**
 * Create and start a backend app container (node/python/php).
 */
async function createAppContainer(site) {
  const runtime = site.runtime || 'static';
  const image = RUNTIME_IMAGES[runtime];
  if (!image) throw new Error(`Unknown runtime: ${runtime}`);

  const dir = siteDir(site.id);
  const isPhp = runtime === 'php';
  const workDir = path.join(dir, isPhp ? 'html' : 'app');
  fs.mkdirSync(workDir, { recursive: true });
  if (!isPhp) chownTree(workDir);

  await pullImage(image);
  const network = await prepareSiteNetwork(site);
  const container = await docker.createContainer(spec.buildSiteContainerSpec(site, specOpts(site, network)));
  await container.start();
  return container.id;
}

/**
 * Restart a site container.
 * More reliable than nginx -s reload on Docker Desktop Mac,
 * where bind mounts can appear empty until the container restarts.
 */
async function restartSiteContainer(containerId) {
  await docker.getContainer(containerId).restart({ t: 2 });
}

async function stopAndRemove(containerId) {
  try {
    const c = docker.getContainer(containerId);
    try { await c.stop({ t: 5 }); } catch {}
    await c.remove();
  } catch {}
}

/**
 * Apply updated settings to a running site.
 * Static/PHP sites rewrite nginx config + restart in place.
 * Node/Python app containers are fully recreated so start_cmd, env_vars, and
 * app_port (all baked into the container at creation) take effect immediately.
 * Returns the new container ID for app runtimes (caller must persist it), or null.
 */
async function applySiteSettings(site) {
  const runtime = site.runtime || 'static';

  // Traefik labels are immutable — if domain changed we must recreate the container
  if (site.container_id) {
    let domainChanged = false;
    try {
      const info = await docker.getContainer(site.container_id).inspect();
      const current = info.Config.Labels?.[`traefik.http.routers.${site.id}-http.rule`];
      domainChanged = current !== `Host(\`${site.domain}\`)`;
    } catch {}

    if (domainChanged) {
      await stopAndRemove(site.container_id);
      return createSiteContainer(site);
    }
  }

  if (runtime === 'static') {
    writeNginxConfig(site);
    if (site.container_id) {
      try { await restartSiteContainer(site.container_id); } catch {}
    }
    return null;
  }
  if (runtime === 'php') {
    if (site.container_id) {
      try { await restartSiteContainer(site.container_id); } catch {}
    }
    return null;
  }
  // node / python — recreate so new start_cmd / env_vars / app_port apply
  if (site.container_id) await stopAndRemove(site.container_id);
  return createAppContainer(site);
}

/**
 * Recreate a site's live container from the current local image.
 * Stops + removes the old container (if any), then builds a fresh one with
 * identical config via createSiteContainer(). Used by the image-update job
 * so containers pick up newly pulled images and — since Phase 1 — move from
 * the shared network onto their own per-site network.
 * Returns the new container ID (caller persists it).
 */
async function recreateSiteContainer(site) {
  if (site.container_id) await stopAndRemove(site.container_id);
  // A leftover container with the same name (e.g. stale DB link) would make
  // createContainer fail with 409 — remove it by name as well.
  try {
    const leftover = docker.getContainer(spec.containerName(site.id));
    await leftover.inspect();
    await stopAndRemove(spec.containerName(site.id));
  } catch {}
  return createSiteContainer(site);
}

async function startSiteContainer(containerId) {
  await docker.getContainer(containerId).start();
}

async function stopSiteContainer(containerId) {
  await docker.getContainer(containerId).stop({ t: 5 });
}

async function removeSiteContainer(containerId) {
  const c = docker.getContainer(containerId);
  try { await c.stop({ t: 5 }); } catch {}
  await c.remove();
}

/**
 * Remove everything Docker-side that belongs to a site: live container,
 * preview container and the site's private network.
 */
async function removeSiteResources(site) {
  if (site.container_id) await stopAndRemove(site.container_id);
  if (site.preview_container_id) await stopAndRemove(site.preview_container_id);
  // Also by name, in case the DB link was stale
  for (const name of [spec.containerName(site.id), spec.previewContainerName(site.id)]) {
    try { await docker.getContainer(name).inspect(); await stopAndRemove(name); } catch {}
  }
  await networks.removeSiteNetwork(site.id);
}

/**
 * Returns { status, running } for a container.
 */
async function containerStatus(containerId) {
  try {
    const info = await docker.getContainer(containerId).inspect();
    return {
      status: info.State.Status,
      running: info.State.Running,
      exitCode: info.State.ExitCode,
    };
  } catch {
    return { status: 'missing', running: false };
  }
}

/**
 * Tail logs from a site container.
 */
async function containerLogs(containerId, lines = 100) {
  const container = docker.getContainer(containerId);
  const buf = await container.logs({
    stdout: true,
    stderr: true,
    follow: false,
    tail: lines,
    timestamps: true,
  });
  // Demux Docker's multiplexed log format (8-byte header per frame)
  const result = [];
  let offset = 0;
  while (offset + 8 <= buf.length) {
    const size = buf.readUInt32BE(offset + 4);
    if (size > 0) result.push(buf.subarray(offset + 8, offset + 8 + size).toString('utf8'));
    offset += 8 + size;
  }
  return result.length ? result.join('') : buf.toString('utf8');
}

/**
 * Build the site app using an ephemeral container (node/python only).
 * Runs site.build_cmd inside the runtime image with /app bind-mounted,
 * as uid 1000 on the site's own network with the same caps/limits as the app.
 */
async function runBuildStep(site) {
  if (!site.build_cmd) return;
  const image = RUNTIME_IMAGES[site.runtime];
  if (!image) throw new Error(`Unknown runtime: ${site.runtime}`);

  chownTree(appDir(site.id));
  await pullImage(image);
  const network = await prepareSiteNetwork(site);
  const buildContainer = await docker.createContainer(spec.buildStepContainerSpec(site, specOpts(site, network)));

  await buildContainer.start();
  const result = await buildContainer.wait();
  try { await buildContainer.remove(); } catch {}

  if (result.StatusCode !== 0) {
    throw new Error(`Build step failed with exit code ${result.StatusCode}`);
  }
}

/**
 * Update env vars + restart an app container.
 */
async function applyAppSettings(site) {
  if (site.container_id) {
    try { await restartSiteContainer(site.container_id); } catch {}
  }
}

/**
 * Create a preview container for a site, serving from preview_html/.
 * The preview gets its own domain (site.preview_domain) and shares the
 * live site's private network.
 */
async function createPreviewContainer(site) {
  const dir = siteDir(site.id);
  const prevHtmlDir = path.join(dir, 'preview_html');
  fs.mkdirSync(prevHtmlDir, { recursive: true });
  fs.mkdirSync(path.join(dir, 'maintenance'), { recursive: true });

  // Copy current live content into preview dir so it starts with the same content
  const htmlDir = path.join(dir, 'html');
  if (fs.existsSync(htmlDir) && fs.readdirSync(htmlDir).length > 0) {
    fs.cpSync(htmlDir, prevHtmlDir, { recursive: true });
  }

  // Write a preview nginx config with the preview domain
  const previewNginxConf = path.join(dir, 'nginx-preview.conf');
  fs.writeFileSync(previewNginxConf, generateNginxConfig({ ...site, domain: site.preview_domain }));
  if (!fs.existsSync(path.join(dir, '.htpasswd'))) fs.writeFileSync(path.join(dir, '.htpasswd'), '');

  await pullImage(PREVIEW_IMAGE);
  const network = await prepareSiteNetwork(site);
  const container = await docker.createContainer(spec.buildPreviewContainerSpec(site, { ...specOpts(site, network), limits: LIMITS.static }));
  await container.start();
  return container.id;
}

/**
 * Swap preview → live. Renames html dirs so the live container serves the
 * preview content without any DNS or Traefik label changes.
 * After swap: old live content is in preview_html (rollback path).
 */
async function swapPreview(site) {
  const dir = siteDir(site.id);
  const htmlDir = path.join(dir, 'html');
  const previewHtmlDir = path.join(dir, 'preview_html');
  const tmpDir = path.join(dir, 'html_swap_tmp');

  if (!fs.existsSync(previewHtmlDir)) throw new Error('No preview to swap');

  // Three-way rename: html → tmp, preview_html → html, tmp → preview_html
  if (fs.existsSync(tmpDir)) fs.rmSync(tmpDir, { recursive: true, force: true });
  if (fs.existsSync(htmlDir)) fs.renameSync(htmlDir, tmpDir);
  fs.renameSync(previewHtmlDir, htmlDir);
  if (fs.existsSync(tmpDir)) fs.renameSync(tmpDir, previewHtmlDir);

  // Restart live container to pick up new html bind mount contents
  if (site.container_id) {
    try { await restartSiteContainer(site.container_id); } catch {}
  }
  // Restart preview container to pick up old html as its new content
  if (site.preview_container_id) {
    try { await restartSiteContainer(site.preview_container_id); } catch {}
  }
}

/**
 * Remove the preview container and delete preview_html.
 */
async function removePreviewContainer(site) {
  if (site.preview_container_id) await stopAndRemove(site.preview_container_id);
  const previewHtmlDir = path.join(siteDir(site.id), 'preview_html');
  const previewConf = path.join(siteDir(site.id), 'nginx-preview.conf');
  if (fs.existsSync(previewHtmlDir)) fs.rmSync(previewHtmlDir, { recursive: true, force: true });
  if (fs.existsSync(previewConf)) fs.unlinkSync(previewConf);
}

const { withAudit } = require('./audit');

const siteMeta = (args) => ({ siteId: args[0]?.id, siteName: args[0]?.name });
const idMeta   = () => ({});

module.exports = {
  siteDir,
  appDir,
  previewDir,
  writeNginxConfig,
  chownTree,
  createSiteContainer:   withAudit('createSiteContainer',   createSiteContainer,   siteMeta),
  createAppContainer:    withAudit('createAppContainer',    createAppContainer,    siteMeta),
  runBuildStep:          withAudit('runBuildStep',          runBuildStep,          siteMeta),
  createPreviewContainer:withAudit('createPreviewContainer',createPreviewContainer,siteMeta),
  swapPreview:           withAudit('swapPreview',           swapPreview,           siteMeta),
  removePreviewContainer:withAudit('removePreviewContainer',removePreviewContainer,siteMeta),
  applySiteSettings:     withAudit('applySiteSettings',     applySiteSettings,     siteMeta),
  recreateSiteContainer: withAudit('recreateSiteContainer', recreateSiteContainer, siteMeta),
  removeSiteResources:   withAudit('removeSiteResources',   removeSiteResources,   siteMeta),
  startSiteContainer:    withAudit('startSiteContainer',    startSiteContainer,    idMeta),
  stopSiteContainer:     withAudit('stopSiteContainer',     stopSiteContainer,     idMeta),
  removeSiteContainer:   withAudit('removeSiteContainer',   removeSiteContainer,   idMeta),
  applyAppSettings,
  containerStatus,
  containerLogs,
  docker,
  networks,
  NETWORK,
  LIMITS,
  RUNTIME_IMAGES,
  STATIC_IMAGE,
};
