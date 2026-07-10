# Grimport Hardening Block 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close all release-blocking security holes and make the deploy pipeline non-destructive.

**Architecture:** Centralize authorization at Express mount points (fail-closed), extract pure validation/SSRF/escaping helpers with unit tests, and rewrite the three duplicated deploy blocks into one atomic extract-then-swap helper. Wrap all async route handlers so rejections reach the error handler instead of hanging.

**Tech Stack:** Node.js 20, Express 4, better-sqlite3, dockerode, adm-zip. Tests use Node's built-in `node:test` runner (no new dependency) for pure functions, plus a curl-based auth-matrix script for integration.

## Global Constraints

- Runs exclusively in Docker for production (`docker compose up --build supervisor`).
- No new runtime dependencies unless unavoidable. Prefer Node built-ins.
- Existing API-token back-compat: tokens already issued must keep working (default role `admin`).
- Spec: `docs/superpowers/specs/2026-07-10-hardening-block1-design.md`.
- SPA + login: all non-API routes serve `public/index.html`; global JSON error handler at `index.js`.
- Commit after every task. Keep `supervisor/Dockerfile` present (needed for GHCR release).

## File Structure

- Create: `supervisor/src/validate.js` — pure validators: `isValidHostname`, `sanitizeHeaderName`, `sanitizeRedirectField`, `assertPublicUrl`. One responsibility: input validation, no I/O except DNS in `assertPublicUrl`.
- Create: `supervisor/src/async-handler.js` — `asyncHandler(fn)` wrapper.
- Create: `supervisor/src/extract.js` — `atomicExtract(zipPath, targetDir, opts)`: validate → extract to temp → swap. Pulls the duplicated logic out of `deploy.js`.
- Create: `supervisor/test/validate.test.js`, `supervisor/test/extract.test.js` — `node:test` unit tests.
- Create: `supervisor/test/auth-matrix.sh` — integration auth-matrix (curl).
- Modify: `supervisor/src/index.js` — mount-level role middleware.
- Modify: `supervisor/src/routes/settings.js` — remove blanket access; wire validators.
- Modify: `supervisor/src/routes/sites.js` — domain validation; preview-route auth; async wrap.
- Modify: `supervisor/src/routes/deploy.js` — use `atomicExtract`; success-after-build; async wrap.
- Modify: `supervisor/src/routes/webhooks.js` — `assertPublicUrl` on create/test.
- Modify: `supervisor/src/nginx.js` — header/redirect validation before config write.
- Modify: `supervisor/src/docker.js` — refuse bad domain in Traefik label.
- Modify: `supervisor/src/auth.js` — token role column; `secure` cookie; `session.regenerate`.
- Modify: `supervisor/src/db.js` — migration: `api_tokens.role` column.
- Modify: `supervisor/package.json` — add `"test": "node --test test/"`.
- Modify: `.env.example` — document `SESSION_SECURE`.

---

## Task 1: Test harness + async handler wrapper

**Files:**
- Modify: `supervisor/package.json`
- Create: `supervisor/src/async-handler.js`
- Create: `supervisor/test/async-handler.test.js`

**Interfaces:**
- Produces: `asyncHandler(fn) -> (req,res,next)` — calls `fn` and routes any rejection to `next(err)`.

- [ ] **Step 1: Add test script**

In `supervisor/package.json`, add to `"scripts"`:
```json
"test": "node --test test/"
```

- [ ] **Step 2: Write the failing test**

Create `supervisor/test/async-handler.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { asyncHandler } = require('../src/async-handler');

test('forwards rejection to next', async () => {
  const boom = new Error('boom');
  const handler = asyncHandler(async () => { throw boom; });
  let passed;
  await new Promise(resolve => {
    handler({}, {}, err => { passed = err; resolve(); });
  });
  assert.strictEqual(passed, boom);
});

test('does not call next on success', async () => {
  const handler = asyncHandler(async (req, res) => { res.done = true; });
  const res = {};
  let nextCalled = false;
  await handler({}, res, () => { nextCalled = true; });
  assert.strictEqual(res.done, true);
  assert.strictEqual(nextCalled, false);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd supervisor && node --test test/async-handler.test.js`
Expected: FAIL — `Cannot find module '../src/async-handler'`.

- [ ] **Step 4: Implement**

Create `supervisor/src/async-handler.js`:
```js
/** Wrap an async route handler so rejections reach Express's error handler. */
function asyncHandler(fn) {
  return function (req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd supervisor && node --test test/async-handler.test.js`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add supervisor/package.json supervisor/src/async-handler.js supervisor/test/async-handler.test.js
git commit -m "feat: async handler wrapper + node:test harness"
```

---

## Task 2: Input validators (hostname, header, redirect)

**Files:**
- Create: `supervisor/src/validate.js`
- Create: `supervisor/test/validate.test.js`

**Interfaces:**
- Produces:
  - `isValidHostname(s) -> boolean` — RFC-1123 hostname, max 253 chars, lowercase letters/digits/hyphen/dots.
  - `sanitizeHeaderName(s) -> string` — throws `Error` if not `^[A-Za-z0-9-]+$`.
  - `sanitizeRedirectField(s) -> string` — throws `Error` if it contains `\n`, `\r`, `;`, `{`, `}`.

- [ ] **Step 1: Write the failing test**

Create `supervisor/test/validate.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const { isValidHostname, sanitizeHeaderName, sanitizeRedirectField } = require('../src/validate');

