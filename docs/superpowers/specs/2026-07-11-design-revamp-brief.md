# Grimport — UI Design Revamp Brief (design-agnostic)

Date: 2026-07-11
For: an independent designer, unfamiliar with the product, approaching the
visual design with fresh eyes.
Purpose: a complete redesign of the panel UI.

## How to read this brief

This document defines **what** must be designed — every screen, its content,
its controls, its states, and the technical constraints — but deliberately
says **nothing** about how it should look. Colour, typography, spacing,
iconography style, motion, density, mood, and brand personality are **yours to
decide**. There is no incumbent visual language to honour and no fixed brand
palette to match. Treat the product name "Grimport" as the only fixed brand
element, and even its logo/wordmark treatment is open.

Where this brief names a colour-like concept (e.g. "error state", "success"),
it means a *semantic role* the design must express, not a specific hue.

---

## 1. Product context (enough to design well, not to bias you)

Grimport is a **self-hosted control panel for hosting static and small
app websites** on a user's own server. A user uploads a site (a zip of
files, or a build), Grimport runs it in a container and serves it over HTTPS
on a custom domain. Think of the category as "self-hosted Netlify/Vercel."

**Who uses it:** technically comfortable individuals and small teams —
developers, indie hosts, agencies running client sites. They value clarity,
speed, control, and trustworthy status information. They are comfortable with
domains, DNS, containers, and command lines, but the product should still feel
effortless, not intimidating.

**Primary jobs the UI serves:**
1. See at a glance whether every site is up and healthy.
2. Deploy a new version of a site quickly and watch it succeed.
3. Diagnose when something is wrong (logs, uptime, analytics, DNS).
4. Manage domains, SSL, access, and panel configuration.

**Emotional target (interpret freely):** confidence and calm control. The user
should trust the status they see and never feel lost. Beyond that, the
personality is your call — it can be minimal, expressive, playful, austere,
whatever you can justify for this audience.

---

## 2. Deliverables expected from you

