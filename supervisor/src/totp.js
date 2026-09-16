/**
 * TOTP (RFC 6238) on top of HOTP (RFC 4226), HMAC-SHA1, 30s step, 6 digits,
 * base32 secrets — the standard Google-Authenticator-compatible flavor.
 * Pure node:crypto, no dependency.
 */
const crypto = require('crypto');

const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
const DEFAULT_STEP = 30;
const DEFAULT_DIGITS = 6;
const DEFAULT_WINDOW = 1; // ±1 step tolerance

function base32Encode(buf) {
  let bits = '';
  for (const byte of buf) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    output += BASE32_ALPHABET[parseInt(bits.substr(i, 5), 2)];
  }
  const rem = bits.length % 5;
  if (rem) {
    output += BASE32_ALPHABET[parseInt(bits.slice(-rem).padEnd(5, '0'), 2)];
  }
  return output;
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/[^A-Z2-7]/g, '');
  let bits = '';
  for (const char of clean) {
    const idx = BASE32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

/** Generates a random base32 secret (default 160 bits / 20 bytes, the RFC's recommended HMAC-SHA1 key size). */
function generateSecret(byteLength = 20) {
  return base32Encode(crypto.randomBytes(byteLength));
}

/** RFC 4226 HOTP: HMAC-SHA1 over an 8-byte big-endian counter, dynamic truncation. */
function hotp(secretBase32, counter, digits = DEFAULT_DIGITS) {
  const key = base32Decode(secretBase32);
  const counterBuf = Buffer.alloc(8);
  // Counter fits in 53-bit-safe range for any realistic use (30s steps for millennia).
  counterBuf.writeBigUInt64BE(BigInt(Math.trunc(counter)));
  const hmac = crypto.createHmac('sha1', key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const binCode = hmac.readUInt32BE(offset) & 0x7fffffff;
  const code = binCode % 10 ** digits;
  return String(code).padStart(digits, '0');
}

/** RFC 6238 TOTP: HOTP with counter = floor(unixSeconds / step). `time` is ms epoch (like Date.now()). */
function totp(secretBase32, { time = Date.now(), step = DEFAULT_STEP, digits = DEFAULT_DIGITS } = {}) {
  const counter = Math.floor(Math.floor(time / 1000) / step);
  return hotp(secretBase32, counter, digits);
}

/**
 * Verifies a submitted code against the secret, tolerating clock drift of
 * `window` steps on either side (default ±1, i.e. ±30s).
 */
function verifyTotp(secretBase32, code, { time = Date.now(), step = DEFAULT_STEP, digits = DEFAULT_DIGITS, window = DEFAULT_WINDOW } = {}) {
  const submitted = String(code ?? '').trim();
  if (!/^\d+$/.test(submitted) || submitted.length !== digits) return false;
  const counter = Math.floor(Math.floor(time / 1000) / step);
  for (let delta = -window; delta <= window; delta++) {
    if (hotp(secretBase32, counter + delta, digits) === submitted) return true;
  }
  return false;
}

/** Builds the otpauth:// URL used to seed authenticator apps (and the QR code rendered from it). */
function buildOtpauthUrl({ secret, label, issuer = 'Grimport', digits = DEFAULT_DIGITS, step = DEFAULT_STEP }) {
  const path = `${encodeURIComponent(issuer)}:${encodeURIComponent(label)}`;
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: 'SHA1',
    digits: String(digits),
    period: String(step),
  });
  return `otpauth://totp/${path}?${params.toString()}`;
}

module.exports = {
  base32Encode,
  base32Decode,
  generateSecret,
  hotp,
  totp,
  verifyTotp,
  buildOtpauthUrl,
  DEFAULT_STEP,
  DEFAULT_DIGITS,
  DEFAULT_WINDOW,
};