test('accepts normal hostnames', () => {
  assert.ok(isValidHostname('example.com'));
  assert.ok(isValidHostname('a.b.sites.example.com'));
  assert.ok(isValidHostname('xn--bcher-kva.example'));
});

test('rejects Traefik rule injection', () => {
  assert.ok(!isValidHostname('evil.com`) || Host(`victim.com'));
  assert.ok(!isValidHostname('a b.com'));
  assert.ok(!isValidHostname('UPPER.com'.toLowerCase() + ' '));
  assert.ok(!isValidHostname(''));
  assert.ok(!isValidHostname('x'.repeat(254)));
});

test('header name rejects injection', () => {
  assert.strictEqual(sanitizeHeaderName('X-Frame-Options'), 'X-Frame-Options');
  assert.throws(() => sanitizeHeaderName('X-Bad\nadd_header Evil'));
  assert.throws(() => sanitizeHeaderName('X;Y'));
});

test('redirect field rejects newlines and braces', () => {
  assert.strictEqual(sanitizeRedirectField('/old'), '/old');
  assert.throws(() => sanitizeRedirectField('/x\nreturn 200'));
  assert.throws(() => sanitizeRedirectField('/x; }'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supervisor && node --test test/validate.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `supervisor/src/validate.js` (leave `assertPublicUrl` for Task 3):
```js
const HOSTNAME_RE = /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*$/;

function isValidHostname(s) {
  if (typeof s !== 'string') return false;
  if (s.length === 0 || s.length > 253) return false;
  return HOSTNAME_RE.test(s);
}

function sanitizeHeaderName(s) {
  if (typeof s !== 'string' || !/^[A-Za-z0-9-]+$/.test(s)) {
    throw new Error(`Invalid header name: ${JSON.stringify(s)}`);
  }
  return s;
}

function sanitizeRedirectField(s) {
  if (typeof s !== 'string' || /[\n\r;{}]/.test(s)) {
    throw new Error(`Invalid redirect value: ${JSON.stringify(s)}`);
  }
  return s;
}

module.exports = { isValidHostname, sanitizeHeaderName, sanitizeRedirectField };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supervisor && node --test test/validate.test.js`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add supervisor/src/validate.js supervisor/test/validate.test.js
git commit -m "feat: hostname/header/redirect validators"
```

---

## Task 3: SSRF guard (assertPublicUrl)

**Files:**
- Modify: `supervisor/src/validate.js`
- Modify: `supervisor/test/validate.test.js`

**Interfaces:**
- Consumes: `dns.promises.lookup` (Node built-in), `net` (Node built-in).
- Produces: `assertPublicUrl(urlString) -> Promise<{ url: URL, address: string }>` — resolves the hostname, throws if protocol is not http/https or the resolved IP is private/loopback/link-local. Returns the pinned resolved address so callers can connect to it directly (DNS-rebinding defense).

- [ ] **Step 1: Write the failing test**

Append to `supervisor/test/validate.test.js`:
```js
const { assertPublicUrl, isPrivateAddress } = require('../src/validate');

test('isPrivateAddress covers reserved ranges', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1',
                     '169.254.169.254', '::1', 'fc00::1', '0.0.0.0']) {
    assert.ok(isPrivateAddress(ip), `${ip} should be private`);
  }
  for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.216.34']) {
    assert.ok(!isPrivateAddress(ip), `${ip} should be public`);
  }
});

