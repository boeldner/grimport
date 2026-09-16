# Changelog

All notable changes to Grimport are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Changed
- One design system for the whole panel, built on Apple's Human Interface Guidelines (macOS), W3C design tokens and WCAG 2.2 AA: `style.css` is replaced by five layered stylesheets (`css/tokens.css`, `base.css`, `layout.css`, `components.css`, `views.css`); every view, modal and standalone page (login, invite, OAuth consent, offline) uses the same buttons, fields, segmented controls, tabs, cards, callouts, badges, tables, menus and modals
- Every text passes WCAG AA contrast in both themes; every control is 44px tall on touch screens
- Phone: primary action next to the page title, wide metric tables pin their first column, tab strips fade where more tabs are hidden, modals are bottom sheets with sticky header and actions, tables turn into labelled blocks
- Primary buttons sit last in every action row; destructive confirmations end with an ellipsis
- Code snippets wrap instead of overflowing their card; text areas grow with their content
- Overview tiles read "Reachable" / "Unreachable" and the table shows the HTTP check result

### Fixed
- Stray scrollbar and disappearing tab strip in site settings
- Collaborator rows with mismatched control heights and a second "Save" button
- Stacked cards without spacing on Domains; tables cut off on phones
- The offline page's retry button (blocked by the content security policy)

### Added
- `npm run ui-audit`: browser audit of every view at desktop, wide, phone and light-theme sizes (overflow, scroll containers, clipped text, control heights, contrast, touch targets, overlaps, button order)
- `test/design-lint.test.js`: tokens-only colours, type, spacing, radii and layers; no inline styles; no duplicate component rules; no emoji

## [0.16.0] - 2026-09-16

Phase 6 of the roadmap to 1.0: the panel as a phone app. See [Mobile and PWA](docs/wiki/Mobile-and-PWA.md).

### Added
- Web push: every bell notification (sites down/up, deploys held or blocked, domain requests and decisions, support access, suspensions) reaches subscribed devices while the panel is closed; VAPID keys are generated automatically, each device picks its event groups, tapping a notification opens the matching view
- Settings → Notifications → "Push notifications" card for every user (enable per device, test, device list); the Notifications tab is now visible to members with the admin cards hidden
- Pull to refresh on touch devices
- `/api/push/*` endpoints; `PUSH_DISABLED` setting; deep links `/?view=<name>`

### Changed
- Service worker cache bumped; the MCP and OAuth endpoints are never cached

## [0.15.0] - 2026-09-16

Phase 5 of the roadmap to 1.0: MCP for Claude. Claude Code, Claude Desktop and claude.ai can list, create, deploy, inspect and roll back sites with a token that carries the user's role, scope and quota. See [MCP for Claude](docs/wiki/MCP.md).

### Added
- Remote MCP endpoint `POST /mcp` (Streamable HTTP, stateless, Bearer tokens only) with tools `whoami`, `list_sites`, `get_site`, `get_site_status`, `create_site`, `deploy_zip`, `deploy_url`, `get_deploy_history`, `rollback`, `get_logs`, `start_site`, `stop_site`, `set_maintenance`, `set_env_vars`, `preview_create`, `preview_swap`, `preview_discard`; resources `grimport://sites` and `grimport://sites/{id}/logs`; prompt `publish-project`
- OAuth 2.1 server (dynamic client registration, PKCE, refresh rotation, revocation) so claude.ai custom connectors and Claude Desktop sign in through the panel's own login and a "Connect an app" consent page; issued tokens show under API tokens with a "Connected app" badge and can be revoked there
- Local stdio server `mcp/server.js` for Claude Code with the same tools plus `deploy_directory` (zips a folder honouring `.gitignore`)
- `GET /api/me`: role, capabilities, quota, base domain, accessible sites, MCP endpoint
- Settings → API tokens: "Connect Claude" card with the endpoint and a ready-made `claude mcp add` command
- Login page honours `?next=` for same-origin return paths (used by the consent page)
- `PANEL_URL` and `MCP_JSON_LIMIT` settings

### Changed
- Tokens that belong to a user may create sites within the owner's quota (before: admin tokens only); a site-scoped token gains the site it created and nothing else

## [0.14.1] - 2026-09-16

### Fixed
- Uptime checks reported every site as down since 0.11: the probe still read the container's address on the management network, which site containers left when they moved to per-site networks. Checks now go through Traefik with the site's Host header (following the https redirect for SSL sites), so uptime reflects what a visitor gets; suspended sites are skipped and pre-0.11 containers keep the direct probe as a fallback.

## [0.14.0] - 2026-09-16

