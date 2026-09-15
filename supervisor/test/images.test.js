const test = require('node:test');
const assert = require('node:assert');
const Database = require('better-sqlite3');
const { createImageUpdater, imageForRuntime, shortId, RUNTIME_IMAGES } = require('../src/images');

// ── Fakes ─────────────────────────────────────────────────
function makeDb(rows) {
  const db = new Database(':memory:');
  db.exec(`CREATE TABLE sites (
    id TEXT PRIMARY KEY, name TEXT, runtime TEXT DEFAULT 'static',
    container_id TEXT, created_at INTEGER DEFAULT 0)`);
  const ins = db.prepare('INSERT INTO sites (id, name, runtime, container_id, created_at) VALUES (?, ?, ?, ?, ?)');
  rows.forEach((r, i) => ins.run(r.id, r.name, r.runtime || 'static', r.container_id || null, i));
  return db;
}

/**
 * images:     { tag: 'sha256:...' }            local image id per tag
 * containers: { id: { imageId, tag, running } } per container id
 * pullEffect: { tag: 'sha256:new' }            what a pull changes the local id to
 */
function makeDocker({ images = {}, containers = {}, pullEffect = {} } = {}) {
  const calls = { pulls: [] };
  const docker = {
    calls,
    images,
    getImage: tag => ({
      inspect: async () => {
        if (!images[tag]) { const e = new Error('no such image'); e.statusCode = 404; throw e; }
        return { Id: images[tag] };
      },
    }),
    getContainer: id => ({
      inspect: async () => {
        const c = containers[id];
        if (!c) { const e = new Error('no such container'); e.statusCode = 404; throw e; }
        return { Image: c.imageId, Config: { Image: c.tag }, State: { Running: !!c.running }, NetworkSettings: { Networks: c.networks || { [`webhost-site-${c.siteId || id.replace(/^c/, 's')}`]: {} } } };
      },
    }),
    pull: (tag, cb) => {
      calls.pulls.push(tag);
      if (pullEffect[tag]) images[tag] = pullEffect[tag];
      cb(null, {});
    },
    modem: { followProgress: (_stream, done) => done(null) },
  };
  return docker;
}

const NGINX_OLD = 'sha256:aaaa000000000000000000000000000000000000000000000000000000000000';
const NGINX_NEW = 'sha256:bbbb000000000000000000000000000000000000000000000000000000000000';
const NODE_CUR  = 'sha256:cccc000000000000000000000000000000000000000000000000000000000000';

// ── Tests ─────────────────────────────────────────────────
test('imageForRuntime maps every runtime and falls back to the static image', () => {
  assert.strictEqual(imageForRuntime('static'), 'nginxinc/nginx-unprivileged:alpine');
  assert.strictEqual(imageForRuntime(undefined), 'nginxinc/nginx-unprivileged:alpine');
  assert.strictEqual(imageForRuntime('node'), RUNTIME_IMAGES.node);
  assert.strictEqual(imageForRuntime('bogus'), 'nginxinc/nginx-unprivileged:alpine');
});

test('shortId strips the sha256 prefix and truncates to 12 chars', () => {
  assert.strictEqual(shortId(NGINX_OLD), 'aaaa00000000');
  assert.strictEqual(shortId(null), null);
});

