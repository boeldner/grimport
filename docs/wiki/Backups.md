# Backups

All Grimport data lives in `./data/` relative to the install directory.

```
data/
├── sites/
│   └── <site-id>/
│       ├── html/           ← live site files
│       ├── history/        ← last 5 deploy zips
│       ├── maintenance/    ← maintenance page
│       ├── nginx.conf      ← generated nginx config
│       └── .htpasswd       ← basic auth credentials
├── certs/
│   └── acme.json           ← Let's Encrypt certificates
└── supervisor.db           ← SQLite database (sites, settings, tokens, uptime)
```

## Backing up

The simplest approach is to stop the stack, copy `./data/`, and restart:

```bash
cd ~/grimport
docker compose down
tar -czf grimport-backup-$(date +%Y%m%d).tar.gz data/
docker compose up -d
```

Or back up while running (safe for `data/sites/` and `data/certs/`, but use SQLite's backup API for the database to avoid corruption):

```bash
# Safe database backup while running
docker exec webhost-supervisor sqlite3 /data/supervisor.db ".backup '/data/supervisor.db.bak'"
```

## Restoring

```bash
cd ~/grimport
docker compose down
# Replace data/ with your backup
rm -rf data/
tar -xzf grimport-backup-20260401.tar.gz
docker compose up -d
```

After restore, Grimport will reconcile containers — it will recreate any site containers that exist in the database but not in Docker.

## What to back up regularly

- `data/supervisor.db` — all site config, settings, API tokens, uptime history
- `data/sites/*/html/` — live site files (only needed if you can't redeploy from source)
- `data/certs/acme.json` — only if you want to avoid re-issuing certificates (not critical, they auto-renew)

## Automating with cron

```bash
# Daily backup at 3am, keep 7 days
0 3 * * * cd ~/grimport && \
  docker exec webhost-supervisor sqlite3 /data/supervisor.db ".backup '/data/supervisor.db.bak'" && \
  tar -czf ~/backups/grimport-$(date +\%Y\%m\%d).tar.gz data/ && \
  find ~/backups/grimport-*.tar.gz -mtime +7 -delete
```
