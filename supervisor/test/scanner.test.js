const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { scanDirectory, shannonEntropy, isBinary, extractHosts, isBrandPhish } = require('../src/scanner');

function tmpSite() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grim-scan-')); }
function write(dir, rel, content) {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function findingsOf(result, category) {
  return result.findings.filter(f => f.category === category);
}

// ── pure helpers ────────────────────────────────────────────

test('shannonEntropy: empty string is 0', () => {
  assert.strictEqual(shannonEntropy(''), 0);
});

test('shannonEntropy: repeated character is 0, varied text is higher', () => {
  assert.strictEqual(shannonEntropy('aaaaaaaaaa'), 0);
  assert.ok(shannonEntropy('the quick brown fox jumps over the lazy dog') > 3);
});

test('isBinary: text is not binary, NUL-containing buffer is', () => {
  assert.strictEqual(isBinary(Buffer.from('hello world, this is plain text')), false);
  assert.strictEqual(isBinary(Buffer.from([0x68, 0x69, 0x00, 0x01, 0x02])), true);
});

test('extractHosts: pulls hostnames from script src and form action', () => {
  const html = `<script src="https://cdn.example.com/a.js"></script><form action="http://evil.example.net/collect"></form>`;
  assert.deepStrictEqual(extractHosts(html, 'script', 'src'), ['cdn.example.com']);
  assert.deepStrictEqual(extractHosts(html, 'form', 'action'), ['evil.example.net']);
});

test('isBrandPhish: brand word + password field is true, brand word alone is false', () => {
  const withPassword = '<html>Sign in to PayPal<input type="password" name="pw"></html>';
  const withoutPassword = '<html>Welcome to PayPal, the payment service.</html>';
  assert.strictEqual(isBrandPhish(withPassword), true);
  assert.strictEqual(isBrandPhish(withoutPassword), false);
});

// ── scanDirectory: fixtures ──────────────────────────────────

test('clean static site: verdict clean, no findings', () => {
  const dir = tmpSite();
  write(dir, 'index.html', '<html><body><h1>Welcome</h1><p>A simple page.</p></body></html>');
  write(dir, 'style.css', 'body { color: black; }');
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'clean');
  assert.strictEqual(result.findings.length, 0);
  assert.strictEqual(result.stats.files, 2);
});

test('phishing page: brand + password + external form target is blocked', () => {
  const dir = tmpSite();
  write(dir, 'index.html', `
    <html><body>
      <h1>PayPal account verification</h1>
      <form action="https://evil.example.net/collect" method="post">
        <input type="password" name="pw">
      </form>
    </body></html>`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'blocked');
  const ph = findingsOf(result, 'phishing');
  assert.strictEqual(ph.length, 1);
  assert.strictEqual(ph[0].severity, 'blocked');
});

test('phishing signal to the site\'s own (relative) form is review, not blocked', () => {
  const dir = tmpSite();
  write(dir, 'index.html', `
    <html><body>
      <h1>Sign in with your Apple ID</h1>
      <form action="/login" method="post">
        <input type="password" name="pw">
      </form>
    </body></html>`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  const ph = findingsOf(result, 'phishing');
  assert.strictEqual(ph.length, 1);
  assert.strictEqual(ph[0].severity, 'review');
});

test('known miner script signature is blocked', () => {
  const dir = tmpSite();
  write(dir, 'miner.js', `var CoinHive = new CoinHive.Anonymous("site-key"); CoinHive.start();`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'blocked');
  const miner = findingsOf(result, 'miner');
  assert.strictEqual(miner.length, 1);
});

test('WebAssembly + hashrate combination is flagged as a miner', () => {
  const dir = tmpSite();
  write(dir, 'wasm-loader.js', `const stratum = connect(); loadWebAssembly(mod); reportHashrate(stratum);`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'blocked');
  assert.strictEqual(findingsOf(result, 'miner').length, 1);
});

test('executable file extension is blocked', () => {
  const dir = tmpSite();
  write(dir, 'index.html', '<html>ok</html>');
  write(dir, 'tool.exe', Buffer.from('MZ\x90\x00fake binary content'));
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'blocked');
  const exe = findingsOf(result, 'executable');
  assert.ok(exe.some(f => f.file === 'tool.exe'));
});

test('MZ header on a file without a known extension is still blocked', () => {
  const dir = tmpSite();
  write(dir, 'payload.bin', Buffer.concat([Buffer.from('MZ'), Buffer.alloc(64, 0x90)]));
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'blocked');
  assert.ok(findingsOf(result, 'executable').some(f => f.file === 'payload.bin'));
});

