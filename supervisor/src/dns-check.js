/**
 * DNS status classification for a site domain.
 *
 * Behind Cloudflare (orange-cloud proxy or a cloudflared tunnel) a domain
 * resolves to Cloudflare edge IPs, never to the server's own public IP. That
 * is a correct setup, so it must not be reported as "wrong". Cloudflare's
 * published IPv4 ranges (https://www.cloudflare.com/ips-v4) are stable enough
 * to ship inline; PUBLIC_IP / ipify is still used for the direct-A-record case.
 */

const CLOUDFLARE_V4 = [
  '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
  '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
  '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
  '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
];

function ipToInt(ip) {
  const parts = String(ip).split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    const v = Number(p);
    if (!Number.isInteger(v) || v < 0 || v > 255) return null;
    n = (n * 256) + v;
  }
  return n;
}

function inCidr(ip, cidr) {
  const [base, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipN = ipToInt(ip);
  const baseN = ipToInt(base);
  if (ipN === null || baseN === null) return false;
  if (bits === 0) return true;
  const mask = (0xffffffff << (32 - bits)) >>> 0;
  return ((ipN & mask) >>> 0) === ((baseN & mask) >>> 0);
}

function isCloudflareIp(ip) {
  return CLOUDFLARE_V4.some(c => inCidr(ip, c));
}

/**
 * classifyResolution({ resolved, serverIp, cnames })
 *   resolved  — array of A records the domain currently resolves to
 *   serverIp  — this server's public IP (null if unknown)
 *   cnames    — optional array of CNAME targets (tunnel setups point at *.cfargotunnel.com)
 * Returns: ok | proxied | wrong | unknown
 */
function classifyResolution({ resolved = [], serverIp = null, cnames = [] } = {}) {
  if (cnames.some(c => /\.cfargotunnel\.com\.?$/i.test(c))) return 'proxied';
  if (resolved.length && resolved.every(isCloudflareIp)) return 'proxied';
  if (!serverIp) return 'unknown';
  if (resolved.includes(serverIp)) return 'ok';
  return 'wrong';
}

module.exports = { classifyResolution, isCloudflareIp, inCidr, CLOUDFLARE_V4 };
