# Configuration

Grimport is configured via environment variables in `.env` and runtime settings in the panel.

## Environment variables

Copy `.env.example` to `.env` and edit before starting.

| Variable | Default | Description |
|---|---|---|
| `SUPERVISOR_DOMAIN` | `localhost` | Hostname for the panel, e.g. `panel.yourdomain.com` |
| `SITE_BASE_DOMAIN` | _(empty)_ | Base domain for auto-generated site URLs, e.g. `sites.yourdomain.com` |
| `SUPERVISOR_SECRET` | `changeme` | Initial panel password — bcrypt-hashed on first run, changing it later requires using the panel's Change Password form |
| `SESSION_SECURE` | _(empty / off)_ | Opt-in. Set to `true` to mark the session cookie `Secure`. See note below. |
| `ACME_EMAIL` | _(empty)_ | Email for Let's Encrypt expiry notifications — required for automatic SSL |
| `PUBLIC_IP` | _(empty)_ | Your server's public IP — auto-detected if blank |
| `HOST_DATA_PATH` | _(empty)_ | Absolute host path to the data/sites directory — only needed under Portainer/Arcane |
| `HTTP_PORT` | `80` | Host port mapped to port 80 inside Traefik |
| `HTTPS_PORT` | `443` | Host port mapped to port 443 inside Traefik |
| `NODE_ENV` | `development` | Set to `production` to enable HSTS and stricter headers |
| `GRIMPORT_IMAGE` | `ghcr.io/boeldner/grimport:latest` | Override to pin a specific release, e.g. `ghcr.io/boeldner/grimport:0.9.5` |

### `SESSION_SECURE` is opt-in

Most deployments terminate TLS at a proxy (Cloudflare Tunnel, Traefik) and forward plain HTTP to the supervisor. If the `Secure` cookie flag were on by default, the browser would silently drop the session cookie over that internal HTTP hop and login would appear to fail with no clear error. For that reason `SESSION_SECURE` defaults to **off**. Only set it to `true` if the supervisor itself is reached directly over HTTPS, or your proxy is configured to send `X-Forwarded-Proto: https` and you've verified sessions still work after enabling it.

## Panel settings

Most configuration is also available at runtime from the **Settings** page without a restart:

### General tab
- **Panel name** — shown in the browser tab and sidebar
- **Site base domain** — wildcard base domain for auto-generated site URLs
- **Default SPA mode** — applied to new sites automatically
- **Default cache headers** — applied to new sites automatically

### Server & DNS tab
- Displays your server's public IP and auto-generates the correct A records
- HTTPS / ACME email — save your Let's Encrypt email here
- Cloudflare Tunnel setup guide

### API Tokens tab
- Create named tokens for CI/CD pipelines
- Each token is shown once on creation — copy it immediately
- Tokens can be revoked at any time

### Security tab
- Change the panel password

## Per-site settings

Each site has its own settings accessible from the site card (gear icon):

| Setting | Description |
|---|---|
| **Domain** | Custom hostname for the site |
| **SPA mode** | Returns `index.html` for all 404s (required for React Router, Vue Router, etc.) |
| **Cache headers** | Enables `Cache-Control: public, max-age=86400` for static assets |
| **Maintenance mode** | Serves a maintenance page instead of the site |
| **SSL enabled** | Enables HTTPS router + Let's Encrypt cert for this domain |
| **Basic auth** | Password-protect the site with HTTP Basic Auth |
| **Custom headers** | Add arbitrary response headers (one `Header: Value` per line) |
