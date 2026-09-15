const crypto = require('crypto');
const { sanitizeHeaderName, sanitizeRedirectField } = require('./validate');

const ERROR_PAGES = {
  400: { title: 'Bad Request',            desc: 'The server could not understand this request.' },
  401: { title: 'Unauthorized',           desc: 'Authentication is required to access this resource.' },
  403: { title: 'Forbidden',              desc: "You don't have permission to access this resource." },
  404: { title: 'Not Found',              desc: "The page you're looking for doesn't exist or has been moved." },
  405: { title: 'Method Not Allowed',     desc: 'This request method is not supported here.' },
  408: { title: 'Request Timeout',        desc: 'The server timed out waiting for the request.' },
  410: { title: 'Gone',                   desc: 'This resource has been permanently removed.' },
  429: { title: 'Too Many Requests',      desc: "You've sent too many requests. Please wait a moment." },
  500: { title: 'Server Error',           desc: 'Something went wrong on the server.' },
  502: { title: 'Bad Gateway',            desc: 'The server received an invalid response from an upstream server.' },
  503: { title: 'Service Unavailable',    desc: 'The service is temporarily unavailable. Try again shortly.' },
  504: { title: 'Gateway Timeout',        desc: "The server didn't receive a timely response from an upstream server." },
};

function generateErrorHtml(code, title, desc) {
  const showHome = code < 500;
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${code} ${title}</title>
<style>
:root{color-scheme:light dark}
*{box-sizing:border-box;margin:0;padding:0}
body{
  font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',system-ui,sans-serif;
  min-height:100vh;
  display:flex;align-items:center;justify-content:center;
  padding:40px 24px;
  -webkit-font-smoothing:antialiased;
}
@media(prefers-color-scheme:dark){
  body{background:#111113;color:#e2e2e5}
  .num{color:#1e1e22}
  .rule{background:#2a2a2e}
  .desc{color:#6b6b78}
  a{color:#e2e2e5;border-color:#2a2a2e}
  a:hover{background:rgba(255,255,255,.05);border-color:#3a3a40}
}
@media(prefers-color-scheme:light){
  body{background:#f5f5f7;color:#1d1d1f}
  .num{color:#dddde0}
  .rule{background:#d8d8dc}
  .desc{color:#6e6e73}
  a{color:#1d1d1f;border-color:#d8d8dc}
  a:hover{background:rgba(0,0,0,.04);border-color:#b8b8be}
}
.wrap{max-width:440px;width:100%}
.num{font-size:80px;font-weight:800;letter-spacing:-0.05em;line-height:1;margin-bottom:14px;user-select:none}
h1{font-size:22px;font-weight:600;letter-spacing:-0.02em;margin-bottom:10px}
.rule{height:1px;margin:14px 0}
.desc{font-size:14px;line-height:1.65;margin-bottom:24px}
a{
  display:inline-flex;align-items:center;gap:5px;
  text-decoration:none;font-size:13px;font-weight:500;
  border:1px solid;border-radius:7px;
  padding:7px 14px;
  transition:background .12s,border-color .12s;
}
</style>
</head>
<body>
<div class="wrap">
  <div class="num">${code}</div>
  <h1>${title}</h1>
  <div class="rule"></div>
  <p class="desc">${desc}</p>
  ${showHome ? '<a href="/">&#8592; Back to home</a>' : ''}
</div>
</body>
</html>
`;
}

/**
 * Generate an htpasswd line using nginx-compatible {SHA} hashing.
 */
function generateHtpasswd(username, password) {
  const hash = '{SHA}' + crypto.createHash('sha1').update(password).digest('base64');
  return `${username}:${hash}\n`;
}

/**
 * Generates an nginx config for a site container based on its settings.
 * Written to disk and bind-mounted into the nginx:alpine container.
 */
function generateNginxConfig(site) {
  const spaFallback = site.spa_mode
    ? 'try_files $uri $uri/ /index.html;'
    : 'try_files $uri $uri/ =404;';

  const cacheBlock = site.cache_enabled
    ? `
  # Cache static assets
  location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
    try_files $uri =404;
  }`
    : '';

  const authBlock = site.basic_auth
    ? `
  auth_basic "Restricted";
  auth_basic_user_file /etc/nginx/.htpasswd;`
    : '';

  const customHeaders = (() => {
    try {
      const headers = JSON.parse(site.custom_headers || '[]');
      return headers.map(h => `  add_header ${sanitizeHeaderName(h.name)} "${h.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`).join('\n');
    } catch {
      return '';
    }
  })();

  const redirects = (() => {
    try {
      const rules = JSON.parse(site.redirects || '[]');
      return rules.map(r => `  rewrite ^${sanitizeRedirectField(r.from)}$ ${sanitizeRedirectField(r.to)} ${r.permanent ? 'permanent' : 'redirect'};`).join('\n');
    } catch {
      return '';
    }
  })();

  // Maintenance mode swaps root to /maintenance
  const root = site.maintenance_mode
    ? '/usr/share/nginx/maintenance'
    : '/usr/share/nginx/html';

  // Analytics snippet injection (Plausible, Umami, custom)
  const snippetRaw = site.analytics_snippet || '';
  const snippetBlock = snippetRaw
    ? `
  sub_filter '</body>' '${snippetRaw.replace(/\\/g, '\\\\').replace(/'/g, "\\'")} </body>';
  sub_filter_once on;
  sub_filter_types text/html;`
    : '';

  const errorCodes = Object.keys(ERROR_PAGES).join(' ');

  return `server {
  listen 8080;
  server_name ${site.domain};
  root ${root};
  index index.html;
${authBlock}
${customHeaders}
${redirects}
${snippetBlock}

  error_page ${errorCodes} @errorpage;
  location @errorpage {
    root /usr/share/nginx/html;
    rewrite ^ /$status.html break;
  }

  location / {
    ${spaFallback}
  }
${cacheBlock}

  location /__health {
    access_log off;
    return 200 "ok";
    add_header Content-Type text/plain;
  }

  gzip on;
  gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
}
`;
}

module.exports = { generateNginxConfig, generateHtpasswd, generateErrorHtml, ERROR_PAGES };
