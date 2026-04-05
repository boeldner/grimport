# CI/CD Integration

Grimport has a REST API with Bearer token authentication. Any CI/CD system that can run `curl` can deploy sites automatically.

## Setup

1. Go to **Settings → API Tokens** in the panel
2. Create a token with a descriptive name (e.g. "GitHub Actions — my-site")
3. Copy the token — it's shown only once
4. Find your site ID: it's in the URL when viewing the site, or from `GET /api/sites`

## GitHub Actions

Add these secrets to your repository: `GRIMPORT_URL`, `GRIMPORT_TOKEN`, `GRIMPORT_SITE_ID`.

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Build
        run: npm ci && npm run build

      - name: Zip dist
        run: cd dist && zip -r ../release.zip .

      - name: Deploy to Grimport
        run: |
          curl -fsSL -X POST "${{ secrets.GRIMPORT_URL }}/api/deploy/${{ secrets.GRIMPORT_SITE_ID }}" \
            -H "Authorization: Bearer ${{ secrets.GRIMPORT_TOKEN }}" \
            -F "file=@release.zip"
```

## GitLab CI

```yaml
deploy:
  stage: deploy
  script:
    - npm ci && npm run build
    - cd dist && zip -r ../release.zip .
    - |
      curl -fsSL -X POST "$GRIMPORT_URL/api/deploy/$GRIMPORT_SITE_ID" \
        -H "Authorization: Bearer $GRIMPORT_TOKEN" \
        -F "file=@release.zip"
  only:
    - main
```

Add `GRIMPORT_URL`, `GRIMPORT_TOKEN`, and `GRIMPORT_SITE_ID` as CI/CD variables (masked).

## Shell script / cron

```bash
#!/usr/bin/env bash
npm run build
cd dist && zip -r ../release.zip . && cd ..
curl -fsSL -X POST "https://panel.yourdomain.com/api/deploy/SITE_ID" \
  -H "Authorization: Bearer grim_yourtoken" \
  -F "file=@release.zip"
```

## Webflow

Webflow doesn't have a native webhook for deploys, but you can use Zapier or Make (Integromat):

1. Trigger: Webflow → "Site published"
2. Action: HTTP POST to `https://panel.yourdomain.com/api/deploy/SITE_ID` with the zip from Webflow's export URL

Or download the Webflow export manually and use the panel drag-and-drop.

## Rollback via API

```bash
# List available deployments
curl -H "Authorization: Bearer grim_yourtoken" \
  https://panel.yourdomain.com/api/deploy/SITE_ID/history

# Roll back to a specific deployment
curl -X POST -H "Authorization: Bearer grim_yourtoken" \
  https://panel.yourdomain.com/api/deploy/SITE_ID/rollback/DEPLOYMENT_ID
```

## Token security

- Tokens have full API access — treat them like passwords
- Create one token per integration so you can revoke them independently
- Revoke tokens in the panel immediately if they're compromised
- Tokens are stored as SHA-256 hashes — the plaintext is never stored
