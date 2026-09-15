# Screenshot tools

Generates panel screenshots for the README and wiki from a local demo
instance. Never point these at a real/production panel.

## Scripts (run from `supervisor/`)

- `npm run demo-seed` — creates `supervisor/.demo/sites` and
  `supervisor/.demo/supervisor.db`, then seeds fictional demo data (sites,
  deployments, activity, notifications, a webhook, API tokens, extra users,
  uptime history). Safe to re-run.
- `npm run demo-serve` — starts the supervisor against that demo database on
  `http://localhost:3000` (username `admin`, password `changeme`).
- `npm run screenshots` — logs into the running demo instance with
  [puppeteer-core](https://www.npmjs.com/package/puppeteer-core) and a local
  Chrome/Chromium binary, and screenshots each view/modal in both themes.

Typical flow:

```sh
npm run demo-seed
npm run demo-serve &          # leave running in another terminal
npm run screenshots
```

## What the demo seed contains

Five fictional sites (`Bakery landing`, `Board-game club`, `Weather API`,
`Sourdough diary`, `Reading list`) covering static/node/php/python runtimes,
SPA mode, maintenance mode, basic auth, SSL, and a PHP preview deployment;
sample deployments, activity log entries, notifications (a site-down alert
and an unknown-domain hit), a webhook, two scoped/unscoped API tokens, an
`editor` and a `viewer` user, and 48 uptime checks each for two sites. All
names and domains (`*.demo.test`) are fictional — none of this touches a
real site or a real domain.

## `screenshots.js`

```
node tools/screenshots.js [--out DIR] [--themes dark,light] [--only name,name] [--all]
```

- With no flags: shoots the curated default set used by the README and wiki,
  into `docs/screenshots/`.
- `--all`: shoots every view and modal the harness knows about, into
  `docs/screenshots/all/` (gitignored — for local review only, not committed).
- `--only sites,login`: shoots just the named views/modals.
- `--out DIR`: writes elsewhere instead of the defaults above.
- `--themes dark,light`: restrict to one theme.

Files are named `<name>__<theme>.png`.

Env vars: `CHROME` (browser binary, auto-detected otherwise), `GRIMPORT_URL`
(default `http://localhost:3000` — refuses any other host unless `--i-know`
is passed), `GRIMPORT_USER` / `GRIMPORT_PASS` (default `admin` / `changeme`).

## Localhost-only rule

The panel screenshotted here always contains demo/fictional data, so the
script refuses to run against anything but `localhost`/`127.0.0.1` unless
you explicitly pass `--i-know`. Do not use that flag against a real,
publicly reachable panel.

## What gets committed

Only the curated default set in `docs/screenshots/` (used by the README and
the wiki) is committed. `docs/screenshots/all/` and `supervisor/.demo/` are
gitignored, local-only output for reviewing changes before curating.

## `make-icons.js`

```
node tools/make-icons.js
```

Generates the PWA/home-screen icons from the Grim Mage logo (the same SVG
paths used in `public/index.html`'s `.logo`) and writes them straight into
`public/icons/`: `icon-192.png`, `icon-512.png`, `icon-512-maskable.png`
(logo scaled to the central 60% so it survives OS masking, no rounded
corners), and `apple-touch-icon.png` (180×180 — iOS rounds it itself). No
npm dependencies: it draws a temporary HTML tile (dark gradient background,
violet logo) and rasterizes it with the same headless-Chrome binary
`screenshots.js` uses.

Env vars: `CHROME` (browser binary; default is the Puppeteer-cached
chrome-headless-shell under `~/.cache/puppeteer`).

The output PNGs are small and committed to the repo — re-run and commit the
new files whenever the logo changes.
