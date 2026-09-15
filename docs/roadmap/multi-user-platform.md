# Grimport 1.0 — Multi-user platform plan

Status: proposal, 2026-09-15. Written for the project owner; everything here is a plan, nothing is implemented yet.
Baseline: v0.9.6 (roles admin / editor / viewer, per-site grants, scoped API tokens, self-update, container image updates).

The goal: invite friends who know little about hosting, let them publish and manage their own sites safely, keep the ability to help them when something breaks, and let Claude (Cowork / Claude Code) deploy straight into the panel — without turning the server into a liability.

---

## 0. Ground rules (apply to every phase)

1. **Docs are part of the feature.** A feature is done when the wiki page, README bullet, API reference entry, screenshot and CHANGELOG line exist. Not before. See section 11.
2. **Nothing sensitive ever enters git.** No `.env`, no database, no backups, no site content, no tokens, no real user names, no real screenshots. The public/private split is in section 10 and is enforced by tooling (gitleaks in CI + pre-commit), not by memory.
3. **Screenshots come from demo data only.** A checked-in seed script creates fictional sites and users; the screenshot tool renders from that. Personal domains (`*.boe.zip`) never appear in the repo.
4. **Security before invitations.** Phase 1 (tenant isolation) ships before the first invite goes out. A friend's compromised site must not be able to reach the panel, other sites, or the host.
5. **Every action has an actor.** Everything a user or admin does on someone else's site is written to the activity log with `actor`, `target_user` and `site_id`. Support access is transparent, never silent.

---

## 1. Personas and use cases

| Persona | Who | Knows | Wants |
|---|---|---|---|
| **Owner** | You. Runs the server, pays for it. | Docker, DNS, everything | Invite people, set limits, fix things fast, sleep at night |
| **Beginner** | A friend with a wedding page, a club site, a portfolio | Drag-and-drop, a Webflow/Framer export | "Put this online under a nice address, keep it online" |
| **Maker** | A friend who builds small Node/PHP/Python apps | Some coding, git, maybe Docker | A place to run an app, logs, env vars, a custom domain |
| **Agent** | Claude in Cowork or Claude Code, acting for the Owner or a Maker | The API, via MCP | Create a site and deploy a build output in one step, read logs when it fails |
| **Support** | The Owner acting on a friend's site | | Open their site, see logs, redeploy, roll back, without asking for their password |

Use cases (UC-n are referenced from the phases):

- **UC-1 Invite.** Owner creates an invitation (name, role, quota) and sends the link via chat. Friend opens it, picks username + password, lands in a guided first-run.
- **UC-2 First site, beginner.** Beginner drags a zip, gets `name.sites.example` automatically, sees "Online" with a link. No DNS, no runtime choice, no headers. Advanced settings hidden.
- **UC-3 Custom domain.** Beginner or Maker wants `their-domain.tld`. They enter it, the panel shows the exact DNS record, the Owner approves (or auto-approve if the policy allows), DNS check goes green.
- **UC-4 App site, maker.** Maker creates a Node site, sets start command + env vars, deploys, watches logs, sees CPU/RAM.
- **UC-5 Something is down.** Friend gets a push/bell notification, sees "Container exited (out of memory)", can restart or roll back themselves. Owner sees the same in their feed and can step in.
- **UC-6 Support.** Owner opens the friend's site with a visible "support mode" banner, fixes the deploy, the friend gets a notification "Owner rolled back Bakery to deploy #4".
- **UC-7 Agent deploy.** From Cowork: "publish this folder to my portfolio site". The MCP zips the folder, deploys to a preview, the security check runs, the agent reports the preview URL, the user says "go live".
- **UC-8 Abuse.** A hosted site turns out to be phishing or a miner. Owner suspends the site (maintenance page, container stopped) and the user, with one click each, and the audit log shows what happened.
- **UC-9 Leaving.** A friend leaves: their sites are transferred to the Owner or deleted, tokens revoked, data exported on request.
- **UC-10 Phone.** Everything in UC-5 and UC-6 works from a phone, installed as a PWA with push notifications.

---

## 2. Roles and permissions model

### Today
`admin` (everything), `editor` (deploy + settings on granted sites), `viewer` (read granted sites). Grants live in `site_permissions`. Tokens carry a role and an optional site scope.

### Proposed

Two layers: a **platform role** and a **site role**.