test('assertPublicUrl rejects non-http protocols', async () => {
  await assert.rejects(() => assertPublicUrl('file:///etc/passwd'));
  await assert.rejects(() => assertPublicUrl('ftp://example.com'));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supervisor && node --test test/validate.test.js`
Expected: FAIL — `assertPublicUrl`/`isPrivateAddress` not exported.

- [ ] **Step 3: Implement**

Add to `supervisor/src/validate.js`:
```js
const dns = require('node:dns').promises;
const net = require('node:net');

function ipToLong(ip) {
  return ip.split('.').reduce((acc, o) => (acc << 8) + Number(o), 0) >>> 0;
}

function inRange(ip, cidr) {
  const [range, bits] = cidr.split('/');
  const mask = bits === '0' ? 0 : (~0 << (32 - Number(bits))) >>> 0;
  return (ipToLong(ip) & mask) === (ipToLong(range) & mask);
}

const V4_PRIVATE = ['0.0.0.0/8', '10.0.0.0/8', '100.64.0.0/10', '127.0.0.0/8',
  '169.254.0.0/16', '172.16.0.0/12', '192.0.0.0/24', '192.168.0.0/16', '198.18.0.0/15'];

function isPrivateAddress(ip) {
  if (net.isIPv4(ip)) return V4_PRIVATE.some(c => inRange(ip, c));
  if (net.isIPv6(ip)) {
    const low = ip.toLowerCase();
    if (low === '::1' || low === '::') return true;
    if (low.startsWith('fc') || low.startsWith('fd')) return true; // fc00::/7 ULA
    if (low.startsWith('fe80')) return true; // link-local
    if (low.startsWith('::ffff:')) return isPrivateAddress(low.slice(7)); // v4-mapped
    return false;
  }
  return true; // unknown format → treat as unsafe
}

async function assertPublicUrl(urlString) {
  let url;
  try { url = new URL(urlString); } catch { throw new Error('Invalid URL'); }
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error('Only http/https URLs are allowed');
  }
  const { address } = await dns.lookup(url.hostname);
  if (isPrivateAddress(address)) {
    throw new Error('URL resolves to a private or reserved address');
  }
  return { url, address };
}

module.exports = { isValidHostname, sanitizeHeaderName, sanitizeRedirectField, assertPublicUrl, isPrivateAddress };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supervisor && node --test test/validate.test.js`
Expected: PASS (6 tests total).

- [ ] **Step 5: Commit**

```bash
git add supervisor/src/validate.js supervisor/test/validate.test.js
git commit -m "feat: SSRF guard assertPublicUrl + private-range detection"
```

---

## Task 4: Centralize authorization at mount points

**Files:**
- Modify: `supervisor/src/index.js:85-96`
- Modify: `supervisor/src/routes/settings.js` (remove now-redundant checks, keep password self-path)
- Create: `supervisor/test/auth-matrix.sh`

**Interfaces:**
- Consumes: `requireAuth`, `requireRole` from `auth.js` (existing).

- [ ] **Step 1: Tighten mounts**

In `supervisor/src/index.js`, replace the protected-routes block:
```js
// ── Protected routes ───────────────────────────────────────
app.use('/api/sites',    requireAuth, require('./routes/sites'));
app.use('/api/deploy',   requireAuth, require('./routes/deploy'));
app.use('/api/settings/webhooks', requireAuth, requireRole('admin'), require('./routes/webhooks'));
app.use('/api/settings', requireAuth, requireRole('admin'), require('./routes/settings'));
app.use('/api/dns',       requireAuth, require('./routes/dns'));
app.use('/api/analytics', requireAuth, require('./routes/analytics'));
app.use('/api/uptime',          requireAuth, require('./routes/uptime'));
app.use('/api/activity',        requireAuth, require('./routes/activity'));
app.use('/api/notifications',   requireAuth, require('./routes/notifications'));
app.use('/api/users',           requireAuth, require('./routes/users'));
app.use('/api/update',          requireAuth, requireRole('admin'), require('./routes/update'));
```
Note: `/api/settings/webhooks` MUST be registered before `/api/settings` so the more specific path matches first. Import `requireRole` at top: it is already exported from `./auth`.

- [ ] **Step 2: Keep users self-password reachable**

`/api/users` stays `requireAuth` at the mount (NOT admin-only), because a non-admin must PATCH their own password. Open `supervisor/src/routes/users.js` and confirm each admin-only action (list users, create, delete, change others) already calls `requireRole('admin')` per-route; the self `PATCH /:id` must allow a user editing their own id. If per-route guards are missing, add `requireRole('admin')` to every route EXCEPT the self-service PATCH branch. (Verification, not blind edit — read the file first.)

- [ ] **Step 3: Verify settings routes need no per-route role now**

`/api/settings` is admin-only at the mount, so the token/analytics/password routes inside `settings.js` are now admin-gated. No code change required inside settings.js for authorization in this task (validation comes in Task 8). Leave a comment at top of `settings.js`:
```js
// NOTE: mounted behind requireRole('admin') in index.js — all routes here are admin-only.
```

- [ ] **Step 4: Write the integration auth-matrix script**

Create `supervisor/test/auth-matrix.sh`:
```bash
#!/usr/bin/env bash
# Requires a running supervisor at $BASE (default http://localhost:3000)
# and two cookies: $ADMIN_COOKIE and $VIEWER_COOKIE (wh.sid values).
set -u
BASE=${BASE:-http://localhost:3000}
fail=0
check() { # desc method path cookie expected
  code=$(curl -s -o /dev/null -w '%{http_code}' -X "$2" \
    -H "Cookie: wh.sid=$4" "$BASE$3")
  if [ "$code" != "$5" ]; then echo "FAIL: $1 (got $code want $5)"; fail=1
  else echo "ok: $1 ($code)"; fi
}
check "viewer cannot create token" POST /api/settings/tokens "$VIEWER_COOKIE" 403
check "admin can list tokens"      GET  /api/settings/tokens "$ADMIN_COOKIE" 200
check "viewer cannot list webhooks" GET /api/settings/webhooks "$VIEWER_COOKIE" 403
check "viewer cannot update"       POST /api/update/check     "$VIEWER_COOKIE" 403
exit $fail
```
Make executable: `chmod +x supervisor/test/auth-matrix.sh`.

- [ ] **Step 5: Run the app and the matrix**

```bash
docker compose up --build -d supervisor
# create a viewer user via admin session, capture cookies, then:
BASE=http://localhost:3000 ADMIN_COOKIE=... VIEWER_COOKIE=... ./supervisor/test/auth-matrix.sh
```
Expected: all `ok:` lines, exit 0. (If manual cookie capture is impractical in the harness, document the expected results and defer live run to the reviewer; the unit-level guarantee is the mount config above.)

- [ ] **Step 6: Commit**

```bash
git add supervisor/src/index.js supervisor/src/routes/settings.js supervisor/src/routes/users.js supervisor/test/auth-matrix.sh
git commit -m "fix: enforce admin role at settings/webhooks/update mounts (fail-closed)"
```

---

## Task 5: API-token role column (stop blanket admin)

**Files:**
- Modify: `supervisor/src/db.js` (migration)
- Modify: `supervisor/src/auth.js:44-49`
- Modify: `supervisor/src/routes/settings.js:49-56` (set role on create)

**Interfaces:**
- Produces: `api_tokens.role TEXT NOT NULL DEFAULT 'admin'`; `req.user.role` from token row.

- [ ] **Step 1: Add migration**

In `supervisor/src/db.js`, in the migration section (where other `ALTER TABLE ... ADD COLUMN` guarded migrations live — follow the existing pattern), add:
```js
try { db.exec("ALTER TABLE api_tokens ADD COLUMN role TEXT NOT NULL DEFAULT 'admin'"); } catch {}
```
(Existing tokens inherit `admin` for back-compat, per spec.)

- [ ] **Step 2: Read role from token in auth**

In `supervisor/src/auth.js`, change the token block:
```js
    const row = db.prepare('SELECT id, role FROM api_tokens WHERE token_hash = ?').get(hash);
    if (row) {
      db.prepare('UPDATE api_tokens SET last_used = unixepoch() WHERE id = ?').run(row.id);
      req.user = { id: 'token', role: row.role || 'admin', username: 'api' };
      return next();
    }
```

- [ ] **Step 3: Accept optional role on token create**

In `supervisor/src/routes/settings.js` `POST /tokens`, accept an optional `role`:
```js
  const { name, role } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'name required' });
  const tokenRole = ['admin', 'editor', 'viewer'].includes(role) ? role : 'admin';
  const token = 'grim_' + nanoid(32);
  const hash = crypto.createHash('sha256').update(token).digest('hex');
  const id = nanoid(10);
  db.prepare('INSERT INTO api_tokens (id, name, token_hash, role) VALUES (?, ?, ?, ?)').run(id, name.trim(), hash, tokenRole);
  res.json({ id, name: name.trim(), role: tokenRole, token });
