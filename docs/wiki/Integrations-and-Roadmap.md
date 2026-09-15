# Integrations & Roadmap

## Current integrations

### CI/CD (via API tokens)
Any tool that can make an HTTP request can deploy to Grimport. Tokens can now be scoped to a role and a set of sites, with an optional expiry. See [CI/CD Integration](CICD-Integration) for GitHub Actions, GitLab CI, and curl examples, and [API Reference](API-Reference#tokens) for token scoping.

### Outbound webhooks
POST to a user-defined URL on site events — `deploy`, `rollback`, `site_down`, `site_up`. Configure under **Settings → Webhooks**; each webhook can be enabled/disabled and test-fired individually. See [API Reference](API-Reference#webhooks).

```json
{
  "event": "deploy",
  "site": { "id": "...", "name": "...", "domain": "..." },
  "timestamp": "2026-04-05T12:00:00Z"
}
```

### ntfy alerts
Push notifications to your phone when a site goes down/up or a deploy fails, via [ntfy](https://ntfy.sh). Configure the topic URL under **Settings → Alerts**, with a per-event enable list and a test-send button. See [API Reference](API-Reference#alerts-ntfy).

### Analytics snippet injection
Paste a tracking snippet (Plausible, Umami, or any `<script>`) once in **Settings → General**; it's injected into every served page without touching the deploy zip.

### Built-in backups
Scheduled or on-demand backups of the SQLite database and site files, with configurable retention, downloadable straight from the panel. See [Backups](Backups).

### Cloudflare
- **Proxy** — works out of the box; see [DNS & Networking](DNS-and-Networking)
- **Tunnel** — expose Grimport without open ports; see [DNS & Networking](DNS-and-Networking)

### Let's Encrypt (via Traefik)
Automatic certificate issuance and renewal. See [SSL & HTTPS](SSL-and-HTTPS).

---

## Roadmap towards 1.0

The multi-user platform plan (invitations, roles and quotas, tenant isolation, content safety with LLM review, MCP server for Claude, PWA) lives in [docs/roadmap/multi-user-platform.md](https://github.com/boeldner/grimport/blob/main/docs/roadmap/multi-user-platform.md). It lists the agreed policies and the phases towards 1.0; it is a direction, not a schedule.

## Wishlist (unscheduled)

Not committed, not scheduled — ideas under consideration, roughly in priority order.

### Cloudflare DNS auto-provisioning
**What:** When you create a site or change its domain, Grimport automatically creates the A record via the Cloudflare API.

**How it would work:** Settings → Cloudflare API token + Zone ID. Site creation calls `POST /dns/records`.

### S3 / R2 / Backblaze B2 backup destinations
**What:** Send scheduled backups to object storage in addition to (or instead of) local disk.

**How it would work:** Settings → S3 endpoint + key + bucket, alongside the existing local backup schedule.

### Pushover / additional alert channels
**What:** Alert channels beyond ntfy — Pushover, generic webhook-based push services.

### Git-based deploys
**What:** Connect a site to a GitHub/GitLab repository branch. Push to main → Grimport pulls and deploys automatically (via webhook from the git host).

**How it would work:** Site settings → Git repo URL + branch. Grimport registers a webhook on the git host. On push event, clones/pulls and builds (static output only), then deploys.

---

## Requesting features

Open an issue on [GitHub](https://github.com/boeldner/grimport/issues) with the label `enhancement`. Describe the use case, not just the feature.