**Platform roles**

| Role | Purpose |
|---|---|
| `owner` | Exactly one. Cannot be deleted or demoted. Runs updates, backups, users. |
| `admin` | Same as owner except user/quota management of other admins. Optional; for a trusted co-admin. |
| `member` | An invited friend. Can create sites within their quota, owns those sites, invites collaborators to their own sites. |
| `guest` | Cannot create sites; only has site roles granted by others. Replaces today's global `viewer`. |

**Site roles** (per site, in a new `site_members` table)

| Site role | Can |
|---|---|
| `owner` | Everything on the site incl. delete, transfer, members, domain change |
| `editor` | Deploy, rollback, preview, settings except domain/delete/members |
| `viewer` | Read status, logs, analytics |

Owner/admin have implicit `owner` on every site ("support access", see section 4).

**Capabilities and quotas per member** (set at invite time, editable later; stored as JSON on the user)

| Capability | Default for a Beginner | Default for a Maker |
|---|---|---|
| `runtimes` | `["static"]` | `["static","php","node","python"]` |
| `max_sites` | 3 | 10 |
| `max_upload_mb` | 100 | 250 |
| `disk_quota_mb` | 1000 | 5000 |
| `custom_domains` | `approval` (Owner approves) | `approval` |
| `subdomain_base` | inherited from panel setting | inherited |
| `api_tokens` | yes, scoped to own sites | yes |
| `webhooks` | no | own sites |

**Capability matrix** (who may do what)

| Action | owner/admin | member (own site) | site editor | site viewer |
|---|---|---|---|---|
| Create site | yes | within quota | no | no |
| Delete / transfer site | yes | yes | no | no |
| Change domain | yes | subdomain: yes; custom: request | no | no |
| Choose runtime | yes | within `runtimes` | no | no |
| Deploy / rollback / preview | yes | yes | yes | no |
| Logs / analytics / uptime | yes | yes | yes | yes |
| Headers / redirects / basic auth | yes | yes (Advanced) | yes | no |
| Env vars / start command | yes | yes if runtime allowed | yes | no |
| Invite collaborators to site | yes | yes | no | no |
| API tokens | any scope | own sites only | own sites only | own sites, viewer role |
| Webhooks / ntfy | yes | own sites, if capability | no | no |
| Backups, users, updates, containers, panel settings | yes | no | no | no |
| Suspend site / user | yes | no | no | no |

**Data model changes**

- `users`: add `email` (nullable), `display_name`, `status` (`invited`, `active`, `disabled`), `platform_role`, `capabilities` (JSON), `totp_secret` (nullable), `last_login_at`.
- `invitations`: `id`, `token_hash`, `created_by`, `platform_role`, `capabilities`, `expires_at`, `used_by`, `used_at`.
- `sites`: add `owner_id`, `status` (`active`, `suspended`, `quarantined`), `disk_bytes` (cached).
- `site_members`: `site_id`, `user_id`, `site_role` (replaces `site_permissions`, migrated).
- `notifications`: add `user_id` (null = every admin). Today the bell is global; per-user scoping is a prerequisite for inviting anyone.
- `api_tokens`: add `user_id`; token rights are the intersection of token scope and the user's rights, evaluated at request time.
- `activity`: add `target_user_id`. Existing `actor` stays.
- `domain_requests`: `site_id`, `domain`, `requested_by`, `status`, `decided_by`.

Migration: existing `admin` becomes `owner` (first admin) or `admin`; existing `editor`/`viewer` users become `guest` with the matching site role on each granted site; all existing sites get `owner_id` = the owner.

---

## 3. What multi-user means for every existing feature

