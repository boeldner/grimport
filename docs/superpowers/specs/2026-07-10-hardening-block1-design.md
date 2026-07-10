# Grimport Hardening — Block 1 (Security + Deploy Pipeline)

Date: 2026-07-10
Status: Approved direction, pending spec review
Target release: next version (bump from 0.8.2)

## Goal

Close all release-blocking security holes and make the deploy pipeline
non-destructive. Ship a version that is safe to run multi-user and won't
brick a live site on a bad upload.

Out of scope for this block: new features (git deploys, backups, scoped
tokens as a feature), UI polish, docs. Those follow in later blocks.

## Findings addressed

Cross-confirmed by bug audit + security audit unless noted.

| # | Severity | Issue | Location |
|---|----------|-------|----------|
| 1 | CRIT | Any viewer mints API token; token acts as admin | settings.js:49, auth.js:48 |
| 2 | CRIT | Preview routes have no authorization | sites.js:255,278,291 |
| 3 | HIGH | Traefik `Host()` rule injection via site.domain | docker.js:99,106,320 |
| 4 | HIGH | Stored XSS via analytics_snippet, no role check | settings.js:36, nginx.js:137 |
| 5 | HIGH | SSRF via webhooks + deploy-from-URL | webhooks.js:65, deploy.js:247 |
| 6 | HIGH | Deploy rm's live site before validating zip | deploy.js:96,196,283 |
| 7 | HIGH | Rollback extracts to html/ for app runtimes | deploy.js:195 |
| 8 | HIGH | Deploy logged success before build/apply runs | deploy.js:142 |
| 9 | HIGH | Reconcile deletes preview containers on restart | reconcile.js:54 |
| 11 | HIGH | Unwrapped async handlers → hung requests | systemic |
| — | MED | nginx config injection via header name / redirects | nginx.js:115,124 |
| — | MED | Session cookie never Secure; no session.regenerate | auth.js:21, auth.js(login) |

## Design

### 1. Centralize authorization at mount points

Root cause: auth is applied per-route by hand; new routers forget it.
Fix: enforce role at the mount in `index.js` and add a token-scope gate.

- `index.js`: change mounts to layer role middleware:
  - `/api/settings` → `requireAuth, requireRole('admin')`
  - `/api/settings/webhooks` → `requireAuth, requireRole('admin')`
  - `/api/users` → `requireAuth, requireRole('admin')` (verify existing per-route guards still allow self-password change; keep PATCH self path working)
  - `/api/update` → `requireAuth, requireRole('admin')`
- Preview routes in `sites.js` (`POST/DELETE /:id/preview`, `/preview/swap`):
  add `requireSiteAccess('id'), requireRole('admin','editor')` like sibling routes.
- Audit every router for GET/DELETE that mutates or leaks and lacks a guard
  (analytics, notifications, activity export). Add `requireRole` where a
  viewer should not act.

Decision: mount-level role is the default; a route needing looser access
opts in explicitly. This inverts the current failure mode (forget = open →
forget = closed).

### 2. API-token scope

`auth.js:48` currently sets every token to `role: 'admin'`. Two-part fix:

