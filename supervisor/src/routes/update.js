const { Router } = require('express');
const https = require('https');
const path = require('path');
const { requireRole } = require('../auth');
const Dockerode = require('dockerode');
const db = require('../db');

function logActivity(event, detail) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail) VALUES (?, ?, ?, ?)')
      .run(null, 'grimport', event, detail);
  } catch {}
}

const imageUpdater = require('../image-updater');

const router = Router();
const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const CURRENT_VERSION = require('../../package.json').version;
const REPO = 'boeldner/grimport';
const IMAGE = process.env.GRIMPORT_IMAGE || 'ghcr.io/boeldner/grimport:latest';
const CONTAINER_NAME = 'webhost-supervisor';

let versionCache = null;
let versionCacheAt = 0;
const CACHE_TTL = 60 * 60 * 1000;

let updateState = { status: 'idle', message: '' };
// status: idle | pulling | applying | restarting | error

function semverGt(a, b) {
  const pa = a.split('.').map(Number);
  const pb = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

function fetchLatestRelease() {
  return new Promise((resolve, reject) => {
    https.get({
      hostname: 'api.github.com',
      path: `/repos/${REPO}/releases/latest`,
      headers: { 'User-Agent': 'grimport-supervisor', 'Accept': 'application/vnd.github.v3+json' },
    }, res => {
      let body = '';
      res.on('data', d => { body += d; });
      res.on('end', () => {
        try {
          const json = JSON.parse(body);
          resolve({
            version: json.tag_name?.replace(/^v/, '') || null,
            notes: json.body || null,
          });
        } catch { resolve({ version: null, notes: null }); }
      });
    }).on('error', reject);
  });
}

// GET /api/update/check
router.get('/check', async (req, res) => {
  const now = Date.now();
  const force = req.query.force === '1';
  if (!force && versionCache && now - versionCacheAt < CACHE_TTL) return res.json(versionCache);
  try {
    const { version: latest, notes } = await fetchLatestRelease();
    versionCache = {
      current: CURRENT_VERSION,
      latest: latest || CURRENT_VERSION,
      updateAvailable: latest ? semverGt(latest, CURRENT_VERSION) : false,
      releaseNotes: notes || null,
    };
    versionCacheAt = now;
    res.json(versionCache);
  } catch {
    res.json({ current: CURRENT_VERSION, latest: CURRENT_VERSION, updateAvailable: false, releaseNotes: null });
  }
});

// GET /api/update/status
router.get('/status', (req, res) => {
  const fs = require('fs');
  let recreatorLog = null;
  try { recreatorLog = fs.readFileSync('/tmp/grimport-recreator.log', 'utf8').trim().split('\n').slice(-5).join('\n'); } catch {}
  res.json({ ...updateState, recreatorLog });
});

// POST /api/update/apply — admin only
router.post('/apply', requireRole('admin'), (req, res) => {
  if (updateState.status !== 'idle' && updateState.status !== 'error') {
    return res.status(409).json({ error: 'Update already in progress' });
  }
  res.json({ ok: true });
  setImmediate(performUpdate);
});

async function performUpdate() {
  try {
    // 1. Pull new image — container keeps running, sites unaffected
    logActivity('update_started', `Pulling ${IMAGE}`);
    updateState = { status: 'pulling', message: 'Pulling new image from GHCR…' };
    await new Promise((resolve, reject) => {
      docker.pull(IMAGE, (err, stream) => {
        if (err) return reject(err);
        docker.modem.followProgress(stream, err => err ? reject(err) : resolve());
      });
    });

    // 2. Inspect own container to clone its full config
    updateState = { status: 'applying', message: 'Preparing new container…' };
    const self = docker.getContainer(CONTAINER_NAME);
    const info = await self.inspect();

    // Build clean network config — only pass network names, not stale endpoint metadata
    const endpointsConfig = {};
    for (const [netName, netInfo] of Object.entries(info.NetworkSettings.Networks || {})) {
      endpointsConfig[netName] = { Aliases: (netInfo.Aliases || []).filter(a => a !== CONTAINER_NAME) };
    }

    const cfg = {
      name:   CONTAINER_NAME,
      Image:  IMAGE,
      Env:    info.Config.Env    || [],
      Labels: info.Config.Labels || {},
      HostConfig: {
        Binds:         info.HostConfig.Binds       || [],
        NetworkMode:   info.HostConfig.NetworkMode || 'bridge',
        RestartPolicy: { Name: 'unless-stopped' },
        PortBindings:  info.HostConfig.PortBindings || {},
      },
      NetworkingConfig: { EndpointsConfig: endpointsConfig },
    };

    // 3. Spawn a helper container using the NEW image.
    //    It has Docker socket access and runs independently — it will outlive us.
    //    It waits for the old container to stop, removes it, then starts the new one.
    const HELPER = 'grimport-updater';
    const helperScript = `
      const Dockerode = require('/app/node_modules/dockerode');
      const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
      const NAME = ${JSON.stringify(CONTAINER_NAME)};
      const cfg  = ${JSON.stringify(cfg)};
      async function run() {
        await new Promise(r => setTimeout(r, 4000));
        try { await docker.getContainer(NAME).remove({ force: true }); } catch {}
        const nc = await docker.createContainer(cfg);
        await nc.start();
        console.log('[grimport-updater] done');
      }
      run().catch(e => { console.error('[grimport-updater] failed:', e.message); process.exit(1); });
    `;

    // Clean up any leftover helper from a previous attempt
    try { await docker.getContainer(HELPER).remove({ force: true }); } catch {}

    const helper = await docker.createContainer({
      name: HELPER,
      Image: IMAGE,
      Cmd: ['node', '-e', helperScript],
      HostConfig: {
        Binds: ['/var/run/docker.sock:/var/run/docker.sock'],
        AutoRemove: true,
        NetworkMode: info.HostConfig.NetworkMode || 'bridge',
      },
    });
    await helper.start();

    // 4. Disable own restart policy so Docker won't auto-restart the old image on exit
    await self.update({ RestartPolicy: { Name: 'no' } });

    // 5. Exit — the helper container takes over
    logActivity('update_applying', `Restarting with ${IMAGE}`);
    updateState = { status: 'restarting', message: 'Restarting with new version…' };
    setTimeout(() => process.exit(0), 600);

  } catch (err) {
    console.error('[update] Failed:', err.message);
    logActivity('update_failed', err.message);
    updateState = { status: 'error', message: err.message };
    try {
      await docker.getContainer(CONTAINER_NAME).update({ RestartPolicy: { Name: 'unless-stopped' } });
    } catch {}
  }
}


// ── Site container images ──────────────────────────────────
// The panel updates itself via /apply above; site containers (nginx / php /
// node / python) are separate images that also need refreshing over time.

// GET /api/update/images — compare each site container with the local image
// for its runtime tag. No registry access; pull first to see what's new.
router.get('/images', async (req, res) => {
  try {
    res.json(await imageUpdater.status());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/update/images/pull — pull every runtime image in use, then report status.
router.post('/images/pull', requireRole('admin'), async (req, res) => {
  try {
    const pulled = await imageUpdater.pullImages();
    const st = await imageUpdater.status();
    logActivity('images_pulled', pulled.filter(p => p.updated).map(p => p.tag).join(', ') || 'no changes');
    res.json({ pulled, ...st });
  } catch (err) {
    res.status(502).json({ error: `Image pull failed: ${err.message}` });
  }
});

// POST /api/update/images/apply — rolling recreate of outdated site containers.
// body: { pull?: bool (default true), site_ids?: [..], force?: bool }
router.post('/images/apply', requireRole('admin'), (req, res) => {
  const { pull, site_ids, force } = req.body || {};
  try {
    imageUpdater.run({
      pull: pull !== false,
      siteIds: Array.isArray(site_ids) ? site_ids : null,
      force: !!force,
      actor: req.user?.username || 'system',
    });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message });
  }
  logActivity('containers_update_started', force ? 'forced recreate' : 'outdated containers');
  res.json({ ok: true, job: imageUpdater.getState() });
});

// GET /api/update/images/status — progress of the rolling update.
router.get('/images/status', (req, res) => {
  res.json(imageUpdater.getState());
});

module.exports = router;
