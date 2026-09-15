const test = require('node:test');
const assert = require('node:assert');
const { createNetworks, allocateSubnet, parsePool } = require('../src/networks');

test('allocateSubnet returns the lowest free /24 and skips the pool base', () => {
  assert.strictEqual(allocateSubnet([]), '10.99.1.0/24');
  assert.strictEqual(allocateSubnet(['10.99.1.0/24']), '10.99.2.0/24');
  assert.strictEqual(allocateSubnet(['10.99.1.0/24', '10.99.3.0/24']), '10.99.2.0/24');
  assert.strictEqual(allocateSubnet([], '10.42.0.0/16'), '10.42.1.0/24');
});

test('allocateSubnet throws when the pool is exhausted and validates the pool', () => {
  const all = Array.from({ length: 255 }, (_, i) => `10.99.${i + 1}.0/24`);
  assert.throws(() => allocateSubnet(all), /No free/);
  assert.throws(() => parsePool('nope'), /SITE_NET_POOL/);
  assert.throws(() => parsePool('10.99.0.0/25'), /24 or larger/);
});

function fakeDocker({ networks = [], traefikExists = true } = {}) {
  const calls = { created: [], connected: [], removed: [], disconnected: [] };
  const docker = {
    calls,
    listNetworks: async ({ filters } = {}) => {
      const f = filters ? JSON.parse(filters) : {};
      let list = networks;
      if (f.label) list = list.filter(n => f.label.every(l => { const [k, v] = l.split('='); return n.Labels?.[k] === v; }));
      if (f.name) list = list.filter(n => f.name.includes(n.Name));
      return list;
    },
    createNetwork: async (cfg) => {
      const n = { Name: cfg.Name, Id: `id-${cfg.Name}`, Labels: cfg.Labels, Internal: cfg.Internal, IPAM: cfg.IPAM };
      networks.push(n); calls.created.push(cfg);
      return { id: n.Id };
    },
    getNetwork: (name) => ({
      connect: async ({ Container }) => {
        if (!traefikExists) { const e = new Error('No such container'); e.statusCode = 404; throw e; }
        if (calls.connected.includes(`${name}:${Container}`)) { const e = new Error('endpoint with name webhost-traefik already exists'); e.statusCode = 403; throw e; }
        calls.connected.push(`${name}:${Container}`);
      },
      disconnect: async ({ Container }) => { calls.disconnected.push(`${name}:${Container}`); },
      remove: async () => {
        const i = networks.findIndex(n => n.Name === name);
        if (i === -1) { const e = new Error('not found'); e.statusCode = 404; throw e; }
        networks.splice(i, 1); calls.removed.push(name);
      },
    }),
  };
  return docker;
}
const quiet = { warn: () => {} };

test('ensureSiteNetwork creates an internal network with the next subnet, then reuses it', async () => {
  const docker = fakeDocker();
  const nets = createNetworks({ docker, log: quiet });
  const a = await nets.ensureSiteNetwork('s1', { internal: true });
  assert.deepStrictEqual({ name: a.name, subnet: a.subnet, created: a.created }, { name: 'webhost-site-s1', subnet: '10.99.1.0/24', created: true });
  assert.strictEqual(docker.calls.created[0].Internal, true);
  assert.strictEqual(docker.calls.created[0].Labels['webhost.site.net'], 'true');
  const b = await nets.ensureSiteNetwork('s2');
  assert.strictEqual(b.subnet, '10.99.2.0/24');
  assert.strictEqual(docker.calls.created[1].Internal, false);
  const again = await nets.ensureSiteNetwork('s1', { internal: true });
  assert.strictEqual(again.created, false);
  assert.strictEqual(docker.calls.created.length, 2);
});

test('connectTraefik tolerates already-connected and missing Traefik', async () => {
  const docker = fakeDocker();
  const nets = createNetworks({ docker, log: quiet });
  await nets.ensureSiteNetwork('s1');
  assert.strictEqual(await nets.connectTraefik('webhost-site-s1'), true);
  assert.strictEqual(await nets.connectTraefik('webhost-site-s1'), true, '403 already exists is fine');
  const noTraefik = createNetworks({ docker: fakeDocker({ traefikExists: false }), log: quiet });
  assert.strictEqual(await noTraefik.connectTraefik('webhost-site-s1'), false);
});

test('removeSiteNetwork disconnects Traefik and removes; missing network is not an error', async () => {
  const docker = fakeDocker();
  const nets = createNetworks({ docker, log: quiet });
  await nets.ensureSiteNetwork('s1');
  assert.strictEqual(await nets.removeSiteNetwork('s1'), true);
  assert.ok(docker.calls.disconnected.includes('webhost-site-s1:webhost-traefik'));
  assert.strictEqual(await nets.removeSiteNetwork('s1'), false);
});

test('reconnectTraefikToAll connects every site network and lists them', async () => {
  const docker = fakeDocker();
  const nets = createNetworks({ docker, log: quiet });
  await nets.ensureSiteNetwork('s1'); await nets.ensureSiteNetwork('s2');
  assert.strictEqual(await nets.reconnectTraefikToAll(), 2);
  const list = await nets.listSiteNetworks();
  assert.deepStrictEqual(list.map(n => n.siteId).sort(), ['s1', 's2']);
});
