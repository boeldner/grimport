# Contributing to Grimport

## How to contribute

1. Fork the repo and create a branch: `git checkout -b feat/my-thing`
2. Make your changes — keep PRs focused on one thing
3. Test manually with `docker compose up -d --build`, and run `cd supervisor && npm test` (Node 22 or newer)
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

## Definition of done

A feature or fix is not done until:

1. Wiki page or section updated (`docs/wiki/`), including the "why", not only the "how".
2. README: feature bullet and "What's new" line for the next version.
3. API reference entry for every new or changed route, with auth requirements.
4. Screenshot(s) regenerated from demo data and committed under `docs/screenshots/`.
5. CHANGELOG.md entry under "Unreleased".
6. Tests for backend behaviour; the auth matrix script extended for every new role/route pair.

## No secrets, no real data

Never commit `.env`, `data/`, tokens, real user names, real domains, or
screenshots of a live panel. Screenshots come only from the demo seed —
see "Screenshots" below.

Run `tools/setup-hooks.sh` once and install gitleaks (`brew install
gitleaks`) so the pre-commit hook scans staged changes before every
commit. CI runs gitleaks too, so a missed secret still fails the build.

## Screenshots

Screenshots are generated from fictional demo data only, never from a
live panel. See `supervisor/tools/README.md` for details. In short,
from `supervisor/`:

```bash
npm run demo-seed
npm run demo-serve
npm run screenshots
```