test('secret: AWS access key and a .env file are review-level', () => {
  const dir = tmpSite();
  write(dir, 'config.js', `const AWS_KEY = "AKIAABCDEFGHIJKLMNOP";`);
  write(dir, '.env', 'DB_PASSWORD=supersecretvalue');
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  const secrets = findingsOf(result, 'secret');
  assert.ok(secrets.some(f => f.file === 'config.js'));
  assert.ok(secrets.some(f => f.file === '.env'));
  assert.ok(secrets.every(f => f.severity === 'review'));
});

test('secret: generic api-key literal is flagged in non-HTML text but not required in HTML', () => {
  const dir = tmpSite();
  write(dir, 'settings.txt', `api_key: "abcdefghijklmnop"`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  assert.ok(findingsOf(result, 'secret').some(f => f.file === 'settings.txt'));
});

test('external-script: allow-listed host is info (clean verdict), non-allow-listed is review', () => {
  const dirAllowed = tmpSite();
  write(dirAllowed, 'index.html', '<html><head><script src="https://cdnjs.cloudflare.com/lib.js"></script></head></html>');
  const allowed = scanDirectory(dirAllowed);
  assert.strictEqual(allowed.verdict, 'clean');
  assert.strictEqual(findingsOf(allowed, 'external-script')[0].severity, 'info');
  assert.deepStrictEqual(allowed.stats.externalHosts, ['cdnjs.cloudflare.com']);

  const dirBlocked = tmpSite();
  write(dirBlocked, 'index.html', '<html><head><script src="https://evil.example.net/lib.js"></script></head></html>');
  const notAllowed = scanDirectory(dirBlocked);
  assert.strictEqual(notAllowed.verdict, 'review');
  assert.strictEqual(findingsOf(notAllowed, 'external-script')[0].severity, 'review');
});

test('external-script: a site allow-list entry overrides the default (non-default host allowed)', () => {
  const dir = tmpSite();
  write(dir, 'index.html', '<html><head><script src="https://my-own-cdn.example.com/lib.js"></script></head></html>');
  const result = scanDirectory(dir, { allowlist: ['my-own-cdn.example.com'] });
  assert.strictEqual(result.verdict, 'clean');
  assert.strictEqual(findingsOf(result, 'external-script')[0].severity, 'info');
});

test('external-form: form posting to a non-allow-listed host is review', () => {
  const dir = tmpSite();
  write(dir, 'contact.html', '<html><body><form action="https://forms.example.net/submit"><input name="msg"></form></body></html>');
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  assert.strictEqual(findingsOf(result, 'external-form').length, 1);
});

test('obfuscated JS: long high-entropy line is flagged review', () => {
  const dir = tmpSite();
  const randomish = Array.from({ length: 6000 }, () => String.fromCharCode(33 + Math.floor(Math.random() * 90))).join('');
  write(dir, 'bundle.js', `var payload = "${randomish}";`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  assert.strictEqual(findingsOf(result, 'obfuscated-js').length, 1);
});

test('obfuscated JS: eval(atob(...)) pattern is flagged', () => {
  const dir = tmpSite();
  write(dir, 'loader.js', `eval(atob("Y29uc29sZS5sb2coMSk="));`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  assert.ok(findingsOf(result, 'obfuscated-js').some(f => f.detail.includes('eval(atob(')));
});

test('redirect: meta refresh to an external host is review', () => {
  const dir = tmpSite();
  write(dir, 'index.html', `<html><head><meta http-equiv="refresh" content="0; url=https://other-host.example.net/landing"></head></html>`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'review');
  assert.strictEqual(findingsOf(result, 'redirect').length, 1);
});

test('large-inline-data: data URI over 200KB is info only (still clean)', () => {
  const dir = tmpSite();
  const big = Buffer.alloc(210 * 1024, 'a').toString('base64');
  write(dir, 'index.html', `<html><body><img src="data:image/png;base64,${big}"></body></html>`);
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'clean');
  assert.strictEqual(findingsOf(result, 'large-inline-data').length, 1);
  assert.strictEqual(findingsOf(result, 'large-inline-data')[0].severity, 'info');
});

test('binary files are skipped for content scans but still counted', () => {
  const dir = tmpSite();
  write(dir, 'photo.png', Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3, 4, 5]));
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'clean');
  assert.strictEqual(result.stats.files, 1);
});

test('files over 5MB are skipped entirely', () => {
  const dir = tmpSite();
  write(dir, 'huge.txt', Buffer.alloc(6 * 1024 * 1024, 'a'));
  const result = scanDirectory(dir);
  assert.strictEqual(result.verdict, 'clean');
  assert.strictEqual(result.findings.length, 0);
});
