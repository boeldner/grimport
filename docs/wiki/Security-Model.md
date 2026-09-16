# Security Model

This page describes how Grimport protects the panel itself and the sites it hosts.

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

- Passkeys / WebAuthn as a login method (planned as a later phase).
- Per-site tenant isolation hardening beyond container/network separation (see
  the multi-user platform roadmap).
- Automated certificate-expiry alerting (the `cert_expiry` alert event exists
  but has no producer yet).
- A CSP report-only mode / violation reporting endpoint.
- Device/session anomaly detection (new-country logins, impossible travel).
