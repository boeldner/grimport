# Deploying Sites

## Creating a site

1. Click **+ New site** in the panel
2. Enter a **name** (internal label) and **domain** (the hostname the site will be served on)
3. The site container is created and starts immediately, serving a default placeholder page

## Deploying via the panel

1. Click **↑ Deploy** on the site card
2. Drag a `.zip` onto the upload area, or click to browse
3. The progress bar shows upload status
4. When complete, the container restarts and the site is live

## Zip format

Grimport accepts any zip. Supported layouts:

**Flat root** (most common):
```
index.html
styles.css
app.js
images/logo.png
```

**Single subfolder** (e.g. Vite, Astro, Next.js output):
```
dist/
  index.html
  _astro/
    app.js
```
Grimport detects the single-subfolder pattern and automatically extracts the contents one level up.

**Webflow export:**
Webflow zips are flat root — export directly and deploy without modification.

## Limits

Every zip is checked before the live directory is touched (see [Security Model](Security-Model) for the reasoning):

- Upload size up to 250 MB; at most 20 000 entries (`DEPLOY_MAX_ENTRIES`); at most 1024 MB uncompressed (`DEPLOY_MAX_TOTAL_MB`); no single file above 250 MB (`DEPLOY_MAX_FILE_MB`).
- Symlinks and paths that would escape the site directory are rejected.
- A site may use 2048 MB on disk in total, counting the current files, the deploy history and the new upload (`SITE_DISK_QUOTA_MB`). Old deployments are pruned automatically (last 5 are kept); delete the site's history or ask an admin to raise the quota if you hit it.
- 30 deploys, URL deploys or rollbacks per 10 minutes per user (`DEPLOY_RATE_LIMIT`).

A rejected deploy returns HTTP 413 with the limit that was hit, or 429 when the rate limit applies. The live site is never touched by a rejected deploy.

## Site settings

Access per-site settings with the gear icon on the site card.

### SPA mode
Routes all requests through `index.html` — required for React Router, Vue Router, Svelte Kit in SPA mode, etc. Without this, direct links to sub-routes return 404.

### Cache headers
Adds `Cache-Control: public, max-age=86400` to responses for `.js`, `.css`, `.woff2`, and image files. Improves load time on repeat visits.

### Maintenance mode
Serves a static maintenance page instead of the live site. The maintenance page lives at `./data/sites/<id>/maintenance/index.html`. You can replace it with your own branded page.

### SSL enabled
Adds a Traefik HTTPS router for this domain and requests a Let's Encrypt certificate. Requires `ACME_EMAIL` to be set and the domain to resolve to your server.

### Basic auth
Password-protects the entire site with HTTP Basic Auth. The username and password are set per-site. Passwords are stored as bcrypt hashes.

### Custom response headers
Add arbitrary headers to all responses from this site. One `Header: Value` per line. Examples:
```
X-Frame-Options: SAMEORIGIN
Content-Security-Policy: default-src 'self'
```

## Starter templates

For static sites, the New site modal (and a site's overflow menu →
**Apply template…**) offer three self-contained starter templates — no
build step, no external requests:

- **blank** — a friendly "It works" placeholder page with the site name.
- **one-page** — a hero, three feature blocks, and a contact section.
- **portfolio** — a header, a project grid (six placeholder cards) and an
  about section.

Applying a template writes `index.html` and `style.css` into the site's
`html/` directory, replacing only those two files — anything else already
deployed there (images, other pages) is left alone. `{{SITE_NAME}}` and
`{{SITE_DOMAIN}}` placeholders in the template are filled in with the
site's own name and domain. Each template is tasteful and light (system
font stack, one accent colour) and adapts to the visitor's light/dark
system theme automatically.

Applying a template overwrites the current `index.html`/`style.css` — the
panel asks for confirmation before doing so on an existing site.

## Default settings for new sites

In **Settings → General**, you can configure defaults applied to every newly created site:
- Default SPA mode (on/off)
- Default cache headers (on/off)

Existing sites are not affected when you change the defaults.
