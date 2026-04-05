# Grimport

> Self-hosted static site publishing panel — deploy any static site in seconds via drag-and-drop or API.

[![Latest Release](https://img.shields.io/github/v/release/boeldner/grimport?style=flat-square&color=b91c1c)](https://github.com/boeldner/grimport/releases)
[![Docker Image](https://img.shields.io/badge/ghcr.io-grimport-b91c1c?style=flat-square&logo=docker&logoColor=white)](https://github.com/boeldner/grimport/pkgs/container/grimport)
[![License: MIT](https://img.shields.io/badge/license-MIT-gray?style=flat-square)](LICENSE)

![Grimport dashboard](docs/screenshot.png)

---

## What is Grimport?

Grimport manages static sites on your own server. Each site gets its own isolated **nginx:alpine** container. **Traefik** handles routing and SSL. You control everything through a clean web panel — no SSH, no config files, no YAML.

It's built for:
- Webflow exports, Astro, Next.js static output, plain HTML
- Teams deploying from CI/CD pipelines via API
- Anyone who wants a self-hosted Netlify/Vercel alternative

---

## Features

**Hosting**
- Container isolation — each site runs in its own `nginx:alpine` container (~10 MB)
- Wildcard subdomains — set a base domain, get auto-generated URLs instantly
- Per-site SPA mode, cache control headers, custom response headers
- Maintenance mode — take a site offline with one click, serves a custom page
- Basic auth — password-protect any site

**Deployment**
- Drag-and-drop `.zip` upload from the panel
- REST API with Bearer tokens — deploy from GitHub Actions, GitLab CI, scripts
- Deploy history — keeps last 5 deployments per site, one-click rollback
- Supports any zip layout: `dist/`, `build/`, `out/`, or flat root

**SSL**
- Automatic Let's Encrypt certificates via Traefik ACME
- Per-site SSL toggle — enable HTTPS with a checkbox
- Cloudflare proxy compatible — no Let's Encrypt needed behind CF

**Monitoring**
- Uptime checks every 60 seconds per site, stored for 30 days
- Activity log — deploy, rollback, start/stop, up/down events
- Container log viewer with tail output

**Panel**
- Auth-protected with bcrypt + session, rate-limited login
- API token management (create, revoke, audit last-used)
- Server & DNS guide — A record table, Cloudflare Tunnel setup
- Container reconciliation — recovers cleanly from daemon restarts

---

## Quick start

### One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/boeldner/grimport/main/install.sh | bash
```

The installer asks for your domain, password, and ACME email — then pulls the image and starts the stack. On completion it prints your panel URL and credentials.

**Update an existing install:**
```bash
curl -fsSL https://raw.githubusercontent.com/boeldner/grimport/main/install.sh | bash -s -- --update
```

### Manual setup

**Requirements:** Docker + Docker Compose v2, ports 80 + 443 open.

```bash
git clone https://github.com/boeldner/grimport
cd grimport
cp .env.example .env
# Edit .env with your domain, password, and ACME email
docker compose up -d
```

Open **http://localhost** (or your domain) — default password is in `.env` as `SUPERVISOR_SECRET`.

---

## Configuration

| Variable | Default | Description |
|---|---|---|
| `SUPERVISOR_DOMAIN` | `localhost` | Hostname for the panel |
| `SITE_BASE_DOMAIN` | _(empty)_ | Base domain for auto-generated site URLs, e.g. `sites.yourdomain.com` |
| `SUPERVISOR_SECRET` | `changeme` | Initial panel password — bcrypt-hashed on first run |
| `ACME_EMAIL` | _(empty)_ | Email for Let's Encrypt expiry notifications (required for SSL) |
| `HTTP_PORT` | `80` | Host port for HTTP |
| `HTTPS_PORT` | `443` | Host port for HTTPS |
| `NODE_ENV` | `development` | Set to `production` to enable HSTS and stricter headers |
| `GRIMPORT_IMAGE` | `ghcr.io/boeldner/grimport:latest` | Override to use a pinned release tag |

All settings can also be changed at runtime from **Settings → General**.

### Enable HTTPS

In `docker-compose.yml`, uncomment the 6 HTTPS label lines under the `supervisor` service. Then set `ACME_EMAIL` in `.env` and restart. Traefik obtains the cert automatically.

---

## Deploying a site

**From the panel:**
1. Click **+ New site**, enter a name and domain
2. Click **↑ Deploy** on the site card
3. Drop your `.zip` — Grimport extracts it and restarts the container
4. The site is live within seconds

**Via API (CI/CD):**
```bash
# Create a token in Settings → API Tokens
curl -X POST https://panel.yourdomain.com/api/deploy/SITE_ID \
  -H "Authorization: Bearer grim_yourtoken" \
  -F "file=@dist.zip"
```

**GitHub Actions example:**
```yaml
- name: Deploy to Grimport
  run: |
    curl -fsSL -X POST ${{ secrets.GRIMPORT_URL }}/api/deploy/${{ secrets.SITE_ID }} \
      -H "Authorization: Bearer ${{ secrets.GRIMPORT_TOKEN }}" \
      -F "file=@dist.zip"
```

---

## Architecture

```
[ Internet ]
     │
 [ Traefik v3 ]  ←── SSL termination, hostname routing, ACME
     │
 [ webhost-net (Docker bridge) ]
     │             │             │
 [site-a]      [site-b]      [site-c]   ←── nginx:alpine, one per site
                   │
          [ Grimport Supervisor ]  ←── Express API + GUI, Dockerode, SQLite
```

- **Traefik v3** — auto-discovers site containers via Docker labels, handles Let's Encrypt
- **Supervisor** — Node.js/Express backend, vanilla JS/CSS frontend, SQLite state
- **nginx:alpine** — ~10 MB per site, config generated per-site settings
- **SQLite** — zero-infrastructure state stored at `./data/supervisor.db`

---

## API reference

All endpoints require a session cookie (browser) or `Authorization: Bearer grim_…` header.

| Method | Path | Description |
|---|---|---|
| `GET` | `/api/sites` | List all sites |
| `POST` | `/api/sites` | Create a site |
| `PUT` | `/api/sites/:id` | Update site settings |
| `DELETE` | `/api/sites/:id` | Delete site + container |
| `POST` | `/api/sites/:id/start` | Start container |
| `POST` | `/api/sites/:id/stop` | Stop container |
| `POST` | `/api/deploy/:id` | Deploy a zip (multipart/form-data, field `file`) |
| `GET` | `/api/deploy/:id/history` | List deploy history |
| `POST` | `/api/deploy/:id/rollback/:deploymentId` | Roll back to a previous deploy |
| `GET` | `/api/uptime/:id` | Uptime checks for one site (`?period=24h\|7d\|30d`) |
| `GET` | `/api/activity` | Activity log (`?limit=&site_id=`) |
| `GET` | `/api/settings/tokens` | List API tokens |
| `POST` | `/api/settings/tokens` | Create API token |
| `DELETE` | `/api/settings/tokens/:id` | Revoke API token |

---

## Integrations

Grimport is designed to be the deployment target. Pair it with:

| Tool | How |
|---|---|
| **GitHub Actions** | Use API tokens to deploy on push — see example above |
| **GitLab CI** | Same — `curl` with Bearer token in CI variables |
| **Webflow** | Export site → zip → deploy via panel or API |
| **Astro / Next.js / Vite** | `npm run build` → zip `dist/` → deploy |
| **Cloudflare** | Use as proxy (CDN + DDoS) or Tunnel (no open ports) |

---

## Development

```bash
# Backend with hot reload
cd supervisor && npm install && node --watch src/index.js

# Full stack
docker compose up -d --build supervisor
```

Frontend is vanilla JS/CSS — edit `supervisor/public/` and hard-refresh.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

---

## License

MIT — see [LICENSE](LICENSE)
