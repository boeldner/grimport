const test = require('node:test');
const assert = require('node:assert');
const { classifyResolution, isCloudflareIp, inCidr } = require('../src/dns-check');

test('inCidr matches addresses inside and rejects outside / malformed', () => {
  assert.strictEqual(inCidr('104.16.1.1', '104.16.0.0/13'), true);
  assert.strictEqual(inCidr('104.24.0.5', '104.16.0.0/13'), false);
  assert.strictEqual(inCidr('172.71.10.3', '172.64.0.0/13'), true);
  assert.strictEqual(inCidr('not-an-ip', '172.64.0.0/13'), false);
  assert.strictEqual(inCidr('1.2.3', '172.64.0.0/13'), false);
});

test('isCloudflareIp recognises edge IPs and not a random host', () => {
  assert.strictEqual(isCloudflareIp('104.21.45.67'), true);
  assert.strictEqual(isCloudflareIp('172.67.180.22'), true);
  assert.strictEqual(isCloudflareIp('188.114.97.3'), true);
  assert.strictEqual(isCloudflareIp('145.224.73.93'), false);
  assert.strictEqual(isCloudflareIp('192.168.1.1'), false);
});

test('direct A record to this server is ok', () => {
  assert.strictEqual(classifyResolution({ resolved: ['145.224.73.93'], serverIp: '145.224.73.93' }), 'ok');
});

test('Cloudflare-proxied domain is proxied, not wrong', () => {
  assert.strictEqual(classifyResolution({ resolved: ['104.21.45.67', '172.67.180.22'], serverIp: '145.224.73.93' }), 'proxied');
});

test('cloudflared tunnel CNAME is proxied even before A records are inspected', () => {
  assert.strictEqual(classifyResolution({ resolved: [], serverIp: '145.224.73.93', cnames: ['abc123.cfargotunnel.com'] }), 'proxied');
});

test('resolving to some other host is wrong; unknown server IP is unknown', () => {
  assert.strictEqual(classifyResolution({ resolved: ['1.2.3.4'], serverIp: '145.224.73.93' }), 'wrong');
  assert.strictEqual(classifyResolution({ resolved: ['1.2.3.4'], serverIp: null }), 'unknown');
});

test('mixed Cloudflare + foreign IPs is not treated as proxied', () => {
  assert.strictEqual(classifyResolution({ resolved: ['104.21.45.67', '1.2.3.4'], serverIp: '145.224.73.93' }), 'wrong');
});
