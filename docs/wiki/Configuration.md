# Configuration

Grimport is configured via environment variables in `.env` and runtime settings in the panel.

## Environment variables

Copy `.env.example` to `.env` and edit before starting.

| Variable | Default | Description |
|---|---|---|
| `SUPERVISOR_DOMAIN` | `localhost` | Hostname for the panel, e.g. `panel.yourdomain.com` |
| `SITE_BASE_DOMAIN` | _(empty)_ | Base domain for auto-generated site URLs, e.g. `sites.yourdomain.com` |
| `SUPERVISOR_SECRET` | `changeme` | Initial panel password — bcrypt-hashed on first run, changing it later requires using the panel's Change Password form |
| `ACME_EMAIL` | _(empty)_ | Email for Let's Encrypt expiry notifications — required for automatic SSL |
| `HTTP_PORT` | `80` | Host port mapped to port 80 inside Traefik |
| `HTTPS_PORT` | `443` | Host port mapped to port 443 inside Traefik |
| `NODE_ENV` | `development` | Set to `production` to enable HSTS and stricter headers |
| `GRIMPORT_IMAGE` | `ghcr.io/boeldner/grimport:latest` | Override to pin a specific release, e.g. `ghcr.io/boeldner/grimport:0.5.1` |

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
