const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { atomicExtract } = require('../src/extract');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grim-')); }

test('extracts flat and hoists single root folder', () => {
  const work = tmp();
  const zipPath = path.join(work, 'a.zip');
  const zip = new AdmZip();
  zip.addFile('site/index.html', Buffer.from('<h1>hi</h1>'));
  zip.writeZip(zipPath);
  const target = path.join(work, 'html');
  const { fileCount } = atomicExtract(zipPath, target);
  assert.ok(fs.existsSync(path.join(target, 'index.html')));
  assert.strictEqual(fileCount, 1);
});

test('corrupt zip leaves existing target untouched', () => {
  const work = tmp();
  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'live.html'), 'LIVE');
  const badZip = path.join(work, 'bad.zip');
  fs.writeFileSync(badZip, 'not a real zip');
  assert.throws(() => atomicExtract(badZip, target));
  assert.strictEqual(fs.readFileSync(path.join(target, 'live.html'), 'utf8'), 'LIVE');
});

test('rejects zip-slip entries', () => {
  const work = tmp();
  const zipPath = path.join(work, 'slip.zip');
  const zip = new AdmZip();
  zip.addFile('../evil.txt', Buffer.from('x'));
  zip.writeZip(zipPath);
  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'live.html'), 'LIVE');
  assert.throws(() => atomicExtract(zipPath, target));
  assert.ok(fs.existsSync(path.join(target, 'live.html')));
  assert.ok(!fs.existsSync(path.join(work, 'evil.txt')));
});
