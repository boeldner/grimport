# Contributing to Grimport

## How to contribute

1. Fork the repo and create a branch: `git checkout -b feat/my-thing`
2. Make your changes — keep PRs focused on one thing
3. Test manually with `docker compose up -d --build`
4. Open a pull request against `main`

## Project structure

```
grimport/
├── supervisor/
│   ├── src/
│   │   ├── index.js          # Express app entry
│   │   ├── auth.js           # Session + Bearer token middleware
│   │   ├── db.js             # SQLite schema + migrations
│   │   ├── docker.js         # Dockerode helpers (create, start, stop…)
│   │   ├── nginx.js          # nginx config generator
│   │   ├── uptime.js         # Background uptime check job
│   │   ├── reconcile.js      # Container reconciliation on startup
│   │   └── routes/           # Express route handlers
│   └── public/               # Vanilla JS/CSS frontend
│       ├── index.html
│       ├── app.js
│       ├── style.css
│       └── login.html
├── traefik/
│   └── traefik.yml           # Traefik static config
├── docker-compose.yml
├── install.sh                # One-liner installer
└── data/                     # Runtime data (gitignored)
    ├── sites/                # Per-site html, nginx config, deploy history
    ├── certs/                # Traefik ACME certs
    └── supervisor.db         # SQLite database
```

## Guidelines

- **No new dependencies** without a good reason — the backend is intentionally lean
- **No build step** — frontend is vanilla JS/CSS, no bundler
- **Keep the API stable** — existing tokens and integrations should not break
- **Security-sensitive changes** (auth, file handling) need extra care

## Local dev setup

```bash
git clone https://github.com/boeldner/grimport
cd grimport
cp .env.example .env
# Start Traefik only (so supervisor can connect)
docker compose up -d traefik
# Run supervisor with hot reload
cd supervisor && npm install && node --watch src/index.js
```

The panel is then available at `http://localhost:3000` directly (no Traefik routing).

## Reporting issues

Open an issue on GitHub. Include:
- Grimport version (`/api/health` or the panel footer)
- Docker + OS version
- Relevant logs (`docker compose logs supervisor`)
