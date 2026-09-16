const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  isValidTemplateId,
  listTemplates,
  getTemplate,
  applyPlaceholders,
  applyTemplateToDir,
} = require('../src/templates');

test('isValidTemplateId accepts lowercase-digits-hyphens only', () => {
  assert.ok(isValidTemplateId('blank'));
  assert.ok(isValidTemplateId('one-page'));
  assert.ok(isValidTemplateId('a1-b2'));
  assert.ok(!isValidTemplateId(''));
  assert.ok(!isValidTemplateId('Blank'));
  assert.ok(!isValidTemplateId('one_page'));
  assert.ok(!isValidTemplateId('../etc/passwd'));
  assert.ok(!isValidTemplateId('a/b'));
  assert.ok(!isValidTemplateId('a b'));
  assert.ok(!isValidTemplateId(null));
  assert.ok(!isValidTemplateId(undefined));
});

test('listTemplates finds the three shipped templates with their manifest fields', () => {
  const list = listTemplates();
  const ids = list.map(t => t.id).sort();
  assert.deepStrictEqual(ids, ['blank', 'one-page', 'portfolio']);
  for (const t of list) {
    assert.ok(t.name, `${t.id} needs a name`);
    assert.ok(t.description, `${t.id} needs a description`);
    assert.match(t.preview_bg, /^#[0-9a-fA-F]{3,8}$/, `${t.id} preview_bg must be a hex colour`);
  }
});

test('getTemplate returns one entry by id, and null for unknown/invalid ids', () => {
  const blank = getTemplate('blank');
  assert.strictEqual(blank.id, 'blank');
  assert.strictEqual(getTemplate('does-not-exist'), null);
  assert.strictEqual(getTemplate('../etc/passwd'), null);
  assert.strictEqual(getTemplate(''), null);
});

test('applyPlaceholders replaces every occurrence of SITE_NAME and SITE_DOMAIN', () => {
  const src = '<title>{{SITE_NAME}}</title><p>{{SITE_NAME}} at {{SITE_DOMAIN}}, again {{SITE_NAME}}</p>';
  const out = applyPlaceholders(src, { siteName: 'Bakery', siteDomain: 'bakery.example.com' });
  assert.strictEqual(out, '<title>Bakery</title><p>Bakery at bakery.example.com, again Bakery</p>');
});

test('applyPlaceholders leaves text alone when no vars are given', () => {
  assert.strictEqual(applyPlaceholders('plain text, no placeholders'), 'plain text, no placeholders');
});

test('applyPlaceholders does not choke on special replacement-string characters ($&, $$) in the substitution', () => {
  const out = applyPlaceholders('{{SITE_NAME}}', { siteName: 'Weird $& Name $$' });
  assert.strictEqual(out, 'Weird $& Name $$');
});

test('applyTemplateToDir copies index.html and style.css with placeholders replaced, and leaves other files untouched', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-tpl-'));
  const htmlDir = path.join(dir, 'html');
  fs.mkdirSync(htmlDir, { recursive: true });
  fs.writeFileSync(path.join(htmlDir, 'index.html'), 'OLD CONTENT');
  fs.writeFileSync(path.join(htmlDir, 'keep-me.txt'), 'do not touch');

  applyTemplateToDir('blank', htmlDir, { siteName: 'My Site', siteDomain: 'my-site.example.com' });

  const html = fs.readFileSync(path.join(htmlDir, 'index.html'), 'utf8');
  assert.match(html, /My Site/);
  assert.match(html, /my-site\.example\.com/);
  assert.doesNotMatch(html, /\{\{SITE_NAME\}\}/);
  assert.doesNotMatch(html, /\{\{SITE_DOMAIN\}\}/);
  assert.ok(fs.existsSync(path.join(htmlDir, 'style.css')));
  assert.strictEqual(fs.readFileSync(path.join(htmlDir, 'keep-me.txt'), 'utf8'), 'do not touch', 'files outside the template must survive');

  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyTemplateToDir creates htmlDir if it does not exist yet', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-tpl-'));
  const htmlDir = path.join(dir, 'nested', 'html');
  applyTemplateToDir('one-page', htmlDir, { siteName: 'X', siteDomain: 'x.test' });
  assert.ok(fs.existsSync(path.join(htmlDir, 'index.html')));
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyTemplateToDir rejects an invalid id before touching the filesystem', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-tpl-'));
  const htmlDir = path.join(dir, 'html');
  assert.throws(() => applyTemplateToDir('../etc', htmlDir, {}), /Invalid template id/);
  assert.throws(() => applyTemplateToDir('Nope!', htmlDir, {}), /Invalid template id/);
  assert.ok(!fs.existsSync(htmlDir), 'must not create the directory for a rejected id');
  fs.rmSync(dir, { recursive: true, force: true });
});

test('applyTemplateToDir rejects a well-formed but unknown id', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-tpl-'));
  const htmlDir = path.join(dir, 'html');
  assert.throws(() => applyTemplateToDir('does-not-exist', htmlDir, {}), /Unknown template/);
  fs.rmSync(dir, { recursive: true, force: true });
});
