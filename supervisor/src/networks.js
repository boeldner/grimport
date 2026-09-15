/**
 * Per-site Docker networks.
 *
 * Each site gets `webhost-site-<id>`: a /24 carved out of SITE_NET_POOL
 * (default 10.99.0.0/16). Static sites and previews use `internal` networks
 * (no route to the outside at all); app runtimes get a normal bridge whose
 * egress is fenced by the egress-guard rules (egress/apply-rules.sh) which
 * key on the same pool. Traefik is connected to every site network so it can
 * reach the container; the supervisor never is, so a site cannot reach the
 * panel or other sites.
 *
 * Dockerode is injected so the module is unit-testable without Docker.
 */

const DEFAULT_POOL = '10.99.0.0/16';

function parsePool(pool) {
  const m = /^(\d+)\.(\d+)\.(\d+)\.(\d+)\/(\d+)$/.exec(pool || '');
  if (!m) throw new Error(`SITE_NET_POOL must look like 10.99.0.0/16, got "${pool}"`);
  const bits = Number(m[5]);
  if (bits > 24) throw new Error('SITE_NET_POOL must be /24 or larger (it is split into /24 site networks)');
  return { a: Number(m[1]), b: Number(m[2]), c: Number(m[3]), bits };
}

/**
 * Lowest free /24 inside the pool that is not in `existingSubnets`.
 * Third octet 0 is skipped so the pool's own network address is never used.
 */
function allocateSubnet(existingSubnets, pool = DEFAULT_POOL) {
  const { a, b, c, bits } = parsePool(pool);
  const taken = new Set((existingSubnets || []).map(s => String(s).trim()));
  const count = Math.min(256, 2 ** (24 - bits)); // number of /24s in the pool
  for (let i = 1; i < count; i++) {
    const third = (c + i) & 0xff;
    const subnet = `${a}.${b}.${third}.0/24`;
    if (!taken.has(subnet)) return subnet;
  }
  throw new Error(`No free /24 left in ${pool}`);
}

function isAlreadyExistsError(err) {
  const msg = String(err?.message || err?.reason || '');
  return err?.statusCode === 403 || err?.statusCode === 409 || /already exists|already connected|endpoint with name/i.test(msg);
}

function createNetworks({ docker, pool = process.env.SITE_NET_POOL || DEFAULT_POOL, traefikName = process.env.TRAEFIK_CONTAINER || 'webhost-traefik', log = console } = {}) {
  const name = siteId => `webhost-site-${siteId}`;

  async function listSiteNetworks() {
    const nets = await docker.listNetworks({ filters: JSON.stringify({ label: ['webhost.site.net=true'] }) });
    return nets.map(n => ({
      name: n.Name,
      id: n.Id,
      siteId: n.Labels?.['webhost.site.id'] || null,
      subnet: n.IPAM?.Config?.[0]?.Subnet || null,
      internal: !!n.Internal,
    }));
  }

  async function findNetwork(netName) {
    const nets = await docker.listNetworks({ filters: JSON.stringify({ name: [netName] }) });
    return nets.find(n => n.Name === netName) || null;
  }

  async function ensureSiteNetwork(siteId, { internal = false } = {}) {
    const netName = name(siteId);
    const existing = await findNetwork(netName);
    if (existing) {
      return { name: netName, id: existing.Id, subnet: existing.IPAM?.Config?.[0]?.Subnet || null, created: false };
    }
    const all = await listSiteNetworks();
    const subnet = allocateSubnet(all.map(n => n.subnet).filter(Boolean), pool);
    const created = await docker.createNetwork({
      Name: netName,
      Driver: 'bridge',
      Internal: !!internal,
      Labels: { 'webhost.site': 'true', 'webhost.site.id': siteId, 'webhost.site.net': 'true' },
      IPAM: { Driver: 'default', Config: [{ Subnet: subnet }] },
    });
    return { name: netName, id: created.id || created.Id || null, subnet, created: true };
  }

  async function connectTraefik(netName) {
    try {
      await docker.getNetwork(netName).connect({ Container: traefikName });
      return true;
    } catch (err) {
      if (isAlreadyExistsError(err)) return true;
      if (err?.statusCode === 404) {
        log.warn?.(`[networks] Traefik container "${traefikName}" not found — ${netName} has no edge route (dev without Traefik?)`);
        return false;
      }
      throw err;
    }
  }

  async function removeSiteNetwork(siteId) {
    const netName = name(siteId);
    const net = docker.getNetwork(netName);
    try { await net.disconnect({ Container: traefikName, Force: true }); } catch {}
    try { await net.remove(); return true; } catch (err) {
      if (err?.statusCode === 404) return false;
      log.warn?.(`[networks] Could not remove ${netName}: ${err.message}`);
      return false;
    }
  }

  async function reconnectTraefikToAll() {
    let nets = [];
    try { nets = await listSiteNetworks(); } catch (err) {
      log.warn?.(`[networks] Could not list site networks: ${err.message}`);
      return 0;
    }
    let ok = 0;
    for (const n of nets) {
      try { if (await connectTraefik(n.name)) ok++; } catch (err) {
        log.warn?.(`[networks] Could not connect Traefik to ${n.name}: ${err.message}`);
      }
    }
    return ok;
  }

  return { name, allocateSubnet: subs => allocateSubnet(subs, pool), listSiteNetworks, ensureSiteNetwork, connectTraefik, removeSiteNetwork, reconnectTraefikToAll };
}

module.exports = { createNetworks, allocateSubnet, parsePool, DEFAULT_POOL };
