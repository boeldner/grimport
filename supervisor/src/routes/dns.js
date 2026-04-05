const { Router } = require('express');
const dns = require('dns').promises;
const db = require('../db');

const router = Router();

// Cache the public IP for 10 minutes so we don't hammer ipify
let cachedPublicIp = null;
let cachedAt = 0;

async function getPublicIp() {
  if (cachedPublicIp && Date.now() - cachedAt < 10 * 60 * 1000) return cachedPublicIp;
  try {
    const res = await fetch('https://api4.ipify.org?format=json', { signal: AbortSignal.timeout(4000) });
    const { ip } = await res.json();
    cachedPublicIp = ip;
    cachedAt = Date.now();
    return ip;
  } catch {
    return process.env.PUBLIC_IP || null;
  }
}

// GET /api/dns/server-ip — just return the server's public IP
// Must be before /:id so Express doesn't swallow it as a param
router.get('/server-ip', async (req, res) => {
  const ip = await getPublicIp();
  res.json({ ip });
});

// GET /api/dns/:id — check DNS status for a site
router.get('/:id', async (req, res) => {
  const row = db.prepare('SELECT id, domain FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Site not found' });

  const serverIp = await getPublicIp();

  let resolved = [];
  let status = 'unknown';
  let error = null;

  try {
    resolved = await dns.resolve4(row.domain);
    if (!serverIp) {
      status = 'unknown'; // can't compare without knowing our IP
    } else if (resolved.includes(serverIp)) {
      status = 'ok';
    } else {
      status = 'wrong'; // resolves, but to a different IP
    }
  } catch (err) {
    if (err.code === 'ENOTFOUND' || err.code === 'ENODATA') {
      status = 'pending'; // domain doesn't resolve yet
    } else {
      status = 'error';
      error = err.message;
    }
  }

  res.json({
    domain: row.domain,
    serverIp,
    resolved,
    status,  // ok | pending | wrong | unknown | error
    error,
    records: serverIp ? [
      { type: 'A', name: row.domain, value: serverIp },
    ] : [],
  });
});


module.exports = router;
