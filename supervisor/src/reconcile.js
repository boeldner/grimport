const Dockerode = require('dockerode');
const db = require('./db');
const { containerStatus } = require('./docker');

const docker = new Dockerode({ socketPath: '/var/run/docker.sock' });

async function findContainerByName(siteId) {
  try {
    const name = `webhost-site-${siteId}`;
    const list = await docker.listContainers({
      all: true,
      filters: JSON.stringify({ name: [name] }),
    });
    const exact = list.find(c => c.Names.some(n => n === `/${name}` || n === name));
    return exact ? exact.Id : null;
  } catch {
    return null;
  }
}

async function reconcile() {
  console.log('[reconcile] Checking container state...');
  const sites = db.prepare('SELECT id, container_id FROM sites').all();

  // Phase 1: verify container IDs, re-link by name if stale/missing
  for (const site of sites) {
    if (site.container_id) {
      const status = await containerStatus(site.container_id);
      if (status.status !== 'missing') continue;
      console.warn(`[reconcile] Site ${site.id}: stale container ID, searching by name...`);
    }
    const newId = await findContainerByName(site.id);
    if (newId) {
      db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newId, site.id);
      console.log(`[reconcile] Site ${site.id}: re-linked to container ${newId}`);
    } else if (site.container_id) {
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
