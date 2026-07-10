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

test('zip-slip entry cannot escape target dir', () => {
  const work = tmp();
  const zipPath = path.join(work, 'slip.zip');
  const zip = new AdmZip();
  // adm-zip's addFile() normalizes a '../evil.txt' name to 'evil.txt'
  // immediately, so a traversal name never survives writeZip()/getEntries()
  // when set through the normal API. To build a zip that genuinely carries
  // a '..'-containing entry name on disk (and thus exercise the real
  // zip-slip defense in atomicExtract), we add a placeholder entry and then
  // mutate its entryName directly before writing the zip. This does survive
  // a write/read round-trip (verified below), proving traversal entries can
  // reach atomicExtract in the wild (e.g. crafted zips, other zip tools, or
  // future adm-zip versions with different normalization).
  zip.addFile('placeholder.txt', Buffer.from('x'));
  zip.getEntries()[0].entryName = '../evil.txt';
  zip.writeZip(zipPath);

  // Sanity check: the traversal name really made it onto disk.
  const roundTripped = new AdmZip(zipPath).getEntries()[0].entryName;
  assert.ok(roundTripped.includes('..'), 'test setup must produce a real traversal entry name');

  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'live.html'), 'LIVE');

  // The explicit zip-slip check in atomicExtract is defense-in-depth: it
  // fires here because the entry name still contains '..' when we reach it.
  assert.throws(() => atomicExtract(zipPath, target));

  // The real invariant under test: nothing escapes targetDir, and the
  // pre-existing live file is untouched, regardless of how the rejection
  // happens.
  assert.ok(fs.existsSync(path.join(target, 'live.html')));
  assert.strictEqual(fs.readFileSync(path.join(target, 'live.html'), 'utf8'), 'LIVE');
  assert.ok(!fs.existsSync(path.join(work, 'evil.txt')));
  assert.ok(!fs.existsSync(path.join(path.dirname(work), 'evil.txt')));
});
