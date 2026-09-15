const test = require('node:test');
const assert = require('node:assert');
const {
  buildSiteContainerSpec, buildPreviewContainerSpec, buildStepContainerSpec, siteNetworkName,
} = require('../src/container-spec');
const { RUNTIME_IMAGES, STATIC_IMAGE, PREVIEW_IMAGE } = require('../src/images');

const OPTS = {
  hostDataPath: '/srv/grimport/data/sites',
  network: 'webhost-site-abc',
  letsencrypt: false,
  limits: { memoryMb: 256, cpus: 0.5, pids: 256 },
};
const base = (over = {}) => ({ id: 'abc', domain: 'bakery.demo.test', ssl_enabled: false, runtime: 'static', ...over });

function assertHardened(spec) {
  const h = spec.HostConfig;
  assert.strictEqual(h.Memory, 256 * 1024 * 1024);
  assert.strictEqual(h.MemorySwap, h.Memory, 'no swap');
  assert.strictEqual(h.NanoCpus, 5e8);
  assert.strictEqual(h.PidsLimit, 256);
  assert.deepStrictEqual(h.CapDrop, ['ALL']);
  assert.deepStrictEqual(h.SecurityOpt, ['no-new-privileges:true']);
  assert.strictEqual(h.NetworkMode, 'webhost-site-abc');
  assert.ok(h.Ulimits.some(u => u.Name === 'nofile'));
  assert.strictEqual(spec.Labels['traefik.docker.network'], 'webhost-site-abc');
}

test('siteNetworkName', () => {
  assert.strictEqual(siteNetworkName('x1'), 'webhost-site-x1');
});

test('static site: unprivileged nginx on 8080, read-only rootfs, tmpfs, ro binds', () => {
  const spec = buildSiteContainerSpec(base(), OPTS);
  assert.strictEqual(spec.Image, STATIC_IMAGE);
  assert.match(spec.Image, /nginx-unprivileged/);
  assertHardened(spec);
  assert.strictEqual(spec.HostConfig.ReadonlyRootfs, true);
  assert.ok(spec.HostConfig.Tmpfs['/tmp']);
  assert.strictEqual(spec.Labels['traefik.http.services.abc.loadbalancer.server.port'], '8080');
  assert.strictEqual(spec.Labels['traefik.http.routers.abc-http.rule'], 'Host(`bakery.demo.test`)');
  assert.ok(spec.HostConfig.Binds.every(b => b.endsWith(':ro')));
  assert.ok(spec.HostConfig.Binds[0].startsWith('/srv/grimport/data/sites/abc/html:'));
  assert.strictEqual(spec.User, undefined, 'image already runs as uid 101');
  assert.strictEqual(spec.Labels['traefik.http.routers.abc.tls'], undefined, 'no TLS router outside letsencrypt mode');
});

test('static site with ssl in letsencrypt mode gets the https router + redirect', () => {
  const spec = buildSiteContainerSpec(base({ ssl_enabled: true }), { ...OPTS, letsencrypt: true });
  assert.strictEqual(spec.Labels['traefik.http.routers.abc.tls.certresolver'], 'letsencrypt');
  assert.strictEqual(spec.Labels['traefik.http.routers.abc-http.middlewares'], 'abc-https');
});

test('node site: uid 1000, HOME on tmpfs, app bind rw, start command, app port', () => {
  const spec = buildSiteContainerSpec(base({ runtime: 'node', start_cmd: 'node server.js', app_port: 4000, env_vars: '{"A":"1"}' }), { ...OPTS, limits: { memoryMb: 512, cpus: 0.5, pids: 256 } });
  assert.strictEqual(spec.Image, RUNTIME_IMAGES.node);
  assert.strictEqual(spec.User, '1000:1000');
  assert.deepStrictEqual(spec.Cmd, ['sh', '-c', 'node server.js']);
  assert.ok(spec.Env.includes('A=1') && spec.Env.includes('HOME=/tmp'));
  assert.strictEqual(spec.Labels['traefik.http.services.abc.loadbalancer.server.port'], '4000');
  assert.strictEqual(spec.HostConfig.Memory, 512 * 1024 * 1024);
  assert.deepStrictEqual(spec.HostConfig.CapDrop, ['ALL']);
  assert.strictEqual(spec.HostConfig.CapAdd, undefined);
  assert.strictEqual(spec.HostConfig.ReadonlyRootfs, undefined);
  assert.deepStrictEqual(spec.HostConfig.Binds, ['/srv/grimport/data/sites/abc/app:/app']);
});

test('python site mirrors node hardening', () => {
  const spec = buildSiteContainerSpec(base({ runtime: 'python' }), OPTS);
  assert.strictEqual(spec.Image, RUNTIME_IMAGES.python);
  assert.strictEqual(spec.User, '1000:1000');
  assert.strictEqual(spec.Cmd, undefined);
});

test('php site: documented exception keeps only the four apache capabilities, port 80, root user', () => {
  const spec = buildSiteContainerSpec(base({ runtime: 'php' }), OPTS);
  assert.strictEqual(spec.Image, RUNTIME_IMAGES.php);
  assert.strictEqual(spec.User, undefined);
  assert.deepStrictEqual(spec.HostConfig.CapDrop, ['ALL']);
  assert.deepStrictEqual(spec.HostConfig.CapAdd, ['CHOWN', 'SETUID', 'SETGID', 'NET_BIND_SERVICE']);
  assert.deepStrictEqual(spec.HostConfig.SecurityOpt, ['no-new-privileges:true']);
  assert.strictEqual(spec.Labels['traefik.http.services.abc.loadbalancer.server.port'], '80');
  assert.deepStrictEqual(spec.HostConfig.Binds, ['/srv/grimport/data/sites/abc/html:/var/www/html']);
});

test('preview container: unprivileged nginx on the live site network, own router names', () => {
  const spec = buildPreviewContainerSpec(base({ preview_domain: 'preview-bakery.demo.test' }), OPTS);
  assert.strictEqual(spec.Image, PREVIEW_IMAGE);
  assert.strictEqual(spec.name, 'webhost-preview-abc');
  assertHardened(spec);
  assert.strictEqual(spec.Labels['webhost.preview'], 'true');
  assert.strictEqual(spec.Labels['traefik.http.routers.abc-preview-http.rule'], 'Host(`preview-bakery.demo.test`)');
  assert.strictEqual(spec.Labels['traefik.http.services.abc-preview.loadbalancer.server.port'], '8080');
  assert.strictEqual(spec.HostConfig.ReadonlyRootfs, true);
});

test('build step container runs as uid 1000 with limits and no restart', () => {
  const spec = buildStepContainerSpec(base({ runtime: 'node', build_cmd: 'npm ci' }), OPTS);
  assert.strictEqual(spec.User, '1000:1000');
  assert.deepStrictEqual(spec.Cmd, ['sh', '-c', 'npm ci']);
  assert.deepStrictEqual(spec.HostConfig.CapDrop, ['ALL']);
  assert.deepStrictEqual(spec.HostConfig.RestartPolicy, { Name: 'no' });
  assert.strictEqual(spec.HostConfig.PidsLimit, 256);
});

test('invalid domain is refused before any label is produced', () => {
  assert.throws(() => buildSiteContainerSpec(base({ domain: 'bad domain' }), OPTS), /invalid domain/);
});

test('unknown runtime is refused', () => {
  assert.throws(() => buildSiteContainerSpec(base({ runtime: 'ruby' }), OPTS), /Unknown runtime/);
});
