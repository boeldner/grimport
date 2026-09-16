# Security Model

How Grimport keeps one site from hurting the panel, other sites, or the host. This page describes what is enforced today; the direction is in the [roadmap](https://github.com/boeldner/grimport/blob/main/docs/roadmap/multi-user-platform.md).

## Threats this covers

A site is content or code that someone else controls. Grimport assumes any site may try to:

1. reach the panel or other sites from inside the Docker network,
2. exhaust CPU, memory, processes or disk,
3. use the server for scanning, spam or mining,
4. escalate privileges inside its container.

Content-level threats (phishing pages, malware downloads) are a separate layer: the deploy scanner and quarantine are planned for a later phase, and Cloudflare's WAF in front of public sites is still recommended.

## One network per site

Every site runs in its own Docker network, `webhost-site-<id>`, a `/24` taken from `SITE_NET_POOL` (default `10.99.0.0/16`). The supervisor creates the network with the site and removes it with the site.

- **Static sites and previews** use `internal` networks: no route to the outside world at all. Traefik is attached to the network and proxies requests in; nothing gets out.
- **App sites** (PHP, Node, Python) need the internet, so their network is a normal bridge fenced by the egress guard (below).
- **Traefik** is attached to every site network. The **supervisor is attached to none** of them: it talks to Docker over the socket, never over the network. A site container therefore cannot reach the panel, the SQLite database, or another site. `webhost-net` is only the management network shared by Traefik and the supervisor.

Existing installs migrate automatically: a container still on the shared network shows as **Outdated (network)** under Settings → General → Updates → Site containers, and the rolling update there recreates it on its own network.

## Egress guard

`egress-guard` (service in `docker-compose.yml`, script in `egress/apply-rules.sh`) is a tiny Alpine sidecar with host networking and `NET_ADMIN`. Every minute it re-applies a `GRIMPORT-EGRESS` chain hooked into Docker's `DOCKER-USER` chain:

| From site networks to | Result |
|---|---|
| another address in the site pool | dropped |
| 10/8, 172.16/12, 192.168/16, 100.64/10, 127/8 | dropped (LAN, host, other containers) |
| 169.254/16 | dropped (cloud metadata, link-local) |
| more than `EGRESS_NEW_CONN_PER_SEC` new connections per second | dropped (scanning, spam) |
| everything else (HTTPS to the internet, DNS) | allowed |

Replies to connections Traefik opened are always allowed. On Docker Desktop the daemon runs in a VM the sidecar cannot reach; the guard detects that and idles. Configure with `SITE_NET_POOL`, `EGRESS_GUARD_INTERVAL`, `EGRESS_NEW_CONN_PER_SEC`.

## Container hardening

All site containers are created with:

| Setting | Value | Why |
|---|---|---|
| Memory / swap | `SITE_MEMORY_STATIC_MB` 256, `SITE_MEMORY_APP_MB` 512, no swap | a leak cannot take the host down |
| CPU | `SITE_CPUS` 0.5 | a busy loop cannot starve neighbours |
| PIDs | `SITE_PIDS` 256 | fork bombs stop early |
| Open files | 4096 soft / 8192 hard | |
| Capabilities | all dropped | no raw sockets, no mounts, no ptrace |
| `no-new-privileges` | on | setuid binaries cannot escalate |

Per runtime:

| Runtime | Image | User | Extra |
|---|---|---|---|
| static, preview | `nginxinc/nginx-unprivileged:alpine` | uid 101 | read-only root filesystem, `/tmp` on tmpfs (64 MB), listens on 8080 |
| node | `node:22-alpine` | uid 1000 | `/tmp` on tmpfs (256 MB), `HOME=/tmp` |
| python | `python:3.12-slim` | uid 1000 | `/tmp` on tmpfs (256 MB), `HOME=/tmp` |
| php | `php:8.3-apache` | root, drops to www-data | keeps only `CHOWN`, `SETUID`, `SETGID`, `NET_BIND_SERVICE` so Apache can bind :80 |

Build steps for Node and Python (`build_cmd`) run in a throwaway container with the same limits, as uid 1000, on the site's network. The site's `app/` directory is owned by uid 1000 so the non-root process can write there.

## Deploy limits

Every zip is inspected before anything touches the live directory:

| Limit | Default | Variable |
|---|---|---|
| Upload size | 250 MB | (multer, fixed) |
| Entries | 20 000 | `DEPLOY_MAX_ENTRIES` |
| Uncompressed total | 1024 MB | `DEPLOY_MAX_TOTAL_MB` |
| Single file | 250 MB | `DEPLOY_MAX_FILE_MB` |
| Symlinks, NUL bytes in names, paths outside the target | rejected | |
| Per-site disk quota (current files + history + new deploy) | 2048 MB | `SITE_DISK_QUOTA_MB` |

After extraction the on-disk size is measured again, so a zip whose headers lie is still rejected. Rejections return HTTP 413 with the limit that was hit.

## Rate limits

| Scope | Default | Variable |
|---|---|---|
| Login attempts | 10 per 15 min per IP, plus per-account lockout (see Panel login) | (fixed) |
| Deploys, URL deploys, rollbacks | 30 per 10 min per user or token | `DEPLOY_RATE_LIMIT` |
| Any `/api/*` request except `/api/health` | 600 per 15 min per user, token or IP | `API_RATE_LIMIT` |

`0` disables a limit. Limits are keyed by the logged-in user, else a hash of the API token, else the client IP. Responses are HTTP 429 with `RateLimit-*` headers.

## Panel login

The panel is designed to be reachable on the public internet without relying on a
separate access proxy (e.g. Cloudflare Access) in front of it. Login hardening is
layered so no single control has to carry the whole burden:

### Rate limiting and lockout

- An outer IP-based rate limit (`express-rate-limit`) caps `/api/auth/login` at 10
  attempts per 15 minutes per IP, regardless of username.
- Behind that, `src/lockout.js` tracks failures **per username** and **per IP**
  independently. After 5 failures within 15 minutes, the key is locked out for
  `2^(failures - 5)` minutes — 1, 2, 4, 8, 16, 32, then capped at 60 minutes for
  every further failure. A locked request gets `429` with
  `{ "error": "Too many failed logins, try again in N minutes" }` and a
  `Retry-After` header.
- A successful login clears the lockout for that **username** (the per-IP counter
  is intentionally left alone, so a burst of failures against many usernames from
  one IP still keeps escalating).
- The 5th failure against a username fires a `login_lockout` alert (via
  `sendAlert`, if a push channel is configured — see Configuration) and an
  audit-log entry at `warn` level, so the owner finds out about credential
  stuffing attempts.

### Two-factor authentication (TOTP)

- `src/totp.js` implements RFC 6238 TOTP on top of RFC 4226 HOTP: HMAC-SHA1,
  30-second step, 6-digit codes, base32 secrets — the standard flavor every
  authenticator app (Google Authenticator, Authy, 1Password, etc.) supports.
- Setup: **Settings → Security → Two-factor authentication → Set up** generates a
  secret, shows a QR code (and the raw key for manual entry), and holds the
  secret *pending* in the session only. It isn't written to the account until a
  valid 6-digit code proves the app was set up correctly (`POST
  /api/auth/totp/enable`).
- Enabling 2FA mints **8 one-time recovery codes**, shown once, hashed
  (bcrypt) at rest in `recovery_codes`. Each can substitute for a TOTP code
  exactly once — logging in with one immediately marks it used.
- Login flow: a correct password for an account with 2FA enabled does not create
  a full session. The server holds a pending login (`session.pendingTotpUserId`)
  and returns `{ "ok": false, "totp_required": true }`. The client then posts to
  `POST /api/auth/totp/verify` with a TOTP or recovery code to complete the
  login. Failed verification attempts count toward that username's lockout, same
  as a wrong password.
- Owner/admin policy: the `require_totp_admins` setting (default **off**) forces
  every admin account to have 2FA enabled. While it's on, `GET /api/auth/me`
  reports `{ "authenticated": true, "totp_setup_required": true }` for an admin
  without a TOTP secret, and the panel opens the Security tab with a
  non-dismissable notice until setup is finished. Non-admin members and API
  tokens are never blocked by this setting.

### Sessions

- `GET /api/auth/sessions` lists the current user's own active sessions (device,
  IP, last-seen, which one is "this device"). `DELETE
  /api/auth/sessions/:sid` revokes one of them; `POST
  /api/auth/sessions/revoke-others` signs out every session but the current one.
  A user can only ever see or revoke their **own** sessions.
