# Security Model

How Grimport keeps one site from hurting the panel, other sites, or the host. This page describes what is enforced today; the direction is in the [roadmap](https://github.com/boeldner/grimport/blob/main/docs/roadmap/multi-user-platform.md).

## Threats this covers

A site is content or code that someone else controls. Grimport assumes any site may try to:

1. reach the panel or other sites from inside the Docker network,
2. exhaust CPU, memory, processes or disk,
3. use the server for scanning, spam or mining,
4. escalate privileges inside its container.

Content-level threats (phishing pages, malware downloads) are a separate layer: the deploy scanner and quarantine are planned for a later phase, and Cloudflare's WAF in front of public sites is still recommended.

## One network per site

Every site runs in its own Docker network, `webhost-site-<id>`, a `/24` taken from `SITE_NET_POOL` (default `10.99.0.0/16`). The supervisor creates the network with the site and removes it with the site.

- **Static sites and previews** use `internal` networks: no route to the outside world at all. Traefik is attached to the network and proxies requests in; nothing gets out.
- **App sites** (PHP, Node, Python) need the internet, so their network is a normal bridge fenced by the egress guard (below).
- **Traefik** is attached to every site network. The **supervisor is attached to none** of them: it talks to Docker over the socket, never over the network. A site container therefore cannot reach the panel, the SQLite database, or another site. `webhost-net` is only the management network shared by Traefik and the supervisor.

Existing installs migrate automatically: a container still on the shared network shows as **Outdated (network)** under Settings → General → Updates → Site containers, and the rolling update there recreates it on its own network.

## Egress guard

`egress-guard` (service in `docker-compose.yml`, script in `egress/apply-rules.sh`) is a tiny Alpine sidecar with host networking and `NET_ADMIN`. Every minute it re-applies a `GRIMPORT-EGRESS` chain hooked into Docker's `DOCKER-USER` chain:

| From site networks to | Result |
|---|---|
| another address in the site pool | dropped |
| 10/8, 172.16/12, 192.168/16, 100.64/10, 127/8 | dropped (LAN, host, other containers) |
| 169.254/16 | dropped (cloud metadata, link-local) |
| more than `EGRESS_NEW_CONN_PER_SEC` new connections per second | dropped (scanning, spam) |
| everything else (HTTPS to the internet, DNS) | allowed |

Replies to connections Traefik opened are always allowed. On Docker Desktop the daemon runs in a VM the sidecar cannot reach; the guard detects that and idles. Configure with `SITE_NET_POOL`, `EGRESS_GUARD_INTERVAL`, `EGRESS_NEW_CONN_PER_SEC`.

## Container hardening

All site containers are created with:

| Setting | Value | Why |
|---|---|---|
| Memory / swap | `SITE_MEMORY_STATIC_MB` 256, `SITE_MEMORY_APP_MB` 512, no swap | a leak cannot take the host down |
| CPU | `SITE_CPUS` 0.5 | a busy loop cannot starve neighbours |
| PIDs | `SITE_PIDS` 256 | fork bombs stop early |
| Open files | 4096 soft / 8192 hard | |
| Capabilities | all dropped | no raw sockets, no mounts, no ptrace |
| `no-new-privileges` | on | setuid binaries cannot escalate |

Per runtime:

| Runtime | Image | User | Extra |
|---|---|---|---|
| static, preview | `nginxinc/nginx-unprivileged:alpine` | uid 101 | read-only root filesystem, `/tmp` on tmpfs (64 MB), listens on 8080 |
| node | `node:22-alpine` | uid 1000 | `/tmp` on tmpfs (256 MB), `HOME=/tmp` |
| python | `python:3.12-slim` | uid 1000 | `/tmp` on tmpfs (256 MB), `HOME=/tmp` |
| php | `php:8.3-apache` | root, drops to www-data | keeps only `CHOWN`, `SETUID`, `SETGID`, `NET_BIND_SERVICE` so Apache can bind :80 |

Build steps for Node and Python (`build_cmd`) run in a throwaway container with the same limits, as uid 1000, on the site's network. The site's `app/` directory is owned by uid 1000 so the non-root process can write there.

## Deploy limits

Every zip is inspected before anything touches the live directory:

| Limit | Default | Variable |
|---|---|---|
| Upload size | 250 MB | (multer, fixed) |
| Entries | 20 000 | `DEPLOY_MAX_ENTRIES` |
| Uncompressed total | 1024 MB | `DEPLOY_MAX_TOTAL_MB` |
| Single file | 250 MB | `DEPLOY_MAX_FILE_MB` |
| Symlinks, NUL bytes in names, paths outside the target | rejected | |
| Per-site disk quota (current files + history + new deploy) | 2048 MB | `SITE_DISK_QUOTA_MB` |

After extraction the on-disk size is measured again, so a zip whose headers lie is still rejected. Rejections return HTTP 413 with the limit that was hit.

## Rate limits

| Scope | Default | Variable |
|---|---|---|
| Login attempts | 10 per 15 min per IP | (fixed) |
| Deploys, URL deploys, rollbacks | 30 per 10 min per user or token | `DEPLOY_RATE_LIMIT` |
| Any `/api/*` request except `/api/health` | 600 per 15 min per user, token or IP | `API_RATE_LIMIT` |

`0` disables a limit. Limits are keyed by the logged-in user, else a hash of the API token, else the client IP. Responses are HTTP 429 with `RateLimit-*` headers.

## What is not covered yet

- Content scanning of deployed files (phishing, miners, secrets) and quarantine — planned.
- Per-user quotas and runtime permissions — planned with the multi-user release.
- Panel hardening for a public login (2FA, lockout, CSP) — planned with the multi-user release; until then keep the panel behind Cloudflare Access or a VPN if strangers could reach it.
- The supervisor itself has the Docker socket. Anyone who can run code as the supervisor owns the host; that is why sites can never reach it.
