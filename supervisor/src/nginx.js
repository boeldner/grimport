const crypto = require('crypto');

function generate404Html(domain) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>404 — Not Found</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0d0d0f;color:#e4e2de;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;-webkit-font-smoothing:antialiased}
.box{text-align:center;padding:40px 24px;max-width:400px}
.code{font-size:88px;font-weight:800;letter-spacing:-0.05em;line-height:1;color:#1c1c21;margin-bottom:16px}
h1{font-size:20px;font-weight:600;letter-spacing:-0.02em;margin-bottom:6px}
p{color:#6b6b78;font-size:14px;line-height:1.6;margin-bottom:28px}
a{display:inline-flex;align-items:center;gap:6px;color:#e4e2de;text-decoration:none;font-size:13px;font-weight:500;border:1px solid #262629;padding:8px 16px;border-radius:7px;transition:border-color .15s,background .15s}
a:hover{border-color:#36363c;background:rgba(255,255,255,.04)}
</style>
</head>
<body>
<div class="box">
  <div class="code">404</div>
  <h1>Page not found</h1>
  <p>The page you're looking for doesn't exist or has been moved.</p>
  <a href="/">&#8592; Go home</a>
</div>
</body>
</html>
`;

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
      return headers.map(h => `  add_header ${h.name} "${h.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`).join('\n');
    } catch {
      return '';
    }
  })();

  const redirects = (() => {
    try {
      const rules = JSON.parse(site.redirects || '[]');
      return rules.map(r => `  rewrite ^${r.from}$ ${r.to} ${r.permanent ? 'permanent' : 'redirect'};`).join('\n');
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

  return `server {
  listen 80;
  server_name ${site.domain};
  root ${root};
  index index.html;
${authBlock}
${customHeaders}
${redirects}
${snippetBlock}

  error_page 404 @notfound;
  location @notfound {
    root /usr/share/nginx/html;
    rewrite ^ /404.html break;
  }

  location / {
    ${spaFallback}
  }
${cacheBlock}

  # Health check endpoint used by supervisor
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

module.exports = { generateNginxConfig, generateHtpasswd, generate404Html };