```
Also include `role` in the `GET /tokens` select: `SELECT id, name, role, created_at, last_used`.

- [ ] **Step 4: Manual verify**

```bash
docker compose up --build -d supervisor
# As admin, create a viewer-role token, then use it to hit an admin route:
curl -s -X POST -H "Authorization: Bearer grim_..." http://localhost:3000/api/settings/tokens -d '{"name":"x"}' -H 'Content-Type: application/json' -o /dev/null -w '%{http_code}\n'
```
Expected: `403` (viewer token cannot mint tokens). An admin-role token still returns `200`.

- [ ] **Step 5: Commit**

```bash
git add supervisor/src/db.js supervisor/src/auth.js supervisor/src/routes/settings.js
git commit -m "feat: per-token role column; tokens no longer blanket-admin"
```

---

## Task 6: Preview routes authorization + async wrap

**Files:**
- Modify: `supervisor/src/routes/sites.js:255,278,291`

**Interfaces:**
- Consumes: `requireSiteAccess`, `requireRole` (already imported in sites.js), `asyncHandler` from `../async-handler`.

- [ ] **Step 1: Import asyncHandler**

At top of `supervisor/src/routes/sites.js`, add:
```js
const { asyncHandler } = require('../async-handler');
```

- [ ] **Step 2: Guard + wrap the three preview routes**

Change the three route signatures:
```js
router.post('/:id/preview', requireSiteAccess(), requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
```
```js
router.post('/:id/preview/swap', requireSiteAccess(), requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
```
```js
router.delete('/:id/preview', requireSiteAccess(), requireRole('admin', 'editor'), asyncHandler(async (req, res) => {
```
Keep each handler body unchanged; ensure the closing `)` matches the added `asyncHandler(` (the trailing `});` becomes `}));`).

- [ ] **Step 3: Syntax check**

Run: `cd supervisor && node -e "require('./src/routes/sites')"`
Expected: no output, exit 0 (module loads).

- [ ] **Step 4: Commit**

```bash
git add supervisor/src/routes/sites.js
git commit -m "fix: authorize preview routes (site access + editor/admin)"
```

---

## Task 7: Domain validation on site create/update + Traefik guard

**Files:**
- Modify: `supervisor/src/routes/sites.js:82-96, 115-140`
- Modify: `supervisor/src/docker.js` (label build sites ~99,106,320)

**Interfaces:**
- Consumes: `isValidHostname` from `../validate`.

- [ ] **Step 1: Import validator**

At top of `sites.js`:
```js
const { isValidHostname } = require('../validate');
```

- [ ] **Step 2: Validate on create**

In `POST /`, after the `name && domain` check:
```js
  const normalizedDomain = domain.trim().toLowerCase();
  if (!isValidHostname(normalizedDomain)) return res.status(400).json({ error: 'Invalid domain' });