test('status() flags containers whose image id differs from the local tag', async () => {
  const db = makeDb([
    { id: 's1', name: 'Fresh', container_id: 'c1' },
    { id: 's2', name: 'Stale', container_id: 'c2' },
    { id: 's3', name: 'NodeApp', runtime: 'node', container_id: 'c3' },
    { id: 's4', name: 'NoContainer' },
    { id: 's5', name: 'Gone', container_id: 'c-missing' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW, 'node:22-alpine': NODE_CUR },
    containers: {
      c1: { imageId: NGINX_NEW, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c2: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c3: { imageId: NODE_CUR, tag: 'node:22-alpine', running: false },
    },
  });
  const u = createImageUpdater({ docker, db, recreate: async () => 'x' });
  const st = await u.status();

  assert.strictEqual(st.total, 5);
  assert.strictEqual(st.outdated, 1);
  const byId = Object.fromEntries(st.sites.map(s => [s.id, s]));
  assert.strictEqual(byId.s1.outdated, false);
  assert.strictEqual(byId.s2.outdated, true);
  assert.strictEqual(byId.s2.container_image_id, 'aaaa00000000');
  assert.strictEqual(byId.s2.local_image_id, 'bbbb00000000');
  assert.strictEqual(byId.s3.outdated, false);
  assert.strictEqual(byId.s3.image, 'node:22-alpine');
  assert.strictEqual(byId.s4.missing, true);
  assert.strictEqual(byId.s5.missing, true, 'unreachable container counts as missing, never outdated');
  assert.strictEqual(byId.s5.outdated, false);
  assert.deepStrictEqual(st.images.map(i => i.tag).sort(), ['nginxinc/nginx-unprivileged:alpine', 'node:22-alpine']);
  assert.strictEqual(byId.s1.isolated, true);
  assert.strictEqual(byId.s2.outdated_reason, 'image');
});

test('status() never reports outdated when the image is not present locally', async () => {
  const db = makeDb([{ id: 's1', name: 'A', container_id: 'c1' }]);
  const docker = makeDocker({
    images: {},
    containers: { c1: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true } },
  });
  const u = createImageUpdater({ docker, db, recreate: async () => 'x' });
  const st = await u.status();
  assert.strictEqual(st.outdated, 0);
  assert.strictEqual(st.sites[0].local_image_id, null);
});

test('pullImages() pulls the static image plus each runtime in use and reports what changed', async () => {
  const db = makeDb([
    { id: 's1', name: 'A', runtime: 'static' },
    { id: 's2', name: 'B', runtime: 'php' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_OLD, 'php:8.3-apache': NODE_CUR },
    pullEffect: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW },
  });
  const events = [];
  const u = createImageUpdater({ docker, db, recreate: async () => 'x', log: (e, d) => events.push([e, d]) });
  const pulled = await u.pullImages();

  assert.deepStrictEqual(docker.calls.pulls.sort(), ['nginxinc/nginx-unprivileged:alpine', 'php:8.3-apache']);
  const nginx = pulled.find(p => p.tag === 'nginxinc/nginx-unprivileged:alpine');
  const php = pulled.find(p => p.tag === 'php:8.3-apache');
  assert.strictEqual(nginx.updated, true);
  assert.strictEqual(nginx.local_image_id, 'bbbb00000000');
  assert.strictEqual(php.updated, false);
  assert.ok(events.some(([e]) => e === 'images_pulled'));
});

test('recreateSite() calls the factory with the parsed site and persists the new container id', async () => {
  const db = makeDb([{ id: 's1', name: 'A', container_id: 'old' }]);
  const seen = [];
  const u = createImageUpdater({
    docker: makeDocker(),
    db,
    recreate: async site => { seen.push(site); return 'new-id'; },
    parseSite: row => ({ ...row, parsed: true }),
  });
  const id = await u.recreateSite('s1', 'admin');
  assert.strictEqual(id, 'new-id');
  assert.strictEqual(seen[0].parsed, true);
  assert.strictEqual(seen[0].container_id, 'old');
  assert.strictEqual(db.prepare('SELECT container_id FROM sites WHERE id = ?').get('s1').container_id, 'new-id');
  await assert.rejects(() => u.recreateSite('nope'), /Site not found/);
});

