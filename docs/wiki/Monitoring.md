# Monitoring

## Uptime checks

Grimport checks every site every **60 seconds** by making an HTTP request to the container's internal IP on the `webhost-net` Docker network (not via Traefik). This means uptime reflects the container health, not edge routing.

Check results are stored in SQLite for **30 days** and then pruned automatically.

### Viewing uptime

The **Activity** view in the sidebar shows:
- Current status (up / down / stopped) for each site
- 24h uptime percentage
- A sparkline of recent checks

Click a site's uptime bar to see detailed check history for 24h, 7d, or 30d.

### State change events

When a site transitions from up → down or down → up, an event is written to the **activity log** automatically. This gives you a history of incidents without any extra setup.

## Activity log

The Activity view shows all events across all sites, newest first:
- **deploy** — a zip was deployed
- **rollback** — a rollback was performed
- **start / stop** — container started or stopped from the panel
- **settings_changed** — site settings were updated
- **up / down** — uptime state change detected

Filter by site using the filter chips at the top of the view.

## Container logs

Click the **Logs** button on any site card to see the last 100 lines of nginx output from that site's container. Useful for diagnosing 4xx/5xx errors.

## Analytics

**Settings → Analytics** (and per-site analytics views) show requests, bytes served, status-code breakdown (2xx/3xx/4xx/5xx), and average latency, aggregated hourly for `24h` / `7d` / `30d` windows. Data is parsed from nginx access logs on a background pass; trigger an immediate refresh with `POST /api/analytics/:id/refresh`.

## Alerting

Grimport sends alerts through two channels:
- **In-panel notifications** — the bell icon in the top bar shows unread events (unknown domain, site down, site up). Configure which event types appear under **Settings → Notifications**.
- **ntfy push alerts** — configure a topic URL under **Settings → Alerts** to get a push notification on your phone for site-down/site-up and other events. Send a test alert from the same screen.
- **Outbound webhooks** — POST to any URL on `deploy`, `rollback`, `site_down`, `site_up` (Discord, Slack, custom). Configure under **Settings → Webhooks**.

You can still poll the uptime API from an external tool if you prefer:
```bash
# Check if a site is currently up
curl -s -H "Authorization: Bearer grim_token" \
  https://panel.yourdomain.com/api/uptime/SITE_ID \
  | jq .currentStatus
```
