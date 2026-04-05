const { Router } = require('express');
const https = require('https');
const path = require('path');
const { requireRole } = require('../auth');
const Dockerode = require('dockerode');

const router = Router();
const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

const CURRENT_VERSION = '0.7.2';
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

    // 3. Disable own restart policy so Docker won't auto-restart the old image on exit
    await self.update({ RestartPolicy: { Name: 'no' } });

    // 4. Spawn a detached Node.js script that outlives us.
    //    It waits for us to stop, then recreates the container with the new image.
    const { spawn } = require('child_process');
    const child = spawn(process.execPath, ['-e', buildRecreatorScript(info)], {
      detached: true,
      stdio: 'ignore',
      env: process.env,
    });
    child.unref();

    // 5. Exit — Docker won't restart (policy is now 'no').
    //    The detached script takes over and creates a fresh container with the new image.
    updateState = { status: 'restarting', message: 'Restarting with new version…' };
    setTimeout(() => process.exit(0), 600);

  } catch (err) {
    console.error('[update] Failed:', err.message);
    updateState = { status: 'error', message: err.message };
    // Restore restart policy so the container keeps running normally
    try {
      await docker.getContainer(CONTAINER_NAME).update({ RestartPolicy: { Name: 'unless-stopped' } });
    } catch {}
  }
}

function buildRecreatorScript(info) {
  // Serialise only what createContainer needs — skip read-only inspection fields
  const cfg = {
    name:  CONTAINER_NAME,
    Image: IMAGE,
    Env:   info.Config.Env   || [],
    Labels: info.Config.Labels || {},
    HostConfig: {
      Binds:         info.HostConfig.Binds         || [],
      NetworkMode:   info.HostConfig.NetworkMode   || 'bridge',
      RestartPolicy: { Name: 'unless-stopped' },   // restore policy on the new container
    },
    NetworkingConfig: {
      EndpointsConfig: info.NetworkSettings.Networks || {},
    },
  };

  return `
    const Dockerode = require(${JSON.stringify(require.resolve('dockerode'))});
    const fs = require('fs');
    const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });
    const cfg = ${JSON.stringify(cfg)};
    const LOG = '/tmp/grimport-recreator.log';

    function log(msg) {
      const line = new Date().toISOString() + ' ' + msg + '\\n';
      try { fs.appendFileSync(LOG, line); } catch {}
      console.log(msg);
    }

    async function run() {
      log('[recreator] Starting — waiting for old container to stop...');
      // Give the old container time to fully stop before we remove it
      await new Promise(r => setTimeout(r, 5000));

      try {
        await docker.getContainer(${JSON.stringify(CONTAINER_NAME)}).remove({ force: true });
        log('[recreator] Old container removed');
      } catch (e) {
        log('[recreator] remove old container: ' + e.message);
      }

      try {
        const nc = await docker.createContainer(cfg);
        await nc.start();
        log('[recreator] New container started — update complete');
      } catch (e) {
        log('[recreator] FAILED to start new container: ' + e.message);
        // Fallback: restore restart policy on whatever container exists so Docker recovers it
        try {
          await docker.getContainer(${JSON.stringify(CONTAINER_NAME)}).update({ RestartPolicy: { Name: 'unless-stopped' } });
          log('[recreator] Restored restart policy on existing container');
        } catch {}
      }
    }

    run();
  `;
}

module.exports = router;
