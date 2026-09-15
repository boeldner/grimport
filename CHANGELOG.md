# Changelog

All notable changes to Grimport are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [Unreleased]

### Added
- CI workflow (tests, gitleaks, npm audit), PR template, pre-commit secret scan, CHANGELOG

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
