# Integrations & Roadmap

## Current integrations

### CI/CD (via API tokens)
Any tool that can make an HTTP request can deploy to Grimport. See [CI/CD Integration](CICD-Integration) for GitHub Actions, GitLab CI, and curl examples.

### Cloudflare
- **Proxy** — works out of the box; see [DNS & Networking](DNS-and-Networking)
- **Tunnel** — expose Grimport without open ports; see [DNS & Networking](DNS-and-Networking)

### Let's Encrypt (via Traefik)
Automatic certificate issuance and renewal. See [SSL & HTTPS](SSL-and-HTTPS).

---

## Planned integrations

These are the most commonly requested additions, roughly in priority order.

### Outbound webhooks
**What:** POST to a user-defined URL on site events — deploy, rollback, site down, site up.

**Use case:** Get a Discord or Slack message when a deploy completes, or when a site goes offline.

**How it would work:** Settings → add a webhook URL. Events sent as JSON:
```json
{
  "event": "deploy",
  "site": { "id": "...", "name": "...", "domain": "..." },
  "timestamp": "2026-04-05T12:00:00Z"
}
```

### Cloudflare DNS auto-provisioning
**What:** When you create a site or change its domain, Grimport automatically creates the A record via the Cloudflare API.

**How it would work:** Settings → Cloudflare API token + Zone ID. Site creation calls `POST /dns/records`.

### S3 / R2 / Backblaze B2 backup
**What:** Scheduled export of all site files and the SQLite database to object storage.

**How it would work:** Settings → S3 endpoint + key + bucket. Nightly backup job runs at configurable time. Keeps N versions.

### ntfy / Pushover alerts
**What:** Push notification to your phone when a site goes down or comes back up.

**How it would work:** Settings → ntfy topic URL or Pushover API key. Uptime state changes trigger a push.

### Plausible / Umami analytics snippet injection
**What:** Automatically inject a Plausible or Umami tracking script into every served page without modifying the deploy zip.

**How it would work:** Settings → analytics script URL. nginx adds the snippet via `sub_filter` into `</body>`. Per-site toggle to enable/disable.

### Git-based deploys
**What:** Connect a site to a GitHub/GitLab repository branch. Push to main → Grimport pulls and deploys automatically (via webhook from the git host).

**How it would work:** Site settings → Git repo URL + branch. Grimport registers a webhook on the git host. On push event, clones/pulls and builds (static output only), then deploys.

---

## Requesting features

Open an issue on [GitHub](https://github.com/boeldner/grimport/issues) with the label `enhancement`. Describe the use case, not just the feature.
