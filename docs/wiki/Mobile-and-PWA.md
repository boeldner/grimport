# Mobile and PWA

Grimport can be installed as an app on your phone, tablet, or desktop —
same panel, no App Store, no separate build.

## Installing on iOS

Safari only (Chrome/Firefox on iOS can't install web apps):

1. Open the panel in Safari.
2. Tap the **Share** button.
3. Tap **Add to Home Screen**.

The app icon, name, and status-bar style come from the panel automatically.
Launching from the home screen opens Grimport full-screen, no browser chrome.

## Installing on Android and desktop

Chrome, Edge, and most Chromium-based browsers prompt automatically:

- After your second visit, Grimport shows an **"Install Grimport as an
  app"** toast with an **Install** button.
- Or use the browser's own install icon in the address bar (Chrome/Edge) or
  menu → **Install Grimport…**.

## What works offline

Installed or not, Grimport caches its own shell (HTML, CSS, JS, icons) so
the app still opens without a connection. What that means in practice:

- The **app shell loads** — sidebar, layout, styling — even offline.
- **Live data does not.** Sites, uptime, logs, analytics all come from
  `/api/*`, which is always network-only — no stale numbers are ever shown
  as if they were current.
- If the panel truly can't be reached (no cached shell either), you'll see
  a minimal offline page instead of a blank screen.

Reconnecting refreshes the current view automatically.

## Update prompts

When a new version of the panel is deployed, your open tab detects it in
the background. A toast appears: **"New version available — reload to
update"** with a **Reload** button. Nothing changes until you click it —
no forced refresh mid-task.

## Phone tab bar

The bottom tab bar shown on phones (Sites / Overview / Activity / More) is
configurable — see [Monitoring](Monitoring#phone-view) for how to
customize which views it shows.
