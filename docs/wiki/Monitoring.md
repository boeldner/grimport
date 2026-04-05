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

## Alerting

Grimport does not send alerts by default. Planned integrations:
- **Outbound webhooks** — POST to a URL on site up/down events (Discord, Slack, custom)
- **ntfy / Pushover** — push notifications for mobile alerts

Until those are available, you can poll the uptime API from an external tool:
```bash
# Check if a site is currently up
curl -s -H "Authorization: Bearer grim_token" \
  https://panel.yourdomain.com/api/uptime/SITE_ID \
  | jq .currentStatus
```