- "Remember this device" on login extends that session's cookie to 30 days;
  otherwise it's the normal 8-hour session.
- Admin sessions idle for more than 2 hours are rejected outright on the next
  request (`requireAuth` compares against `last_seen`, refreshed at most once a
  minute) — a panel session left open on a shared machine doesn't stay valid
  indefinitely.

### CSRF and headers

- Mutating `/api/*` requests (`POST`/`PUT`/`PATCH`/`DELETE`) that ride on a
  cookie session must carry either `Content-Type: application/json` or
  `X-Requested-With: grimport` (`src/csrf.js`). Neither can be set by a plain
  cross-site HTML form, so a forged submission from another site can't reach the
  API even with the session cookie attached. Bearer-token (API/CI) requests are
  exempt — there's no ambient cookie jar to forge for them.
- Every panel page ships a strict `Content-Security-Policy`:
  `default-src 'self'; script-src 'self' 'nonce-<per-request>'; style-src 'self'
  'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self';
  frame-ancestors 'none'; base-uri 'self'; form-action 'self'`. The few pages
  that still need an inline `<script>` (`login.html`, `invite.html`,
  `offline.html`) get it nonce-tagged per request rather than via
  `'unsafe-inline'`.
- Also set on every response: `X-Content-Type-Options: nosniff`,
  `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`,
  `Permissions-Policy`, `Cross-Origin-Opener-Policy: same-origin`,
  `X-Permitted-Cross-Domain-Policies: none`, and (in production) HSTS.
- The panel only answers on `SUPERVISOR_DOMAIN` — any other Host header gets the
  catch-all "domain not connected" page, never the login form.

## What is not covered yet

- Content scanning of deployed files (phishing, miners, secrets) and quarantine — planned.
- Passkeys / WebAuthn as a login method — planned.
- A CSP report-only mode / violation reporting endpoint; device or session anomaly detection (new-country logins).
- Automated certificate-expiry alerting (the `cert_expiry` alert event exists but has no producer yet).
- The supervisor itself has the Docker socket. Anyone who can run code as the supervisor owns the host; that is why sites can never reach it.