| Feature | Today | Change needed | Size |
|---|---|---|---|
| Sites list | admin sees all, others see grants | Scope by `site_members`; owner/admin see all with an owner column and an "owned by" filter | S |
| Create site | admin only | Members within quota; runtime picker limited by `runtimes`; domain field defaults to `slug.base` and custom domains open a request | M |
| Deploy (zip / URL) | per-site grant | Add per-user `max_upload_mb`, disk quota check before extract, zip entry/size limits (section 8) | S |
| Preview / swap | per-site grant | Unchanged, plus quarantine state (section 8) | S |
| Rollback / history | per-site grant | Unchanged | – |
| Logs | per-site grant | Unchanged; suspended sites show the suspension reason | S |
| Analytics | per-site grant | Unchanged | – |
| Overview | admin only | Members get an overview of their own sites; owner/admin see all | S |
| Activity | admin sees all; others only their sites | Add "by me / on my sites / everything (admin)" filter; add `target_user` | S |
| Notifications (bell) | global | Per-user rows; site_down goes to the site owner + members + admins; unknown_domain to admins only | M |
| Webhooks | admin, global | Per-site webhooks owned by the site owner (capability-gated); admin keeps global ones | M |
| ntfy alerts | admin, global | Per-user ntfy topic (member gets their own site events) | S |
| API tokens | admin creates, any scope | Every user manages their own tokens; scope ≤ their rights; admin can list/revoke all | M |
| Backups | admin | Unchanged; later: per-site export for members (zip of current html) | S later |
| Panel settings | admin | Unchanged; add policy settings (default capabilities, domain approval mode, quarantine mode) | M |
| Users | admin creates with password | Invitations (section 4), profile self-service, suspend, transfer, delete-with-transfer | L |
| Updates / containers | admin | Unchanged | – |
| DNS check | any site access | Members see status + the records they need; custom domain requests carry the check result | S |
| Domains view | admin | Owner/admin only; add request queue | S |
| Command palette | role-aware | Filter by site role; add "Invite", "Support mode" | S |
| Phone tab bar | per browser | Unchanged | – |
| Onboarding wizard | first admin only | Per-role first-run (section 4) | M |
| Self-update | admin | Unchanged | – |

Cross-cutting: every route that reads a site must go through one `requireSiteRole('viewer'|'editor'|'owner')` helper; the existing `requireSiteAccess` is renamed and extended. One place, one test matrix (`test/auth-matrix.sh` already exists as a starting point).

---

## 4. Login, invitations, onboarding, learning, support

### Invitations (UC-1)
- Owner: Settings → Users → "Invite" → name, platform role, capability preset (Beginner / Maker / custom) → the panel shows a one-time link (48 h). No email required; the link is pasted into a chat. Optional SMTP later.
- Friend: opens link → picks username + password (zxcvbn strength meter, min 10) → optional TOTP → lands in first-run.
- Invitation tokens are hashed at rest, single-use, revocable.

### Login
- Keep username + password + rate limit. Add TOTP (optional for members, required for owner/admin), recovery codes, a sessions list with "sign out everywhere", "remember this device" (30 days).
- Passkeys (WebAuthn) as a later phase; the session store already supports multiple sessions.
- Cloudflare Access decision (section 13): either every friend also gets a Cloudflare Access identity (extra friction, extra safety), or the panel host is exempted from Access and relies on Grimport's own auth + 2FA + Cloudflare WAF/rate limiting. Recommendation: exempt the panel, require 2FA for owner/admin, keep Access for nothing else.

### First-run per role (UC-2)
- Member first-run: three steps. "Your address" (shows `name.base`), "Your first site" (drop zip, or pick a starter template: blank / one-page / portfolio / coming-soon), "Where to look when something breaks" (points at status, logs, the bell). Ends with the site live.
- Beginner mode (capability `advanced_ui: false`): site settings show only Name and Domain; Behaviour/Access/App tabs move behind "Advanced settings" and are off by default. Deploy modal loses the URL tab.
- Contextual help: every field with a `field-help` gets a "Learn more" link into the wiki page section. A "Help" entry in the drawer opens the Getting-Started page in-panel (iframe of the wiki is fine).

### Support mode (UC-6)
- Owner/admin opening a site they do not own sees a persistent banner "Support mode — Anna's site. Actions are logged and Anna is notified."
- Every mutating action creates an activity row with `target_user_id` and a notification for the site owner.
- Optional later: "ask before acting" — the member can require approval for destructive actions (delete, domain change) even by support.

### Leaving (UC-9)
- Delete user → dialog: transfer sites to owner (default) or delete sites. Tokens revoked, sessions killed, invitations cancelled. Export: "Download my sites" zip (per-site export from Backups).

---

## 5. UI/UX polish — compact density

The redesign shipped at a comfortable density; the request is a tighter, more "utility" feel. One pass over the design tokens, no new components:

| Token / element | Now | Proposed |
|---|---|---|
| Body font | 14 px | 13 px |
| View title | 20 / 600 | 18 / 600 |
| Card title, site name | 14 / 600 | 13 / 600 |
| Table text | 12 px, 28 px rows | 12 px, 26 px rows |
| Button | 7 × 13 px padding, 13 px | 5 × 11 px, 12.5 px; `btn-sm` 4 × 9 px |
| Badges | 11 px, 3 × 7 px | 10 px, 2 × 6 px |
| Site card padding / gap | 16 / 10 px | 14 / 8 px |
| Grid gap | 14 px | 12 px |
| View header bottom margin | 28 px | 20 px |
| Sidebar width | 216 px | 200 px |
| Modal padding / gap | 24 / 20 px | 20 / 16 px |
| Stat tile value | 22 / 700 | 20 / 600 |
| Card header | 12 × 16 px | 10 × 14 px |

Further:
- One primary button per view. Card rows use secondary buttons only; "Deploy" stays primary because it is the main action.
- Optional **list view** for Sites (dense table: name, domain, status, uptime, runtime, actions) remembered per user; the card grid stays the default on phones.
- Reduce the number of visible tags on cards; runtime and SPA move to a hover/tooltip row on small widths.
- A "Density: comfortable / compact" toggle is not planned; ship one compact scale and adjust from feedback.
- Regenerate all screenshots after the pass (section 11).

---

## 6. PWA and mobile

- `manifest.webmanifest`: name, short name, `display: standalone`, `start_url: /`, theme/background colours for both themes, icons 192/512 (+ maskable) generated from the SVG logo at build time (a small script in `tools/`, output committed).
- Service worker: precache the app shell (HTML, CSS, JS, logo), network-first for `/api/*`, offline page for the shell, `skipWaiting` + a toast "New version — reload" when the panel updates itself.
- iOS: `apple-touch-icon`, `apple-mobile-web-app-capable`, status-bar style, `viewport-fit=cover` and safe-area insets on the top bar and bottom tab bar (bottom already has it).
- Touch: minimum 44 px targets on phone (card buttons, overflow menu rows), pull-to-refresh on Sites, swipe to close the drawer.
- Web push (UC-5, UC-10): VAPID key pair generated on first run and stored in the DB (private), subscription per user + device, events: site_down, site_up, deploy_failed, security_review. Falls back to ntfy where push is unavailable.
- "Install" hint once per device after the second visit.

---

## 7. MCP server for Claude (Cowork / Claude Code) — UC-7

**Package** `grimport-mcp` in `mcp/` (published to npm later): a stdio MCP server; configuration via `GRIMPORT_URL`, `GRIMPORT_TOKEN`, optional `CF_ACCESS_CLIENT_ID` / `CF_ACCESS_CLIENT_SECRET` for panels behind Cloudflare Access.

Tools (all thin wrappers over the existing REST API):
- `list_sites`, `get_site(id)`, `get_site_status(id)` (container, uptime, DNS)
- `create_site(name, domain?, runtime?)` — domain defaults to the caller's subdomain policy
- `deploy_directory(site_id, path, preview?)` — zips a local folder (respecting `.gitignore`), uploads, returns the deploy summary and URL
- `deploy_zip(site_id, zip_path, preview?)`, `deploy_url(site_id, url)`
- `preview_swap(site_id)`, `preview_discard(site_id)`, `rollback(site_id, deployment_id)`
- `get_logs(site_id, lines)`, `get_deploy_history(site_id)`
- `set_maintenance(site_id, on)`, `set_env_vars(site_id, vars)` (Maker capability only)
Resources: `grimport://sites` (list), `grimport://sites/{id}/logs`. Prompt: `publish-project` ("zip this build output, deploy to preview, report the URL, wait for go-live").

**Server side**: nothing new for v1 — it runs on the existing API with a scoped, expiring token created by the user for "Claude". Add `GET /api/me` (rights, quota, subdomain base) so the agent can explain limits instead of failing.

**Later**: a remote MCP endpoint (`/mcp`, Streamable HTTP, token auth) so Cowork connects without a local install. Behind Cloudflare Access this needs an Access bypass rule for `/mcp` (the endpoint authenticates itself) or a service token.

**Safety**: agent deploys follow the same review pipeline as human deploys (section 8); agent tokens default to `preview` deploys, "go live" stays a human click unless the user opts in.

---

