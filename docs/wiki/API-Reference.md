# API Reference

## Authentication

Every `/api/*` route (except login) requires one of:
- **Session cookie** — set automatically after logging in via the browser
- **Bearer token** — `Authorization: Bearer grim_<token>` header

Create tokens in **Settings → API Tokens**. Tokens carry their own role (admin / editor / viewer) and can optionally be scoped to a set of sites and given an expiry date — see [Tokens](#tokens) below.

### CSRF header on mutating requests

A session-cookie request that mutates state (`POST`/`PUT`/`PATCH`/`DELETE` on
`/api/*`) must carry either `Content-Type: application/json` or
`X-Requested-With: grimport`. A request with neither gets `403 { "error":
"Missing X-Requested-With header" }`. This does **not** apply to Bearer-token
requests — send whichever header you like, or neither. If you're calling the
API with `fetch`/`curl` and already send a JSON body with
`Content-Type: application/json`, you already satisfy this; it's an issue only
for non-JSON form-style requests.

## Roles

Two layers: a **platform role** (`owner` | `admin` | `member` | `guest`) and,
per site, a **site role** (`owner` | `editor` | `viewer`). See
[Users and Roles](Users-and-Roles) for the full model, capability presets and
invitation flow.

- **owner** — exactly one; everything, including users, domains, updates, backups and panel settings
- **admin** — same as owner except promoting/demoting/deleting other admins
- **member** — creates and owns sites within their capability quota; manages collaborators and tokens on their own sites
- **guest** — no sites of their own; acts only through a site role granted by someone else

Owner and admin have an implicit `owner` site role on every site ("support
access" — every action taken this way is logged against the site and its
owner is notified). A legacy `role` (`admin` | `editor` | `viewer`) is still
present on every user/token response for backward compatibility; it's derived
from the platform role and site role and kept in sync automatically.

Every site response carries `my_role` (the caller's effective site role),
`owner` (`{ id, username, display_name }` or `null`), `support` (`true` when
the caller is an admin acting outside their own sites) and `status`
(`active` | `suspended`). A scoped API token narrows access further — it can
never widen it beyond what its owning user already has.

## Base URL

`https://panel.yourdomain.com/api`

---

## Auth

### Login
```
POST /auth/login
Content-Type: application/json

{ "username": "admin", "password": "...", "remember": false }
```
Rate-limited to 10 attempts / 15 minutes per IP (outer limit), plus an escalating
per-username/per-IP lockout after 5 failures in 15 minutes — see
[Security-Model](Security-Model#rate-limiting-and-lockout). A locked-out request
gets `429 { "error": "Too many failed logins, try again in N minutes" }` with a
`Retry-After` header.

- `remember: true` extends the session cookie to 30 days instead of the default 8 hours.
- If the account has TOTP enabled, a correct password does **not** create a full
  session. The response is `{ "ok": false, "totp_required": true }` and the
  login must be completed with `POST /auth/totp/verify` below.

### Complete a 2FA login
```
POST /auth/totp/verify
Content-Type: application/json

{ "code": "123456" }
```
Accepts a current TOTP code or an unused recovery code (which is then marked
used). Completes the pending login from `/auth/login` and returns the same
`{ ok, role, username }` shape a normal login does. Failed attempts count
toward that username's lockout.

### Logout
```
POST /auth/logout
```

### Current session
```
GET /auth/me
```
Returns one of:
- `{ authenticated: false }` — not logged in
- `{ authenticated: false, totp_required: true }` — password accepted, waiting on `/auth/totp/verify`
- `{ authenticated: true, totp_setup_required: true, id, role, username }` — an admin account that `require_totp_admins` forces through 2FA setup before anything else
- `{ authenticated: true, id, role, username, needsOnboarding, totp_enabled }` — the normal case. `needsOnboarding` is only ever true for the admin, on a fresh/unconfigured install.

### Two-factor authentication (session required)
```
POST /auth/totp/setup
```
Generates a secret, held pending in the session (not saved yet). Returns
`{ secret, otpauth_url, qr_data_url }` — render `qr_data_url` directly as an
`<img>` `src`, or let the user enter `secret` manually.

```
POST /auth/totp/enable
Content-Type: application/json

{ "code": "123456" }
```
Verifies the pending secret and turns 2FA on. Returns `{ ok: true,
recovery_codes: [...8 codes...] }` — shown once, save them.

```
POST /auth/totp/disable
Content-Type: application/json

{ "password": "..." }
```
Re-checks the account password, then clears the TOTP secret and all recovery codes.

### Sessions (session required)
```
GET /auth/sessions
```
Returns `{ sessions: [{ sid, sid_short, created_at, last_seen, ua, ip, current }] }` — only the calling user's own sessions.

```
DELETE /auth/sessions/:sid
```
Revokes one of your own sessions (403 on anyone else's).

```
POST /auth/sessions/revoke-others
```
Signs out every session for your account except the one making the request. Returns `{ ok: true, revoked: N }`.

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
Admins and members (within their site quota; members get an automatic subdomain when `domain` is omitted, a custom domain becomes a request unless the policy is free). Tokens act for their owner; a site-scoped token gains the site it created. `runtime` is `static` (default), `php`, `node`, or `python`; `node`/`python` also accept `build_cmd`, `start_cmd`, `app_port`.

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

## Templates

_Auth: any authenticated user for the list; site editor or higher to apply one — see [Starter templates](Deploying-Sites#starter-templates)._

### List templates
```
GET /templates
```
Returns every starter template: `[{ "id", "name", "description", "preview_bg" }]`.

### Apply a template
```
POST /templates/:id/apply/:siteId
```
Site editor/owner or admin. The site must be static and not suspended. Writes the template's `index.html`/`style.css` into the site's `html/` directory (placeholders `{{SITE_NAME}}`/`{{SITE_DOMAIN}}` replaced, other files left alone), applies the change immediately, and logs a `template_applied` activity row. `404` for an unknown template id, `400` if the site isn't static, `423` if it's suspended.

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

Rejections: `413` when a zip exceeds the entry, size or per-site disk quota limits (message names the limit), `429` after 30 deploys per 10 minutes per user or token. See [Deploying Sites](Deploying-Sites#limits).

Content scanner responses (see [Security Model](Security-Model#content-safety)):
- `200 { "ok": true, "files": 12, "verdict": "clean", "findings": [] }` — live
- `202 { "ok": true, "pending_review": true, "review_id": "...", "verdict": "review", "findings": [...] }` — held for an admin; the live site is unchanged
- `422 { "error": "Deploy blocked by the content scanner", "verdict": "blocked", "findings": [...], "review_id": "..." }` — rejected

Each finding is `{ "category", "severity", "file", "line"?, "detail" }`.

### Deploy from a URL
```
POST /deploy/:id/url
Content-Type: application/json

{ "url": "https://example.com/build.zip" }
```
Editor or admin with site access. URL must point directly at a `.zip` (redirects are rejected) and resolve to a public address (SSRF-guarded). Same extraction/build/webhook behavior and the same scanner responses as the multipart upload.

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

### Pending review on a site
```
GET    /sites/:id/review
DELETE /sites/:id/review
PUT    /sites/:id/scan-allowlist     { "hosts": ["cdn.example.com"] }
```
`GET` returns the upload held for this site (or `null`); `DELETE` withdraws it (editor or admin). `PUT /scan-allowlist` (site owner or admin, up to 50 hostnames) sets the external script hosts the scanner accepts for this site on top of the panel-wide list. Site objects carry `pending_review: { id, created_at, findings_count, created_by }` and `scan_allowlist`.

---

## Deploy reviews

Panel admins only. Uploads the content scanner held; see [Security Model](Security-Model#content-safety).

```
GET  /reviews?status=pending             list (without status: every row, newest first, max 200)
GET  /reviews/:id/download               the exact zip that was uploaded
POST /reviews/:id/approve   { "note"? }  promote the held files, record the deployment, notify the uploader
POST /reviews/:id/reject    { "note"? }  discard the held files, notify the uploader
```
Rows: `{ id, site_id, site_name, site_domain, filename, size, verdict, findings, findings_count, status, created_by, created_by_name, created_at, decided_by, decided_at, note }`. `409` when the review was already decided, `410` when the held files are gone.

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

### Member and scanner policies
```
GET /settings/policies
PUT /settings/policies
Content-Type: application/json

{
  "custom_domain_policy": "approval",
  "default_preset": "beginner",
  "invite_ttl_hours": 48,
  "scan_mode": "quarantine",
  "scan_script_allowlist": ["cdnjs.cloudflare.com", "cdn.jsdelivr.net"]
}
```
Admin. Every field is optional on `PUT`. `custom_domain_policy` is `approval` or `free`, `default_preset` is `beginner` or `maker`, `scan_mode` is `quarantine`, `log` or `off`; `scan_script_allowlist` accepts an array or a comma/newline separated string of hostnames.

### Domain requests
```
GET  /domains/requests?status=pending
POST /domains/requests/:id/approve
POST /domains/requests/:id/reject     { "note"? }
```
Admin. Members create a request by choosing a custom domain while the policy is `approval`; see [Users and Roles](Users-and-Roles#domain-requests).

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

## Me

```
GET /me
```
Session or token. Who the caller is and what it may do, meant for agents (see [MCP for Claude](MCP)):

```json
{
  "auth": { "kind": "token", "token_id": "abc", "site_scope": ["s1"] },
  "user": { "id": "u1", "username": "carla", "display_name": "Carla" },
  "platform_role": "member", "role": "editor",
  "capabilities": { "runtimes": ["static"], "max_sites": 3, "max_upload_mb": 100, "disk_quota_mb": 1000, "custom_domains": "approval", "api_tokens": true, "webhooks": false, "advanced_ui": false },
  "quota": { "sites_used": 1, "sites_max": 3, "sites_left": 2 },
  "site_base_domain": "sites.example.com", "automatic_subdomain": "<slug>.sites.example.com",
  "accessible_site_ids": ["s1"],
  "panel_url": "https://panel.example.com", "mcp_endpoint": "https://panel.example.com/mcp", "version": "0.15.0"
}
```
`null` in `max_sites`, `disk_quota_mb`, `sites_max` or `accessible_site_ids` means unlimited / every site (admins).

---

## MCP

```
POST /mcp
Authorization: Bearer grim_...
Content-Type: application/json
Accept: application/json, text/event-stream
```
Streamable HTTP transport, stateless (no session id, JSON responses; `GET`/`DELETE` answer `405`). Bearer tokens only, a browser session is refused with `401` and a `WWW-Authenticate: Bearer resource_metadata=".../.well-known/oauth-protected-resource/mcp"` header. Body limit `MCP_JSON_LIMIT` (64 MB). Tools, resources and the prompt are listed in [MCP for Claude](MCP#tools); each tool maps onto the REST calls documented here with the caller's own token.

OAuth 2.1 endpoints for clients without a token field (claude.ai connectors, Claude Desktop), active when `PANEL_URL` is https (or localhost):

```
GET  /.well-known/oauth-authorization-server
GET  /.well-known/oauth-protected-resource/mcp
POST /register                       dynamic client registration (public clients, PKCE S256 required)
GET  /authorize                      redirects to /oauth/consent (panel login + Allow)
POST /token                          authorization_code and refresh_token grants
POST /revoke
GET  /api/oauth/consent-info?client_id=   session: what the consent page shows
POST /api/oauth/consent              session: { client_id, redirect_uri, code_challenge, state, scope, decision: "allow" | "deny" } -> { redirect }
```
Access tokens are `api_tokens` rows owned by the signing-in user (24 h, refresh 90 days, rotated on every refresh) and appear under `GET /tokens` with `oauth_client_id` set.

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
