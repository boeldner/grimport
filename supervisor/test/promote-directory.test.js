const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { promoteDirectory } = require('../src/extract');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grim-promote-')); }

test('promoteDirectory: moves a staged dir into an empty target', () => {
  const work = tmp();
  const staged = path.join(work, '.deploy-stage-abc');
  fs.mkdirSync(staged, { recursive: true });
  fs.writeFileSync(path.join(staged, 'index.html'), '<h1>hi</h1>');
  const target = path.join(work, 'html');

  const { fileCount } = promoteDirectory(staged, target);
  assert.strictEqual(fileCount, 1);
  assert.ok(fs.existsSync(path.join(target, 'index.html')));
  assert.ok(!fs.existsSync(staged));
});

test('promoteDirectory: replaces existing target content and leaves no stray dirs', () => {
  const work = tmp();
  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'old.html'), 'OLD');

  const staged = path.join(work, '.deploy-stage-xyz');
  fs.mkdirSync(staged, { recursive: true });
  fs.writeFileSync(path.join(staged, 'new.html'), 'NEW');

  const { fileCount } = promoteDirectory(staged, target);
  assert.strictEqual(fileCount, 1);
  assert.ok(fs.existsSync(path.join(target, 'new.html')));
  assert.ok(!fs.existsSync(path.join(target, 'old.html')));
  assert.ok(!fs.existsSync(staged));

  const stray = fs.readdirSync(work).filter(n => n.startsWith('.deploy-bak-') || n.startsWith('.deploy-stage-'));
  assert.deepStrictEqual(stray, []);
});

test('promoteDirectory: throws and cleans up the staged dir when it does not exist', () => {
  const work = tmp();
  const missing = path.join(work, '.deploy-stage-missing');
  assert.throws(() => promoteDirectory(missing, path.join(work, 'html')));
});

test('promoteDirectory: staged dir is always consumed even when target pre-exists', () => {
  const work = tmp();
  const target = path.join(work, 'app');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'server.js'), 'OLD');
  const staged = path.join(work, '.deploy-stage-1');
  fs.mkdirSync(staged, { recursive: true });
  fs.writeFileSync(path.join(staged, 'server.js'), 'NEW');

  promoteDirectory(staged, target);
  assert.strictEqual(fs.readFileSync(path.join(target, 'server.js'), 'utf8'), 'NEW');
  assert.ok(!fs.existsSync(staged));
});
