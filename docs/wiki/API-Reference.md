# API Reference

## Authentication

All API endpoints require one of:
- **Session cookie** — set automatically after logging in via the browser
- **Bearer token** — `Authorization: Bearer grim_<token>` header

Create tokens in **Settings → API Tokens**.

## Base URL

`https://panel.yourdomain.com/api`

---

## Sites

### List sites
```
GET /sites
```
Returns an array of site objects. Passwords are never returned.

### Create site
```
POST /sites
Content-Type: application/json

{ "name": "My Site", "domain": "mysite.com" }
```

### Get site
```
GET /sites/:id
```

### Update site settings
```
PUT /sites/:id
Content-Type: application/json

{
  "domain": "mysite.com",
  "spa_mode": true,
  "cache_enabled": true,
  "maintenance_mode": false,
  "ssl_enabled": true,
  "custom_headers": "X-Frame-Options: SAMEORIGIN",
  "basic_auth": { "username": "user", "password": "pass" }
}
```

All fields are optional — only send what you want to change.

### Delete site
```
DELETE /sites/:id
```
Stops and removes the container. Site data is deleted from disk.

### Start / stop container
```
POST /sites/:id/start
POST /sites/:id/stop
```

### Container logs
```
GET /sites/:id/logs?lines=100
```

---

## Deployments

### Deploy a zip
```
POST /deploy/:id
Content-Type: multipart/form-data

file=@build.zip
```

The zip is extracted into the site's `html/` directory. The container is restarted to pick up new files.

Supported zip layouts:
- Flat root: `index.html`, `styles.css`, etc. at the top level
- Single subfolder: `dist/index.html` → Grimport unwraps it automatically

### List deploy history
```
GET /deploy/:id/history
```
Returns the last 5 deployments with ID, filename, size, and timestamp.

### Roll back
```
POST /deploy/:id/rollback/:deploymentId
```
Restores the given deployment and restarts the container.

---

## Uptime

### Uptime for one site
```
GET /uptime/:id?period=24h
```
`period` options: `24h` (default), `7d`, `30d`

Returns `{ currentStatus, uptime24h, uptime7d, checks: [...] }`.

### Uptime summary (all sites)
```
GET /uptime
```
Returns a map of `siteId → { currentStatus, uptime24h }`.

---

## Activity log

```
GET /activity?limit=50&site_id=SITE_ID
```
Both parameters are optional. Returns an array of activity events sorted by time descending.

---

## Settings

### Get settings
```
GET /settings
```

### Update settings
```
PUT /settings
Content-Type: application/json

{
  "site_base_domain": "sites.yourdomain.com",
  "acme_email": "you@yourdomain.com",
  "default_spa_mode": false,
  "default_cache_enabled": true
}
```

### List API tokens
```
GET /settings/tokens
```

### Create API token
```
POST /settings/tokens
Content-Type: application/json

{ "name": "GitHub Actions" }
```
Returns `{ id, name, token }` — the `token` field is only returned once.

### Revoke API token
```
DELETE /settings/tokens/:id
```

---

## System

```
GET /api/config     — panel config (version, domains, SSL status)
GET /api/health     — { ok: true, version: "..." }
```

---

## Error responses

All errors return JSON:
```json
{ "error": "Human-readable error message" }
```

Common status codes:
- `400` — invalid request body or parameters
- `401` — not authenticated
- `403` — wrong password (login endpoint)
- `404` — site or resource not found
- `429` — rate limit exceeded (login endpoint)
- `500` — internal error (check supervisor logs)
