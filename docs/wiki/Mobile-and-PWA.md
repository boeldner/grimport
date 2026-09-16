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

## Push notifications

Every notification that lands in the bell can also reach your devices while the panel is closed: sites going down or coming back, deploys held or blocked by the scanner, domain requests and decisions, support access and suspensions.

Turn it on under **Settings → Notifications → Push notifications** with "Enable on this device", allow notifications when the browser asks, and pick the event groups this device should get. "Send a test" confirms the path works. Each device is listed with its label; remove one there or disable push on the device itself. Members see the same card for the events that concern their sites.

Where it works:

- **iPhone and iPad**: only in the installed app (Share, Add to Home Screen, open from there), iOS 16.4 or later. The card explains this when opened in Safari.
- **Android**: Chrome, Edge, Firefox, Samsung Internet, installed or in the browser.
- **Desktop**: Chrome, Edge, Firefox, Safari 16 or later.

Nothing to configure on the server: the VAPID key pair is generated on first use and stored in the database. The contact address sent to the push services is your ACME email (or the panel URL). Tapping a notification opens the panel on the matching view. Set `PUSH_DISABLED=1` to switch delivery off panel-wide.

## Pull to refresh

On touch devices, pull the current view down from the top and release to reload it (sites, overview, activity, deployments, logs, domains or settings) together with the bell.

## Update prompts

When a new version of the panel is deployed, your open tab detects it in
the background. A toast appears: **"New version available — reload to
update"** with a **Reload** button. Nothing changes until you click it —
no forced refresh mid-task.

## Phone tab bar

The bottom tab bar shown on phones (Sites / Overview / Activity / More) is
configurable — see [Monitoring](Monitoring#phone-view) for how to
customize which views it shows.
