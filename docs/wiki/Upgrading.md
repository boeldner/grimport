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
