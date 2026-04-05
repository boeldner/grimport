# DNS & Networking

## Standard DNS (A records)

Point two A records to your server's public IP:

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `panel` | `<your-server-ip>` | 3600 |
| A | `*.sites` | `<your-server-ip>` | 3600 |

Replace `panel` with your `SUPERVISOR_DOMAIN` subdomain and `*.sites` with your `SITE_BASE_DOMAIN`.

The wildcard record (`*.sites.yourdomain.com`) is only needed if you use auto-generated site URLs. Sites with custom domains only need their own A record.

**Tip:** The **Settings → Server & DNS** tab shows your server IP and the exact records to create, already filled in with your configured domains.

## Cloudflare Proxy

If your domain is on Cloudflare, you can enable the proxy (orange cloud) for free CDN, DDoS protection, and analytics.

1. Add the A record in Cloudflare DNS with the proxy **enabled** (orange cloud)
2. No Let's Encrypt needed — Cloudflare terminates SSL at the edge
3. Set SSL/TLS mode to **Full** (not Full Strict) in the Cloudflare dashboard → SSL/TLS → Overview

With Cloudflare proxy, keep Traefik's HTTPS labels **disabled** (your server only receives HTTP from Cloudflare's edge).

## Cloudflare Tunnel (no open ports)

Use `cloudflared` to expose Grimport without opening ports 80/443. Ideal for home servers or servers behind NAT.

**1. Install cloudflared:**
```bash
curl -L https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg >/dev/null
echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared any main" | \
  sudo tee /etc/apt/sources.list.d/cloudflared.list
sudo apt update && sudo apt install cloudflared
```

**2. Authenticate and create a tunnel:**
```bash
cloudflared tunnel login
cloudflared tunnel create grimport
```

**3. Create `~/.cloudflared/config.yml`:**
```yaml
tunnel: <your-tunnel-id>
credentials-file: /root/.cloudflared/<tunnel-id>.json

ingress:
  - hostname: panel.yourdomain.com
    service: http://localhost:80
  - hostname: "*.sites.yourdomain.com"
    service: http://localhost:80
  - service: http_status:404
```

**4. Route DNS through the tunnel:**
```bash
cloudflared tunnel route dns grimport panel.yourdomain.com
cloudflared tunnel route dns grimport "*.sites.yourdomain.com"
```

**5. Run as a system service:**
```bash
cloudflared service install
systemctl start cloudflared
```

No Let's Encrypt needed — Cloudflare handles SSL via the tunnel.

## Docker networking

All containers (Traefik, supervisor, site containers) share the `webhost-net` bridge network. Site containers are only reachable inside that network — they have no ports exposed to the host. Traefik routes external traffic to them by hostname.

The supervisor container talks to site containers directly over `webhost-net` for uptime checks (using each container's internal IP, not via Traefik).
