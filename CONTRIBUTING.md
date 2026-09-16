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

## Frontend

The panel UI follows one design system: Apple's Human Interface Guidelines
(macOS) for the visual language, W3C design tokens for structure, WCAG 2.2
AA for contrast and target size. Five stylesheets, loaded in this order,
each in its own cascade layer:

| File | Holds |
|---|---|
| `public/css/tokens.css` | every colour, type size, spacing step, radius, control height, shadow and z-layer, for light and dark |
| `public/css/base.css` | reset, typography, focus ring, scrollbars, motion |
| `public/css/layout.css` | app shell, sidebar, phone chrome, `.stack` / `.cluster` primitives |
| `public/css/components.css` | buttons, fields, segmented controls, tabs, cards, callouts, badges, status, tables, modals, menus, toasts, chips |
| `public/css/views.css` | the few view-specific pieces built from those components |

Rules:

- Build new UI from existing components. A new component goes into
  `components.css` once, with a comment showing its markup.
- Colours only as tokens. Literals live in `tokens.css` and nowhere else.
- Font sizes, font weights, spacing, radii and z-index come from the token
  scales. No in-between values.
- Controls read `--control-*`, so they grow to 44px on touch screens by
  themselves. Do not hard-code control heights.
- `--text-3` is for placeholders and disabled text only.
- No inline styles, except custom properties set from data
  (`style="--bar-h: 40%"`). Scripts toggle classes; they only set
  position and size directly.
- Primary action last (right-most) in any button row; destructive actions
  end with an ellipsis when they ask for confirmation.
- Icons are inline SVG. No emoji.

Two checks keep it that way:

- `npm test` runs `test/design-lint.test.js` (static rules above).
- `npm run ui-audit` (demo server running) opens every view, tab, modal
  and page at desktop, wide, phone and light-theme sizes and fails on
  overflow, stray scroll containers, clipped text, mismatched control
  heights, contrast below AA, touch targets under 44px on phones,
  overlapping controls and page errors. Run it before any UI change is
  merged; the budget is zero.

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
