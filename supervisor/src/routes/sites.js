const { Router } = require('express');
const { nanoid } = require('nanoid');
const db = require('../db');
const { isValidHostname, sanitizeHeaderName, sanitizeRedirectField } = require('../validate');
const {
  createSiteContainer,
  createPreviewContainer,
  swapPreview,
  removePreviewContainer,
  applySiteSettings,
  startSiteContainer,
  stopSiteContainer,
  removeSiteResources,
  containerStatus,
  containerLogs,
  siteDir,
} = require('../docker');
const imageUpdater = require('../image-updater');
const { fireWebhooks } = require('../webhooks');
const { requireRole, requireSiteRole, requireHumanSession, authz, isPanelAdmin } = require('../auth');
const { asyncHandler } = require('../async-handler');
const { notify } = require('../notify');
const { parseSite, parseSiteForContainer } = require('../site-model');
const { SITE_ROLES } = require('../authz');
const { pendingReviewFor, pendingDir } = require('../quarantine');
const fs = require('fs');

const router = Router();

function logActivity(siteId, siteName, event, detail, actor = 'system', targetUserId = null) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null, actor, targetUserId);
  } catch {}
}

/**
 * Record an action an admin performed on somebody else's site (support mode):
 * the activity row carries the site owner as target, and the owner gets a bell
 * notification so support access is never silent.
 */
function supportTrail(req, site, event, detail) {
  const ownerId = authz.siteOwnerId(site.id);
  const actor = req.user?.username || 'system';
  logActivity(site.id, site.name, event, detail, actor, req.supportMode ? ownerId : null);
  if (req.supportMode && ownerId) {
    notify({
      type: 'support_action',
      title: `${actor} (support) — ${event.replace(/_/g, ' ')} on ${site.name}`,
      detail: detail || null,
      data: { siteId: site.id, actor, event },
      userIds: [ownerId],
      admins: false,
      force: true,
    });
  }
}

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

/** Public view of a site for the requesting user: adds my_role, owner, support flag. */
function decorate(site, req) {
  const out = parseSite(site);
  out.my_role = authz.siteRoleFor(req.user, site.id);
  out.support = authz.isSupportAccess(req.user, site.id);
  out.owner_id = site.owner_id || null;
  const owner = site.owner_id ? db.prepare('SELECT username, display_name FROM users WHERE id = ?').get(site.owner_id) : null;
  out.owner = owner ? { id: site.owner_id, username: owner.username, display_name: owner.display_name || null } : null;
  out.status = site.status || 'active';
  const pr = pendingReviewFor(site.id);
  if (pr) {
    let n = 0; try { n = JSON.parse(pr.findings || '[]').length; } catch {}
    out.pending_review = { id: pr.id, created_at: pr.created_at, findings_count: n, created_by: pr.created_by };
  }
  return out;
}

function slugify(name) {
  return String(name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || nanoid(6).toLowerCase();
}

// GET /api/sites — list sites the caller can see (admins: all)
router.get('/', asyncHandler(async (req, res) => {
  const scope = authz.siteScopeSql(req.user, 'id');
  const rows = db.prepare(`SELECT * FROM sites WHERE ${scope.sql} ORDER BY created_at DESC`).all(...scope.params);
  const sites = await Promise.all(
    rows.map(async (row) => {
      const site = decorate(row, req);
      site.container = site.container_id ? await containerStatus(site.container_id) : { status: 'none', running: false };
      return site;
    })
  );
  res.json(sites);
}));

// GET /api/sites/:id
router.get('/:id', requireSiteRole('viewer'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const site = decorate(row, req);
  if (site.container_id) site.container = await containerStatus(site.container_id);
  res.json(site);
}));

/**
 * Domain policy for non-admin creators: members get `<slug>.<base>`; a custom
 * domain becomes a request the owner approves (or is allowed straight away
 * when the panel policy is "free" and the user's capability says so).
 */
