const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const express = require('express');
const bcrypt = require('bcryptjs');

// Isolated DB per test file (see test/session-store-migration.test.js for the
// same pattern): point DATA_PATH at a fresh temp dir before requiring db.js
// so this file's better-sqlite3 instance never touches the real database.
const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-userspw-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const usersRouter = require('../src/routes/users');

function makeApp(asUser) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => { req.user = asUser; next(); });
  app.use('/api/users', usersRouter);
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

test('PATCH /api/users/:id lets a non-admin change their own password, and the users table is what login checks', async () => {
  const oldHash = bcrypt.hashSync('oldpass123', 12);
  const userId = 'editor1';
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(userId, 'editor1', oldHash, 'editor');

  const app = makeApp({ id: userId, role: 'editor', username: 'editor1' });

  await withServer(app, async (base) => {
    // Wrong current password is rejected.
    const bad = await fetch(`${base}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: 'nope', password: 'newpass456' }),
    });
    assert.strictEqual(bad.status, 401);

    // Correct current password changes the users.password_hash row.
    const ok = await fetch(`${base}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: 'oldpass123', password: 'newpass456' }),
    });
    assert.strictEqual(ok.status, 200);

    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    assert.ok(bcrypt.compareSync('newpass456', row.password_hash), 'users.password_hash must match the new password — this is the row /api/auth/login checks');
    assert.ok(!bcrypt.compareSync('oldpass123', row.password_hash), 'old password must no longer work');
  });
});

test('PATCH /api/users/:id rejects a self password change with no current_password (non-admin)', async () => {
  const oldHash = bcrypt.hashSync('oldpass123', 12);
  const userId = 'viewer1';
  db.prepare('INSERT INTO users (id, username, password_hash, role) VALUES (?, ?, ?, ?)')
    .run(userId, 'viewer1', oldHash, 'viewer');

  const app = makeApp({ id: userId, role: 'viewer', username: 'viewer1' });

  await withServer(app, async (base) => {
    const res = await fetch(`${base}/api/users/${userId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: 'newpass456' }),
    });
    assert.strictEqual(res.status, 400);
  });
});
