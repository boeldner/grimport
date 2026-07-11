# Grimport Design System — macOS-native Redesign

Source of truth: `docs/design/redesign-canvas/grimport-redesign.dc.html`
(open in a browser for the pixel-exact reference). This file captures the
system in text so it can be implemented in vanilla CSS.

## Direction

The panel behaves like a **native macOS app**: system font stack, a
translucent (vibrancy) sidebar, **hairline dividers instead of boxes**, calm
surfaces, 10px card / 6px control radii, and **elevation via lightening the
surface, not shadows**. Status is the product — every state gets a
**glyph + label + colour** (never colour alone; colour-blind-safe). Density is
high (28px table rows, 12px table text) but clearly grouped. Both themes are
first-class. UI language English, layouts tolerate growing strings. 100% vanilla
CSS with custom properties — no framework patterns.

## Brand

- **Logo "Grim Mage":** a hooded mage silhouette with two glowing eye-strokes;
  one path + two eye strokes, works in `currentColor` so it scales to 14px
  (sidebar, favicon) and up (app icon tile with a dark arcane gradient).
- **Wordmark:** glyph + "Grimport".
- **Accent:** macOS system blue. Violet is the secondary "arcane" accent (the
  Grim-Mage nod). The previous red brand is retired.

## Design tokens (both themes)

Exact values from the canvas. Implement as CSS custom properties on `:root`
(light) and `[data-theme="dark"]` (dark). (Canvas uses `data-th`; our app uses
`data-theme` — keep our attribute name.)

### Light (`:root`)
```
--bg:      #f5f5f7;   /* desktop/backmost */
--content: #f1f1f3;   /* content area behind panels */
--panel:   #ffffff;   /* primary surface (cards, tables) */
--panel2:  #f6f6f8;   /* raised/inset surface */
--side:    rgba(244,244,247,.80);  /* vibrancy sidebar (needs backdrop-blur) */
--tx:      #1d1d1f;   /* primary text */
--tx2:     #63636a;   /* secondary text */
--tx3:     #98989f;   /* tertiary/muted */
--line:    rgba(0,0,0,.08);   /* hairline divider */
--line2:   rgba(0,0,0,.15);   /* stronger hairline */
--acc:     #0a6fde;   --accSoft: rgba(10,111,222,.10);   /* system blue */
--ok:      #178f45;   --okSoft:  rgba(23,143,69,.12);
--warn:    #b26e05;   --warnSoft:rgba(178,110,5,.13);
--err:     #d0342c;   --errSoft: rgba(208,52,44,.10);
--vio:     #7a4fd0;   --vioSoft: rgba(122,79,208,.11);  /* secondary accent */
--mono:    ui-monospace,"SF Mono",Menlo,monospace;
--shdw:    0 22px 60px rgba(20,20,30,.22), 0 2px 10px rgba(20,20,30,.10); /* modals only */
--desk:    linear-gradient(135deg,#c7d4e4,#dcd5cd 55%,#c9c3d6); /* window backdrop */
```

### Dark (`[data-theme="dark"]`)
```
--bg:      #1d1d20;
--content: #19191c;
--panel:   #252529;
--panel2:  #2e2e34;
--side:    rgba(42,42,48,.78);
--tx:      #f2f2f5;
--tx2:     #a2a2ab;
--tx3:     #6c6c75;
--line:    rgba(255,255,255,.09);
--line2:   rgba(255,255,255,.17);
--acc:     #4a8fef;   --accSoft: rgba(74,143,239,.16);
--ok:      #3fbf6f;   --okSoft:  rgba(63,191,111,.16);
--warn:    #e2a33c;   --warnSoft:rgba(226,163,60,.16);
--err:     #ef6a5e;   --errSoft: rgba(239,106,94,.14);
--vio:     #a98af0;   --vioSoft: rgba(169,138,240,.16);
--shdw:    0 22px 60px rgba(0,0,0,.55), 0 2px 10px rgba(0,0,0,.35);
```

## Typography

