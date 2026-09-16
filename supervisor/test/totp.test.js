const test = require('node:test');
const assert = require('node:assert');
const {
  base32Encode, base32Decode, generateSecret, hotp, totp, verifyTotp, buildOtpauthUrl,
} = require('../src/totp');

// RFC 6238 Appendix B test vectors — HMAC-SHA1, 8-digit codes, 30s step,
// T0 = 0, secret = ASCII "12345678901234567890" (20 bytes). The RFC gives
// the raw key as bytes; our API takes a base32 secret and decodes it, so
// base32-encode the RFC's raw key once here.
const RFC_SECRET_SHA1 = base32Encode(Buffer.from('12345678901234567890', 'ascii'));

const RFC_VECTORS_SHA1_8DIGIT = [
  { seconds: 59,          code8: '94287082' },
  { seconds: 1111111109,  code8: '07081804' },
  { seconds: 1111111111,  code8: '14050471' },
  { seconds: 1234567890,  code8: '89005924' },
  { seconds: 2000000000,  code8: '69279037' },
  { seconds: 20000000000, code8: '65353130' },
];

test('base32 round-trips arbitrary byte buffers', () => {
  for (const input of [Buffer.from([]), Buffer.from([1]), Buffer.from('12345678901234567890', 'ascii'), Buffer.from(Array.from({ length: 20 }, (_, i) => i * 7 % 256))]) {
    const encoded = base32Encode(input);
    assert.ok(/^[A-Z2-7]*$/.test(encoded), `encoded output must be valid base32: ${encoded}`);
    assert.deepStrictEqual(base32Decode(encoded), input);
  }
});

test('RFC 6238 SHA1 test vectors — 8-digit codes at T0=0, 30s step', () => {
  for (const { seconds, code8 } of RFC_VECTORS_SHA1_8DIGIT) {
    const got = totp(RFC_SECRET_SHA1, { time: seconds * 1000, step: 30, digits: 8 });
    assert.strictEqual(got, code8, `T=${seconds}`);
  }
});

// 10^6 divides 10^8, so mod-10^6 truncation is exactly the last 6 digits of
// the (zero-padded) 8-digit RFC code — the same secret/time pairs above,
// reused at the app's real config (6 digits), rather than needing a second
// independently-sourced vector.
test('same secret/time pairs at the app default (6 digits, 30s step)', () => {
  for (const { seconds, code8 } of RFC_VECTORS_SHA1_8DIGIT) {
    const expected6 = code8.slice(-6);
    const got = totp(RFC_SECRET_SHA1, { time: seconds * 1000 });
    assert.strictEqual(got, expected6, `T=${seconds}`);
    assert.strictEqual(got.length, 6);
  }
});

test('hotp() matches totp() for the counter derived from time/step', () => {
  const counter = Math.floor(59 / 30); // = 1, matches the RFC's first vector
  assert.strictEqual(hotp(RFC_SECRET_SHA1, counter, 8), '94287082');
});

test('verifyTotp accepts the exact current code', () => {
  const { seconds, code8 } = RFC_VECTORS_SHA1_8DIGIT[0];
  assert.strictEqual(verifyTotp(RFC_SECRET_SHA1, code8.slice(-6), { time: seconds * 1000 }), true);
});

test('verifyTotp tolerates ±1 step of clock drift but not ±2', () => {
  const secret = generateSecret();
  const t0 = Date.parse('2026-01-01T00:00:00Z');
  const code = totp(secret, { time: t0 });

  assert.strictEqual(verifyTotp(secret, code, { time: t0 + 30_000 }), true, '+1 step (30s) must pass');
  assert.strictEqual(verifyTotp(secret, code, { time: t0 - 30_000 }), true, '-1 step must pass');
  assert.strictEqual(verifyTotp(secret, code, { time: t0 + 90_000 }), false, '+3 steps must fail');
  assert.strictEqual(verifyTotp(secret, code, { time: t0 + 61_000 }), false, '+2 steps must fail (outside window)');
});

test('verifyTotp rejects garbage input without throwing', () => {
  const secret = generateSecret();
  assert.strictEqual(verifyTotp(secret, 'abcdef', {}), false);
  assert.strictEqual(verifyTotp(secret, '123', {}), false);
  assert.strictEqual(verifyTotp(secret, undefined, {}), false);
  assert.strictEqual(verifyTotp(secret, null, {}), false);
});

test('generateSecret produces a fresh, valid base32 string each call', () => {
  const a = generateSecret();
  const b = generateSecret();
  assert.notStrictEqual(a, b);
  assert.ok(/^[A-Z2-7]+$/.test(a));
  assert.strictEqual(base32Decode(a).length, 20);
});

test('buildOtpauthUrl encodes issuer, label, and TOTP parameters', () => {
  const url = buildOtpauthUrl({ secret: 'JBSWY3DPEHPK3PXP', label: 'admin@localhost', issuer: 'Grimport' });
  assert.ok(url.startsWith('otpauth://totp/'));
  assert.match(url, /issuer=Grimport/);
  assert.match(url, /secret=JBSWY3DPEHPK3PXP/);
  assert.match(url, /digits=6/);
  assert.match(url, /period=30/);
  assert.match(url, /admin%40localhost/);
});
