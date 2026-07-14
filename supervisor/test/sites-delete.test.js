const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-sitesdel-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const sitesRouter = require('../src/routes/sites');

function makeApp() {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = { id: 'admin1', role: 'admin', username: 'admin' }; next(); });
  app.use('/api/sites', sitesRouter);
  return app;
}

async function withServer(app, fn) {
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;
  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('DELETE /api/sites/:id succeeds with no FK error when a site_permissions row references the site', async () => {
  const siteId = 'site1';
  db.prepare(
    `INSERT INTO sites (id, name, domain) VALUES (?, ?, ?)`
  ).run(siteId, 'Test Site', 'test-site.example.com');
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run('u1', 'u1', 'hash', 'editor');
  db.prepare('INSERT INTO site_permissions (user_id, site_id) VALUES (?, ?)').run('u1', siteId);
  db.prepare('INSERT INTO deployments (id, site_id, filename, size) VALUES (?, ?, ?, ?)')
    .run('d1', siteId, 'deploy.zip', 123);

  const app = makeApp();
  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/sites/${siteId}`, { method: 'DELETE' });
    const body = await res.json().catch(() => ({}));
    assert.strictEqual(res.status, 200, `expected clean 200, got ${res.status}: ${JSON.stringify(body)}`);
    assert.deepStrictEqual(body, { ok: true });
  });

  assert.strictEqual(db.prepare('SELECT * FROM sites WHERE id = ?').get(siteId), undefined);
  assert.strictEqual(db.prepare('SELECT * FROM site_permissions WHERE site_id = ?').get(siteId), undefined);
  assert.strictEqual(db.prepare('SELECT * FROM deployments WHERE site_id = ?').get(siteId), undefined);
});
