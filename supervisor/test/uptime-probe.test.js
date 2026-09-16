const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Isolated DB (uptime.js requires db.js on load).
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-uptime-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const { httpProbe, interpretResponse, probeViaTraefik, healthPath, TRAEFIK_NOT_FOUND } = require('../src/uptime');

// A stand-in for Traefik: routes by Host header like the real edge does.
// - up.example       -> nginx-style site: /__health is 200, / is 200
// - maint.example    -> maintenance mode: / is 403 but /__health still 200
// - app.example      -> node app without a health route: / is 404 from the app
// - broken.example   -> Traefik can't reach the backend: 502
// - ssl.example      -> http router redirects to https (SSL site)
// - anything else    -> Traefik's own 404 (no router for that Host)
function fakeTraefik() {
  return new Promise(resolve => {
    const server = http.createServer((req, res) => {
      const host = req.headers.host;
      if (host === 'up.example') return res.writeHead(200).end(req.url === '/__health' ? 'ok' : '<h1>hi</h1>');
      if (host === 'maint.example') return req.url === '/__health' ? res.writeHead(200).end('ok') : res.writeHead(403).end('maintenance');
      if (host === 'app.example') return res.writeHead(404, { 'content-type': 'text/html' }).end('<h1>Cannot GET /</h1>');
      if (host === 'broken.example') return res.writeHead(502).end('Bad Gateway');
      if (host === 'ssl.example') return res.writeHead(308, { location: 'https://ssl.example/' }).end();
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end(`${TRAEFIK_NOT_FOUND}\n`);
    });
    server.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('healthPath: nginx runtimes use /__health, app runtimes use /', () => {
  assert.strictEqual(healthPath({ runtime: 'static' }), '/__health');
  assert.strictEqual(healthPath({ runtime: 'php' }), '/__health');
  assert.strictEqual(healthPath({}), '/__health');
  assert.strictEqual(healthPath({ runtime: 'node' }), '/');
  assert.strictEqual(healthPath({ runtime: 'python' }), '/');
});

test('interpretResponse: site answers count as up, Traefik errors as down', () => {
  assert.strictEqual(interpretResponse({ status: 200, body: 'ok' }), true);
  assert.strictEqual(interpretResponse({ status: 403, body: 'maintenance' }), true);
  assert.strictEqual(interpretResponse({ status: 401, body: '' }), true);
  assert.strictEqual(interpretResponse({ status: 404, body: '<h1>Cannot GET /</h1>' }), true);
  assert.strictEqual(interpretResponse({ status: 404, body: `${TRAEFIK_NOT_FOUND}\n` }), false);
  assert.strictEqual(interpretResponse({ status: 502, body: '' }), false);
  assert.strictEqual(interpretResponse({ status: 503, body: '' }), false);
  assert.strictEqual(interpretResponse({ status: 504, body: '' }), false);
  assert.strictEqual(interpretResponse({ error: new Error('timeout') }), false);
  assert.strictEqual(interpretResponse(null), false);
});

test('probeViaTraefik routes by Host header and reads the verdict from the edge', async () => {
  const { server, port } = await fakeTraefik();
  const opts = { host: '127.0.0.1', httpPort: port, httpsPort: 1 };
  try {
    const up = await probeViaTraefik({ domain: 'up.example', runtime: 'static' }, opts);
    assert.strictEqual(up.up, true);
    assert.ok(Number.isInteger(up.latency) && up.latency >= 0);

    const maint = await probeViaTraefik({ domain: 'maint.example', runtime: 'static' }, opts);
    assert.strictEqual(maint.up, true, 'maintenance mode still answers /__health');

    const app = await probeViaTraefik({ domain: 'app.example', runtime: 'node' }, opts);
    assert.strictEqual(app.up, true, "an app's own 404 means the app answered");

    const broken = await probeViaTraefik({ domain: 'broken.example', runtime: 'static' }, opts);
    assert.strictEqual(broken.up, false);

    const unknown = await probeViaTraefik({ domain: 'nobody.example', runtime: 'static' }, opts);
    assert.strictEqual(unknown.up, false, 'no router for this Host');

    // SSL site: the http hop redirects, the https hop is unreachable in this
    // test (port 1) so the redirect response itself is what gets judged —
    // still a site that answered, never a false "down".
    const ssl = await probeViaTraefik({ domain: 'ssl.example', runtime: 'static' }, opts);
    assert.strictEqual(ssl.up, true);
  } finally {
    server.close();
  }
});

test('probeViaTraefik returns null when Traefik itself is unreachable (caller falls back)', async () => {
  const r = await probeViaTraefik({ domain: 'up.example', runtime: 'static' }, { host: '127.0.0.1', httpPort: 1, httpsPort: 1 });
  assert.strictEqual(r, null);
});

test('httpProbe never throws and reports timeouts as errors', async () => {
  const server = http.createServer(() => { /* never answers */ });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  try {
    const r = await httpProbe({ host: '127.0.0.1', port: server.address().port, path: '/', hostHeader: 'x', timeoutMs: 150 });
    assert.ok(r.error);
  } finally {
    server.close();
  }
});