test('run() pulls, recreates only outdated containers one by one, and reports progress', async () => {
  const db = makeDb([
    { id: 's1', name: 'Fresh', container_id: 'c1' },
    { id: 's2', name: 'Stale', container_id: 'c2' },
    { id: 's3', name: 'AlsoStale', container_id: 'c3' },
    { id: 's4', name: 'NoContainer' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_OLD },
    containers: {
      c1: { imageId: NGINX_NEW, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c2: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c3: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
    },
    pullEffect: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW },
  });
  const order = [];
  const u = createImageUpdater({
    docker, db,
    recreate: async site => {
      order.push(site.id);
      // simulate the new container being created from the fresh image
      docker.getContainer; // no-op: status is only re-read after the loop
      return `new-${site.id}`;
    },
  });

  const job = u.run({ actor: 'admin' });
  assert.notStrictEqual(u.getState().status, 'idle', 'state flips immediately');
  assert.throws(() => u.run(), /already in progress/, 'second run is rejected while busy');
  await job;

  const st = u.getState();
  assert.strictEqual(st.status, 'done');
  assert.strictEqual(st.total, 2);
  assert.strictEqual(st.done, 2);
  assert.deepStrictEqual(order, ['s3', 's2'], 'only outdated containers are recreated, newest site first (list order)');
  assert.ok(st.results.every(r => r.ok));
  assert.match(st.message, /Updated 2 containers/);
  assert.strictEqual(db.prepare('SELECT container_id FROM sites WHERE id = ?').get('s2').container_id, 'new-s2');
  assert.strictEqual(db.prepare('SELECT container_id FROM sites WHERE id = ?').get('s1').container_id, 'c1');
});

test('run() with force + siteIds recreates exactly the listed sites even if up to date', async () => {
  const db = makeDb([
    { id: 's1', name: 'A', container_id: 'c1' },
    { id: 's2', name: 'B', container_id: 'c2' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW },
    containers: {
      c1: { imageId: NGINX_NEW, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c2: { imageId: NGINX_NEW, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
    },
  });
  const order = [];
  const u = createImageUpdater({ docker, db, recreate: async s => { order.push(s.id); return 'n'; } });
  await u.run({ pull: false, force: true, siteIds: ['s2'] });
  assert.deepStrictEqual(order, ['s2']);
  assert.deepStrictEqual(docker.calls.pulls, [], 'pull:false skips the registry');
});

test('run() records per-site failures without aborting the rest', async () => {
  const db = makeDb([
    { id: 's1', name: 'Bad', container_id: 'c1' },
    { id: 's2', name: 'Good', container_id: 'c2' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW },
    containers: {
      c1: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
      c2: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true },
    },
  });
  const events = [];
  const u = createImageUpdater({
    docker, db,
    recreate: async s => { if (s.id === 's1') throw new Error('boom'); return 'ok-id'; },
    log: (e, d, meta) => events.push({ e, d, meta }),
  });
  await u.run({ pull: false });
  const st = u.getState();
  assert.strictEqual(st.status, 'done');
  assert.strictEqual(st.results.find(r => r.id === 's1').ok, false);
  assert.strictEqual(st.results.find(r => r.id === 's2').ok, true);
  assert.match(st.message, /1 failed/);
  assert.ok(events.some(x => x.e === 'container_recreate_failed' && x.meta.level === 'error'));
  // a finished job can be started again
  assert.doesNotThrow(() => u.run({ pull: false }));
});

test('status() flags a container still on the shared network as outdated (network) so the rolling update isolates it', async () => {
  const db = makeDb([
    { id: 's1', name: 'Legacy', container_id: 'c1' },
    { id: 's2', name: 'Both', container_id: 'c2' },
  ]);
  const docker = makeDocker({
    images: { 'nginxinc/nginx-unprivileged:alpine': NGINX_NEW },
    containers: {
      c1: { imageId: NGINX_NEW, tag: 'nginxinc/nginx-unprivileged:alpine', running: true, networks: { 'webhost-net': {} } },
      c2: { imageId: NGINX_OLD, tag: 'nginxinc/nginx-unprivileged:alpine', running: true, networks: { 'webhost-net': {} } },
    },
  });
  const u = createImageUpdater({ docker, db, recreate: async () => 'x' });
  const st = await u.status();
  const byId = Object.fromEntries(st.sites.map(s => [s.id, s]));
  assert.strictEqual(byId.s1.isolated, false);
  assert.strictEqual(byId.s1.network, 'webhost-net');
  assert.strictEqual(byId.s1.outdated, true);
  assert.strictEqual(byId.s1.outdated_reason, 'network');
  assert.strictEqual(byId.s2.outdated_reason, 'image+network');
  assert.strictEqual(st.outdated, 2);
});
