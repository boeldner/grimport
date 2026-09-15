/**
 * Pure builders for the Docker container specs of site containers.
 *
 * No I/O here: docker.js decides paths, networks and limits and passes them
 * in, so every hardening decision (image, user, capabilities, resource caps,
 * read-only root, per-site network) is unit-testable without Docker.
 *
 * Security model (docs/wiki/Security-Model.md):
 * - every site runs in its own network (`webhost-site-<id>`)
 * - memory / CPU / PID caps, no swap, nofile ulimit
 * - all capabilities dropped, no-new-privileges
 * - static sites: nginx-unprivileged (uid 101, port 8080), read-only rootfs
 * - node / python: uid 1000, HOME on tmpfs
 * - php: apache must start as root to bind :80 and drop to www-data, so it
 *   keeps the four capabilities that needs (documented exception)
 */
const path = require('path');
const { RUNTIME_IMAGES, STATIC_IMAGE, PREVIEW_IMAGE } = require('./images');
const { isValidHostname } = require('./validate');

const MB = 1024 * 1024;

function siteNetworkName(siteId) {
  return `webhost-site-${siteId}`;
}

function containerName(siteId) {
  return `webhost-site-${siteId}`;
}

function previewContainerName(siteId) {
  return `webhost-preview-${siteId}`;
}

/** Traefik router/service labels shared by live and preview containers. */
function traefikLabels({ routerName, serviceName, domain, port, network, ssl, letsencrypt }) {
  if (!isValidHostname(domain)) throw new Error(`Refusing Traefik label for invalid domain: ${domain}`);
  const labels = {
    'traefik.enable': 'true',
    'traefik.docker.network': network,
    [`traefik.http.routers.${routerName}-http.rule`]: `Host(\`${domain}\`)`,
    [`traefik.http.routers.${routerName}-http.entrypoints`]: 'web',
    [`traefik.http.routers.${routerName}-http.service`]: serviceName,
    [`traefik.http.services.${serviceName}.loadbalancer.server.port`]: String(port),
  };
  // HTTPS router only in Let's Encrypt mode. Behind Cloudflare (tunnel/proxy)
  // TLS terminates at the edge; redirect labels there would loop.
  if (ssl && letsencrypt) {
    Object.assign(labels, {
      [`traefik.http.routers.${routerName}.rule`]: `Host(\`${domain}\`)`,
      [`traefik.http.routers.${routerName}.entrypoints`]: 'websecure',
      [`traefik.http.routers.${routerName}.tls`]: 'true',
      [`traefik.http.routers.${routerName}.tls.certresolver`]: 'letsencrypt',
      [`traefik.http.routers.${routerName}.service`]: serviceName,
      [`traefik.http.middlewares.${routerName}-https.redirectscheme.scheme`]: 'https',
      [`traefik.http.routers.${routerName}-http.middlewares`]: `${routerName}-https`,
    });
  }
  return labels;
}

/** HostConfig hardening shared by every site container. */
function hardenedHostConfig({ network, limits, extra = {} }) {
  const { memoryMb, cpus, pids } = limits;
  return {
    Memory: Math.round(memoryMb * MB),
    MemorySwap: Math.round(memoryMb * MB),   // same as Memory: no swap
    NanoCpus: Math.round(cpus * 1e9),
    PidsLimit: pids,
    CapDrop: ['ALL'],
    SecurityOpt: ['no-new-privileges:true'],
    Ulimits: [{ Name: 'nofile', Soft: 4096, Hard: 8192 }],
    RestartPolicy: { Name: 'unless-stopped' },
    NetworkMode: network,
    ...extra,
  };
}

function parseEnvVars(json) {
  try { return Object.entries(JSON.parse(json || '{}')).map(([k, v]) => `${k}=${v}`); }
  catch { return []; }
}

/**
 * buildSiteContainerSpec(site, opts) -> createContainer() argument for the live container.
 * opts: { hostDataPath, network, letsencrypt, limits: { memoryMb, cpus, pids } }
 */
