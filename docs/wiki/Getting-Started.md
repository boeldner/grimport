# Getting Started

Grimport is up in under 5 minutes.

## Requirements

- A Linux server (Hetzner, DigitalOcean, any VPS)
- Docker 20+ and Docker Compose v2
- Ports 80 and 443 open in your firewall
- A domain name pointing to your server

## Option A — One-liner installer (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/boeldner/grimport/main/install.sh | bash
```

The interactive installer will ask you for:
- **Install directory** (default: `~/grimport`)
- **Panel domain** — e.g. `panel.yourdomain.com`
- **Site base domain** — e.g. `sites.yourdomain.com` (for auto-generated URLs; leave blank to use custom domains only)
- **Password** — leave blank to auto-generate a secure one
- **ACME email** — your email for Let's Encrypt (leave blank for local HTTP-only dev)

It then pulls the Docker image, starts the stack, and prints your panel URL + credentials.

## Option B — Manual

```bash
git clone https://github.com/boeldner/grimport
cd grimport
cp .env.example .env
nano .env   # set SUPERVISOR_DOMAIN, SUPERVISOR_SECRET, ACME_EMAIL
docker compose up -d
```

## First login

Open your panel domain in a browser. Log in with the password you set in `.env` as `SUPERVISOR_SECRET`.

## Deploy your first site

1. Click **+ New site**
2. Enter a name and domain
3. Click **↑ Deploy** on the site card
4. Drop a `.zip` of your static site (Webflow export, `dist/`, `build/`, or plain HTML)
5. The site is live within a few seconds

## Enable HTTPS

Set `ACME_EMAIL` in `.env`, then in `docker-compose.yml` uncomment the 6 HTTPS label lines under the `supervisor` service. Restart:

```bash
docker compose down && docker compose up -d
```

Traefik will obtain a Let's Encrypt certificate automatically on first request.

## Next steps

- [Configure DNS records](DNS-and-Networking)
- [Set up SSL](SSL-and-HTTPS)
- [Deploy from CI/CD](CICD-Integration)