function resolveDomainForCreate(req, name, requested) {
  const admin = isPanelAdmin(req.user);
  const base = getSetting('site_base_domain');
  const wanted = requested ? String(requested).trim().toLowerCase() : '';
  if (admin) {
    if (!wanted) throw Object.assign(new Error('domain is required'), { status: 400 });
    return { domain: wanted, request: null };
  }
  const caps = req.user.capabilities || {};
  const policy = getSetting('custom_domain_policy') || 'approval';
  const free = policy === 'free' || caps.custom_domains === 'free';
  const isSub = base && wanted.endsWith(`.${base}`) && !wanted.slice(0, -base.length - 1).includes('.');
  if (wanted && (isSub || free)) return { domain: wanted, request: null };
  if (!base) throw Object.assign(new Error('No base domain configured — ask the owner to set one before creating sites'), { status: 400 });
  // Auto subdomain; keep the custom wish as a request
  let slug = slugify(name);
  let domain = `${slug}.${base}`;
  let i = 2;
  while (db.prepare('SELECT 1 FROM sites WHERE domain = ?').get(domain)) { domain = `${slug}-${i++}.${base}`; }
  return { domain, request: wanted && wanted !== domain ? wanted : null };
}

// POST /api/sites — create a site (owner/admin/member within capabilities)
router.post('/', asyncHandler(async (req, res) => {
  const pr = req.user.platform_role;
  if (req.user.id === 'token' && req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
  if (!['owner', 'admin', 'member'].includes(pr)) return res.status(403).json({ error: 'Forbidden: your account cannot create sites' });
  const { name, domain, spa_mode, cache_enabled, runtime, build_cmd, start_cmd, app_port } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const caps = req.user.capabilities || {};
  const siteRuntime = runtime || 'static';
  if (!isPanelAdmin(req.user)) {
    const owned = db.prepare('SELECT COUNT(*) AS c FROM sites WHERE owner_id = ?').get(req.user.id).c;
    if (owned >= (caps.max_sites ?? 0)) return res.status(403).json({ error: `Site limit reached (${caps.max_sites}) — ask the owner to raise it` });
    if (!(caps.runtimes || ['static']).includes(siteRuntime)) return res.status(403).json({ error: `Runtime "${siteRuntime}" is not enabled for your account` });
  }

  let resolved;
  try { resolved = resolveDomainForCreate(req, name, domain); }
  catch (e) { return res.status(e.status || 400).json({ error: e.message }); }
  if (!isValidHostname(resolved.domain)) return res.status(400).json({ error: 'Invalid domain' });
  if (resolved.request && !isValidHostname(resolved.request)) return res.status(400).json({ error: 'Invalid domain' });

  const id = nanoid(10);
  const ownerId = req.user.id === 'token' ? (req.user.tokenOwner?.id || null) : req.user.id;
  try {
    db.prepare(
      `INSERT INTO sites (id, name, domain, spa_mode, cache_enabled, runtime, build_cmd, start_cmd, app_port, owner_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id, String(name).trim(), resolved.domain,
      spa_mode ? 1 : 0, cache_enabled !== false ? 1 : 0,
      siteRuntime, build_cmd || null, start_cmd || null, app_port || null, ownerId
    );

    const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(id);
    const containerId = await createSiteContainer(parseSiteForContainer(row));
    db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(containerId, id);
    const site = decorate(db.prepare('SELECT * FROM sites WHERE id = ?').get(id), req);
    site.container = await containerStatus(containerId);
    logActivity(id, site.name, 'created', resolved.domain, req.user?.username || 'system');

    if (resolved.request) {
      const rid = nanoid(10);
      db.prepare('INSERT INTO domain_requests (id, site_id, domain, requested_by) VALUES (?, ?, ?, ?)').run(rid, id, resolved.request, ownerId);
      notify({ type: 'domain_request', title: `${req.user.username} requests ${resolved.request} for ${site.name}`, detail: 'Approve or reject under Domains', data: { siteId: id, requestId: rid, domain: resolved.request }, force: true });
      site.domain_request = { id: rid, domain: resolved.request, status: 'pending' };
    }
    res.status(201).json(site);
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ error: 'Domain already exists' });
    }
    console.error('Create site error:', err);
    res.status(500).json({ error: err.message });
  }
}));

// PUT /api/sites/:id — update settings (site editor+; domain changes need site owner)
router.put('/:id', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.status === 'suspended' && !isPanelAdmin(req.user)) return res.status(423).json({ error: 'Site is suspended' });

  const {
    name, domain, spa_mode, cache_enabled, maintenance_mode,
    ssl_enabled, basic_auth, custom_headers, redirects,
    runtime, build_cmd, start_cmd, app_port, env_vars,
  } = req.body;

  let domainValue = domain;
  let domainRequest = null;
  if (domain !== undefined) {
    domainValue = String(domain).trim().toLowerCase();
    if (!isValidHostname(domainValue)) return res.status(400).json({ error: 'Invalid domain' });
    if (domainValue !== row.domain) {
      if (req.siteRole !== 'owner') return res.status(403).json({ error: 'Only the site owner can change the domain' });
      if (!isPanelAdmin(req.user)) {
        // Members: subdomains of the base are fine, anything else becomes a request.
        const base = getSetting('site_base_domain');
        const caps = req.user.capabilities || {};
        const free = (getSetting('custom_domain_policy') || 'approval') === 'free' || caps.custom_domains === 'free';
        const isSub = base && domainValue.endsWith(`.${base}`) && !domainValue.slice(0, -base.length - 1).includes('.');
        if (!isSub && !free) { domainRequest = domainValue; domainValue = row.domain; }
      }
    }
  }
  if (runtime !== undefined && runtime !== row.runtime && !isPanelAdmin(req.user)) {
    if (!(req.user.capabilities?.runtimes || ['static']).includes(runtime)) return res.status(403).json({ error: `Runtime "${runtime}" is not enabled for your account` });
  }

  if (custom_headers !== undefined) {
    try {
      const list = typeof custom_headers === 'string' ? JSON.parse(custom_headers) : custom_headers;
      for (const h of list) sanitizeHeaderName(h.name);
    } catch (e) { return res.status(400).json({ error: `Invalid custom header: ${e.message}` }); }
  }
  if (redirects !== undefined) {
    try {
      const list = typeof redirects === 'string' ? JSON.parse(redirects) : redirects;
      for (const r of list) { sanitizeRedirectField(r.from); sanitizeRedirectField(r.to); }
    } catch (e) { return res.status(400).json({ error: `Invalid redirect: ${e.message}` }); }
  }

  db.prepare(
    `UPDATE sites SET
      name = COALESCE(?, name),
      domain = COALESCE(?, domain),
      spa_mode = COALESCE(?, spa_mode),
      cache_enabled = COALESCE(?, cache_enabled),
      maintenance_mode = COALESCE(?, maintenance_mode),
      ssl_enabled = COALESCE(?, ssl_enabled),
      basic_auth = ?,
      custom_headers = COALESCE(?, custom_headers),
      redirects = COALESCE(?, redirects),
      runtime = COALESCE(?, runtime),
      build_cmd = COALESCE(?, build_cmd),
      start_cmd = COALESCE(?, start_cmd),
      app_port = COALESCE(?, app_port),
      env_vars = COALESCE(?, env_vars)
    WHERE id = ?`
  ).run(
    name ?? null,
    domain ? domainValue : null,
    spa_mode !== undefined ? (spa_mode ? 1 : 0) : null,
    cache_enabled !== undefined ? (cache_enabled ? 1 : 0) : null,
    maintenance_mode !== undefined ? (maintenance_mode ? 1 : 0) : null,
    ssl_enabled !== undefined ? (ssl_enabled ? 1 : 0) : null,
    (() => {
      if (basic_auth === undefined) return row.basic_auth; // not sent — keep unchanged
      if (basic_auth === null) return null;                // explicit remove
      const existing = row.basic_auth ? JSON.parse(row.basic_auth) : null;
      return JSON.stringify({
        username: basic_auth.username,
        password: basic_auth.password || existing?.password || '',
      });
    })(),
    custom_headers !== undefined ? JSON.stringify(custom_headers) : null,
    redirects !== undefined ? JSON.stringify(redirects) : null,
    runtime ?? null,
    build_cmd !== undefined ? (build_cmd || null) : null,
    start_cmd !== undefined ? (start_cmd || null) : null,
    app_port ?? null,
    env_vars ?? null,
    req.params.id,
  );

  const updatedRow = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  const updated = decorate(updatedRow, req);
  // Container ops need the stored basic-auth password (it goes into .htpasswd);
  // the response object above keeps it stripped.
  const newContainerId = await applySiteSettings(parseSiteForContainer(updatedRow));
  if (newContainerId) {
    db.prepare('UPDATE sites SET container_id = ? WHERE id = ?').run(newContainerId, req.params.id);
    updated.container_id = newContainerId;
  }
  if (domainRequest) {
    const rid = nanoid(10);
    db.prepare('INSERT INTO domain_requests (id, site_id, domain, requested_by) VALUES (?, ?, ?, ?)').run(rid, row.id, domainRequest, req.user.id);
    notify({ type: 'domain_request', title: `${req.user.username} requests ${domainRequest} for ${updated.name}`, detail: 'Approve or reject under Domains', data: { siteId: row.id, requestId: rid, domain: domainRequest }, force: true });
    updated.domain_request = { id: rid, domain: domainRequest, status: 'pending' };
  }
  supportTrail(req, updated, 'settings_changed', null);
  res.json(updated);
}));

// POST /api/sites/:id/start
router.post('/:id/start', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  if (row.status === 'suspended' && !isPanelAdmin(req.user)) return res.status(423).json({ error: 'Site is suspended' });
  await startSiteContainer(row.container_id);
  supportTrail(req, row, 'started', null);
  res.json({ ok: true });
}));

// POST /api/sites/:id/stop
router.post('/:id/stop', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  await stopSiteContainer(row.container_id);
  supportTrail(req, row, 'stopped', null);
  res.json({ ok: true });
}));

// DELETE /api/sites/:id — stop + remove container + network, delete files (site owner)
router.delete('/:id', requireSiteRole('owner'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  await removeSiteResources(parseSite(row));

  const dir = siteDir(req.params.id);
  if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });

  const deleteSiteCascade = db.transaction((siteId) => {
    db.prepare('DELETE FROM site_permissions WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM site_members WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM domain_requests WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM deployments WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM analytics_hourly WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM analytics_cursor WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM uptime_checks WHERE site_id = ?').run(siteId);
    db.prepare('DELETE FROM sites WHERE id = ?').run(siteId);
  });
  deleteSiteCascade(req.params.id);

  const ownerId = row.owner_id;
  logActivity(null, row.name, 'deleted', row.domain, req.user?.username || 'system', req.supportMode ? ownerId : null);
  if (req.supportMode && ownerId) {
    notify({ type: 'support_action', title: `${req.user.username} (support) deleted ${row.name}`, detail: row.domain, data: { actor: req.user.username, event: 'deleted' }, userIds: [ownerId], admins: false, force: true });
  }
  res.json({ ok: true });
}));

// ── Suspension (panel admins) ──────────────────────────────

router.post('/:id/suspend', requireRole('admin'), requireHumanSession, asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const reason = req.body?.reason ? String(req.body.reason).slice(0, 200) : null;
  if (row.container_id) { try { await stopSiteContainer(row.container_id); } catch {} }
  if (row.preview_container_id) { try { await stopSiteContainer(row.preview_container_id); } catch {} }
  db.prepare("UPDATE sites SET status = 'suspended' WHERE id = ?").run(row.id);
  logActivity(row.id, row.name, 'suspended', reason, req.user.username, row.owner_id);
  notify({ type: 'site_suspended', title: `${row.name} was suspended`, detail: reason || 'Contact the panel owner', data: { siteId: row.id }, siteId: row.id, admins: false, force: true });
  res.json({ ok: true, status: 'suspended' });
}));

router.post('/:id/unsuspend', requireRole('admin'), requireHumanSession, asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  db.prepare("UPDATE sites SET status = 'active' WHERE id = ?").run(row.id);
  if (row.container_id) { try { await startSiteContainer(row.container_id); } catch {} }
  logActivity(row.id, row.name, 'unsuspended', null, req.user.username, row.owner_id);
  notify({ type: 'site_unsuspended', title: `${row.name} is active again`, data: { siteId: row.id }, siteId: row.id, admins: false, force: true });
  res.json({ ok: true, status: 'active' });
}));

// ── Members (site owner manages collaborators) ─────────────

// GET /api/sites/:id/members
router.get('/:id/members', requireSiteRole('viewer'), (req, res) => {
  const row = db.prepare('SELECT id, owner_id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const members = db.prepare(
    `SELECT m.user_id, m.site_role, m.added_at, u.username, u.display_name, u.platform_role
     FROM site_members m JOIN users u ON u.id = m.user_id WHERE m.site_id = ? ORDER BY m.added_at ASC`
  ).all(row.id);
  const owner = row.owner_id ? db.prepare('SELECT id, username, display_name FROM users WHERE id = ?').get(row.owner_id) : null;
  res.json({ owner, members });
});

// PUT /api/sites/:id/members — replace the member list [{ user_id, site_role }]
router.put('/:id/members', requireSiteRole('owner'), requireHumanSession, (req, res) => {
  const row = db.prepare('SELECT id, owner_id, name FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const list = Array.isArray(req.body?.members) ? req.body.members : null;
  if (!list) return res.status(400).json({ error: 'members must be an array of { user_id, site_role }' });
  for (const m of list) {
    if (!m?.user_id || !['viewer', 'editor'].includes(m.site_role)) return res.status(400).json({ error: 'site_role must be viewer or editor' });
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(m.user_id)) return res.status(400).json({ error: `Unknown user ${m.user_id}` });
  }
  const replace = db.transaction(items => {
    db.prepare('DELETE FROM site_members WHERE site_id = ?').run(row.id);
    for (const m of items) {
      if (m.user_id === row.owner_id) continue;
      db.prepare('INSERT OR IGNORE INTO site_members (site_id, user_id, site_role, added_by) VALUES (?, ?, ?, ?)').run(row.id, m.user_id, m.site_role, req.user.id);
    }
  });
  replace(list);
  supportTrail(req, row, 'members_changed', `${list.length} member(s)`);
  res.json({ ok: true });
});

// Legacy shape kept for the current UI: user ids with access (viewer role).
router.get('/:id/users', requireSiteRole('owner'), (req, res) => {
  const row = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const userIds = db.prepare('SELECT user_id FROM site_members WHERE site_id = ?').all(req.params.id).map(r => r.user_id);
  res.json({ user_ids: userIds });
});
router.put('/:id/users', requireSiteRole('owner'), requireHumanSession, (req, res) => {
  const row = db.prepare('SELECT id, owner_id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const { user_ids } = req.body;
  if (!Array.isArray(user_ids)) return res.status(400).json({ error: 'user_ids must be an array' });
  const replace = db.transaction(ids => {
    db.prepare('DELETE FROM site_members WHERE site_id = ?').run(req.params.id);
    for (const userId of ids) {
      if (userId === row.owner_id) continue;
      const u = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
      if (!u) continue;
      db.prepare('INSERT OR IGNORE INTO site_members (site_id, user_id, site_role, added_by) VALUES (?, ?, ?, ?)')
        .run(req.params.id, userId, u.role === 'viewer' ? 'viewer' : 'editor', req.user.id);
    }
  });
  replace(user_ids);
  res.json({ ok: true });
});

// POST /api/sites/:id/transfer { user_id } — hand the site to another user (site owner)
router.post('/:id/transfer', requireSiteRole('owner'), requireHumanSession, (req, res) => {
  const row = db.prepare('SELECT id, name, owner_id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const target = db.prepare('SELECT id, username, platform_role, status FROM users WHERE id = ?').get(req.body?.user_id);
  if (!target || target.status !== 'active') return res.status(400).json({ error: 'Unknown or disabled user' });
  if (!['owner', 'admin', 'member'].includes(target.platform_role)) return res.status(400).json({ error: 'Target cannot own sites (guest)' });
  db.prepare('UPDATE sites SET owner_id = ? WHERE id = ?').run(target.id, row.id);
  db.prepare('DELETE FROM site_members WHERE site_id = ? AND user_id = ?').run(row.id, target.id);
  logActivity(row.id, row.name, 'transferred', `to ${target.username}`, req.user.username, row.owner_id);
  notify({ type: 'site_transferred', title: `${row.name} is now yours`, detail: `Transferred by ${req.user.username}`, data: { siteId: row.id }, userIds: [target.id], admins: false, force: true });
  res.json({ ok: true, owner_id: target.id });
});

// GET /api/sites/:id/logs
router.get('/:id/logs', requireSiteRole('viewer'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row || !row.container_id) return res.status(404).json({ error: 'No container' });
  try {
    const logs = await containerLogs(row.container_id, Number(req.query.lines) || 100);
    res.type('text/plain').send(logs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}));

// POST /api/sites/:id/recreate — rebuild the live container from the current
// local runtime image (pulls first). ~2s downtime for that one site.
router.post('/:id/recreate', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const job = imageUpdater.getState();
  if (job.status === 'pulling' || job.status === 'recreating' || job.status === 'starting') {
    return res.status(409).json({ error: 'A container update is already running' });
  }
  if (req.body?.pull !== false) {
    try { await imageUpdater.pullImages(); } catch (err) {
      return res.status(502).json({ error: `Image pull failed: ${err.message}` });
    }
  }
  const containerId = await imageUpdater.recreateSite(row.id, req.user?.username || 'system');
  supportTrail(req, row, 'container_recreated', null);
  res.json({ ok: true, container_id: containerId, container: await containerStatus(containerId) });
}));

// ── Domain requests (site owner asks, panel admin decides) ──

router.post('/:id/domain-request', requireSiteRole('owner'), requireHumanSession, (req, res) => {
  const row = db.prepare('SELECT id, name, domain FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const wanted = String(req.body?.domain || '').trim().toLowerCase();
  if (!isValidHostname(wanted)) return res.status(400).json({ error: 'Invalid domain' });
  if (db.prepare('SELECT 1 FROM sites WHERE domain = ?').get(wanted)) return res.status(409).json({ error: 'Domain already in use' });
  const open = db.prepare("SELECT id FROM domain_requests WHERE site_id = ? AND status = 'pending'").get(row.id);
  if (open) return res.status(409).json({ error: 'A request is already pending for this site' });
  const rid = nanoid(10);
  db.prepare('INSERT INTO domain_requests (id, site_id, domain, requested_by) VALUES (?, ?, ?, ?)').run(rid, row.id, wanted, req.user.id);
  notify({ type: 'domain_request', title: `${req.user.username} requests ${wanted} for ${row.name}`, detail: 'Approve or reject under Domains', data: { siteId: row.id, requestId: rid, domain: wanted }, force: true });
  res.status(201).json({ id: rid, site_id: row.id, domain: wanted, status: 'pending' });
});

router.get('/:id/domain-request', requireSiteRole('viewer'), (req, res) => {
  const r = db.prepare('SELECT id, domain, status, note, created_at, decided_at FROM domain_requests WHERE site_id = ? ORDER BY created_at DESC LIMIT 1').get(req.params.id);
  res.json(r || null);
});

// ── Content-scanner review (site side) ─────────────────────

// GET /api/sites/:id/review — the pending review (with findings) or null
router.get('/:id/review', requireSiteRole('viewer'), (req, res) => {
  const pr = pendingReviewFor(req.params.id);
  if (!pr) return res.json(null);
  let findings = []; try { findings = JSON.parse(pr.findings || '[]'); } catch {}
  res.json({ id: pr.id, verdict: pr.verdict, findings, created_at: pr.created_at, created_by: pr.created_by, status: pr.status });
});

// DELETE /api/sites/:id/review — withdraw a pending upload (editor+)
router.delete('/:id/review', requireSiteRole('editor'), (req, res) => {
  const row = db.prepare('SELECT id, name, runtime, owner_id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const pr = pendingReviewFor(row.id);
  if (!pr) return res.status(404).json({ error: 'No pending review' });
  const isApp = row.runtime === 'node' || row.runtime === 'python';
  fs.rmSync(pendingDir(row.id, isApp), { recursive: true, force: true });
  try { fs.unlinkSync(require('path').join(siteDir(row.id), 'history', pr.filename)); } catch {}
  db.prepare("UPDATE deploy_reviews SET status = 'rejected', decided_by = ?, decided_at = unixepoch(), note = 'withdrawn' WHERE id = ?").run(req.user.id, pr.id);
  supportTrail(req, row, 'deploy_withdrawn', pr.filename);
  res.json({ ok: true });
});

// PUT /api/sites/:id/scan-allowlist { hosts: [] } — external script hosts this site may load (owner)
router.put('/:id/scan-allowlist', requireSiteRole('owner'), requireHumanSession, (req, res) => {
  const row = db.prepare('SELECT id FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  const list = Array.isArray(req.body?.hosts) ? req.body.hosts : String(req.body?.hosts || '').split(/[\s,]+/);
  const hosts = [...new Set(list.map(h => String(h).trim().toLowerCase()).filter(Boolean))];
  if (hosts.length > 50) return res.status(400).json({ error: 'At most 50 hosts' });
  if (hosts.some(h => !/^[a-z0-9.-]+$/.test(h))) return res.status(400).json({ error: 'Entries must be hostnames' });
  db.prepare('UPDATE sites SET scan_allowlist = ? WHERE id = ?').run(JSON.stringify(hosts), row.id);
  res.json({ ok: true, hosts });
});

// ── Blue-green preview ─────────────────────────────────────

router.post('/:id/preview', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (row.preview_container_id) return res.status(409).json({ error: 'Preview already exists' });

  const { preview_domain } = req.body;
  if (!preview_domain?.trim()) return res.status(400).json({ error: 'preview_domain required' });
  const pd = preview_domain.trim().toLowerCase();
  if (!isValidHostname(pd)) return res.status(400).json({ error: 'Invalid domain' });
  if (!isPanelAdmin(req.user)) {
    const base = getSetting('site_base_domain');
    if (!base || !pd.endsWith(`.${base}`)) return res.status(403).json({ error: `Preview domains must be under ${base || 'the base domain'}` });
  }

  const conflict = db.prepare('SELECT id FROM sites WHERE domain = ? AND id != ?').get(pd, row.id);
  if (conflict) return res.status(409).json({ error: 'Domain already in use' });

  db.prepare('UPDATE sites SET preview_domain = ? WHERE id = ?').run(pd, row.id);
  const site = parseSiteForContainer(db.prepare('SELECT * FROM sites WHERE id = ?').get(row.id));

  const containerId = await createPreviewContainer(site);
  db.prepare('UPDATE sites SET preview_container_id = ? WHERE id = ?').run(containerId, row.id);
  supportTrail(req, row, 'preview_created', pd);
  res.json({ ok: true, preview_container_id: containerId });
}));

router.post('/:id/preview/swap', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if (!row.preview_container_id) return res.status(404).json({ error: 'No preview to swap' });

  await swapPreview(parseSite(row));
  supportTrail(req, row, 'preview_swapped', `${row.preview_domain} → ${row.domain}`);
  fireWebhooks('deploy', row.id, row.name, `Live swap from ${row.preview_domain}`);
  res.json({ ok: true });
}));

router.delete('/:id/preview', requireSiteRole('editor'), asyncHandler(async (req, res) => {
  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.id);
  if (!row) return res.status(404).json({ error: 'Not found' });

  await removePreviewContainer(parseSite(row));
  db.prepare('UPDATE sites SET preview_container_id = NULL, preview_domain = NULL WHERE id = ?').run(row.id);
  supportTrail(req, row, 'preview_removed', null);
  res.json({ ok: true });
}));

module.exports = router;
