const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { atomicExtract, inspectZip, defaultLimits } = require('../src/extract');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grim-lim-')); }
function zipWith(work, files, name = 'a.zip') {
  const zip = new AdmZip();
  for (const [n, content, attr] of files) {
    zip.addFile(n, Buffer.isBuffer(content) ? content : Buffer.from(content));
    // addFile() normalises the attr argument; the entry setter keeps it verbatim
    if (attr !== undefined) zip.getEntry(n).attr = attr >>> 0;
  }
  const p = path.join(work, name);
  zip.writeZip(p);
  return p;
}
const LIM = { maxEntries: 3, maxTotalBytes: 1000, maxSingleBytes: 600 };

test('defaultLimits reads env with sane fallbacks', () => {
  const d = defaultLimits();
  assert.strictEqual(d.maxEntries, 20000);
  assert.strictEqual(d.maxTotalBytes, 1024 * 1024 * 1024);
  assert.strictEqual(d.maxSingleBytes, 250 * 1024 * 1024);
});

test('too many entries is rejected before extraction', () => {
  const work = tmp();
  const zp = zipWith(work, [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']]);
  assert.throws(() => atomicExtract(zp, path.join(work, 'out'), LIM), /entries, limit is 3/);
  assert.ok(!fs.existsSync(path.join(work, 'out')));
});

test('declared total size over the limit is rejected', () => {
  const work = tmp();
  const zp = zipWith(work, [['a', 'x'.repeat(500)], ['b', 'y'.repeat(501)]]);
  assert.throws(() => inspectZip(zp, LIM), /uncompressed size exceeds/);
});

test('single file over the limit is rejected', () => {
  const work = tmp();
  const zp = zipWith(work, [['big.bin', 'z'.repeat(601)]]);
  assert.throws(() => inspectZip(zp, LIM), /single-file limit/);
});

test('symlink entries are rejected', () => {
  const work = tmp();
  const zp = zipWith(work, [['link', '/etc/passwd', 0xa1ff << 16]]);
  assert.throws(() => inspectZip(zp, LIM), /symlinks are not allowed/);
});

test('within limits extracts and reports totalBytes', () => {
  const work = tmp();
  const zp = zipWith(work, [['index.html', '<h1>ok</h1>'], ['a.css', 'body{}']]);
  const out = path.join(work, 'out');
  const r = atomicExtract(zp, out, LIM);
  assert.strictEqual(r.fileCount, 2);
  assert.strictEqual(r.totalBytes, 11 + 6);
  assert.ok(fs.existsSync(path.join(out, 'index.html')));
});

test('a rejected zip leaves an existing live dir untouched', () => {
  const work = tmp();
  const out = path.join(work, 'out');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, 'live.html'), 'LIVE');
  const zp = zipWith(work, [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']]);
  assert.throws(() => atomicExtract(zp, out, LIM));
  assert.strictEqual(fs.readFileSync(path.join(out, 'live.html'), 'utf8'), 'LIVE');
  assert.ok(!fs.readdirSync(work).some(n => n.startsWith('.deploy-tmp-')), 'temp dir cleaned up');
});
