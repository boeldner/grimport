const test = require('node:test');
const assert = require('node:assert');
const { isValidHostname, sanitizeHeaderName, sanitizeRedirectField } = require('../src/validate');

test('accepts normal hostnames', () => {
  assert.ok(isValidHostname('example.com'));
  assert.ok(isValidHostname('a.b.sites.example.com'));
  assert.ok(isValidHostname('xn--bcher-kva.example'));
});

test('rejects Traefik rule injection', () => {
  assert.ok(!isValidHostname('evil.com`) || Host(`victim.com'));
  assert.ok(!isValidHostname('a b.com'));
  assert.ok(!isValidHostname('UPPER.com'.toLowerCase() + ' '));
  assert.ok(!isValidHostname(''));
  assert.ok(!isValidHostname('x'.repeat(254)));
});

test('header name rejects injection', () => {
  assert.strictEqual(sanitizeHeaderName('X-Frame-Options'), 'X-Frame-Options');
  assert.throws(() => sanitizeHeaderName('X-Bad\nadd_header Evil'));
  assert.throws(() => sanitizeHeaderName('X;Y'));
});

test('redirect field rejects newlines and braces', () => {
  assert.strictEqual(sanitizeRedirectField('/old'), '/old');
  assert.throws(() => sanitizeRedirectField('/x\nreturn 200'));
  assert.throws(() => sanitizeRedirectField('/x; }'));
});

const { assertPublicUrl, isPrivateAddress } = require('../src/validate');

test('isPrivateAddress covers reserved ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1',
                     '169.254.169.254', '::1', 'fc00::1', '0.0.0.0']) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
    assert.ok(!isPrivateAddress(ip), `${ip} should be public`);
  }
});

test('assertPublicUrl rejects non-http protocols', async () => {
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd'));
  await assert.rejects(() => assertPublicUrl('ftp://example.com'));
});

test('isPrivateAddress covers full fe80::/10 link-local range', () => {
  for (const ip of ['fe80::1', 'fe95::1', 'fea0::1', 'febf::1']) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`);
  }
});

test('isPrivateAddress covers wider reserved IPv4 ranges', () => {
  for (const ip of ['224.0.0.1', '240.0.0.1', '255.255.255.255',
                     '192.0.2.1', '198.51.100.1', '203.0.113.1']) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1']) {
    assert.ok(!isPrivateAddress(ip), `${ip} should still be public`);
  }
});
