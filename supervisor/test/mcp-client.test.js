const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const multer = require('multer');
const os = require('os');
const { createClient, multipartBody } = require('../src/mcp/client');

function startApi() {
  const app = express();
  const upload = multer({ dest: os.tmpdir() });
  app.use(express.json());
  app.get('/api/echo', (req, res) => res.json({ method: req.method, host: req.headers.host, auth: req.headers.authorization, xrw: req.headers['x-requested-with'] }));
  app.post('/api/json', (req, res) => res.json({ got: req.body, ct: req.headers['content-type'] }));
  app.put('/api/json', (req, res) => res.json({ got: req.body }));
  app.delete('/api/json', (req, res) => res.json({ deleted: true }));
  app.post('/api/upload', upload.single('file'), (req, res) => res.json({ name: req.file.originalname, size: req.file.size, mime: req.file.mimetype }));
  app.post('/api/held', (req, res) => res.status(202).json({ ok: true, pending_review: true, review_id: 'r1' }));
  app.get('/api/text', (req, res) => res.type('text/plain').send('hello logs'));
  app.get('/api/nope', (req, res) => res.status(404).json({ error: 'Site not found' }));
  app.get('/api/boom', (req, res) => res.status(500).send('nope'));
  return new Promise(resolve => {
    const server = app.listen(0, '127.0.0.1', () => resolve({ server, port: server.address().port }));
  });
}

test('multipartBody wraps a buffer in a single form-data part', () => {
  const { body, contentType } = multipartBody('file', 'a"b.zip', Buffer.from('PK'));
  assert.match(contentType, /^multipart\/form-data; boundary=----grimport-/);
  const s = body.toString('latin1');
  assert.ok(s.includes('name="file"; filename="ab.zip"'));
  assert.ok(s.includes('Content-Type: application/zip'));
  assert.ok(s.includes('\r\n\r\nPK\r\n--'));
});

test('client sends the token, CSRF header and Host override; parses JSON and text', async () => {
  const { server, port } = await startApi();
  const client = createClient({ baseUrl: `http://127.0.0.1:${port}`, token: 'grim_x', hostHeader: 'panel.test' });
  try {
    const echo = await client.get('/echo');
    assert.strictEqual(echo.auth, 'Bearer grim_x');
    assert.strictEqual(echo.xrw, 'grimport');
    assert.strictEqual(echo.host, 'panel.test');

    const posted = await client.post('/json', { a: 1 });
    assert.deepStrictEqual(posted.got, { a: 1 });
    assert.match(posted.ct, /application\/json/);
    assert.deepStrictEqual((await client.put('/json', { b: 2 })).got, { b: 2 });
    assert.deepStrictEqual(await client.del('/json'), { deleted: true });
    assert.strictEqual(await client.get('/text'), 'hello logs');

    const up = await client.upload('/upload', Buffer.from('PKzip'), 'site.zip');
    assert.strictEqual(up.status, 200);
    assert.strictEqual(up.name, 'site.zip');
    assert.strictEqual(up.size, 7);

    const held = await client.upload('/held', Buffer.from('x'), 'a.zip');
    assert.strictEqual(held.status, 202);
    assert.strictEqual(held.pending_review, true);
  } finally {
    server.close();
  }
});

test('client rejects with status and message from the API', async () => {
  const { server, port } = await startApi();
  const client = createClient({ baseUrl: `http://127.0.0.1:${port}`, token: 't' });
  try {
    await assert.rejects(client.get('/nope'), err => err.status === 404 && err.message === 'Site not found');
    await assert.rejects(client.get('/boom'), err => err.status === 500 && err.message === 'HTTP 500');
  } finally {
    server.close();
  }
  await assert.rejects(createClient({ baseUrl: 'http://127.0.0.1:1', token: 't' }).get('/echo'), /Cannot reach the panel/);
  assert.throws(() => createClient({ baseUrl: 'http://x', token: '' }), /token is required/);
});
