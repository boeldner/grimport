const Dockerode = require('dockerode');
const path = require('path');
const fs = require('fs');
const { generateNginxConfig, generateHtpasswd } = require('./nginx');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const NETWORK = process.env.DOCKER_NETWORK || 'webhost-net';
const LETSENCRYPT_MODE = !!process.env.ACME_EMAIL;
const DATA_PATH = process.env.DATA_PATH || '/data/sites';
// HOST_DATA_PATH must be the path on the Docker host (not inside this container),
// because bind-mounts in dynamically created containers are resolved by the host daemon.
const HOST_DATA_PATH = process.env.HOST_DATA_PATH || DATA_PATH;

const RUNTIME_IMAGES = {
  static: 'nginx:alpine',
  php:    'php:8.3-apache',
  node:   'node:22-alpine',
  python: 'python:3.12-slim',
};

function siteDir(siteId) {
  return path.join(DATA_PATH, siteId);
}

function appDir(siteId) {
  return path.join(DATA_PATH, siteId, 'app');
}

function containerName(siteId) {
  return `webhost-site-${siteId}`;
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
}

/**
 * Create and start a site container.
 * Branches on site.runtime: static/php use nginx/apache; node/python use app container.
 * Returns the container ID.
 */
async function createSiteContainer(site) {
  const runtime = site.runtime || 'static';
  if (runtime !== 'static') return createAppContainer(site);
  const dir = siteDir(site.id);
  const htmlDir = path.join(dir, 'html');
  const nginxConf = path.join(dir, 'nginx.conf');
  const maintenanceDir = path.join(dir, 'maintenance');

  fs.mkdirSync(htmlDir, { recursive: true });
  fs.mkdirSync(maintenanceDir, { recursive: true });
  writeNginxConfig(site);

  // Copy the default page into html dir if it's empty
  const defaultPage = path.join(DATA_PATH, '..', 'default-page');
  if (fs.existsSync(defaultPage) && fs.readdirSync(htmlDir).length === 0) {
    fs.cpSync(defaultPage, htmlDir, { recursive: true });
  }

  // Pull image if not present (silent, best-effort)
  try {
    await new Promise((resolve, reject) => {
      docker.pull('nginx:alpine', (err, stream) => {
        if (err) return resolve(); // ignore pull errors, image may already be local
        docker.modem.followProgress(stream, resolve);
      });
    });
  } catch {}

  const container = await docker.createContainer({
    name: containerName(site.id),
    Image: 'nginx:alpine',
    Labels: {
      'webhost.site': 'true',
      'webhost.site.id': site.id,
      'traefik.enable': 'true',
      // HTTP router — always present
      [`traefik.http.routers.${site.id}-http.rule`]: `Host(\`${site.domain}\`)`,
      [`traefik.http.routers.${site.id}-http.entrypoints`]: 'web',
      [`traefik.http.routers.${site.id}-http.service`]: site.id,
      // HTTPS router — only in letsencrypt mode with ssl_enabled
      // In Cloudflare Tunnel mode ACME_EMAIL is not set — SSL is handled externally,
      // adding redirect labels would cause redirect loops.
      ...(site.ssl_enabled && LETSENCRYPT_MODE ? {
        [`traefik.http.routers.${site.id}.rule`]: `Host(\`${site.domain}\`)`,
        [`traefik.http.routers.${site.id}.entrypoints`]: 'websecure',
        [`traefik.http.routers.${site.id}.tls`]: 'true',
        [`traefik.http.routers.${site.id}.tls.certresolver`]: 'letsencrypt',
        [`traefik.http.routers.${site.id}.service`]: site.id,
        [`traefik.http.middlewares.${site.id}-https.redirectscheme.scheme`]: 'https',
        [`traefik.http.routers.${site.id}-http.middlewares`]: `${site.id}-https`,
      } : {}),
      [`traefik.http.services.${site.id}.loadbalancer.server.port`]: '80',
    },
    HostConfig: {
      Binds: [
        `${path.join(HOST_DATA_PATH, site.id, 'html')}:/usr/share/nginx/html:ro`,
        `${path.join(HOST_DATA_PATH, site.id, 'maintenance')}:/usr/share/nginx/maintenance:ro`,
        `${path.join(HOST_DATA_PATH, site.id, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`,
        `${path.join(HOST_DATA_PATH, site.id, '.htpasswd')}:/etc/nginx/.htpasswd:ro`,
      ],
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK,
    },
    NetworkingConfig: {
      EndpointsConfig: {
        [NETWORK]: {},
      },
    },
  });

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

/**
 * Apply updated settings to a running site.
 * Static/PHP sites rewrite nginx config + restart in place.
 * Node/Python app containers are fully recreated so start_cmd, env_vars, and
 * app_port (all baked into the container at creation) take effect immediately.
 * Returns the new container ID for app runtimes (caller must persist it), or null.
 */
async function applySiteSettings(site) {
  const runtime = site.runtime || 'static';
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
  if (site.container_id) {
    try {
      const old = docker.getContainer(site.container_id);
      try { await old.stop({ t: 5 }); } catch {}
      await old.remove();
    } catch {}
  }
  const newId = await createAppContainer(site);
  return newId;
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
  const logs = await container.logs({
    stdout: true,
    stderr: true,
    tail: lines,
    timestamps: true,
  });
  return logs.toString('utf8');
}

/**
 * Build the site app using an ephemeral container (node/python only).
 * Runs site.build_cmd inside the runtime image with /app bind-mounted.
 */
async function runBuildStep(site) {
  if (!site.build_cmd) return;
  const image = RUNTIME_IMAGES[site.runtime];
  if (!image) throw new Error(`Unknown runtime: ${site.runtime}`);

  const hostAppDir = path.join(HOST_DATA_PATH, site.id, 'app');

  // Pull image silently first
  await new Promise(resolve => {
    docker.pull(image, (err, stream) => {
      if (err || !stream) return resolve();
      docker.modem.followProgress(stream, resolve);
    });
  });

  const buildContainer = await docker.createContainer({
    Image: image,
    Cmd: ['sh', '-c', site.build_cmd],
    WorkingDir: '/app',
    HostConfig: {
      Binds: [`${hostAppDir}:/app`],
      AutoRemove: false,
    },
  });

  await buildContainer.start();
  const result = await buildContainer.wait();
  try { await buildContainer.remove(); } catch {}

  if (result.StatusCode !== 0) {
    throw new Error(`Build step failed with exit code ${result.StatusCode}`);
  }
}

/**
 * Create and start a backend app container (node/python/php).
 */
async function createAppContainer(site) {
  const runtime = site.runtime || 'static';
  const image = RUNTIME_IMAGES[runtime];
  if (!image) throw new Error(`Unknown runtime: ${runtime}`);

  const dir = siteDir(site.id);

  // php uses html/ mounted to /var/www/html, port 80 — same as static but with apache
  const isPhp = runtime === 'php';
  const htmlDir = path.join(dir, 'html');
  const appDirPath = path.join(dir, 'app');

  fs.mkdirSync(isPhp ? htmlDir : appDirPath, { recursive: true });

  const envVars = (() => {
    try { return Object.entries(JSON.parse(site.env_vars || '{}')).map(([k, v]) => `${k}=${v}`); }
    catch { return []; }
  })();

  const appPort = site.app_port || 3000;
  const servicePort = isPhp ? '80' : String(appPort);

  // Traefik labels — same pattern as static containers
  const labels = {
    'webhost.site': 'true',
    'webhost.site.id': site.id,
    'traefik.enable': 'true',
    [`traefik.http.routers.${site.id}-http.rule`]: `Host(\`${site.domain}\`)`,
    [`traefik.http.routers.${site.id}-http.entrypoints`]: 'web',
    [`traefik.http.routers.${site.id}-http.service`]: site.id,
    ...(site.ssl_enabled && LETSENCRYPT_MODE ? {
      [`traefik.http.routers.${site.id}.rule`]: `Host(\`${site.domain}\`)`,
      [`traefik.http.routers.${site.id}.entrypoints`]: 'websecure',
      [`traefik.http.routers.${site.id}.tls`]: 'true',
      [`traefik.http.routers.${site.id}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.routers.${site.id}.service`]: site.id,
      [`traefik.http.middlewares.${site.id}-https.redirectscheme.scheme`]: 'https',
      [`traefik.http.routers.${site.id}-http.middlewares`]: `${site.id}-https`,
    } : {}),
    [`traefik.http.services.${site.id}.loadbalancer.server.port`]: servicePort,
  };

  const binds = isPhp
    ? [`${path.join(HOST_DATA_PATH, site.id, 'html')}:/var/www/html`]
    : [`${path.join(HOST_DATA_PATH, site.id, 'app')}:/app`];

  const containerDef = {
    name: containerName(site.id),
    Image: image,
    Labels: labels,
    Env: envVars,
    WorkingDir: isPhp ? '/var/www/html' : '/app',
    HostConfig: {
      Binds: binds,
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK,
    },
    NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
  };

  if (!isPhp && site.start_cmd) {
    containerDef.Cmd = ['sh', '-c', site.start_cmd];
  }

  // Pull image silently
  await new Promise(resolve => {
    docker.pull(image, (err, stream) => {
      if (err || !stream) return resolve();
      docker.modem.followProgress(stream, resolve);
    });
  });

  const container = await docker.createContainer(containerDef);
  await container.start();
  return container.id;
}

/**
 * Update env vars + restart an app container.
 */
async function applyAppSettings(site) {
  if (site.container_id) {
    try { await restartSiteContainer(site.container_id); } catch {}
  }
}

function previewDir(siteId) {
  return path.join(DATA_PATH, siteId, 'preview_html');
}

function previewContainerName(siteId) {
  return `webhost-preview-${siteId}`;
}

/**
 * Create a preview container for a site, serving from preview_html/.
 * The preview gets its own domain (site.preview_domain).
 */
async function createPreviewContainer(site) {
  const dir = siteDir(site.id);
  const prevHtmlDir = path.join(dir, 'preview_html');
  const nginxConf = path.join(dir, 'nginx.conf'); // reuse same nginx config (same settings)

  fs.mkdirSync(prevHtmlDir, { recursive: true });

  // Copy current live content into preview dir so it starts with the same content
  const htmlDir = path.join(dir, 'html');
  if (fs.existsSync(htmlDir) && fs.readdirSync(htmlDir).length > 0) {
    fs.cpSync(htmlDir, prevHtmlDir, { recursive: true });
  }

  // Write a preview nginx config with the preview domain
  const previewNginxConf = path.join(dir, 'nginx-preview.conf');
  const { generateNginxConfig } = require('./nginx');
  const previewSite = { ...site, domain: site.preview_domain };
  fs.writeFileSync(previewNginxConf, generateNginxConfig(previewSite));

  const container = await docker.createContainer({
    name: previewContainerName(site.id),
    Image: 'nginx:alpine',
    Labels: {
      'webhost.site': 'true',
      'webhost.site.id': site.id,
      'webhost.preview': 'true',
      'traefik.enable': 'true',
      [`traefik.http.routers.${site.id}-preview-http.rule`]: `Host(\`${site.preview_domain}\`)`,
      [`traefik.http.routers.${site.id}-preview-http.entrypoints`]: 'web',
      [`traefik.http.routers.${site.id}-preview-http.service`]: `${site.id}-preview`,
      [`traefik.http.services.${site.id}-preview.loadbalancer.server.port`]: '80',
    },
    HostConfig: {
      Binds: [
        `${path.join(HOST_DATA_PATH, site.id, 'preview_html')}:/usr/share/nginx/html:ro`,
        `${path.join(HOST_DATA_PATH, site.id, 'maintenance')}:/usr/share/nginx/maintenance:ro`,
        `${path.join(HOST_DATA_PATH, site.id, 'nginx-preview.conf')}:/etc/nginx/conf.d/default.conf:ro`,
        `${path.join(HOST_DATA_PATH, site.id, '.htpasswd')}:/etc/nginx/.htpasswd:ro`,
      ],
      RestartPolicy: { Name: 'unless-stopped' },
      NetworkMode: NETWORK,
    },
    NetworkingConfig: { EndpointsConfig: { [NETWORK]: {} } },
  });

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
  if (site.preview_container_id) {
    try {
      const c = docker.getContainer(site.preview_container_id);
      try { await c.stop({ t: 5 }); } catch {}
      await c.remove();
    } catch {}
  }
  const previewHtmlDir = path.join(siteDir(site.id), 'preview_html');
  const previewConf = path.join(siteDir(site.id), 'nginx-preview.conf');
  if (fs.existsSync(previewHtmlDir)) fs.rmSync(previewHtmlDir, { recursive: true, force: true });
  if (fs.existsSync(previewConf)) fs.unlinkSync(previewConf);
}

module.exports = {
  siteDir,
  appDir,
  previewDir,
  writeNginxConfig,
  createSiteContainer,
  createAppContainer,
  runBuildStep,
  createPreviewContainer,
  swapPreview,
  removePreviewContainer,
  applySiteSettings,
  startSiteContainer,
  stopSiteContainer,
  removeSiteContainer,
  containerStatus,
  containerLogs,
};
