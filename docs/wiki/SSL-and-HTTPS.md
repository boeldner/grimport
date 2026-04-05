# SSL & HTTPS

## How it works

Grimport uses **Traefik v3** as the reverse proxy. Traefik handles Let's Encrypt certificate issuance and renewal automatically via the ACME HTTP-01 challenge. Certificates are stored in `./data/certs/acme.json` on the host.

## Enable SSL

**1. Set your ACME email in `.env`:**
```env
ACME_EMAIL=you@yourdomain.com
```

Or save it at runtime from **Settings → Server & DNS → HTTPS**.

**2. Uncomment the HTTPS labels in `docker-compose.yml`:**

Under the `supervisor` service, uncomment these 6 lines:
```yaml
- "traefik.http.routers.supervisor.rule=Host(`${SUPERVISOR_DOMAIN:-localhost}`)"
- "traefik.http.routers.supervisor.entrypoints=websecure"
- "traefik.http.routers.supervisor.tls.certresolver=letsencrypt"
- "traefik.http.routers.supervisor.service=supervisor"
- "traefik.http.middlewares.https-redirect.redirectscheme.scheme=https"
- "traefik.http.routers.supervisor-http.middlewares=https-redirect"
```

**3. Restart the stack:**
```bash
docker compose down && docker compose up -d
```

Traefik will obtain a certificate on the first HTTPS request to your domain. DNS must already point to your server.

## Per-site SSL

Enable SSL per site from the site settings (gear icon → SSL enabled). This adds a Traefik HTTPS router and requests a certificate for that site's domain. The domain must resolve to your server.

## Troubleshooting certificates

**Certificate not issued:**
- Check that `ACME_EMAIL` is set and valid
- Check that port 80 is open (required for HTTP-01 ACME challenge)
- Check Traefik logs: `docker compose logs traefik`
- Let's Encrypt has rate limits: 5 failures per hour per domain

**Certificate expired:**
- Traefik renews certificates automatically 30 days before expiry
- Check `./data/certs/acme.json` exists and is writable
- The file must not be empty and must be owned by root (chmod 600)

**Using Cloudflare proxy:**
- Don't enable Let's Encrypt behind Cloudflare proxy — Cloudflare handles SSL
- Set SSL/TLS mode to **Full** (not Full Strict) in the Cloudflare dashboard
- Leave Traefik HTTPS labels commented out

## HSTS

Set `NODE_ENV=production` in `.env` to enable HSTS headers (`Strict-Transport-Security`). Do this only after confirming HTTPS works — HSTS can lock you out of HTTP.
