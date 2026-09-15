# API Reference

## Authentication

Every `/api/*` route (except login) requires one of:
- **Session cookie** — set automatically after logging in via the browser
- **Bearer token** — `Authorization: Bearer grim_<token>` header

Create tokens in **Settings → API Tokens**. Tokens carry their own role (admin / editor / viewer) and can optionally be scoped to a set of sites and given an expiry date — see [Tokens](#tokens) below.

## Roles

- **admin** — full access to everything, including users, tokens, webhooks, backups, settings, and self-update
- **editor** — can deploy, roll back, start/stop, and edit sites they have access to; no admin-only routes
- **viewer** — read-only access to sites they have access to

Admins see and act on all sites. Editors/viewers are scoped to sites explicitly granted via **site access** (`site_permissions`). A scoped API token narrows this further — it can never widen access beyond what its role already allows.

## Base URL

`https://panel.yourdomain.com/api`

---

## Auth

### Login
```
POST /auth/login
Content-Type: application/json

{ "username": "admin", "password": "..." }
```
Rate-limited to 10 attempts / 15 minutes per IP. Sets a session cookie on success.

### Logout
```
POST /auth/logout
```

### Current session
```
GET /auth/me
```
Returns `{ authenticated, id, role, username, needsOnboarding }`. `needsOnboarding` is only ever true for the admin, on a fresh/unconfigured install.

---

## Sites

_Auth: any authenticated user for reads (filtered to sites you can access); editor/admin for mutations; admin for create/delete._

### List sites
```
GET /sites
```
Admins get every site; editors/viewers get only sites they have access to. Includes live container status.

### Get site
```
GET /sites/:id
```
Requires site access.

### Create site
```
POST /sites
Content-Type: application/json

{ "name": "My Site", "domain": "mysite.com", "runtime": "static" }
```
Admin only. `runtime` is `static` (default), `php`, `node`, or `python`; `node`/`python` also accept `build_cmd`, `start_cmd`, `app_port`.

### Update site settings
```
PUT /sites/:id
Content-Type: application/json

{
  "domain": "mysite.com",
  "spa_mode": true,
  "cache_enabled": true,
  "maintenance_mode": false,
  "ssl_enabled": true,
  "custom_headers": [{ "name": "X-Frame-Options", "value": "SAMEORIGIN" }],
  "redirects": [{ "from": "/old", "to": "/new" }],
  "basic_auth": { "username": "user", "password": "pass" }
}
```
Editor or admin with site access. All fields optional — only send what you want to change.

### Delete site
```
DELETE /sites/:id
```
Admin only. Stops and removes the container, deletes site files from disk, and cleans up dependent rows (permissions, deployments, analytics, uptime history).

### Start / stop container
```
POST /sites/:id/start
POST /sites/:id/stop
```
Editor or admin with site access.

### Container logs
```
GET /sites/:id/logs?lines=100
```
Requires site access.

### Site access (which users can see this site)
```
GET /sites/:id/users
PUT /sites/:id/users   { "user_ids": ["..."] }
```
Admin only. Replaces the full access list for the site.

### Blue-green preview
```
POST   /sites/:id/preview        { "preview_domain": "preview.example.com" }
POST   /sites/:id/preview/swap
DELETE /sites/:id/preview
```
Editor or admin with site access. `POST /preview` stands up a second container on `preview_domain`; `/preview/swap` promotes it to production (fires a `deploy` webhook); `DELETE /preview` discards it without swapping.

---

## Deployments

_Auth: editor/admin for deploy/rollback (with site access); admin or editor for the global history list._

### Global deploy history
```
GET /deploy
```
Admin or editor. Last 200 deployments across sites you can access.

### Deploy a zip
```
POST /deploy/:id
Content-Type: multipart/form-data

file=@build.zip
```
Editor or admin with site access. Max 250MB. Extracted into `html/` (static/php runtimes) or `app/` (node/python runtimes, which then run `build_cmd` if set). Fires a `deploy` (or `deploy_failed`) webhook and, on failure, a `deploy_failed` ntfy alert.

Supported zip layouts:
- Flat root: `index.html` at the top level
- Single subfolder: `dist/index.html` → unwrapped automatically

### Deploy from a URL
```
POST /deploy/:id/url
Content-Type: application/json

{ "url": "https://example.com/build.zip" }
```
Editor or admin with site access. URL must point directly at a `.zip` (redirects are rejected) and resolve to a public address (SSRF-guarded). Same extraction/build/webhook behavior as the multipart upload.

### List deploy history
```
GET /deploy/:id/history
```
Requires site access. Returns the last 5 deployments with id, filename, size, timestamp.

### Roll back
```
POST /deploy/:id/rollback/:deploymentId
```
Editor or admin with site access. Restores the given deployment's zip and restarts the container.

---

## Uptime

_Auth: any authenticated user (filtered to accessible sites)._

### Uptime for one site
```
GET /uptime/:id?period=24h
```
`period`: `24h` (default), `7d`, `30d`. Returns `{ uptime, avgLatency, total, strip, currentStatus, period }`.

### Uptime summary (all sites)
```
GET /uptime
```
Returns a map of `siteId → { currentStatus, uptime24h }`, scoped to sites you can access.

---

## Analytics

_Auth: any authenticated user (filtered to accessible sites)._

### Fleet-wide overview
```
GET /analytics/overview?period=24h|7d|30d
```
Per-site and aggregate requests, bytes, status-code counts, and uptime/latency.

### Per-site analytics
```
GET /analytics/:id?period=24h|7d|30d
```
Requires site access. Returns hourly buckets, last-1h summary, and period totals.

### Force a refresh
```
POST /analytics/:id/refresh
```
Requires site access. Triggers an immediate nginx log parse pass.

---

## Activity log

_Auth: any authenticated user for the list (scoped to accessible sites for non-admins); admin only for CSV export._

### List
```
GET /activity?limit=50&site_id=&level=
```
`limit` max 500. `level` optional: `info` | `warn` | `error`.

### Export CSV
```
GET /activity/export.csv
```
Admin only. Full, unfiltered audit log as a CSV download.

---

## Settings

_Auth: admin only for all routes in this section (mounted behind `requireRole('admin')`)._

### Get / update general settings
```
GET /settings
PUT /settings
Content-Type: application/json

{
  "site_base_domain": "sites.yourdomain.com",
  "acme_email": "you@yourdomain.com",
  "default_spa_mode": false,
  "default_cache_enabled": true,
  "analytics_snippet": "<script>...</script>",
  "onboarding_done": true
}
```

### Notification event preferences (in-panel bell)
```
GET /settings/notification-events
PUT /settings/notification-events   { "events": ["unknown_domain", "site_down", "site_up"] }
```

### Alerts (ntfy)
```
GET  /settings/alerts
PUT  /settings/alerts        { "ntfy": { "url": "...", "enabled": true, "events": [...] } }
POST /settings/alerts/test
```
`PUT` validates the ntfy URL resolves to a public address before saving. `POST /test` sends a sample push using the saved config.

### Tokens

```
GET    /settings/tokens
POST   /settings/tokens
DELETE /settings/tokens/:id
```

`POST` body:
```json
{
  "name": "GitHub Actions",
  "role": "editor",
  "site_scope": ["site_id_1", "site_id_2"],
  "expires_in_days": 90
}
```
- `role`: `admin` (default), `editor`, or `viewer` — the token acts with this role.
- `site_scope`: omit or `"all"` for unrestricted (subject to role); an array of site ids to restrict the token to those sites specifically.
- `expires_in_days`: omit for a token that never expires; otherwise a positive number of days from creation.

The raw token (`grim_...`) is only returned once, in the `POST` response.

---

## Webhooks

_Auth: admin only (mounted at `/api/settings/webhooks` behind `requireRole('admin')`)._

```
GET    /settings/webhooks
POST   /settings/webhooks        { "name": "Discord", "url": "https://...", "events": ["deploy","rollback","site_down","site_up"] }
PATCH  /settings/webhooks/:id    { "enabled": false }
DELETE /settings/webhooks/:id
POST   /settings/webhooks/:id/test
```
`url` must resolve to a public address (SSRF-guarded). `events` defaults to all four (`deploy`, `rollback`, `site_down`, `site_up`) if omitted.

---

## Notifications (in-panel bell)

_Auth: any authenticated user can read; admin only for mutations (shared, global feed)._

```
GET    /notifications?limit=50
POST   /notifications/:id/read     (admin)
POST   /notifications/read-all     (admin)
DELETE /notifications               (admin)
DELETE /notifications/:id           (admin)
```
`GET` respects the enabled event types from `/settings/notification-events`.

---

## Users

_Auth: admin only, except `PATCH /users/:id`, which a user may also call on themselves to change their own password._

```
GET    /users
POST   /users             { "username": "...", "password": "...", "role": "admin|editor|viewer" }
PATCH  /users/:id         { "password": "...", "current_password": "...", "role": "..." }
DELETE /users/:id
GET    /users/:id/sites
PUT    /users/:id/sites   { "site_ids": ["..."] }
```
- `POST` requires admin; password must be ≥ 8 characters.
- `PATCH`: admins can update any user's role or password; a non-admin may only change their own password and must supply `current_password`. The last admin cannot be demoted.
- `DELETE`: admin only; cannot delete yourself or the last remaining admin.
- `GET/PUT .../sites`: manage per-site access grants for editor/viewer accounts.

---

## DNS

_Auth: any authenticated user for `server-ip`; site access required for `/dns/:id`._

```
GET /dns/server-ip
GET /dns/:id
```
`GET /dns/:id` resolves the site's domain and compares it against the server's public IP, returning `status`: `ok` | `pending` | `wrong` | `unknown` | `error`.

---

## Update

_Auth: `GET` routes require login; `POST /apply` is admin only._

```
GET  /update/check?force=1
GET  /update/status
POST /update/apply
```
`check` compares the running version against the latest GitHub release (cached 1h unless `force=1`). `apply` pulls the new image and performs an in-place self-update (spawns a helper container that swaps the running supervisor container, then exits).

### Site container images

_Auth: admin only (the router is mounted behind `requireRole('admin')`)._

```
GET  /update/images
POST /update/images/pull
POST /update/images/apply     { "pull": true, "site_ids": ["abc"], "force": false }
GET  /update/images/status
```
`GET /images` compares each site container's image ID with the local image for its runtime tag (no registry access) and returns `{ images, sites: [{ id, name, runtime, image, container_image_id, local_image_id, outdated, missing }], outdated, total, job }`. `POST /pull` pulls every runtime tag in use and returns the fresh status plus `pulled: [{ tag, updated }]`. `POST /apply` starts a background rolling update: pull (unless `pull:false`), then recreate outdated containers one at a time — `site_ids` limits the set, `force:true` recreates even up-to-date ones. Returns `409` while a job is running. `GET /status` returns `{ status: idle|starting|pulling|recreating|done|error, message, total, done, current, results }`.

Per site: `POST /sites/:id/recreate` (admin or editor with site access) pulls the site's runtime image and rebuilds its container; pass `{ "pull": false }` to skip the pull.

---

## Backups

_Auth: admin only (mounted behind `requireRole('admin')`)._

```
GET  /backups
PUT  /backups/settings   { "backup_interval_hours": 24, "backup_keep": 7 }
POST /backups
GET  /backups/download
```
`GET /backups` lists existing backups plus the current schedule/retention. `PUT /settings` configures the schedule (`0` disables the automatic schedule) and how many backups to retain. `POST /backups` creates one now and prunes old ones. `GET /download` streams a fresh backup zip without saving it to disk.

There is intentionally no restore endpoint — restoring means stopping the stack and replacing `data/` from a backup. See [Backups](Backups).

---

## Error responses

All errors return JSON:
```json
{ "error": "Human-readable error message" }
```

Common status codes:
- `400` — invalid request body or parameters
- `401` — not authenticated / expired token
- `403` — insufficient role or no access to this site
- `404` — resource not found
- `409` — conflict (e.g. duplicate domain, preview already exists)
- `429` — rate limit exceeded (login endpoint)
- `500` — internal error (check supervisor logs)
