const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { zipDirectory, ignored, parseGitignore } = require('../../mcp/zip-directory');

function scaffold() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-zipdir-'));
  const w = (rel, content = 'x') => { fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true }); fs.writeFileSync(path.join(dir, rel), content); };
  w('index.html', '<h1>hi</h1>');
  w('css/style.css', 'body{}');
  w('app.js.map', '{}');
  w('secret/key.txt', 'nope');
  w('node_modules/pkg/index.js', 'nope');
  w('.git/HEAD', 'ref');
  w('.DS_Store', '');
  w('.gitignore', '# comment\nnode_modules\n*.map\nsecret/\n!keep.me\n');
  return dir;
}

test('parseGitignore keeps simple patterns and drops comments and negations', () => {
  const dir = scaffold();
  assert.deepStrictEqual(parseGitignore(dir), ['node_modules', '*.map', 'secret']);
  assert.deepStrictEqual(parseGitignore(path.join(dir, 'css')), []);
});

test('ignored applies always-skip names, suffix globs and directory prefixes', () => {
  const pats = ['*.map', 'secret', 'build/tmp'];
  assert.strictEqual(ignored('.git', '.git', []), true);
  assert.strictEqual(ignored('x/node_modules', 'node_modules', []), true);
  assert.strictEqual(ignored('app.js.map', 'app.js.map', pats), true);
  assert.strictEqual(ignored('secret/key.txt', 'key.txt', pats), true);
  assert.strictEqual(ignored('build/tmp/a', 'a', pats), true);
  assert.strictEqual(ignored('css/style.css', 'style.css', pats), false);
});

test('zipDirectory packs only the deployable files', () => {
  const dir = scaffold();
  const { buffer, files, bytes } = zipDirectory(dir, { AdmZip });
  const names = new AdmZip(buffer).getEntries().map(e => e.entryName).sort();
  assert.deepStrictEqual(names, ['.gitignore', 'css/style.css', 'index.html']);
  assert.strictEqual(files, 3);
  assert.ok(bytes > 0);
});

test('zipDirectory refuses empty folders, missing paths and oversized trees', () => {
  const empty = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-zipdir-empty-'));
  assert.throws(() => zipDirectory(empty, { AdmZip }), /Nothing to deploy/);
  assert.throws(() => zipDirectory(path.join(empty, 'missing'), { AdmZip }), /Not a directory/);
  const dir = scaffold();
  assert.throws(() => zipDirectory(dir, { AdmZip, maxBytes: 4 }), /exceeds/);
  assert.throws(() => zipDirectory(dir, {}), /AdmZip/);
});