function buildSiteContainerSpec(site, opts) {
  const runtime = site.runtime || 'static';
  const { hostDataPath, network, letsencrypt, limits } = opts;
  const siteHost = path.join(hostDataPath, site.id);
  const baseLabels = { 'webhost.site': 'true', 'webhost.site.id': site.id, 'webhost.runtime': runtime };

  if (runtime === 'static') {
    return {
      name: containerName(site.id),
      Image: STATIC_IMAGE,
      Labels: {
        ...baseLabels,
        ...traefikLabels({ routerName: site.id, serviceName: site.id, domain: site.domain, port: 8080, network, ssl: site.ssl_enabled, letsencrypt }),
      },
      HostConfig: hardenedHostConfig({
        network, limits,
        extra: {
          Binds: [
            `${path.join(siteHost, 'html')}:/usr/share/nginx/html:ro`,
            `${path.join(siteHost, 'maintenance')}:/usr/share/nginx/maintenance:ro`,
            `${path.join(siteHost, 'nginx.conf')}:/etc/nginx/conf.d/default.conf:ro`,
            `${path.join(siteHost, '.htpasswd')}:/etc/nginx/.htpasswd:ro`,
          ],
          ReadonlyRootfs: true,
          Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
        },
      }),
      NetworkingConfig: { EndpointsConfig: { [network]: {} } },
    };
  }

  const image = RUNTIME_IMAGES[runtime];
  if (!image) throw new Error(`Unknown runtime: ${runtime}`);
  const isPhp = runtime === 'php';
  const appPort = site.app_port || 3000;
  const servicePort = isPhp ? 80 : appPort;

  const spec = {
    name: containerName(site.id),
    Image: image,
    Labels: {
      ...baseLabels,
      ...traefikLabels({ routerName: site.id, serviceName: site.id, domain: site.domain, port: servicePort, network, ssl: site.ssl_enabled, letsencrypt }),
    },
    Env: isPhp ? parseEnvVars(site.env_vars) : [...parseEnvVars(site.env_vars), 'HOME=/tmp'],
    WorkingDir: isPhp ? '/var/www/html' : '/app',
    HostConfig: hardenedHostConfig({
      network, limits,
      extra: isPhp
        ? {
            Binds: [`${path.join(siteHost, 'html')}:/var/www/html`],
            // Apache starts as root to bind :80, then drops to www-data.
            // These four are the minimum it needs; everything else stays dropped.
            CapAdd: ['CHOWN', 'SETUID', 'SETGID', 'NET_BIND_SERVICE'],
          }
        : {
            Binds: [`${path.join(siteHost, 'app')}:/app`],
            Tmpfs: { '/tmp': 'rw,size=256m' },
          },
    }),
    NetworkingConfig: { EndpointsConfig: { [network]: {} } },
  };
  if (!isPhp) {
    spec.User = '1000:1000';
    if (site.start_cmd) spec.Cmd = ['sh', '-c', site.start_cmd];
  }
  return spec;
}

/** Spec for the preview container (nginx serving preview_html on the live site's network). */
function buildPreviewContainerSpec(site, opts) {
  const { hostDataPath, network, limits } = opts;
  const siteHost = path.join(hostDataPath, site.id);
  return {
    name: previewContainerName(site.id),
    Image: PREVIEW_IMAGE,
    Labels: {
      'webhost.site': 'true',
      'webhost.site.id': site.id,
      'webhost.preview': 'true',
      ...traefikLabels({ routerName: `${site.id}-preview`, serviceName: `${site.id}-preview`, domain: site.preview_domain, port: 8080, network, ssl: false, letsencrypt: false }),
    },
    HostConfig: hardenedHostConfig({
      network, limits,
      extra: {
        Binds: [
          `${path.join(siteHost, 'preview_html')}:/usr/share/nginx/html:ro`,
          `${path.join(siteHost, 'maintenance')}:/usr/share/nginx/maintenance:ro`,
          `${path.join(siteHost, 'nginx-preview.conf')}:/etc/nginx/conf.d/default.conf:ro`,
          `${path.join(siteHost, '.htpasswd')}:/etc/nginx/.htpasswd:ro`,
        ],
        ReadonlyRootfs: true,
        Tmpfs: { '/tmp': 'rw,noexec,nosuid,size=64m' },
      },
    }),
    NetworkingConfig: { EndpointsConfig: { [network]: {} } },
  };
}

/** Spec for the ephemeral build container (node/python build_cmd). */
function buildStepContainerSpec(site, opts) {
  const { hostDataPath, network, limits } = opts;
  const image = RUNTIME_IMAGES[site.runtime];
  if (!image) throw new Error(`Unknown runtime: ${site.runtime}`);
  return {
    Image: image,
    Cmd: ['sh', '-c', site.build_cmd],
    WorkingDir: '/app',
    User: '1000:1000',
    Env: [...parseEnvVars(site.env_vars), 'HOME=/tmp'],
    HostConfig: hardenedHostConfig({
      network, limits,
      extra: {
        Binds: [`${path.join(hostDataPath, site.id, 'app')}:/app`],
        Tmpfs: { '/tmp': 'rw,size=512m' },
        RestartPolicy: { Name: 'no' },
        AutoRemove: false,
      },
    }),
  };
}

module.exports = {
  siteNetworkName,
  containerName,
  previewContainerName,
  buildSiteContainerSpec,
  buildPreviewContainerSpec,
  buildStepContainerSpec,
  hardenedHostConfig,
  traefikLabels,
};