Phase 4 of the roadmap to 1.0: content safety. Every upload is scanned before it goes live; what the scanner is unsure about waits for the owner, what it is sure about never lands. See [Security Model](docs/wiki/Security-Model.md#content-safety).

### Added
- Content scanner on every deploy (zip and URL): executables, crypto-miner scripts and phishing patterns are blocked; secrets, obfuscated JavaScript, unknown external scripts, external forms and redirects are marked for review; large inline data is noted
- Quarantine: member uploads marked for review are held next to the live files, the deploy dialog lists the findings, the card shows "Review pending", and the owner approves or rejects under Domains, Deploy reviews (with zip download and an optional note); held uploads can be withdrawn from the card menu
- Scan modes Quarantine / Log only / Off and a panel-wide allow-list of external script hosts (Settings, General); per-site allow-list for site owners (Site settings, Access)
- API: `202` with `pending_review` and `422` with findings on deploy; `GET/DELETE /api/sites/:id/review`, `PUT /api/sites/:id/scan-allowlist`, `/api/reviews` queue for admins; `scan_mode` and `scan_script_allowlist` on `/api/settings/policies`
- Activity events and notifications for held, blocked, approved, rejected and withdrawn uploads; the Domains badge counts reviews too

### Changed
- Deploys extract into a staging directory and are promoted atomically only after the scan
- Demo seed includes a held upload; new screenshots for the review dialog and scanner settings

## [0.13.0] - 2026-09-16

Phase 3 of the roadmap to 1.0: onboarding and learning.

### Added
- Member first-run wizard: your address, your first site (name + starter template, created and published in one go), where to look when something breaks
- Starter templates (Blank, One page, Portfolio) — pick one when creating a site or apply later from the card menu; `GET /api/templates`, `POST /api/templates/:id/apply/:siteId`
- Contextual help links next to the fields people ask about (domain, runtime, SPA fallback, caching, basic auth, tokens, two-factor)
- In-panel Help (sidebar, drawer and command palette) linking the wiki pages and the issue tracker

### Changed
- Docker image now ships the starter templates

## [0.12.0] - 2026-09-16

Phase 2 of the roadmap to 1.0: multi-user core and panel hardening. Invite friends, give them their own sites within quotas, help them when things break, and keep the panel safe on the public internet. See [Users and Roles](docs/wiki/Users-and-Roles.md) and the [Security Model](docs/wiki/Security-Model.md).

### Added
- Platform roles owner / admin / member / guest and site roles owner / editor / viewer; sites have an owner and collaborators
- Capability presets (Beginner: static only, 3 sites; Maker: all runtimes, 10 sites) with per-user overrides: runtimes, site count, upload and disk quota, custom-domain policy, API tokens, webhooks, advanced UI
- Link-only invitations (single use, 48 h) with an accept page; users can be disabled (sessions, tokens and sites suspended) or deleted with their sites transferred or removed
- Members get an automatic `<slug>.<base domain>`; custom domains become requests the owner approves under Domains
- Support mode: admins acting on somebody else's site see a banner, the action is logged with the owner as target, and the owner is notified
- Per-user notifications and per-user API tokens (a token never exceeds its owner's rights); site suspension; ownership transfer
- Beginner mode hides advanced site settings behind a toggle; profile card with display name
- Login lockout (5 failures, exponential backoff, alert to the owner), TOTP two-factor authentication with recovery codes (`require_totp_admins` policy), session list with revocation and "remember this device", CSRF header check, Content-Security-Policy with per-request nonces
- Policies card: custom domain policy, default preset, invitation validity

### Changed
- Existing admins become owner (first) and admin; existing editors and viewers become guests keeping their per-site rights as site roles; existing sites and tokens belong to the owner
- Settings is reachable for every user (own tokens, profile, password, 2FA); admin tabs stay admin-only
- Notification bell shows only what concerns you

### Upgrade notes
- Log in once after the update and check Settings > Users: roles were migrated automatically
- Enable two-factor authentication for the owner account (Settings > Security) before inviting anyone
- Scripts and CI that call the API keep working; tokens are now owned by the user who created them

## [0.11.0] - 2026-09-15

Phase 1 of the roadmap to 1.0: tenant isolation. Ships before the first invitation goes out. See the new [Security Model](docs/wiki/Security-Model.md) page.

### Added
- One Docker network per site (`webhost-site-<id>`, a /24 from `SITE_NET_POOL`); static sites and previews on `internal` networks, Traefik attached per network, the supervisor attached to none
- Egress guard sidecar (`egress-guard` in docker-compose.yml): app sites cannot reach private ranges, other sites or cloud metadata, and new outbound connections are rate-capped
- Container hardening: memory/CPU/PID caps, no swap, all capabilities dropped, no-new-privileges, nofile ulimit; static sites on `nginxinc/nginx-unprivileged` with a read-only root filesystem; Node and Python as uid 1000; PHP keeps only the four capabilities Apache needs
- Deploy limits: entry count, uncompressed size, single-file size, symlink and NUL-byte rejection, post-extraction size check, per-site disk quota (HTTP 413)
- Rate limits: 600 API requests / 15 min per user, token or IP; 30 deploys / 10 min (HTTP 429, `API_RATE_LIMIT`, `DEPLOY_RATE_LIMIT`)
- Settings > General > Updates shows why a container is outdated (image, network or both); the rolling update migrates legacy containers onto their own networks
- New environment variables: `SITE_NET_POOL`, `SITE_MEMORY_STATIC_MB`, `SITE_MEMORY_APP_MB`, `SITE_CPUS`, `SITE_PIDS`, `TRAEFIK_CONTAINER`, `EGRESS_GUARD_INTERVAL`, `EGRESS_NEW_CONN_PER_SEC`, `DEPLOY_MAX_ENTRIES`, `DEPLOY_MAX_TOTAL_MB`, `DEPLOY_MAX_FILE_MB`, `SITE_DISK_QUOTA_MB`

### Changed
- Static site containers listen on 8080 (unprivileged nginx); the generated nginx.conf and Traefik labels follow
- Deleting a site removes its container, preview container and network
- Reconcile re-attaches Traefik to every site network at boot and every five minutes

### Upgrade notes
- After the panel update, open Settings > General > Updates and run "Update outdated containers": every existing site is recreated on its own network (about two seconds of downtime each)
- To get the egress guard, pull the repository (`install.sh --update` or `git pull`) and run `docker compose up -d`

## [0.10.0] - 2026-09-15

Phase 0 of the roadmap to 1.0: foundations.

### Added
- Progressive web app: manifest, icons, service worker (app shell cached, API never cached), offline page, "new version" reload prompt, install hint; iOS safe areas and 44 px touch targets on phones
- Sites list view next to the card grid (remembered per browser; phones always show cards)
- Demo seed and screenshot tooling (`npm run demo-seed`, `demo-serve`, `screenshots`); all screenshots in the repo come from fictional demo data
- CI workflow (tests, gitleaks, npm audit), PR template, pre-commit secret scan, CHANGELOG, definition of done in CONTRIBUTING
- Roadmap to 1.0 (`docs/roadmap/multi-user-platform.md`)

### Changed
- Compact density pass: 13 px body text, smaller buttons, badges, cards, modals and tables, 200 px sidebar
- Release workflow builds amd64 and arm64 on native runners (no more QEMU hangs)
- Design sources and internal planning notes are no longer part of the repository

## [0.9.6] - 2026-09-15

A UI audit release plus one long-missing piece of housekeeping.

### Added
- Site container image updates: Settings > General > Updates panel shows which site containers run an outdated runtime image, pulls fresh images and recreates outdated containers one at a time
- Per-site "Update container" action from the card's overflow menu
- API routes: `GET /api/update/images`, `POST /api/update/images/pull`, `POST /api/update/images/apply`, `GET /api/update/images/status`, `POST /api/sites/:id/recreate`
- Customizable phone tab bar: pick which views appear and in what order (Settings > General, or the drawer on a phone)
- Cloudflare-aware DNS status: proxied/tunnelled domains report a new "proxied" state instead of "wrong"

### Fixed
- Toggles and checkboxes rendering stacked and centered in forms
- Buttons stretching to full width inside forms
- Settings column too narrow, causing tabs to wrap and tables to overflow their cards
- Uptime popover rendering as a black box in light mode
- Notification dropdown too narrow, now widened
- Site card text overflow (ellipsis) and uneven card heights
- Phone grid overflow
- Bottom nav on phone showing only one tab
- Basic-auth password dropped from `.htpasswd` after saving site settings

### Changed
- All icons are inline SVG now (no emoji or text-symbol icons)
- Removed the last remnants of the old red brand colors
- Dockerfile uses `npm ci` with a lockfile
- Release workflow builds each platform on a native runner

## [0.9.5] - 2026-07-14

A full redesign of the panel UI, plus a round of features that were previously roadmap items.

### Added
- macOS-native redesigned UI with dark/light theme and a command palette (Cmd-K)
- Responsive layout, including a dedicated phone monitoring view
- Multi-user roles (admin / editor / viewer) with per-site access grants
- API tokens with role and site scoping and optional expiry
- Blue-green preview deploys with one-click swap to production
- Built-in analytics (requests, bytes, status codes, latency) per site and fleet-wide
- In-panel notifications with per-event preferences, plus ntfy push alerts
- Outbound webhooks for deploy/rollback/uptime events
- Built-in scheduled backups with configurable retention, downloadable from the panel
- One-click self-update from the panel
- First-run onboarding wizard
- Accessibility pass: focus-visible, ARIA roles, keyboard navigation, reduced-motion support

### Changed
- `SESSION_SECURE` is now opt-in (default off) - see [Configuration](docs/wiki/Configuration.md)
