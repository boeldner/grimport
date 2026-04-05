const crypto = require('crypto');

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

module.exports = { generateNginxConfig, generateHtpasswd };
