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

## Default settings for new sites

In **Settings → General**, you can configure defaults applied to every newly created site:
- Default SPA mode (on/off)
- Default cache headers (on/off)

Existing sites are not affected when you change the defaults.
