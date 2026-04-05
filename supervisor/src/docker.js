const Dockerode = require('dockerode');
const path = require('path');
const fs = require('fs');
const { generateNginxConfig, generateHtpasswd } = require('./nginx');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const NETWORK = process.env.DOCKER_NETWORK || 'webhost-net';
const DATA_PATH = process.env.DATA_PATH || '/data/sites';
// HOST_DATA_PATH must be the path on the Docker host (not inside this container),
// because bind-mounts in dynamically created containers are resolved by the host daemon.
const HOST_DATA_PATH = process.env.HOST_DATA_PATH || DATA_PATH;

function siteDir(siteId) {
  return path.join(DATA_PATH, siteId);
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
 * Returns the container ID.
 */
async function createSiteContainer(site) {
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
      // HTTPS router — only when ssl_enabled
      ...(site.ssl_enabled ? {
        [`traefik.http.routers.${site.id}.rule`]: `Host(\`${site.domain}\`)`,
        [`traefik.http.routers.${site.id}.entrypoints`]: 'websecure',
        [`traefik.http.routers.${site.id}.tls`]: 'true',
        [`traefik.http.routers.${site.id}.tls.certresolver`]: 'letsencrypt',
        [`traefik.http.routers.${site.id}.service`]: site.id,
        // Redirect HTTP → HTTPS
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
 * Apply updated settings to a running site (rewrites config, restarts container).
 */
async function applySiteSettings(site) {
  writeNginxConfig(site);
  if (site.container_id) {
    try {
      await restartSiteContainer(site.container_id);
    } catch {
      // Container may be stopped — that's fine, config is on disk
    }
  }
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

module.exports = {
  siteDir,
  writeNginxConfig,
  createSiteContainer,
  applySiteSettings,
  startSiteContainer,
  stopSiteContainer,
  removeSiteContainer,
  containerStatus,
  containerLogs,
};
