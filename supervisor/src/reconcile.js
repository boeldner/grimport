const Dockerode = require('dockerode');
const db = require('./db');
const { containerStatus } = require('./docker');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

async function reconcile() {
  console.log('[reconcile] Checking container state...');
  const sites = db.prepare('SELECT id, container_id FROM sites').all();

  // Phase 1: clear stale container IDs from DB
  for (const site of sites) {
    if (!site.container_id) continue;
    const status = await containerStatus(site.container_id);
    if (status.status === 'missing') {
      db.prepare('UPDATE sites SET container_id = NULL WHERE id = ?').run(site.id);
      console.warn(`[reconcile] Site ${site.id}: container gone, cleared from DB`);
    }
  }

  // Phase 2: remove orphaned site containers not tracked in DB
  let containers;
  try {
    containers = await docker.listContainers({
      all: true,
      filters: JSON.stringify({ label: ['webhost.site=true'] }),
    });
  } catch (err) {
    console.error('[reconcile] Could not list containers:', err.message);
    return;
  }

  const knownIds = new Set(
    db.prepare('SELECT container_id FROM sites WHERE container_id IS NOT NULL').all()
      .map(r => r.container_id)
  );

  for (const c of containers) {
    if (!knownIds.has(c.Id)) {
      console.warn(`[reconcile] Orphan container ${c.Names[0]} — removing`);
      try {
        const container = docker.getContainer(c.Id);
        try { await container.stop({ t: 5 }); } catch {}
        await container.remove();
      } catch (err) {
        console.error(`[reconcile] Failed to remove orphan ${c.Id}:`, err.message);
      }
    }
  }

  console.log('[reconcile] Done');
}

module.exports = { reconcile };