- Move token creation behind `requireRole('admin')` (covered by #1).
- Give tokens a real role column. Minimal change: add `role` to `api_tokens`
  (default `'admin'` for back-compat with existing tokens), and set
  `req.user.role` from that column instead of hardcoding admin. Full scoped
  tokens (per-site) are a later feature — here we only stop silent admin
  grant and make the column exist.

### 3. Domain validation before Traefik labels

- In `sites.js` create + update: validate `domain` against a strict hostname
  regex: `^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$`,
  reject anything else with 400. Enforce max length 253.
- Belt-and-suspenders: `docker.js` refuses to build a label if domain fails
  the same check (throw), so no code path reaches Traefik with a bad value.

### 4. nginx config injection

- Validate `custom_headers[].name` against `^[A-Za-z0-9-]+$`.
- Validate `redirects[].from`/`.to` as paths/URLs; reject newlines and `;`.
- Reject any of these values containing `\n`, `\r`, `{`, `}` before writing config.
- `analytics_snippet` stays admin-only (via #1); no attempt to sanitize HTML —
  admin is trusted, viewer/editor can no longer set it.

### 5. SSRF guard for outbound fetches

Shared helper `assertPublicUrl(url)` used by webhooks and deploy-from-URL:
- Parse URL, require http/https.
- Resolve hostname; reject if it resolves to private/loopback/link-local/
  metadata ranges (127/8, 10/8, 172.16/12, 192.168/16, 169.254/16, ::1, fc00::/7).
- Re-check after any redirect (deploy already blocks redirects; webhooks
  should too, or re-validate each hop).
- Guard against DNS-rebinding by pinning the resolved IP for the request
  where feasible; if not feasible in this pass, at minimum resolve-and-check
  immediately before connect and document the residual risk.

### 6. Non-destructive deploy pipeline

Rewrite the three duplicated rm→extract→hoist blocks in `deploy.js` into one
helper `atomicExtract(zipPath, targetDir, { runtime })`:
- Parse + validate the zip FIRST (zip-slip check already present — keep it).
- Extract into a fresh temp dir `targetDir/../.deploy-tmp-<id>`.
- Only after successful extraction: swap — `rm` old dir, `rename` temp into place.
- On any failure: leave the live dir untouched, clean the temp dir.
- Rollback uses the correct target dir per runtime (`app/` for node/python,
  `html/` for static) — read runtime from the site row, not hardcoded.
- Record deployment success + fire webhook/activity only AFTER build + apply
  succeed. On build failure: record a failed deployment, do not advance the
  rollback pointer, surface the error.

### 7. Async handler wrapper (systemic)

Add `asyncHandler(fn)` util that wraps route handlers so rejections reach the
global error handler instead of hanging. Apply to every `async` route handler
across all routers. Verify the existing global error handler in `index.js:108`
returns JSON (it does).

### 8. Session hardening

- Set `cookie.secure` from an explicit `SESSION_SECURE` env (default true when
  `NODE_ENV=production`), documented in `.env.example`. Add `trust proxy` note.
- Call `req.session.regenerate()` on successful login before setting user fields
  (prevents session fixation), then persist.
- Fail hard (exit) if `SUPERVISOR_SECRET` is unset or `'changeme'` in production
  instead of only warning.

## Data flow (deploy, after fix)

```
upload zip → validate archive (zip-slip, size) → extract to temp
  → build step (if runtime) → apply site settings / restart container
  → on success: atomic swap dir, saveDeployment, activity log, webhook
  → on any failure: cleanup temp, live site untouched, record failure
```

## Testing

Manual + scripted, using the local Docker daemon now available:
- Auth matrix: for each role (admin/editor/viewer) × each protected mount,
  assert 200/403 as expected. Script with curl against a running supervisor.
- Token: create as admin, confirm viewer POST /tokens → 403.
- Domain injection: `POST /sites` with `evil`)||Host(`x` → 400.
- Deploy: upload truncated zip → live site still served (unchanged).
- Rollback node site → files land in app/, site rebuilds.
- SSRF: webhook to 169.254.169.254 → rejected.
- Async: force a dockerode error on start → request returns 500, not hang.

TDD where practical: write the failing curl/assertion first, then fix.

## Rollout

- One branch `harden/block1`. Commit per finding-group for reviewable history.
- Migration for `api_tokens.role` column (additive, default admin).
- After merge: bump version, tag → GHCR release via existing workflow.
- Restored `supervisor/Dockerfile` must be present before tag (it is now).

## Open questions

- Users mount as admin-only: confirm the self-service password-change path
  (PATCH /api/users/:id for own id) should remain available to non-admins.
  If yes, that one route opts out of the mount-level admin gate.
