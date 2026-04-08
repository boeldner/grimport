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

const router = Router();
const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const CURRENT_VERSION = '0.7.6';
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

    const cfg = {
      name:   CONTAINER_NAME,
      Image:  IMAGE,
      Env:    info.Config.Env    || [],
      Labels: info.Config.Labels || {},
      HostConfig: {
        Binds:         info.HostConfig.Binds       || [],
        NetworkMode:   info.HostConfig.NetworkMode || 'bridge',
        RestartPolicy: { Name: 'unless-stopped' },
      },
      NetworkingConfig: {
        EndpointsConfig: info.NetworkSettings.Networks || {},
      },
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

module.exports = router;
