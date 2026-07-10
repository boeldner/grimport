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

module.exports = { isValidHostname, sanitizeHeaderName, sanitizeRedirectField };
