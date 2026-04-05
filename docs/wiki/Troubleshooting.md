# Troubleshooting

## Site shows "404 page not found" (Traefik default)

**Cause:** Traefik is running but the site container hasn't started, or the domain doesn't match.

1. Check that the site container is running: `docker ps | grep webhost-site`
2. Check the site status in the panel — it should show "running" (green dot)
3. Verify the domain in site settings matches what you're visiting exactly
4. Check Traefik logs: `docker compose logs traefik`

## Site shows "502 Bad Gateway"

**Cause:** Traefik can reach the container but nginx is not responding.

1. Check the container logs from the panel (Logs button) or: `docker logs webhost-site-SITEID`
2. Common cause: bad nginx config from a custom header with invalid syntax — check Settings → Custom headers
3. Try restarting the container from the panel

## SSL certificate not issued

1. Verify `ACME_EMAIL` is set in `.env` and the panel **Settings → Server & DNS → HTTPS**
2. Verify port 80 is open — Let's Encrypt HTTP-01 requires it
3. Verify DNS is propagated: `dig +short yourdomain.com` should return your server IP
4. Check Traefik logs for ACME errors: `docker compose logs traefik | grep -i acme`
5. Check `./data/certs/acme.json` — if it's empty or zero bytes, recreate it:
   ```bash
   docker compose down
   echo '{}' > data/certs/acme.json
   chmod 600 data/certs/acme.json
   docker compose up -d
   ```

## Panel not accessible after restart

Grimport has a startup dependency — the supervisor waits for Traefik's healthcheck to pass before starting. This usually takes 5–10 seconds.

If the panel is never accessible:
```bash
docker compose logs supervisor
docker compose logs traefik
```

## Container shows "exited" with error

The site card shows a warning hint when the container exited with a non-zero exit code.

1. Click **Logs** on the site card to see the nginx error
2. Common causes: invalid custom headers, malformed nginx config after settings change
3. Try resetting custom headers in site settings, then restart

## Uptime always shows "down"

The uptime checker reaches containers via their Docker network IP, not through Traefik. If a container is stopped, it correctly shows as down.

If a running container shows as down:
1. Check that the container is on `webhost-net`: `docker inspect webhost-site-SITEID | grep webhost-net`
2. If the network is missing, delete and recreate the site (the network assignment is set at container creation time)

## Deploy history missing

History is stored in `./data/sites/<site-id>/history/`. If the directory is empty, no deployments have been made since v0.5.0. The feature requires at least one deploy after upgrading.

## Reset the admin password

```bash
docker exec -it webhost-supervisor node -e "
  const db = require('better-sqlite3')('/data/supervisor.db');
  const bcrypt = require('bcryptjs');
  const hash = bcrypt.hashSync('newpassword', 12);
  db.prepare(\"UPDATE settings SET value = ? WHERE key = 'password_hash'\").run(hash);
  console.log('Password reset to: newpassword');
"
```

## Get debug info

```bash
# All container statuses
docker ps -a | grep webhost

# Supervisor logs (last 50 lines)
docker compose logs --tail=50 supervisor

# Traefik logs
docker compose logs --tail=50 traefik

# Database contents (sites)
docker exec webhost-supervisor sqlite3 /data/supervisor.db "SELECT id, name, domain, container_id FROM sites"
```
