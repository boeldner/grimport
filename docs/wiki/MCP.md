# MCP for Claude

Grimport speaks [MCP](https://modelcontextprotocol.io) (Model Context Protocol), so Claude can list your sites, create one, deploy a build, read logs and roll back, from Claude Code, Claude Desktop or claude.ai. Every action goes through the same REST API as the panel with a token that carries your role, your site scope and your quota. Nothing Claude does exceeds what you could do yourself, and every upload passes the [content scanner](Security-Model#content-safety).

Two ways to connect:

| | Remote endpoint `https://<panel>/mcp` | Local server `mcp/server.js` |
|---|---|---|
| Runs | inside the panel, nothing to install | on your machine, needs a checkout of this repo |
| Reaches | the panel's API | the panel's API plus folders on your machine |
| Auth | API token as Bearer, or sign in through the panel (OAuth) | API token in an environment variable |
| Extra tool | | `deploy_directory` zips a folder and uploads it |
| Good for | claude.ai, Claude Desktop, Claude Code on any machine | Claude Code next to the project you are building |

## Remote: Claude Code

1. Create a token under **Settings → API tokens** (role Editor is enough; Admin if Claude should manage every site). Copy it.
2. Run:

```
claude mcp add --transport http grimport https://panel.yourdomain.com/mcp \
  --header "Authorization: Bearer grim_..."
```

The Tokens tab shows this command with your panel's address, ready to copy.

## Remote: claude.ai and Claude Desktop

Custom connectors have no field for a token, so the panel acts as an OAuth server:

1. In claude.ai: **Settings → Connectors → Add custom connector**, URL `https://panel.yourdomain.com/mcp`. Claude Desktop: the same under **Settings → Connectors**.
2. Click Connect. Your browser opens the panel; sign in if needed and click **Allow** on the "Connect an app" page.
3. Done. The token Claude received appears under **Settings → API tokens** as "Claude via Claude" with a "Connected app" badge. Revoke it there at any time. Access tokens rotate every 24 hours on their own; after 90 days without use you sign in again.

Requirements:

- The panel must be reachable over **https** at the address in `PANEL_URL` (defaults to `https://<SUPERVISOR_DOMAIN>`). The OAuth endpoints are disabled otherwise; Bearer tokens still work.
- If Cloudflare Access sits in front of the panel, add a bypass policy for `/mcp`, `/token`, `/register`, `/revoke` and `/.well-known/*`: those are called by Claude's servers, not by your browser. `/authorize` and `/oauth/consent` are browser hops and may stay behind Access.

## Local: Claude Code with a folder on your machine

```
cd /path/to/grimport/supervisor && npm ci        # once
claude mcp add grimport-local \
  -e GRIMPORT_URL=https://panel.yourdomain.com \
  -e GRIMPORT_TOKEN=grim_... \
  -- node /path/to/grimport/mcp/server.js
```

Same tools as the remote endpoint plus `deploy_directory(site_id, path)`: zips the folder (skipping `.git`, `node_modules` and what the folder's `.gitignore` lists), uploads it and reports the outcome. Point it at the build output, the folder with `index.html`.

## Tools

| Tool | Does | Needs |
|---|---|---|
| `whoami` | role, capabilities, quota, base domain, which sites the token may touch | |
| `list_sites` | sites the token can see | |
| `get_site` | full settings of one site | viewer |
| `get_site_status` | container state, 24h uptime, DNS | viewer |
| `create_site` | new site; members get `<slug>.<base domain>`, custom domains may become a request | member account |
| `deploy_zip` | upload a zip (base64), scanned, then live or held for review | editor |
| `deploy_url` | deploy a public `.zip` link | editor |
| `get_deploy_history`, `rollback` | last deployments, restore one | viewer / editor |
| `get_logs` | container log tail | viewer |
| `start_site`, `stop_site`, `set_maintenance` | container and maintenance page | editor |
| `set_env_vars` | replace environment variables of a node/python site | editor, Maker preset |
| `preview_create`, `preview_swap`, `preview_discard` | blue-green preview container | editor |

Resources: `grimport://sites` (JSON list) and `grimport://sites/{id}/logs`. Prompt: `publish-project` walks Claude through the usual "zip the build, deploy, report the URL, do not go live from a preview without asking" routine.

Responses tell Claude what happened in plain words: a deploy held by the scanner comes back as "NOT live, waiting for review" with the findings, a blocked one with the files to remove, a permission problem with the reason.

## What a token can do

- Never more than its owner. Role is capped at the owner's role; a member's token is pinned to the sites the member had when the token was created. A token that creates a site gains that one site, nothing else.
- Member uploads that the scanner marks for review wait for the panel owner, exactly as in the panel. Admin uploads go live.
- Rate limits apply per token (`API_RATE_LIMIT`), the JSON body of an MCP request is capped by `MCP_JSON_LIMIT` (64 MB, enough for a 45 MB zip).
- The endpoint accepts Bearer tokens only, never a browser session, so a web page cannot ride your login into it.

## Example

> Publish the `dist` folder to my portfolio site.

Claude calls `whoami`, `list_sites`, then `deploy_directory` (local) or zips the folder and calls `deploy_zip` (remote), and answers with the live URL, or with the scanner's findings if the upload is waiting for review.
