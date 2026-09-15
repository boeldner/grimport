# Upgrading

## One-liner update

```bash
curl -fsSL https://raw.githubusercontent.com/boeldner/grimport/main/install.sh | bash -s -- --update
```

This pulls the latest code and image, then restarts the stack. Your `./data/` directory is never touched.

## Manual update

```bash
cd ~/grimport
git pull
docker compose pull
docker compose up -d
```

## Updating site containers

Every site runs in its own container started from a floating image tag (`nginx:alpine`, `php:8.3-apache`, `node:22-alpine`, `python:3.12-slim`). Updating the panel does **not** touch those containers, so over time they fall behind the images' security fixes.

**Settings → General → Updates → Site containers** shows each site, the image it runs from, and whether the container is older than the image currently on the server.

- **Pull latest images** fetches the current tags from the registry and re-compares.
- **Update outdated containers** pulls, then recreates every outdated container one at a time with identical settings (labels, mounts, env, commands). Each affected site is unreachable for about two seconds; the rest keep serving.
- A single site can be refreshed from its card: **⋯ → Update container**.

Via the API: `GET /api/update/images` (status), `POST /api/update/images/pull`, `POST /api/update/images/apply` (`{ "site_ids": [...], "force": true }` to recreate specific sites even if current), `GET /api/update/images/status` (progress), and `POST /api/sites/:id/recreate` for one site.

Traefik itself is pinned in `docker-compose.yml` (`traefik:v3.6`); bump it there and run `docker compose up -d`.

## Pinning a version

Set `GRIMPORT_IMAGE` in `.env` to use a specific release instead of `latest`:

```env
GRIMPORT_IMAGE=ghcr.io/boeldner/grimport:0.5.1
```

Find available tags at [ghcr.io/boeldner/grimport](https://github.com/boeldner/grimport/pkgs/container/grimport).

## Database migrations

Grimport applies SQLite migrations automatically on startup. You don't need to do anything — the database schema is updated in-place. No data is lost during upgrades.

## Rollback

If something goes wrong after an upgrade:

```bash
cd ~/grimport
git checkout v0.5.1   # or whichever version you came from
docker compose up -d --build
```

Or if using the pre-built image, set `GRIMPORT_IMAGE` to the previous version and restart.