System stack: `-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial,
sans-serif`; mono via `--mono`.

| Role | Size / weight | Use |
|------|---------------|-----|
| Title | 20 / 600 | view titles |
| Heading | 14 / 600 | section headings |
| Body | 13 / 400 | labels, forms, prose |
| Table | 12 / 400 | dense data rows |
| Mono | 11 | domains, logs, code |

## Spacing & geometry

- Spacing scale: **4 / 8 / 12 / 16 / 24**.
- Radius: **6px** controls, **10px** cards; pills use `99px`.
- **Hairlines (`--line`) instead of shadows** for separation inside surfaces.
  Shadow (`--shdw`) is reserved for floating modals/palette/dropdowns only.
- Dark elevation = step up `--panel` → `--panel2`, never a shadow.
- Table rows ~28px tall.

## Status vocabulary (glyph + label + colour)

Every status renders an icon/glyph AND a text label AND a colour token, so
colour is never the only signal.

- **Container:** Running (ok), Stopped/Exited (err if abnormal), Starting… ,
  Restarting, Paused, Missing (err), No container, ? Unknown.
- **Live/Uptime:** UP (ok), DOWN (err), ? — (unknown). Percentages coloured by
  band: ≥99% ok, ≥95% warn, <95% err (e.g. 99.98% / 97.2% / 89.4%).
- **DNS:** DNS ok / DNS wrong / pending. **SSL:** SSL active.
- **Tags:** runtime PHP / NODE / PYTHON (none for static), SPA, ⛭ Maintenance,
  🔒 Basic Auth; role Admin / Editor / Viewer.

## Component vocabulary

Buttons (primary=accent, secondary=hairline, danger=err, icon-only, busy
"Saving…"); inputs with inline validation (`Domain is available` /
`✕ Port 80 is reserved`); toggles; tabs (view-level + modal); segmented
controls (24h/7d/30d, Static/PHP/Node/Python); search field with `⌘K` hint;
cards (site card is flagship); dense sortable tables with emphasis cells;
stat tiles; time-series bar chart w/ hover tooltip + red bars for error hours;
stacked status-code bar + legend; determinate progress bar (deploy %);
4-step checklist (update flow); toast stack (info/ok/err, dismissible);
notification dropdown (vibrancy) with per-item actions; skeleton loaders
(shimmer via `@keyframes`, respect `prefers-reduced-motion`); copy-to-clipboard;
confirmation dialogs (destructive; delete requires typing the site name);
reference/instruction blocks with code snippets; command palette (⌘K, vibrancy).

## Screen coverage (all designed in the canvas)

The canvas provides both-theme comps for: Sites (light + dark, incl. search
empty state), Overview, Activity, Deployments, Logs, Domains, Login (both themes
+ error), all 7 Settings tabs (General, Server & DNS, API Tokens, Webhooks,
Notifications, Users, Security), and modals: New Site, Deploy (progress), Site
Settings, Analytics, DNS Setup (wrong state), Deploy History, Create Preview,
Connect Unknown Domain, Update Panel, Edit User, Command Palette, Confirmations,
Notification Dropdown. Plus role-specific sidebars (admin/editor/viewer), a
phone monitoring view, and system states (skeleton, view-error, panel-restart,
empty).

Each screen's content/controls/states are enumerated in the design brief
(`docs/superpowers/specs/2026-07-11-design-revamp-brief.md`) and shown in the
canvas. Implementers must match the canvas as the visual source of truth and
the brief as the functional contract.

## Notes for implementation

- The canvas mock uses sample versions (1.8.2 / 1.9.0) — ignore; our real
  version comes from `package.json`.
- The vibrancy sidebar needs `backdrop-filter: blur()` over `--side`; provide a
  solid fallback where unsupported.
- Keep our existing attribute `data-theme` (not the canvas's `data-th`).
- Rebuild is a full replacement of `supervisor/public/style.css` and the markup
  in `index.html` / `login.html`, done incrementally per milestone so the app
  stays working between releases.
