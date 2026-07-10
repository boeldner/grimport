const dns = require('node:dns').promises;
const net = require('node:net');

const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

function isValidHostname(s) {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > 253) return false;
  return HOSTNAME_RE.test(s);
}

function sanitizeHeaderName(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9-]+$/.test(s)) {
    throw new Error(`Invalid header name: ${JSON.stringify(s)}`);
  }
  return s;
}

function sanitizeRedirectField(s) {
  if (typeof s !== 'string' || /[\n\r;{}]/.test(s)) {
    throw new Error(`Invalid redirect value: ${JSON.stringify(s)}`);
  }
  return s;
}

function ipToLong(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inRange(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

const V4_PRIVATE = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15',
  '192.0.2.0/24', '198.51.100.0/24', '203.0.113.0/24', // TEST-NET-1/2/3
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved
  '255.255.255.255/32']; // broadcast

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return V4_PRIVATE.some(c => inRange(ip, c));
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // fc00::/7 ULA
    // fe80::/10 link-local spans first hextet fe80..febf. Pragmatic prefix match
    // that stays robust to compressed forms (e.g. "fe95::1") without parsing groups.
    if (low.startsWith('fe8') || low.startsWith('fe9') ||
        low.startsWith('fea') || low.startsWith('feb')) return true;
    if (low.startsWith('::ffff:')) return isPrivateAddress(low.slice(7)); // v4-mapped
    return false;
  }
  return true; // unknown format → treat as unsafe
}

async function assertPublicUrl(urlString) {
  let url;
  try { url = new URL(urlString); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const results = await dns.lookup(url.hostname, { all: true });
  if (results.length === 0) throw new Error('URL host did not resolve');
  for (const r of results) {
    if (isPrivateAddress(r.address)) {
      throw new Error('URL resolves to a private or reserved address');
    }
  }
  return { url, address: results[0].address };
}

module.exports = { isValidHostname, sanitizeHeaderName, sanitizeRedirectField, assertPublicUrl, isPrivateAddress };