## 8. Security: hostile or careless tenants (inside-out threats)

### Threat model
A member (or their leaked token, or an agent gone wrong) deploys content or code that:
1. attacks the panel or other sites from inside the Docker network,
2. exhausts host resources (CPU, memory, disk, PIDs, bandwidth),
3. abuses the server for spam, scanning, crypto-mining, or as a C2/relay,
4. serves phishing, malware, or illegal content under your domain,
5. leaks secrets (their own or others') via the served files.

### What the code does today (facts from v0.9.6)
- Site containers, Traefik and the supervisor all share one Docker network (`webhost-net`). A site container can reach `webhost-supervisor:3000` directly — bypassing Cloudflare Access — and any other site container.
- No resource limits on site containers (memory, CPU, PIDs). One runaway app can take the host down.
- Processes run as root inside the container (`nginx:alpine`, `node`, `python`, `php` images).
- Unrestricted egress from every site container.
- Deploy: 250 MB upload limit, zip-slip check, atomic swap. No limit on entry count or uncompressed size (zip bomb), no disk quota, no content inspection.
- Node/Python/PHP sites run arbitrary code with their app directory mounted read-write.
- Unknown domains hit the supervisor catch-all; the panel itself is reachable on the tunnel hostname only.

### Mitigations

**Phase 1 — isolation and limits (ship before the first invite)**
- One Docker network per site (`webhost-site-<id>`, `internal` for static sites). Traefik joins each site network; the supervisor moves to a separate `webhost-mgmt` network that only Traefik and the supervisor share. Sites cannot reach the panel or each other.
- Egress policy: static sites need none (`internal: true`). App sites get egress through a small forward proxy container (allow-list of hostnames per site, HTTPS only) — or, simpler for v1, an iptables `DOCKER-USER` rule set that blocks RFC1918 and the host from site networks and rate-limits new outbound connections. Document the chosen approach in the wiki.
- Per-container limits in `createSiteContainer` / `createAppContainer`: `Memory` (256 MB static, 512 MB app, per-user override), `NanoCpus` (0.5), `PidsLimit` (256), `CapDrop: ALL` (+ `NET_BIND_SERVICE` only where needed), `SecurityOpt: no-new-privileges`, read-only root filesystem for static sites with a tmpfs for nginx cache/pid, default seccomp profile, `Ulimits` for open files.
- Non-root images: `nginxinc/nginx-unprivileged:alpine` for static (port 8080), `USER node` for Node, `USER 1000` for Python, PHP via `php:8.3-apache` with `APACHE_RUN_USER` and a non-root port. These become new entries in `RUNTIME_IMAGES`; the container-update job recreates existing containers.
- Deploy hardening: max entries (20 000), max uncompressed size (4 × upload limit), reject symlinks and device files, reject files outside the allowed set for static sites (no `.php`, `.cgi`, `.htaccess` effects — nginx ignores them but they signal intent), per-user disk quota checked before extraction, deploy rate limit per user.
- Runtime policy per user (`runtimes` capability): Beginners get static only. App runtimes are an explicit grant.
- Domain policy: members get `slug.base` automatically; anything else is a request the owner approves. Prevents a member from claiming `login.yourbank.tld`-style hostnames on your server and catches typosquats of your own domains.
- API rate limits per user and per token; token creation requires the user's password (re-auth).

**Phase 4 — content safety on deploy**
- Static scanner (runs in the supervisor, pure Node, no network): secret patterns (AWS keys, private keys, `.env` files), obfuscated or packed JS heuristics, known crypto-miner script signatures and domains, external `<script src>` not on an allow-list, forms posting to third-party hosts, password/credit-card fields combined with well-known brand names (phishing), executables and archives inside the bundle, base64 blobs over a size threshold, `meta refresh`/JS redirects to external hosts on the index page.
- Verdict: `clean` → go live; `review` → deploy lands as a preview ("quarantined"), owner notified with findings, member sees "waiting for review"; `blocked` → deploy rejected with the reasons. Per-site allow-list for false positives, admin-editable.
- Suspend controls (UC-8): "Suspend site" (maintenance page + container stopped + tokens frozen) and "Suspend user" (sessions killed, all their sites suspended). Both one click, both logged, both reversible.
- Legal/hygiene: invitation page shows short house rules (no phishing, no mining, no illegal content, we may suspend); acceptance is stored with timestamp.
- Public-facing sites: keep Cloudflare proxy in front (WAF, rate limiting, bot fight mode) — the panel cannot replace that.

**Phase 6 — LLM review** (section 9) sits on top of the scanner, never replaces it.

---

## 9. LLM review pipeline (n8n + Claude Code agent in a Proxmox CT)

Question: can the Claude Code agent running in the Proxmox container answer n8n calls and review a published app? Yes, with a small wrapper. Two ways to get there:

**Option A — direct, no extra infrastructure (recommended for v1)**
Grimport calls the Anthropic API itself (Sonnet) after the static scan: it sends a manifest (file list, sizes, types, scanner findings) plus the text of a capped set of files (index.html, top-level JS, package.json, anything the scanner flagged; total under ~200 KB) and asks for a strict JSON verdict `{ risk: "low|medium|high", findings: [{ file, line?, category, explanation }], summary }`. The API key lives in panel settings (encrypted at rest with `SUPERVISOR_SECRET`), never in git. Cost: cents per deploy. Latency: seconds. One day of work.

**Option B — orchestrated via n8n, executed by the Claude Code agent in the CT**
1. Grimport fires a webhook `deploy.review_requested` with the deploy id and a one-time download URL for the bundle (token, 15 min).
2. n8n receives it, downloads the bundle, and calls a tiny **agent gateway** in the Proxmox CT (HTTP, HMAC-signed, IP allow-listed, one job at a time, workspace wiped per job).
3. The gateway unpacks the bundle into a throwaway directory and runs Claude Code headless: `claude -p "<review prompt>" --output-format json --allowedTools Read,Grep,Glob` with the working directory set to the bundle. The agent can run `npm audit` on `package.json`, inspect dependencies, follow includes — deeper than Option A.
4. The gateway returns the JSON verdict; n8n posts it to `POST /api/deploy/:id/review` (service token, scoped to reviews only).
5. Grimport applies the verdict (go live / hold / notify) exactly as with the scanner.

Option B is the right place for agentic depth (dependency audits, "does this app phone home", "is this a copy of a bank login page") and for anything you want to keep off the public API key. It needs the gateway (a 150-line Fastify service), an n8n workflow (committed as a template without credentials), and the review endpoint.

**Prompt-injection hardening** (both options)
- Site content is untrusted input. It goes into the prompt inside clear delimiters with the instruction that nothing inside can change the task.
- The static scanner's verdict is authoritative. The LLM can raise risk, never lower it; a `blocked` stays blocked.
- Output is validated against a JSON schema; free text is displayed to admins only, never executed or rendered as HTML.
- The agent gets read-only tools and no network beyond the model API. The gateway CT has no access to the Docker socket, the panel, or the tunnel.
- Reviews are logged with model, prompt version and verdict, so a bad call can be replayed and the prompt improved.

---

## 10. Public vs private — what goes to git

| Public (repo) | Private (never committed) |
|---|---|
| Supervisor code, tests, Dockerfile, compose | `.env`, `data/` (SQLite, sites, backups, certs) |
| Wiki, README, this plan, CHANGELOG | API tokens, session secret, VAPID keys, Anthropic API key |
| Demo seed script (fictional sites/users) | Real user names, emails, domains, screenshots of the live panel |
| Screenshot tool and the PNGs it produces from demo data | Cloudflare Access / tunnel configuration, service tokens |
| MCP package source | `mcp/.env`, any token files |
| n8n workflow **templates** (credentials referenced by name only) | n8n credential exports, gateway HMAC secret, CT hostnames/IPs |
| Agent gateway source and its review prompt | Review results, uploaded bundles |
| CI workflows | The "Grimport Panel UI Redesign.zip" design source stays out unless you decide otherwise |

Enforcement:
- `gitleaks` as a pre-commit hook (documented in CONTRIBUTING) and as a CI job that fails the build.
- `.gitignore` additions: `*.pem`, `*.key`, `mcp/.env`, `n8n/credentials*`, `tools/screenshots/out-live/`, `docs/roadmap/private/`.
- The screenshot tool refuses to run against any host other than `localhost` unless `--i-know` is passed, and never runs with `NODE_ENV=production` data.
- A PR checklist in `.github/pull_request_template.md`: docs updated, screenshots regenerated from demo data, no secrets, migration reversible.

---

## 11. Documentation rule and tooling

Definition of done for every feature or fix:
1. Wiki page or section updated (`docs/wiki/`), including the "why", not only the "how".
2. README: feature bullet and "What's new" line for the next version.
3. API reference entry for every new or changed route, with auth requirements.
4. Screenshot(s) regenerated: `npm run demo-seed` (fictional data: sites like "Bakery landing", "Board-game club", "Sourdough diary"; users "owner", "anna", "ben") then `npm run screenshots` (the puppeteer harness from the audit, moved into `tools/`), committed under `docs/screenshots/`.
5. CHANGELOG.md entry (new file; the release workflow already builds notes from commits, the changelog is the human version).
6. Tests for backend behaviour; the auth matrix script extended for every new role/route pair.

Move the existing audit harness into the repo (`tools/demo-seed.js`, `tools/screenshots.js`) in Phase 0 so that this rule is cheap to follow.

---

## 12. Phases and steps

Sizes: S = a day, M = a few days, L = a week or more. Each phase is one release and ends with docs + screenshots.

**Phase 0 — Foundations (0.10)**
1. Docs rule, PR template, CHANGELOG, gitleaks pre-commit + CI. (S)
2. Demo seed + screenshot tool in `tools/`; regenerate README screenshots from demo data. (S)
3. Compact density pass (section 5) + Sites list view. (M)
4. PWA basics: manifest, icons, service worker shell cache, iOS meta, touch targets. (M)

**Phase 1 — Tenant isolation (0.11), before any invitation**
5. Per-site networks + management network; supervisor unreachable from sites. (M)
6. Container limits, cap drop, no-new-privileges, non-root images; container-update job recreates existing sites. (M)
7. Deploy hardening: zip limits, disk quota, per-user rate limits. (S)
8. Runtime and domain policy settings (defaults only; per-user in Phase 2). (S)
9. Wiki: "Security model" page describing all of the above. (S)

**Phase 2 — Multi-user core (0.12)**
10. Data model migration: platform roles, `site_members`, `owner_id`, per-user notifications and tokens, invitations, capabilities/quotas. (L)
11. `requireSiteRole` everywhere; auth matrix tests for every route × role. (M)
12. Invitations UI + accept flow; profile self-service; TOTP. (M)
13. Scoping in every view (section 3); Overview/Activity/bell per user; per-user tokens and ntfy. (M)
14. Support mode banner + notifications; suspend site/user; transfer/delete user flows. (M)
15. Custom domain requests + approval queue. (S)

**Phase 3 — Onboarding and learning (0.13)**
16. Per-role first-run, starter templates, Beginner mode (Advanced toggle), contextual help links, in-panel Help. (M)
17. House rules on the invitation page. (S)

**Phase 4 — Content safety (0.14)**
18. Static scanner + verdicts + quarantine preview + allow-lists + admin notifications. (L)
19. LLM review, Option A (direct API) behind a setting. (S)

**Phase 5 — MCP (0.15)**
20. `grimport-mcp` stdio package, `GET /api/me`, Cowork/Claude Code recipes in the wiki. (M)
21. Remote MCP endpoint + Cloudflare Access recipe. (M, later)

**Phase 6 — Agentic review (0.16)**
22. Agent gateway in the Proxmox CT, n8n workflow template, `POST /api/deploy/:id/review`, replay log. (M)

**Phase 7 — PWA advanced (0.17)**
23. Web push with VAPID, per-device subscriptions, event preferences; pull-to-refresh; offline page. (M)

Then 1.0.

---

## 13. Decisions needed from the owner

1. Invitations by link only (recommended) or also by email (needs SMTP settings)?
2. Custom domains for members: approval required (recommended) or allowed freely?
3. Default capability preset for friends: Beginner (static only) — agreed?
4. Cloudflare Access on the panel: keep for everyone (each friend needs an Access identity) or exempt the panel and rely on Grimport auth + 2FA (recommended)?
5. LLM review: start with Option A (direct API, one day) — agreed? Option B follows once the gateway exists.
6. MCP: local package first (recommended), remote endpoint later?
7. Egress for app sites: proxy with allow-list (safer, more work) or iptables block-private-only (simpler)?
8. The design zip in the repo root: keep private (recommended) or commit under `docs/design/`?

Answer these and Phase 0 can start.
