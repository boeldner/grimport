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

Open your panel domain in a browser. Log in with the password you set in `.env` as `SUPERVISOR_SECRET`. On a fresh install, the admin account sees a short onboarding wizard covering the essentials (base domain, first site) — it only appears once, and only until you've set a base domain and changed the default password.

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

## For invited members

If you were sent an invite link rather than installing the panel yourself,
the flow is shorter: pick a username and password, and you land straight in
a three-step wizard.

1. **Your address** — every site you create gets `<name>.<base>` automatically;
   no DNS record to add. It also shows your site quota and which runtimes
   (static, PHP, Node, Python) your account can use.
2. **Your first site** — name it and optionally pick a starter template
   (blank, one-page, or portfolio — see [Starter templates](Deploying-Sites#starter-templates)).
   Create sends you straight to a live URL.
3. **When something breaks** — points at the three places to look: the
   status label on the site card, Logs, and the notification bell.

Any step can be skipped; skipping (or finishing) never shows the wizard
again on that browser. Every field in the panel that has a small "?" icon
links straight to the relevant wiki page — and the **Help** entry at the
bottom of the sidebar opens a short curated list of pages plus a link to
report a problem.

## Next steps

- [Configure DNS records](DNS-and-Networking)
- [Set up SSL](SSL-and-HTTPS)
- [Deploy from CI/CD](CICD-Integration)
