# Deploy History & Rollback

## How it works

Every time you deploy a zip to a site, Grimport saves a copy of that zip in the site's `history/` directory. The last **5 deployments** per site are kept — older ones are pruned automatically.

## Viewing history

Click the **↺** (history) button on a site card to open the deploy history modal. It shows:
- Deployment number (newest first)
- Filename of the zip
- File size
- Deployment timestamp

## Rolling back

In the history modal, click **Rollback** next to any previous deployment. Grimport will:
1. Extract that zip back into the site's `html/` directory
2. Restart the container
3. Log the rollback in the activity log

The rollback is instant — just like a fresh deploy.

## Rolling back via API

```bash
# Get history
curl -H "Authorization: Bearer grim_yourtoken" \
  https://panel.yourdomain.com/api/deploy/SITE_ID/history

# Roll back to a specific deployment
curl -X POST -H "Authorization: Bearer grim_yourtoken" \
  https://panel.yourdomain.com/api/deploy/SITE_ID/rollback/DEPLOYMENT_ID
```

## Storage

Deploy history zips are stored at `./data/sites/<site-id>/history/`. Each zip is prefixed with a timestamp. Only the last 5 are kept; older ones are deleted automatically when a new deploy is made.

To reclaim disk space manually:
```bash
ls -lh ~/grimport/data/sites/*/history/
```
