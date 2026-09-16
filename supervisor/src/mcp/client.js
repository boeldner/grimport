/**
 * Minimal HTTP client for Grimport's own REST API, used by the MCP tools.
 *
 * The remote /mcp endpoint points it at the supervisor itself over loopback
 * (with the caller's Bearer token, so every authorization rule of the REST
 * API applies unchanged); the local stdio server (mcp/server.js) points it
 * at a panel URL. Uses node:http/https rather than fetch so the Host header
 * can be set explicitly (the catch-all middleware routes by Host).
 */
const http = require('http');
const https = require('https');
const crypto = require('crypto');

const DEFAULT_TIMEOUT_MS = 120_000;

function multipartBody(fieldName, filename, buffer, contentType = 'application/zip') {
  const boundary = `----grimport-${crypto.randomBytes(12).toString('hex')}`;
  const head = Buffer.from(
    `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${filename.replace(/"/g, '')}"\r\nContent-Type: ${contentType}\r\n\r\n`
  );
  const tail = Buffer.from(`\r\n--${boundary}--\r\n`);
  return { body: Buffer.concat([head, buffer, tail]), contentType: `multipart/form-data; boundary=${boundary}` };
}

/**
 * createClient({ baseUrl, token, hostHeader?, userAgent?, timeoutMs? })
 * Every method resolves with the parsed JSON body (or text for text/plain
 * responses) and rejects with an Error carrying `status` and `data` on 4xx/5xx.
 */
function createClient({ baseUrl, token, hostHeader, userAgent = 'grimport-mcp', timeoutMs = DEFAULT_TIMEOUT_MS }) {
  if (!baseUrl) throw new Error('baseUrl is required');
  if (!token) throw new Error('token is required');
  const base = new URL(baseUrl);

  function request(method, apiPath, { body, headers = {} } = {}) {
    return new Promise((resolve, reject) => {
      const url = new URL(`/api${apiPath}`, base);
      const mod = url.protocol === 'https:' ? https : http;
      const h = {
        Authorization: `Bearer ${token}`,
        'X-Requested-With': 'grimport',
        'User-Agent': userAgent,
        Accept: 'application/json, text/plain;q=0.9, */*;q=0.1',
        ...headers,
      };
      if (hostHeader) h.Host = hostHeader;
      let payload = null;
      if (Buffer.isBuffer(body)) payload = body;
      else if (body !== undefined && body !== null) {
        payload = Buffer.from(JSON.stringify(body));
        h['Content-Type'] = 'application/json';
      }
      if (payload) h['Content-Length'] = payload.length;

      const req = mod.request(url, { method, headers: h, timeout: timeoutMs }, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          const ct = String(res.headers['content-type'] || '');
          let data = text;
          if (ct.includes('application/json')) { try { data = JSON.parse(text); } catch { /* keep text */ } }
          if (res.statusCode >= 400) {
            const err = new Error((data && typeof data === 'object' && data.error) || `HTTP ${res.statusCode}`);
            err.status = res.statusCode;
            err.data = data;
            return reject(err);
          }
          resolve({ status: res.statusCode, data, headers: res.headers });
        });
      });
      req.on('timeout', () => req.destroy(new Error('Request to the panel timed out')));
      req.on('error', err => reject(new Error(`Cannot reach the panel at ${base.origin}: ${err.message}`)));
      if (payload) req.write(payload);
      req.end();
    });
  }

  return {
    baseUrl: base.origin,
    request,
    get: p => request('GET', p).then(r => r.data),
    post: (p, b) => request('POST', p, { body: b ?? {} }).then(r => r.data),
    put: (p, b) => request('PUT', p, { body: b ?? {} }).then(r => r.data),
    del: p => request('DELETE', p).then(r => r.data),
    /** Multipart upload of one file; resolves { status, ...json } so 202 (held for review) is visible. */
    upload: (p, buffer, filename = 'deploy.zip') => {
      const { body, contentType } = multipartBody('file', filename, buffer);
      return request('POST', p, { body, headers: { 'Content-Type': contentType } })
        .then(r => ({ status: r.status, ...(typeof r.data === 'object' && r.data ? r.data : { raw: r.data }) }));
    },
  };
}

module.exports = { createClient, multipartBody };