1. A **visual design language**: colour system (incl. a dark and a light
   theme — both are required, see constraints), type scale, spacing system,
   elevation/*material* approach, iconography direction, and motion principles.
2. A **component library** covering the component inventory in §6.
3. **High-fidelity designs for every screen and modal** in §5, including their
   empty / loading / error / success states.
4. A short **rationale** connecting your choices to the audience and jobs above.

Format is your choice (Figma, static comps, coded prototype). If you produce
code, note the front-end constraints in §7.

---

## 3. Information architecture

The panel is a single-page app with a persistent left sidebar and a main
content area. Navigation, in order:

- **Monitor**
  - Sites (default landing)
  - Overview (cross-site analytics + uptime)
  - Activity (audit/event log)
- **Manage** (hidden for the lowest role)
  - Deployments (global deploy history)
  - Logs (live container logs)
- **Admin** (hidden for non-admins)
  - Domains
  - Settings (panel configuration)

Global chrome present on every screen: brand mark, theme (dark/light) toggle,
a notification bell with dropdown, current-user identity + role + sign-out, and
the app version. A conditional "update available" affordance appears for admins
when a new version exists.

The design must gracefully handle the sidebar **losing sections/items depending
on role** (see §8) without looking broken or empty.

---

## 4. Cross-cutting requirements

- **Two themes, first-class.** Both dark and light must be fully designed, not
  one derived carelessly from the other. A user-facing toggle switches them and
  the choice persists.
- **Status is the product.** Health/status indicators (up/down, running/stopped,
  deploy progress, DNS state, SSL state) appear everywhere and must be instantly
  legible, distinguishable for colour-blind users, and never rely on colour
  alone.
- **Feedback for every action.** Almost every action triggers a transient
  success/error message. Design a consistent feedback system (e.g. toasts) plus
  inline validation and busy/disabled states for buttons mid-request.
- **Live data.** Several screens auto-refresh (sites every ~15s, logs optionally
  every ~3s, update flow polls). Design for values that change under the user
  and for the brief moment a panel restart makes data unavailable.
- **Density with breathing room.** Some screens are data tables with many
  columns; some are sparse. The system needs both a comfortable dense-table
  treatment and calm empty/marketing-like states.
- **Text is variable length and will be translated.** Do not design around
  fixed English string widths; allow labels to grow (German and other languages
  are a future goal). Avoid truncation-dependent layouts for critical info.
- **Keyboard & accessibility.** Full keyboard navigation, visible focus, ARIA
  semantics, and a command-palette-style quick action surface are desired
  (there is appetite for ⌘K-style navigation — design it if you see fit).
- **Responsive.** Must be usable from a wide desktop down to a tablet and, at
  least for monitoring/read views, a phone.

---

## 5. Screens (content, controls, states)

For every screen, design the default, empty, loading, and error states. Only
screen-specific notes are listed; the cross-cutting rules in §4 always apply.

### 5.1 Login
- Content: brand mark, product name, one-line tagline, sign-in form, version in
  footer.
- Controls: username, password, submit (with a "signing in…" busy state).
- States: default, submitting, error (inline message; e.g. wrong credentials or
  server unreachable).

### 5.2 Sites (default view) — the primary workspace
- Header: title, a live count ("N sites" / "N of M" when searching), a search
  field (filters by name or domain, live), and a "New site" action (hidden for
  the lowest roles).
- A repeating **site card / row** is the core object. Each shows:
  - Status indicator + label: Running / Stopped / Starting / Restarting /
    Paused / Missing / No container / Unknown.
  - Site name; domain shown as an outbound link.
  - A DNS-status affordance (states: ok / wrong / pending / unknown) opening a
    DNS modal.
  - Zero or more tags: runtime (PHP / Node / Python; none shown for plain
    static), Maintenance, Basic-Auth-protected, SPA.
  - Optional **preview** state: a badge linking to a preview URL plus "Go live"
    and "Discard" actions.
  - Optional error hint (e.g. "Container exited — check logs").
  - An uptime strip: 24h uptime percentage (banded good/warn/bad) + a live
    up/down dot.
  - An action row: primary "Deploy"; secondary Start/Stop (Stop confirms),
    Logs, Analytics, History, Settings, Create-preview.
- Empty states: no sites at all (with a prominent create CTA); search with no
  matches.
- Note: cards update on a ~15s refresh; design so status changes aren't jarring.

### 5.3 Overview (cross-site analytics + uptime)
- Header: title, a period selector (24h / 7d / 30d).
- A row of grand-total stat tiles: total requests, bandwidth, errors, sites up,
  sites down.
- A sortable table, one row per site, columns: site (name+domain), requests,
  bandwidth, 2xx, 3xx, 4xx, 5xx, uptime %, avg latency (ms), live status.
  Rows open a per-site analytics modal. Error cells and low-uptime cells need
  emphasis. Sort controls: requests / bandwidth / errors / uptime / latency /
  name.
- States: loading, error, loaded.

### 5.4 Deployments (global history)
- Header: title, a site filter (all sites / one per site).
- Table: site, file name, size, deployed-when (relative), and a rollback action
  (only for the highest role; confirm before rollback).
- States: loading, empty, error.

### 5.5 Logs (full-page tail)
- Controls: site selector, line-count selector (50/100/250/500), refresh, an
  "auto" toggle (polls ~3s).
- Content: a monospaced log stream.
- States: nothing selected, loading, empty output, error.

### 5.6 Domains (admin)
- Table: domain (link), site, runtime, SSL (on / off), container status.
- States: loading, empty, error.

### 5.7 Activity (audit log)
- Filter bar: site chips (all + per site), level chips (all / errors /
  warnings), and a CSV export action.
- A feed of events; each event has: a type icon, an optional level badge
  (error/warn), an optional actor (username), a human label (e.g. "Deployed",
  "Went down", "Back online"), optional detail text, optional duration, and a
  relative time. Down/up/error events deserve distinct emphasis.
- Event types to represent: deployed, rolled_back, created, deleted, started,
  stopped, settings_changed, site up, site down, update started/applying/failed,
  login, logout, preview created/swapped/removed, generic error/warn.
- States: empty, error.

### 5.8 Settings (panel configuration) — tabbed
Tabs: General · Server & DNS · API Tokens · Webhooks · Notifications · Users
(admin) · Security.
- **General:** site-defaults form (base domain, default SPA, default cache);
  an analytics-snippet textarea injected into hosted sites; an Updates block
  (installed vs latest version pills, "check now", "update to latest" for
  admins, status text, release-notes rendering).
- **Server & DNS:** read-only server facts (public IP, panel URL, version); DNS
  record tables (type/name/value/TTL) for the panel domain and the sites
  wildcard; an HTTPS/SSL status banner with three states (active / partially
  configured / not configured) + a Let's-Encrypt-email form + a restart notice;
  static reference instructions for a tunnel alternative (documentation-style
  content, no controls).
- **API Tokens:** explanatory text + example; a one-time "token created" reveal
  with copy-to-clipboard; a tokens table (name, created, last used, revoke); a
  create form; empty state.
- **Webhooks:** supported-events reference; a list (name, URL, events,
  enabled toggle, test button with busy state, delete); a create form; empty
  state.
- **Notifications:** which bell events are enabled (unknown domain / site down /
  site recovers); a "clear all notifications" danger action.
- **Users (admin):** role explanation; a users table (username with a "you"
  marker, role, per-site access shown as chips/"All"/"None", edit, delete —
  delete hidden for self); a create-user form (username, password, role).
- **Security:** change-password form (current, new).

### 5.9 Modals
Design each with its own empty/loading/error/success handling.
- **New Site:** name; domain (auto-suggested from a random slug + base domain,
  validated); runtime choice (Static / PHP / Node / Python); runtime-conditional
  fields (static: SPA + cache; app: build command, start command, port);
  create action.
- **Deploy to a site:** two methods in tabs — upload a zip (drag-and-drop or
  browse, .zip only, show filename+size) or provide a zip URL. A live progress
  area (uploading %/extracting/downloading/done/error). Deploy disabled until
  input is valid.
- **Site Settings (wide, 4 tabs):** General (name, domain w/ restart warning);
  Behaviour (SPA, cache, maintenance, HTTPS toggle possibly disabled with a
  hint, custom response headers as an add/remove name–value list); Access (basic
  auth username/password + remove option, URL redirects as add/remove
  from→to+permanent rows, and an admin-only per-user site-access checklist that
  saves immediately); App config (runtime switch revealing build/start/port
  fields, environment variables as an add/remove key–value list). Global
  actions: delete-site (danger, irreversible, confirm), cancel, save.
- **Analytics (wide):** period toggle; three stat tiles (requests + last-hour
  sub-stat, data served, error rate + client/server split); a
  requests-over-time chart (hourly buckets, hover tooltip, error buckets
  flagged); a status-code breakdown (stacked bar + legend for 2xx/3xx/4xx/5xx);
  a refresh action; empty state when no data yet.
- **DNS Setup (wide):** a status banner (checking / ok / pending / wrong) with a
  recheck action; two tabs (standard DNS records vs a proxied/tunnel setup),
  each with record tables and step-by-step guidance.
- **Logs (compact):** a log output block + refresh (last ~200 lines).
- **Deploy History:** a numbered list of past deploys (time, size, rollback per
  entry / "current" marker); empty state.
- **Connect unknown domain:** shown when a domain points at the server but isn't
  linked; offers "create new site" (pre-filled) or "assign to an existing site"
  (list with per-site assign + confirm).
- **Create preview:** explanation + a preview-domain field (auto-suggested);
  create action.
- **Update panel:** a progress flow with a 4-step checklist (pull image →
  prepare container → restart → done), status text that survives a mid-flight
  panel restart, and a post-completion auto-reload countdown with a manual
  reload button.
- **Edit user:** role selector (with per-role descriptions) + a site-access
  checklist (hidden when role = admin); save.

---

## 6. Component inventory (the reusable vocabulary)

Design these as a coherent set:

- App shell: sidebar with grouped nav + collapsible/role-aware sections;
  top/global controls cluster; main content region with a per-view header
  (title, subtitle/count, actions).
- Buttons: primary, secondary, danger, icon-only; busy/disabled states.
- Inputs: text, number, password, select/dropdown, textarea, checkbox, toggle,
  search field, file dropzone. Include inline validation + helper text.
- Cards (the site card is the flagship), list rows, and data tables (dense,
  sortable, with emphasis cells and per-row actions).
- Tabs (both view-level and within modals).
- Modals (standard + wide) with header, body, footer actions, and a backdrop;
  dismissible by button, backdrop, and Escape.
- Badges/tags (runtime, SPA, maintenance, auth, role) and status indicators
  (container status, up/down dot, DNS state, SSL state) — all colour-blind-safe.
- Stat tiles / KPI blocks.
- Charts: a time-series bar/spark chart with tooltip, and a segmented
  (stacked-bar) breakdown with legend.
- Progress: determinate bar (deploy %) and a multi-step checklist (update flow).
- Feedback: transient toast stack (info/success/error) + a notification
  dropdown with per-item type icons, detail, relative time, dismiss, and item
  actions.
- Empty states (per screen), loading states (skeletons preferred), error states.
- Chips/filters (site filter, level filter).
- Copy-to-clipboard control (token reveal).
- Confirmation dialogs for destructive actions (stop, delete, rollback,
  discard, revoke, clear).
- Reference/instruction blocks with embedded code snippets (DNS/tunnel/SSL
  documentation content lives inside the UI).

---

## 7. Technical constraints (functional, not aesthetic)

These bound implementation but leave the visual design fully open:

- The current front end is **vanilla HTML, CSS, and JavaScript — no framework
  and no CSS framework** — and must stay that way. Design should be realizable
  in hand-written CSS. (You may still design in any tool; just avoid patterns
  that require React/Tailwind/etc. to exist.)
- Icons are inline **SVG**. An SVG icon set (or a direction for one) is welcome.
- Ships inside a container and is served as static files; assume no build step
  and modest asset budgets. Prefer system/self-hosted fonts over heavy web-font
  loads (a webfont is acceptable if justified and lightweight).
- Dark and light themes via CSS custom properties is the expected mechanism.
- Motion must respect `prefers-reduced-motion`.
- Runtime data comes from a JSON API; screens are populated client-side, so
  loading and error states are real and frequent — design them as first-class.

---

## 8. Roles & conditional UI

Three roles change what's visible; the design must handle each cleanly:

- **Admin:** sees everything — all nav sections, Domains, Settings (incl. Users
  tab), site-access controls, update controls, rollback actions, create-site.
- **Editor:** sees Sites, Overview, Activity, Deployments, Logs. No Domains, no
  Settings, no create-site, no rollback. May be scoped to a subset of sites.
- **Viewer:** sees Sites, Overview, Activity only. No Manage/Admin sections.
  Read-oriented; may be scoped to a subset of sites.

Design the sidebar and headers so that removing sections/items/actions per role
still looks intentional and balanced, never truncated or empty.

---

## 9. Status & state vocabularies to express

Give each a clear, colour-blind-safe visual treatment:

- **Container:** Running, Stopped/Exited (error if abnormal), Starting,
  Restarting (error), Paused, Missing (error), No container, Unknown.
- **Live uptime:** Up, Down, Unknown.
- **Uptime %:** good (≥99), warn (≥95), bad (<95).
- **DNS:** ok, wrong, pending, unknown, error.
- **SSL:** active, partially configured, not configured.
- **Deploy progress:** uploading (with %), extracting, downloading, done, error.
- **Update flow:** pulling, preparing, restarting, done (plus an
  "unreachable-then-recovers" moment).
- **Activity level:** normal, warn, error (with up/down emphasis).

---

## 10. Explicitly out of scope for this brief (your decisions)

Colour palette and semantics · typography and type scale · spacing/grid system ·
corner radius, borders, shadows, and overall *material* · iconography style ·
motion language and timing · information density defaults · brand personality
and logo treatment · illustration/empty-state art direction · light-vs-dark
emphasis. Decide all of these freely; justify them against §1.