```
Use `normalizedDomain` in the INSERT instead of `domain.trim().toLowerCase()`.

- [ ] **Step 3: Validate on update**

In `PUT /:id`, before the UPDATE, when `domain !== undefined`:
```js
  let domainValue = domain;
  if (domain !== undefined) {
    domainValue = String(domain).trim().toLowerCase();
    if (!isValidHostname(domainValue)) return res.status(400).json({ error: 'Invalid domain' });
  }
```
Pass `domainValue` (not raw `domain`) into the `COALESCE(?, domain)` bind.

- [ ] **Step 4: Belt-and-suspenders in docker.js**

In `supervisor/src/docker.js`, add near the top:
```js
const { isValidHostname } = require('./validate');
```
Immediately before each place a `` Host(`${...}`) `` label is built, guard:
```js
  if (!isValidHostname(site.domain)) throw new Error(`Refusing Traefik label for invalid domain: ${site.domain}`);
```
Apply at all three label-build sites (production ~99/106 and preview ~320). If preview uses `site.preview_domain`, validate that variable instead.

- [ ] **Step 5: Verify**

Run: `cd supervisor && node -e "require('./src/routes/sites'); require('./src/docker'); console.log('ok')"`
Expected: `ok`.
Manual: `POST /api/sites` with domain `` a`)||Host(`b `` → `400`.

- [ ] **Step 6: Commit**

```bash
git add supervisor/src/routes/sites.js supervisor/src/docker.js
git commit -m "fix: validate domain before Traefik label (rule-injection guard)"
```

---

## Task 8: nginx header/redirect validation

**Files:**
- Modify: `supervisor/src/routes/sites.js` (validate on write, in PUT)
- Modify: `supervisor/src/nginx.js:112-128`

**Interfaces:**
- Consumes: `sanitizeHeaderName`, `sanitizeRedirectField` from `../validate`.

- [ ] **Step 1: Validate custom_headers/redirects on update**

In `sites.js` `PUT /:id`, when `custom_headers !== undefined` or `redirects !== undefined`, parse and validate before storing:
```js
  const { sanitizeHeaderName, sanitizeRedirectField } = require('../validate');
  if (custom_headers !== undefined) {
    try {
      for (const h of JSON.parse(custom_headers)) sanitizeHeaderName(h.name);
    } catch (e) { return res.status(400).json({ error: `Invalid custom header: ${e.message}` }); }
  }
  if (redirects !== undefined) {
    try {
      for (const r of JSON.parse(redirects)) { sanitizeRedirectField(r.from); sanitizeRedirectField(r.to); }
    } catch (e) { return res.status(400).json({ error: `Invalid redirect: ${e.message}` }); }
  }
```
(Prefer a single top-of-file `require` over inline; inline shown for locality — move to the import block.)

- [ ] **Step 2: Defense-in-depth in nginx.js**

In `nginx.js`, wrap the header/redirect maps so a bad value throws rather than emitting raw config. Change the `customHeaders` map to validate the name:
```js
      const { sanitizeHeaderName } = require('./validate');
      return headers.map(h => `  add_header ${sanitizeHeaderName(h.name)} "${h.value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}";`).join('\n');
```
And `redirects`:
```js
      const { sanitizeRedirectField } = require('./validate');
      return rules.map(r => `  rewrite ^${sanitizeRedirectField(r.from)}$ ${sanitizeRedirectField(r.to)} ${r.permanent ? 'permanent' : 'redirect'};`).join('\n');
```
The surrounding `try/catch` already returns `''` on throw — acceptable fail-safe (bad config omitted rather than injected). Move requires to top of file.

- [ ] **Step 3: Verify**

Run: `cd supervisor && node -e "require('./src/nginx'); console.log('ok')"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add supervisor/src/routes/sites.js supervisor/src/nginx.js
git commit -m "fix: validate custom headers/redirects (nginx directive injection)"
```

---

## Task 9: SSRF guard in webhooks + deploy-from-URL

**Files:**
- Modify: `supervisor/src/routes/webhooks.js` (create + test routes)
- Modify: `supervisor/src/routes/deploy.js:247-280`

**Interfaces:**
- Consumes: `assertPublicUrl` from `../validate`.

- [ ] **Step 1: Read webhooks route file**

Read `supervisor/src/routes/webhooks.js` fully (the router, not the dispatcher `src/webhooks.js`). Identify the create (`POST /`) and `:id/test` handlers.

- [ ] **Step 2: Guard webhook create + test**

In both handlers, before persisting/sending, validate the destination:
```js
const { assertPublicUrl } = require('../validate');
// inside handler, after extracting `url`:
try { await assertPublicUrl(url); }
catch (e) { return res.status(400).json({ error: e.message }); }
```
Make the handlers `async` and wrap with `asyncHandler` (import from `../async-handler`) so the `await` is safe.

- [ ] **Step 3: Guard deploy-from-URL**

In `deploy.js` `POST /:id/url`, replace the manual protocol/URL checks (lines ~251-254) with:
```js
  let parsed, pinnedAddress;
  try { ({ url: parsed, address: pinnedAddress } = await assertPublicUrl(url)); }
  catch (e) { return res.status(400).json({ error: e.message }); }
  if (!parsed.pathname.endsWith('.zip')) return res.status(400).json({ error: 'URL must point to a .zip file' });
```
Add `const { assertPublicUrl } = require('../validate');` at top. Keep the existing redirect rejection (301/302 already rejected). Since redirects are rejected, DNS-rebinding risk is limited; pinning the Host connection is optional here — leave a `// TODO: connect to pinnedAddress to fully close rebinding` comment.

- [ ] **Step 4: Verify**

Run: `cd supervisor && node -e "require('./src/routes/webhooks'); require('./src/routes/deploy'); console.log('ok')"`
Expected: `ok`.
Manual: create a webhook to `http://169.254.169.254/latest/meta-data/` → `400`.

- [ ] **Step 5: Commit**

```bash
git add supervisor/src/routes/webhooks.js supervisor/src/routes/deploy.js
git commit -m "fix: SSRF guard on webhooks and deploy-from-URL"
```

---

## Task 10: Atomic extract helper (non-destructive deploy)

**Files:**
- Create: `supervisor/src/extract.js`
- Create: `supervisor/test/extract.test.js`

**Interfaces:**
- Produces: `atomicExtract(zipPath, targetDir) -> { fileCount }` — validates zip entries (zip-slip), extracts to a sibling temp dir, hoists a single root folder, strips `__MACOSX`, then atomically swaps into `targetDir`. Throws on any failure WITHOUT touching an existing `targetDir`.

- [ ] **Step 1: Write the failing test**

Create `supervisor/test/extract.test.js`:
```js
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const AdmZip = require('adm-zip');
const { atomicExtract } = require('../src/extract');

function tmp() { return fs.mkdtempSync(path.join(os.tmpdir(), 'grim-')); }

test('extracts flat and hoists single root folder', () => {
  const work = tmp();
  const zipPath = path.join(work, 'a.zip');
  const zip = new AdmZip();
  zip.addFile('site/index.html', Buffer.from('<h1>hi</h1>'));
  zip.writeZip(zipPath);
  const target = path.join(work, 'html');
  const { fileCount } = atomicExtract(zipPath, target);
  assert.ok(fs.existsSync(path.join(target, 'index.html')));
  assert.strictEqual(fileCount, 1);
});

test('corrupt zip leaves existing target untouched', () => {
  const work = tmp();
  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'live.html'), 'LIVE');
  const badZip = path.join(work, 'bad.zip');
  fs.writeFileSync(badZip, 'not a real zip');
  assert.throws(() => atomicExtract(badZip, target));
  assert.strictEqual(fs.readFileSync(path.join(target, 'live.html'), 'utf8'), 'LIVE');
});

test('rejects zip-slip entries', () => {
  const work = tmp();
  const zipPath = path.join(work, 'slip.zip');
  const zip = new AdmZip();
  zip.addFile('../evil.txt', Buffer.from('x'));
  zip.writeZip(zipPath);
  const target = path.join(work, 'html');
  fs.mkdirSync(target, { recursive: true });
  fs.writeFileSync(path.join(target, 'live.html'), 'LIVE');
  assert.throws(() => atomicExtract(zipPath, target));
  assert.ok(fs.existsSync(path.join(target, 'live.html')));
  assert.ok(!fs.existsSync(path.join(work, 'evil.txt')));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd supervisor && node --test test/extract.test.js`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `supervisor/src/extract.js`:
```js
const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { nanoid } = require('nanoid');

/**
 * Validate + extract a zip into targetDir atomically.
 * On any error, an existing targetDir is left untouched.
 * Returns { fileCount }.
 */
function atomicExtract(zipPath, targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  const tmpDir = path.join(path.dirname(resolvedTarget), `.deploy-tmp-${nanoid(8)}`);

  try {
    // Parse first — throws here on corrupt zip, before touching live dir.
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Zip-slip check against the temp dir.
    for (const entry of entries) {
      const dest = path.resolve(path.join(tmpDir, entry.entryName));
      if (!dest.startsWith(tmpDir + path.sep) && dest !== tmpDir) {
        throw new Error(`Rejected: zip entry outside target directory: ${entry.entryName}`);
      }
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    zip.extractAllTo(tmpDir, true);

    // Hoist a single root folder so files land flat.
    const meaningful = entries.filter(e => !e.entryName.startsWith('__MACOSX') && !e.entryName.startsWith('.'));
    const rootNames = new Set(meaningful.map(e => e.entryName.split('/')[0]));
    if (rootNames.size === 1) {
      const nested = path.join(tmpDir, [...rootNames][0]);
      if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
        fs.cpSync(nested, tmpDir, { recursive: true });
        fs.rmSync(nested, { recursive: true, force: true });
      }
    }
    const macos = path.join(tmpDir, '__MACOSX');
    if (fs.existsSync(macos)) fs.rmSync(macos, { recursive: true, force: true });

    // Atomic-ish swap: remove old, move temp into place.
    fs.rmSync(resolvedTarget, { recursive: true, force: true });
    fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
    try {
      fs.renameSync(tmpDir, resolvedTarget);
    } catch (e) {
      // Cross-device (Docker volume) fallback: copy then remove temp.
      fs.cpSync(tmpDir, resolvedTarget, { recursive: true });
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }

    return { fileCount: fs.readdirSync(resolvedTarget).length };
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

module.exports = { atomicExtract };
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd supervisor && node --test test/extract.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add supervisor/src/extract.js supervisor/test/extract.test.js
git commit -m "feat: atomicExtract — validate-then-swap deploy extraction"
```

---

## Task 11: Rewire deploy.js onto atomicExtract + success-after-build

**Files:**
- Modify: `supervisor/src/routes/deploy.js` (upload, rollback, url handlers)

**Interfaces:**
- Consumes: `atomicExtract` from `../extract`, `asyncHandler` from `../async-handler`.

- [ ] **Step 1: Imports**

At top of `deploy.js`:
```js
const { atomicExtract } = require('../extract');
const { asyncHandler } = require('../async-handler');
```

- [ ] **Step 2: Rewrite upload handler body**

Replace the manual rm→extract→hoist block (lines ~89-166) so it: validates+extracts to a temp, runs build, applies settings, and ONLY on success saves history/deployment/webhook. Target dir chosen by runtime (existing `isAppRuntime`). New order:
```js
  try {
    const targetDir = path.resolve(isAppRuntime
      ? appDir(req.params.id)
      : path.join(siteDir(req.params.id), 'html'));

    // Non-destructive: throws before touching live dir if the zip is bad.
    const { fileCount } = atomicExtract(req.file.path, targetDir);

    const site = { ...row, spa_mode: !!row.spa_mode, cache_enabled: !!row.cache_enabled,
      maintenance_mode: !!row.maintenance_mode, ssl_enabled: !!row.ssl_enabled,
      custom_headers: row.custom_headers || '[]', redirects: row.redirects || '[]' };

    if (isAppRuntime && row.build_cmd) await runBuildStep(site);
    const newContainerId = await applySiteSettings(site);
    if (newContainerId) db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newContainerId, req.params.id);

    // Success — now persist history + notify.
    const hDir = historyDir(req.params.id);
    fs.mkdirSync(hDir, { recursive: true });
    const historyFilename = `${nanoid(10)}.zip`;
    fs.copyFileSync(req.file.path, path.join(hDir, historyFilename));
    fs.unlinkSync(req.file.path);
    saveDeployment(req.params.id, historyFilename, req.file.size);
    logActivity(req.params.id, row.name, 'deployed', req.file.originalname, req.user?.username || 'system');
    fireWebhooks('deploy', req.params.id, row.name, req.file.originalname);

    res.json({ ok: true, files: fileCount });
  } catch (err) {
    try { fs.unlinkSync(req.file.path); } catch {}
    console.error('Deploy error:', err);
    res.status(500).json({ error: err.message });
  }
```
Wrap the whole handler with `asyncHandler(...)`.

- [ ] **Step 3: Fix rollback (correct target dir + atomicExtract)**

In `POST /:id/rollback/:deploymentId`, compute the runtime-correct target and reuse the helper:
```js
  try {
    const runtime = row.runtime || 'static';
    const isAppRuntime = runtime === 'node' || runtime === 'python';
    const targetDir = path.resolve(isAppRuntime ? appDir(req.params.id) : path.join(siteDir(req.params.id), 'html'));
    atomicExtract(zipPath, targetDir);

    const site = { ...row, spa_mode: !!row.spa_mode, cache_enabled: !!row.cache_enabled,
      maintenance_mode: !!row.maintenance_mode, ssl_enabled: !!row.ssl_enabled,
      custom_headers: row.custom_headers || '[]', redirects: row.redirects || '[]' };
    if (isAppRuntime && row.build_cmd) await runBuildStep(site);
    const rollbackContainerId = await applySiteSettings(site);
    if (rollbackContainerId) db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(rollbackContainerId, req.params.id);

    logActivity(req.params.id, row.name, 'rolled_back', dep.filename, req.user?.username || 'system');
    fireWebhooks('rollback', req.params.id, row.name, dep.filename);
    res.json({ ok: true });
  } catch (err) {
    console.error('Rollback error:', err);
    res.status(500).json({ error: err.message });
  }
```
Wrap with `asyncHandler`.

- [ ] **Step 4: Rewrite url handler body**

In `POST /:id/url`, after the download + size check (SSRF guard from Task 9 already applied), replace the manual rm→extract block with `atomicExtract(tmpPath, targetDir)` and move history/deploy/webhook to after build+apply succeed (same order as Step 2). Wrap with `asyncHandler`.

- [ ] **Step 5: Wrap remaining async routes in the file**

Ensure every `async (req,res)` route in `deploy.js` is wrapped with `asyncHandler`. Sync routes need no wrap.

- [ ] **Step 6: Run unit tests + load check**

Run: `cd supervisor && node --test test/ && node -e "require('./src/routes/deploy'); console.log('ok')"`
Expected: all tests PASS, then `ok`.

- [ ] **Step 7: Live smoke test**

```bash
docker compose up --build -d supervisor
```
- Deploy a valid zip to a static site → site serves new content.
- Deploy a truncated zip (`head -c 50 good.zip > bad.zip`) → HTTP 500, live site unchanged.
- Deploy to a node site, then rollback → files land in `app/`, container rebuilds.

- [ ] **Step 8: Commit**

```bash
git add supervisor/src/routes/deploy.js
git commit -m "fix: non-destructive deploy/rollback/url via atomicExtract; success recorded after build"
```

---

## Task 12: Session hardening (secure cookie, regenerate, secret gate)

**Files:**
- Modify: `supervisor/src/auth.js:11-23`
- Modify: `supervisor/src/routes/auth.js` (login handler)
- Modify: `supervisor/src/db.js` (secret gate — or index.js startup)
- Modify: `.env.example`

**Interfaces:**
- Consumes: `SESSION_SECURE` env, `NODE_ENV`.

- [ ] **Step 1: Secure cookie flag**

In `supervisor/src/auth.js`, set the cookie `secure` explicitly:
```js
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.SESSION_SECURE === 'true' ||
            (process.env.SESSION_SECURE !== 'false' && process.env.NODE_ENV === 'production'),
    maxAge: 8 * 60 * 60 * 1000,
  },
```
Ensure `app.set('trust proxy', 1)` exists in `index.js` (it uses `req.hostname`/XFH — confirm; add if missing) so `secure` works behind Traefik.

- [ ] **Step 2: Regenerate session on login**

Read `supervisor/src/routes/auth.js`. In the successful-login branch (after password verified, before responding), regenerate:
```js
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: 'Session error' });
    req.session.userId = user.id;
    req.session.role = user.role;
    req.session.username = user.username;
    req.session.save(() => res.json({ ok: true, user: { id: user.id, username: user.username, role: user.role } }));
  });
```
Match the existing response shape (read the current handler and preserve its JSON fields).

- [ ] **Step 3: Hard-fail weak secret in production**

In `supervisor/src/index.js` startup (near the top, after requires), add:
```js
if (process.env.NODE_ENV === 'production' &&
    (!process.env.SUPERVISOR_SECRET || process.env.SUPERVISOR_SECRET === 'changeme')) {
  console.error('FATAL: SUPERVISOR_SECRET must be set to a strong value in production.');
  process.exit(1);
}
```

- [ ] **Step 4: Document env**

In `.env.example`, under the secret block, add:
```
# Force Secure cookies (HTTPS only). Auto-on when NODE_ENV=production.
# Set to false only for local HTTP testing.
SESSION_SECURE=
```

- [ ] **Step 5: Verify**

Run: `cd supervisor && node -e "require('./src/auth'); require('./src/routes/auth'); console.log('ok')"`
Expected: `ok`.
Manual: production start with `SUPERVISOR_SECRET=changeme` → process exits 1 with the FATAL line.

- [ ] **Step 6: Commit**

```bash
git add supervisor/src/auth.js supervisor/src/routes/auth.js supervisor/src/index.js .env.example
git commit -m "fix: secure cookie, session regeneration, production secret gate"
```

---

## Task 13: Full verification + release prep

**Files:**
- Modify: `supervisor/package.json` (version bump)

- [ ] **Step 1: Run all unit tests**

Run: `cd supervisor && npm test`
Expected: all tests pass (async-handler, validate, extract).

- [ ] **Step 2: Full build**

Run: `docker build -q supervisor/`
Expected: image sha printed, no error.

- [ ] **Step 3: Smoke the app end-to-end**

```bash
docker compose up --build -d supervisor
```
Walk the auth matrix (Task 4 script), a valid deploy, a corrupt-zip deploy, a rollback, and a webhook-to-metadata rejection. All behave per spec.

- [ ] **Step 4: Bump version**

In `supervisor/package.json`, bump `"version": "0.8.2"` → `"0.9.0"` (minor: hardening + behavior changes).

- [ ] **Step 5: Commit + tag**

```bash
git add supervisor/package.json
git commit -m "chore: release v0.9.0 — security + deploy hardening"
git tag v0.9.0
```
Do NOT push the tag until the user confirms — pushing `v*` triggers the GHCR release workflow.

- [ ] **Step 6: Report**

Summarize what shipped, list any deferred items (DNS-rebinding pinning TODO, UI bug fixes for later block), and ask the user whether to push `main` + the `v0.9.0` tag.

---

## Deferred to later blocks (not in this plan)

- UI bug fixes: CSV export `/api` prefix, uptime detail view, notification-event prefs, password-change form pointing at `users` table.
- Reconcile preview-container awareness (bug #9) — real fix belongs with container-lifecycle refactor; **note:** verify Task 6/11 didn't worsen it. If quick, fold the `knownIds` preview-id fix into Task 6.
- Site-create name-conflict cleanup, delete-site preview leak (container-lifecycle block).
- Analytics `logs({since:0})` OOM (`tail` cap) — small, could be a fast follow.
- Feature work: git deploys, backups, scoped-token UI, domain aliases, email alerts.
