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
