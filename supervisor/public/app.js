/* ── Grimport Supervisor — Frontend v0.5.1 ─────────────────── */


// ── State ─────────────────────────────────────────────────
let sites = [];
let activeSiteId = null;
let selectedDeployFile = null;
let config = { siteBaseDomain: '', sslReady: false, acmeEmail: '' };
let searchQuery = '';
let uptimeData = {}; // siteId → { currentStatus, uptime24h }

// ── API helpers ───────────────────────────────────────────
async function api(method, path, body) {
  const opts = { method, headers: {} };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  const res = await fetch('/api' + path, opts);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

async function apiUpload(siteId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/deploy/${siteId}`);
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 400) reject(new Error(data.error || `HTTP ${xhr.status}`));
      else resolve(data);
    };
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(form);
  });
}

// ── Toast ─────────────────────────────────────────────────
function toast(message, type = 'info') {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  document.getElementById('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

document.querySelectorAll('[data-close]').forEach(btn => {
  btn.addEventListener('click', () => closeModal(btn.dataset.close));
});
document.querySelectorAll('.modal-backdrop').forEach(backdrop => {
  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) closeModal(backdrop.id);
  });
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const open = document.querySelector('.modal-backdrop:not(.hidden)');
  if (open) closeModal(open.id);
});

// ── Search ────────────────────────────────────────────────
document.getElementById('site-search').addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase().trim();
  renderSites();
});

// ── Sites list ────────────────────────────────────────────
async function loadSites() {
  sites = await api('GET', '/sites');
  api('GET', '/uptime').then(d => { uptimeData = d; renderSites(); }).catch(() => {});
  renderSites();
  sites.forEach(s => refreshDnsDot(s.id));
}

async function refreshDnsDot(siteId) {
  try {
    const data = await api('GET', `/dns/${siteId}`);
    const dot = document.getElementById(`dns-dot-${siteId}`);
    if (!dot) return;
    const cls = data.status === 'ok' ? 'ok' : data.status === 'wrong' ? 'wrong' : 'pending';
    dot.className = `dns-indicator dns-indicator-${cls}`;
  } catch {}
}

function renderSites() {
  const grid = document.getElementById('sites-list');
  const count = document.getElementById('site-count');

  const filtered = searchQuery
    ? sites.filter(s =>
        s.name.toLowerCase().includes(searchQuery) ||
        s.domain.toLowerCase().includes(searchQuery))
    : sites;

  count.textContent = searchQuery
    ? `${filtered.length} of ${sites.length} site${sites.length !== 1 ? 's' : ''}`
    : `${sites.length} site${sites.length !== 1 ? 's' : ''}`;

  if (sites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⬡</div>
        <h3>No sites yet</h3>
        <p>Deploy your first site to get started.</p>
        <button class="btn btn-primary" style="margin-top:16px" onclick="document.getElementById('btn-new-site').click()">+ New site</button>
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⬡</div>
        <h3>No results for "${esc(searchQuery)}"</h3>
        <p>Try a different name or domain.</p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => siteCard(s)).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      const site = sites.find(s => s.id === id);
      if (action === 'deploy')    openDeploy(site);
      if (action === 'settings')  openSettings(site);
      if (action === 'logs')      openLogs(site);
      if (action === 'dns')       openDns(site);
      if (action === 'analytics') openAnalytics(site);
      if (action === 'start')     siteAction(id, 'start');
      if (action === 'stop')      siteAction(id, 'stop');
      if (action === 'history')   openHistory(site);
    });
  });
}

function statusInfo(container) {
  if (!container) return { cls: 'stopped', label: 'Unknown', error: false };
  const map = {
    running:    { cls: 'running',  label: 'Running',      error: false },
    exited:     { cls: 'stopped',  label: 'Stopped',      error: container.exitCode !== 0 },
    created:    { cls: 'starting', label: 'Starting',     error: false },
    restarting: { cls: 'starting', label: 'Restarting',   error: true },
    paused:     { cls: 'stopped',  label: 'Paused',       error: false },
    missing:    { cls: 'missing',  label: 'Missing',      error: true },
    none:       { cls: 'stopped',  label: 'No container', error: false },
  };
  return map[container.status] || { cls: 'stopped', label: container.status, error: false };
}

function siteCard(site) {
  const { cls, label, error } = statusInfo(site.container);
  const isRunning = site.container?.running;
  const tags = [
    site.spa_mode         ? `<span class="tag blue">SPA</span>` : '',
    site.maintenance_mode ? `<span class="tag yellow">Maintenance</span>` : '',
    site.cache_enabled    ? `<span class="tag green">Cache</span>` : '',
    site.basic_auth       ? `<span class="tag">Auth</span>` : '',
  ].filter(Boolean).join('');

  return `
    <div class="site-card">
      <div class="site-card-header">
        <span class="status-dot ${cls}" title="${label}"></span>
        <span class="site-name" title="${esc(site.name)}">${esc(site.name)}</span>
        <span class="tag">${label}</span>
      </div>
      <div class="site-domain-row">
        <a class="site-domain" href="http://${esc(site.domain)}" target="_blank" rel="noopener">⬡ ${esc(site.domain)}</a>
        <button class="dns-status-btn" data-action="dns" data-id="${site.id}" title="DNS setup &amp; status">
          <span class="dns-indicator dns-indicator-unknown" id="dns-dot-${site.id}"></span>
        </button>
      </div>
      ${tags ? `<div class="site-tags">${tags}</div>` : ''}
      ${error ? `<div class="site-error-hint">⚠ Container exited unexpectedly — check logs</div>` : ''}
      ${uptimeStrip(site.id)}
      <div class="site-actions">
        <button class="btn btn-sm btn-primary" data-action="deploy" data-id="${site.id}" style="flex:1">↑ Deploy</button>
        <div class="site-action-icons">
          <button class="icon-btn" data-action="${isRunning ? 'stop' : 'start'}" data-id="${site.id}" title="${isRunning ? 'Stop site' : 'Start site'}">
            ${isRunning ? '⏹' : '▷'}
          </button>
          <button class="icon-btn" data-action="history" data-id="${site.id}" title="Deploy history &amp; rollback">↺</button>
          <button class="icon-btn" data-action="analytics" data-id="${site.id}" title="Analytics">◈</button>
          <button class="icon-btn" data-action="logs" data-id="${site.id}" title="Logs">≡</button>
          <button class="icon-btn" data-action="settings" data-id="${site.id}" title="Settings">⚙</button>
        </div>
      </div>
    </div>`;
}

function uptimeStrip(siteId) {
  const u = uptimeData[siteId];
  if (!u || u.uptime24h === null) return '';
  const pct = parseFloat(u.uptime24h);
  const cls = pct >= 99 ? 'uptime-good' : pct >= 95 ? 'uptime-warn' : 'uptime-bad';
  return `<div class="uptime-row">
    <span class="uptime-pct ${cls}">${pct}%</span>
    <span class="uptime-label">uptime 24h</span>
    <span class="uptime-dot ${u.currentStatus === 'up' ? 'uptime-dot-up' : u.currentStatus === 'down' ? 'uptime-dot-down' : 'uptime-dot-unknown'}"></span>
  </div>`;
}

function esc(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── New site ──────────────────────────────────────────────
function randomSlug(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

document.getElementById('btn-new-site').addEventListener('click', async () => {
  document.getElementById('form-new-site').reset();
  if (config.siteBaseDomain) {
    document.querySelector('#form-new-site input[name="domain"]').value =
      `${randomSlug()}.${config.siteBaseDomain}`;
  }
  // Apply panel defaults
  try {
    const s = await api('GET', '/settings');
    document.querySelector('#form-new-site input[name="spa_mode"]').checked = !!s.default_spa_mode;
    document.querySelector('#form-new-site input[name="cache_enabled"]').checked = s.default_cache_enabled !== false;
  } catch {}
  openModal('modal-new-site');
});

document.getElementById('form-new-site').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const domain = fd.get('domain').trim().toLowerCase();
  const domainValid = /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?(\.[a-z]{2,})$/.test(domain);
  if (!domainValid) {
    toast('Invalid domain — use a format like mysite.example.com or test.localhost', 'error');
    return;
  }
  const payload = {
    name: fd.get('name'),
    domain,
    spa_mode: fd.get('spa_mode') === 'on',
    cache_enabled: fd.get('cache_enabled') === 'on',
  };
  try {
    await api('POST', '/sites', payload);
    closeModal('modal-new-site');
    toast(`Site "${payload.name}" created`, 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ── Deploy modal ──────────────────────────────────────────
function openDeploy(site) {
  activeSiteId = site.id;
  selectedDeployFile = null;
  document.getElementById('deploy-site-name').textContent = site.name;
  document.getElementById('deploy-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('deploy-status-text').textContent = 'Uploading…';
  document.getElementById('btn-deploy-confirm').disabled = true;
  document.getElementById('dropzone').classList.remove('dragging');
  document.querySelector('#dropzone .dropzone-inner').innerHTML = `
    <span class="dropzone-icon">↑</span>
    <p>Drop your <strong>.zip</strong> here, or click to browse</p>
    <small>Supports Webflow exports, React/Vue build output, any static site</small>
    <input type="file" id="deploy-file-input" accept=".zip" hidden />
  `;
  document.getElementById('deploy-file-input').addEventListener('change', () => {
    const f = document.getElementById('deploy-file-input').files[0];
    if (f) selectDeployFile(f);
  });
  openModal('modal-deploy');
}

const dropzone = document.getElementById('dropzone');

dropzone.addEventListener('click', () => document.getElementById('deploy-file-input').click());
document.getElementById('deploy-file-input').addEventListener('change', e => {
  if (e.target.files[0]) selectDeployFile(e.target.files[0]);
});
dropzone.addEventListener('dragover', e => { e.preventDefault(); dropzone.classList.add('dragging'); });
dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragging'));
dropzone.addEventListener('drop', e => {
  e.preventDefault();
  dropzone.classList.remove('dragging');
  const file = e.dataTransfer.files[0];
  if (file) selectDeployFile(file);
});

function selectDeployFile(file) {
  if (!file.name.endsWith('.zip')) { toast('Only .zip files are accepted', 'error'); return; }
  selectedDeployFile = file;
  dropzone.querySelector('.dropzone-inner').innerHTML = `
    <span class="dropzone-icon">✓</span>
    <p><strong>${esc(file.name)}</strong></p>
    <small>${(file.size / 1024 / 1024).toFixed(1)} MB — click to change</small>
  `;
  document.getElementById('btn-deploy-confirm').disabled = false;
}

document.getElementById('btn-deploy-confirm').addEventListener('click', async () => {
  if (!selectedDeployFile || !activeSiteId) return;
  const progress = document.getElementById('deploy-progress');
  const fill = document.getElementById('progress-fill');
  const status = document.getElementById('deploy-status-text');
  progress.classList.remove('hidden');
  document.getElementById('btn-deploy-confirm').disabled = true;
  try {
    status.textContent = 'Uploading…';
    await apiUpload(activeSiteId, selectedDeployFile, pct => {
      fill.style.width = `${Math.round(pct * 90)}%`;
      status.textContent = pct < 1 ? `Uploading… ${Math.round(pct * 100)}%` : 'Extracting…';
    });
    fill.style.width = '100%';
    status.textContent = 'Done!';
    await new Promise(r => setTimeout(r, 600));
    closeModal('modal-deploy');
    toast('Site deployed successfully', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
    status.textContent = err.message;
    document.getElementById('btn-deploy-confirm').disabled = false;
  }
});

// ── Settings modal ────────────────────────────────────────
// Tab switching
document.querySelectorAll('.modal-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.modal-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`stab-${tab.dataset.stab}`).classList.remove('hidden');
  });
});

function openSettings(site) {
  activeSiteId = site.id;
  document.getElementById('settings-site-name').textContent = site.name;

  // Reset to General tab
  document.querySelectorAll('.modal-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
  document.querySelectorAll('.modal-tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));

  const form = document.getElementById('form-settings');
  form.elements['id'].value = site.id;
  form.elements['name'].value = site.name;
  form.elements['domain'].value = site.domain;
  form.elements['spa_mode'].checked = !!site.spa_mode;
  form.elements['cache_enabled'].checked = !!site.cache_enabled;
  form.elements['maintenance_mode'].checked = !!site.maintenance_mode;
  form.elements['ssl_enabled'].checked = !!site.ssl_enabled;
  const sslHint = document.getElementById('ssl-toggle-hint');
  if (config.sslReady) {
    sslHint.textContent = '(Let\'s Encrypt via Traefik)';
    form.elements['ssl_enabled'].disabled = false;
  } else {
    sslHint.textContent = '(set ACME_EMAIL in .env first)';
    form.elements['ssl_enabled'].disabled = true;
    form.elements['ssl_enabled'].checked = false;
  }
  form.elements['auth_remove'].checked = false;

  // Basic auth
  const auth = site.basic_auth;
  form.elements['auth_username'].value = auth ? auth.username : '';
  form.elements['auth_password'].value = '';
  form.elements['auth_password'].placeholder = auth ? 'leave blank to keep current' : 'password';

  renderHeadersList(site.custom_headers || []);
  renderRedirectsList(site.redirects || []);
  openModal('modal-settings');
}

// Headers
function renderHeadersList(headers) {
  const list = document.getElementById('headers-list');
  list.innerHTML = headers.map((h, i) => `
    <div class="header-row">
      <input type="text" placeholder="Header-Name" value="${esc(h.name)}" data-header-name data-idx="${i}" />
      <input type="text" placeholder="value" value="${esc(h.value)}" data-header-value data-idx="${i}" />
      <button class="btn btn-sm btn-danger" data-remove-header="${i}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-remove-header]').forEach(btn => {
    btn.addEventListener('click', () => {
      headers.splice(Number(btn.dataset.removeHeader), 1);
      renderHeadersList(headers);
    });
  });
}

document.getElementById('btn-add-header').addEventListener('click', () => {
  const rows = document.getElementById('headers-list').querySelectorAll('.header-row');
  const headers = Array.from(rows).map(row => ({
    name: row.querySelector('[data-header-name]').value,
    value: row.querySelector('[data-header-value]').value,
  }));
  headers.push({ name: '', value: '' });
  renderHeadersList(headers);
});

// Redirects
function renderRedirectsList(redirects) {
  const list = document.getElementById('redirects-list');
  list.innerHTML = redirects.map((r, i) => `
    <div class="redirect-row">
      <input type="text" placeholder="/old-path" value="${esc(r.from)}" data-redirect-from data-idx="${i}" />
      <input type="text" placeholder="/new-path" value="${esc(r.to)}" data-redirect-to data-idx="${i}" />
      <label class="redirect-permanent">
        <input type="checkbox" data-redirect-permanent data-idx="${i}" ${r.permanent ? 'checked' : ''} />
        301
      </label>
      <button class="btn btn-sm btn-danger" data-remove-redirect="${i}">✕</button>
    </div>
  `).join('');
  list.querySelectorAll('[data-remove-redirect]').forEach(btn => {
    btn.addEventListener('click', () => {
      redirects.splice(Number(btn.dataset.removeRedirect), 1);
      renderRedirectsList(redirects);
    });
  });
}

document.getElementById('btn-add-redirect').addEventListener('click', () => {
  const rows = document.getElementById('redirects-list').querySelectorAll('.redirect-row');
  const redirects = collectRedirects(rows);
  redirects.push({ from: '', to: '', permanent: false });
  renderRedirectsList(redirects);
});

function collectRedirects(rows) {
  return Array.from(rows).map(row => ({
    from: row.querySelector('[data-redirect-from]').value.trim(),
    to: row.querySelector('[data-redirect-to]').value.trim(),
    permanent: row.querySelector('[data-redirect-permanent]').checked,
  }));
}

document.getElementById('form-settings').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;

  const headerRows = document.getElementById('headers-list').querySelectorAll('.header-row');
  const custom_headers = Array.from(headerRows).map(row => ({
    name: row.querySelector('[data-header-name]').value.trim(),
    value: row.querySelector('[data-header-value]').value.trim(),
  })).filter(h => h.name);

  const redirectRows = document.getElementById('redirects-list').querySelectorAll('.redirect-row');
  const redirects = collectRedirects(redirectRows).filter(r => r.from && r.to);

  // Build basic_auth payload
  let basic_auth;
  if (form.elements['auth_remove'].checked) {
    basic_auth = null;
  } else {
    const username = form.elements['auth_username'].value.trim();
    const password = form.elements['auth_password'].value;
    if (username) {
      basic_auth = { username, password }; // blank password = server keeps existing
    } else {
      basic_auth = undefined; // don't change
    }
  }

  const payload = {
    name: form.elements['name'].value,
    domain: form.elements['domain'].value,
    spa_mode: form.elements['spa_mode'].checked,
    cache_enabled: form.elements['cache_enabled'].checked,
    maintenance_mode: form.elements['maintenance_mode'].checked,
    ssl_enabled: config.sslReady ? form.elements['ssl_enabled'].checked : undefined,
    custom_headers,
    redirects,
    ...(basic_auth !== undefined ? { basic_auth } : {}),
  };

  try {
    await api('PUT', `/sites/${activeSiteId}`, payload);
    closeModal('modal-settings');
    toast('Settings saved', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('btn-delete-site').addEventListener('click', async () => {
  const site = sites.find(s => s.id === activeSiteId);
  if (!site) return;
  if (!confirm(`Delete "${site.name}"? This removes the container and all files. This cannot be undone.`)) return;
  try {
    await api('DELETE', `/sites/${activeSiteId}`);
    closeModal('modal-settings');
    toast(`Site "${site.name}" deleted`, 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ── Logs modal ────────────────────────────────────────────
async function openLogs(site) {
  activeSiteId = site.id;
  document.getElementById('logs-site-name').textContent = site.name;
  document.getElementById('logs-content').textContent = 'Loading…';
  openModal('modal-logs');
  await fetchLogs();
}

async function fetchLogs() {
  if (!activeSiteId) return;
  try {
    const res = await fetch(`/api/sites/${activeSiteId}/logs?lines=200`);
    const text = await res.text();
    const el = document.getElementById('logs-content');
    el.textContent = text || '(no logs yet)';
    el.scrollTop = el.scrollHeight;
  } catch (err) {
    document.getElementById('logs-content').textContent = `Error: ${err.message}`;
  }
}

document.getElementById('btn-refresh-logs').addEventListener('click', fetchLogs);

// ── Site start / stop ─────────────────────────────────────
async function siteAction(id, action) {
  const site = sites.find(s => s.id === id);
  if (action === 'stop' && site?.container?.running) {
    if (!confirm(`Stop "${site.name}"? It will be unreachable until started again.`)) return;
  }

  // Optimistic update
  const card = document.querySelector(`[data-action="${action === 'stop' ? 'stop' : 'start'}"][data-id="${id}"]`)?.closest('.site-card');
  const dot = card?.querySelector('.status-dot');
  const tag = card?.querySelector('.tag:not(.blue):not(.yellow):not(.green)');
  if (dot) { dot.className = 'status-dot starting'; }
  if (tag) tag.textContent = action === 'start' ? 'Starting…' : 'Stopping…';

  try {
    await api('POST', `/sites/${id}/${action}`);
    toast(`Site ${action === 'start' ? 'started' : 'stopped'}`, 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
    await loadSites(); // revert
  }
}

// ── Analytics modal ───────────────────────────────────────
let activeAnalyticsSiteId = null;
let activeAnalyticsPeriod = '7d';

function fmtBytes(b) {
  if (b < 1024) return b + ' B';
  if (b < 1024 * 1024) return (b / 1024).toFixed(1) + ' KB';
  return (b / 1024 / 1024).toFixed(2) + ' MB';
}
function fmtNum(n) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K';
  return String(n);
}

async function openAnalytics(site) {
  activeAnalyticsSiteId = site.id;
  document.getElementById('analytics-site-name').textContent = site.name;
  document.querySelectorAll('.analytics-period-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.period === activeAnalyticsPeriod));
  openModal('modal-analytics');
  await loadAnalytics();
}

async function loadAnalytics() {
  if (!activeAnalyticsSiteId) return;
  document.getElementById('analytics-loading').classList.remove('hidden');
  document.getElementById('analytics-body').classList.add('hidden');
  try {
    const data = await api('GET', `/analytics/${activeAnalyticsSiteId}?period=${activeAnalyticsPeriod}`);
    renderAnalytics(data);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    document.getElementById('analytics-loading').classList.add('hidden');
    document.getElementById('analytics-body').classList.remove('hidden');
  }
}

function renderAnalytics(data) {
  const { totals, last1h, hourly, period } = data;
  const errorRate = totals.requests > 0
    ? (((totals.client_err + totals.server_err) / totals.requests) * 100).toFixed(1)
    : '0.0';

  document.getElementById('stat-requests').textContent = fmtNum(totals.requests);
  document.getElementById('stat-requests-1h').textContent = fmtNum(last1h.requests) + ' last 1h';
  document.getElementById('stat-bytes').textContent = fmtBytes(totals.bytes);
  document.getElementById('stat-errors').textContent = errorRate + '%';
  document.getElementById('stat-errors-detail').textContent =
    `${totals.client_err} client · ${totals.server_err} server`;

  const total = totals.ok + totals.redirects + totals.client_err + totals.server_err || 1;
  document.getElementById('bar-ok').style.width        = (totals.ok        / total * 100) + '%';
  document.getElementById('bar-redirect').style.width  = (totals.redirects / total * 100) + '%';
  document.getElementById('bar-client').style.width    = (totals.client_err / total * 100) + '%';
  document.getElementById('bar-server').style.width    = (totals.server_err / total * 100) + '%';
  document.getElementById('bar-ok-label').textContent        = totals.ok;
  document.getElementById('bar-redirect-label').textContent  = totals.redirects;
  document.getElementById('bar-client-label').textContent    = totals.client_err;
  document.getElementById('bar-server-label').textContent    = totals.server_err;

  renderSparkline(hourly, period);
}

function renderSparkline(hourly, period) {
  const chart = document.getElementById('analytics-chart');
  if (!hourly.length) {
    chart.innerHTML = '<div class="analytics-empty">No data yet — traffic will appear within 1 minute of the first request.</div>';
    return;
  }
  const now = Math.floor(Date.now() / 1000);
  const hours = period === '30d' ? 720 : period === '7d' ? 168 : 24;
  const bucketCount = Math.min(hours, 48);
  const bucketSize = Math.ceil(hours / bucketCount);
  const dataMap = new Map(hourly.map(h => [h.hour, h]));
  const slots = [];
  for (let i = bucketCount - 1; i >= 0; i--) {
    const slotEnd = now - i * bucketSize * 3600;
    let requests = 0, hasError = false;
    for (let t = slotEnd - bucketSize * 3600; t < slotEnd; t += 3600) {
      const h = dataMap.get(t - (t % 3600));
      if (h) { requests += h.requests; if (h.client_err + h.server_err > 0) hasError = true; }
    }
    slots.push({ requests, hasError, label: new Date(slotEnd * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }
  const maxVal = Math.max(...slots.map(s => s.requests), 1);
  chart.innerHTML = `
    <div class="sparkline">
      ${slots.map(s => `
        <div class="spark-bar-wrap" title="${s.requests} requests at ${s.label}">
          <div class="spark-bar ${s.hasError ? 'spark-bar-error' : ''}" style="height:${Math.max(s.requests / maxVal * 100, s.requests > 0 ? 4 : 0)}%"></div>
        </div>`).join('')}
    </div>
    <div class="sparkline-labels">
      <span>${slots[0]?.label || ''}</span>
      <span>${slots[Math.floor(slots.length / 2)]?.label || ''}</span>
      <span>${slots[slots.length - 1]?.label || 'now'}</span>
    </div>`;
}

document.querySelectorAll('.analytics-period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeAnalyticsPeriod = btn.dataset.period;
    document.querySelectorAll('.analytics-period-btn').forEach(b => b.classList.toggle('active', b === btn));
    loadAnalytics();
  });
});

document.getElementById('btn-analytics-refresh')?.addEventListener('click', async () => {
  if (!activeAnalyticsSiteId) return;
  try {
    await api('POST', `/analytics/${activeAnalyticsSiteId}/refresh`);
    await loadAnalytics();
  } catch (err) {
    toast('Refresh failed: ' + err.message, 'error');
  }
});

// ── DNS modal ─────────────────────────────────────────────
let activeDnsSiteId = null;

async function openDns(site) {
  activeDnsSiteId = site.id;
  document.getElementById('dns-site-name').textContent = site.name;
  document.querySelectorAll('.dns-domain-placeholder').forEach(el => { el.textContent = site.domain; });
  const baseDomain = config.siteBaseDomain || site.domain;
  document.querySelectorAll('[id^="dns-tunnel-wildcard"]').forEach(el => { el.textContent = baseDomain; });
  switchDnsTab('standard');
  setBanner('checking', 'Checking DNS…');
  openModal('modal-dns');
  await checkDns(site.id);
}

async function checkDns(siteId) {
  setBanner('checking', 'Checking DNS…');
  try {
    const data = await api('GET', `/dns/${siteId}`);
    updateDnsIpFields(data.serverIp || '—');
    const bannerMap = {
      ok:      { cls: 'ok',      text: `✓ DNS is correctly pointing to ${data.serverIp}` },
      pending: { cls: 'pending', text: 'DNS not resolving yet — records may not have propagated' },
      wrong:   { cls: 'wrong',   text: `Resolves to ${data.resolved.join(', ')} — expected ${data.serverIp}` },
      unknown: { cls: 'pending', text: 'Server IP unknown — set PUBLIC_IP in .env to enable checks' },
      error:   { cls: 'wrong',   text: `DNS lookup error: ${data.error}` },
    };
    const { cls, text } = bannerMap[data.status] || bannerMap.error;
    setBanner(cls, text);
    const dot = document.getElementById(`dns-dot-${siteId}`);
    if (dot) dot.className = `dns-indicator dns-indicator-${cls === 'ok' ? 'ok' : cls === 'wrong' ? 'wrong' : 'pending'}`;
    return data;
  } catch (err) {
    setBanner('wrong', `Check failed: ${err.message}`);
  }
}

function setBanner(state, text) {
  document.getElementById('dns-status-banner').className = `dns-banner dns-banner-${state}`;
  document.getElementById('dns-status-text').textContent = text;
}

function updateDnsIpFields(ip) {
  ['dns-std-value', 'dns-cf-value'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = ip;
  });
  const site = activeDnsSiteId ? sites.find(s => s.id === activeDnsSiteId) : null;
  if (site) {
    ['dns-std-name', 'dns-cf-name'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.textContent = site.domain;
    });
  }
}

function switchDnsTab(name) {
  document.querySelectorAll('.dns-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === name));
  document.querySelectorAll('.dns-tab-content').forEach(c => c.classList.add('hidden'));
  document.getElementById(`dns-tab-${name}`)?.classList.remove('hidden');
}
document.querySelectorAll('.dns-tab').forEach(tab => {
  tab.addEventListener('click', () => switchDnsTab(tab.dataset.tab));
});
document.getElementById('btn-recheck-dns').addEventListener('click', () => {
  if (activeDnsSiteId) checkDns(activeDnsSiteId);
});

// ── Deploy history ────────────────────────────────────────
async function openHistory(site) {
  activeSiteId = site.id;
  document.getElementById('history-site-name').textContent = site.name;
  document.getElementById('history-list').innerHTML = '<p style="color:var(--text-muted);padding:16px">Loading…</p>';
  openModal('modal-history');
  await refreshHistory(site.id, site.name);
}

async function refreshHistory(siteId, siteName) {
  try {
    const history = await api('GET', `/deploy/${siteId}/history`);
    const list = document.getElementById('history-list');
    if (!history.length) {
      list.innerHTML = '<p style="color:var(--text-muted);padding:16px 0">No deployments yet.</p>';
      return;
    }
    list.innerHTML = `
      <table class="token-table">
        <thead><tr><th>#</th><th>Deployed</th><th>Size</th><th></th></tr></thead>
        <tbody>
          ${history.map((d, i) => `
            <tr>
              <td class="token-meta">${history.length - i}</td>
              <td>${new Date(d.deployed_at * 1000).toLocaleString()}</td>
              <td class="token-meta">${(d.size / 1024).toFixed(0)} KB</td>
              <td>${i > 0 ? `<button class="btn btn-sm" data-rollback="${d.id}">Rollback</button>` : '<span class="token-meta">Current</span>'}</td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    list.querySelectorAll('[data-rollback]').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm('Roll back to this deployment? Current files will be replaced.')) return;
        btn.disabled = true;
        btn.textContent = 'Rolling back…';
        try {
          await api('POST', `/deploy/${siteId}/rollback/${btn.dataset.rollback}`);
          toast('Rolled back successfully', 'success');
          closeModal('modal-history');
          await loadSites();
        } catch (err) {
          toast(err.message, 'error');
          btn.disabled = false;
          btn.textContent = 'Rollback';
        }
      });
    });
  } catch (err) {
    document.getElementById('history-list').innerHTML = `<p style="color:var(--red);padding:16px 0">${esc(err.message)}</p>`;
  }
}

// ── Activity feed ─────────────────────────────────────────
const EVENT_ICONS = {
  deployed:         '↑',
  rolled_back:      '⟳',
  created:          '+',
  deleted:          '✕',
  started:          '▷',
  stopped:          '⏹',
  settings_changed: '⚙',
  up:               '✓',
  down:             '✕',
};
const EVENT_LABELS = {
  deployed:         'Deployed',
  rolled_back:      'Rolled back',
  created:          'Created',
  deleted:          'Deleted',
  started:          'Started',
  stopped:          'Stopped',
  settings_changed: 'Settings changed',
  up:               'Back online',
  down:             'Went down',
};

let activitySiteFilter = null;

async function loadActivity() {
  // Render site filter chips
  const filtersEl = document.getElementById('activity-filters');
  if (filtersEl && sites.length) {
    filtersEl.innerHTML = `
      <button class="activity-filter-chip ${activitySiteFilter === null ? 'active' : ''}" data-filter="">All</button>
      ${sites.map(s => `<button class="activity-filter-chip ${activitySiteFilter === s.id ? 'active' : ''}" data-filter="${s.id}">${esc(s.name)}</button>`).join('')}
    `;
    filtersEl.querySelectorAll('.activity-filter-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        activitySiteFilter = btn.dataset.filter || null;
        loadActivity();
      });
    });
  }

  const url = activitySiteFilter
    ? `/activity?limit=100&site_id=${activitySiteFilter}`
    : '/activity?limit=100';
  try {
    const events = await api('GET', url);
    const feed = document.getElementById('activity-feed');
    if (!events.length) {
      feed.innerHTML = '<div class="activity-empty">No activity yet — events will appear here as you use Grimport.</div>';
      return;
    }
    feed.innerHTML = events.map(e => {
      const isDown = e.event === 'down';
      const isUp   = e.event === 'up';
      return `
        <div class="activity-item ${isDown ? 'activity-item-down' : isUp ? 'activity-item-up' : ''}">
          <span class="activity-icon">${EVENT_ICONS[e.event] || '·'}</span>
          <div class="activity-body">
            <span class="activity-site">${esc(e.site_name || 'Panel')}</span>
            <span class="activity-event">${EVENT_LABELS[e.event] || e.event}</span>
            ${e.detail ? `<span class="activity-detail">${esc(e.detail)}</span>` : ''}
          </div>
          <span class="activity-time">${timeAgo(e.created_at)}</span>
        </div>`;
    }).join('');
  } catch (err) { toast(err.message, 'error'); }
}

function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

// ── View switching ────────────────────────────────────────
document.querySelectorAll('.nav-item[data-view]').forEach(item => {
  item.addEventListener('click', e => {
    e.preventDefault();
    const view = item.dataset.view;
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    item.classList.add('active');
    document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
    document.getElementById(`view-${view}`).classList.remove('hidden');
    if (view === 'panel-settings') loadPanelSettings();
    if (view === 'activity') loadActivity();
  });
});

// ── Settings page tabs ────────────────────────────────────
document.querySelectorAll('.settings-ptab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.settings-ptab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.querySelectorAll('.settings-ppanel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`spanel-${tab.dataset.stab}`).classList.remove('hidden');
    if (tab.dataset.stab === 'server') loadServerInfo();
    if (tab.dataset.stab === 'tokens') loadTokens();
  });
});

// ── Panel settings ────────────────────────────────────────
async function loadPanelSettings() {
  try {
    const s = await api('GET', '/settings');
    const form = document.getElementById('form-panel-settings');
    form.elements['site_base_domain'].value = s.site_base_domain || '';
    form.elements['default_spa_mode'].checked = !!s.default_spa_mode;
    form.elements['default_cache_enabled'].checked = s.default_cache_enabled !== false;
    document.querySelector('#form-acme [name="acme_email"]').value = s.acme_email || '';
  } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('form-acme').addEventListener('submit', async e => {
  e.preventDefault();
  const email = e.target.elements['acme_email'].value.trim();
  try {
    await api('PUT', '/settings', { acme_email: email });
    config = await api('GET', '/config').catch(() => config);
    document.getElementById('ssl-restart-notice').classList.remove('hidden');
    toast('Saved — restart the stack to apply', 'success');
    loadServerInfo();
  } catch (err) { toast(err.message, 'error'); }
});

// ── Server info ───────────────────────────────────────────
async function loadServerInfo() {
  try {
    const [ipData, cfg] = await Promise.all([
      api('GET', '/dns/server-ip'),
      api('GET', '/config').catch(() => config),
    ]);
    const ip = ipData.ip || '—';
    const domain = cfg.supervisorDomain || config.supervisorDomain || '—';
    const baseDomain = cfg.siteBaseDomain || config.siteBaseDomain || '';

    document.getElementById('srv-ip').textContent = ip;
    document.getElementById('srv-domain').textContent = domain;
    document.getElementById('srv-version').textContent = cfg.version || '—';

    document.getElementById('srv-dns-panel-name').textContent = domain;
    document.getElementById('srv-dns-panel-ip').textContent = ip;

    const wildcardBlock = document.getElementById('srv-dns-wildcard-block');
    if (baseDomain) {
      document.getElementById('srv-dns-wildcard-name').textContent = `*.${baseDomain}`;
      document.getElementById('srv-dns-wildcard-ip').textContent = ip;
      wildcardBlock.classList.remove('hidden');
    } else {
      wildcardBlock.classList.add('hidden');
    }

    // SSL status banner
    const banner = document.getElementById('ssl-status-banner');
    const isHttps = window.location.protocol === 'https:';
    if (cfg.sslReady && isHttps) {
      banner.className = 'ssl-status-banner ssl-status-ok';
      document.getElementById('ssl-status-icon').textContent = '✓';
      document.getElementById('ssl-status-title').textContent = 'SSL active';
      document.getElementById('ssl-status-detail').textContent = `Certificates managed by Let's Encrypt. Registered email: ${cfg.acmeEmail}`;
    } else if (cfg.sslReady && !isHttps) {
      banner.className = 'ssl-status-banner ssl-status-partial';
      document.getElementById('ssl-status-icon').textContent = '◑';
      document.getElementById('ssl-status-title').textContent = 'ACME_EMAIL configured — panel HTTPS not yet enabled';
      document.getElementById('ssl-status-detail').textContent = 'Per-site SSL is available. To enable HTTPS on the panel itself, uncomment the HTTPS labels in docker-compose.yml and restart.';
    } else {
      banner.className = 'ssl-status-banner ssl-status-unconfigured';
      document.getElementById('ssl-status-icon').textContent = '✕';
      document.getElementById('ssl-status-title').textContent = 'SSL not configured';
      document.getElementById('ssl-status-detail').textContent = 'Set ACME_EMAIL in Settings → Server & DNS and restart the stack to enable Let\'s Encrypt certificates.';
    }
  } catch (err) {
    toast('Failed to load server info: ' + err.message, 'error');
  }
}

// ── API Tokens ────────────────────────────────────────────
async function loadTokens() {
  try {
    const tokens = await api('GET', '/settings/tokens');
    renderTokens(tokens);
  } catch (err) { toast(err.message, 'error'); }
}

function renderTokens(tokens) {
  const list = document.getElementById('tokens-list');
  if (!tokens.length) {
    list.innerHTML = '<p class="settings-desc" style="color:var(--text-subtle)">No tokens yet.</p>';
    return;
  }
  list.innerHTML = `
    <table class="token-table">
      <thead><tr><th>Name</th><th>Created</th><th>Last used</th><th></th></tr></thead>
      <tbody>
        ${tokens.map(t => `
          <tr>
            <td>${esc(t.name)}</td>
            <td class="token-meta">${new Date(t.created_at * 1000).toLocaleDateString()}</td>
            <td class="token-meta">${t.last_used ? new Date(t.last_used * 1000).toLocaleDateString() : 'never'}</td>
            <td><button class="btn btn-sm btn-danger" data-revoke="${t.id}">Revoke</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  list.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('Revoke this token? Any scripts using it will stop working.')) return;
      await api('DELETE', `/settings/tokens/${btn.dataset.revoke}`);
      toast('Token revoked', 'success');
      loadTokens();
    });
  });
}

document.getElementById('form-create-token').addEventListener('submit', async e => {
  e.preventDefault();
  const name = e.target.elements['token_name'].value.trim();
  if (!name) return;
  try {
    const result = await api('POST', '/settings/tokens', { name });
    e.target.reset();
    const reveal = document.getElementById('token-reveal');
    reveal.classList.add('hidden');
    document.getElementById('token-reveal-value').textContent = result.token;
    document.getElementById('btn-copy-token').textContent = 'Copy';
    requestAnimationFrame(() => {
      reveal.classList.remove('hidden');
      reveal.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    loadTokens();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btn-copy-token').addEventListener('click', () => {
  const val = document.getElementById('token-reveal-value').textContent;
  navigator.clipboard.writeText(val).then(() => {
    const btn = document.getElementById('btn-copy-token');
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
  });
});

document.getElementById('form-panel-settings').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('PUT', '/settings', {
      site_base_domain: form.elements['site_base_domain'].value.trim().toLowerCase(),
      default_spa_mode: form.elements['default_spa_mode'].checked,
      default_cache_enabled: form.elements['default_cache_enabled'].checked,
    });
    config = await api('GET', '/config').catch(() => config);
    toast('Settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('form-change-password').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('PUT', '/settings/password', {
      old_password: form.elements['old_password'].value,
      new_password: form.elements['new_password'].value,
    });
    form.reset();
    toast('Password changed', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Sign out ──────────────────────────────────────────────
document.getElementById('btn-signout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
});

// ── Init ──────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({ authenticated: false }));
  if (!me.authenticated) { window.location.href = '/login.html'; return; }
  config = await api('GET', '/config').catch(() => config);
  await loadSites();
  setInterval(loadSites, 15_000);
}
init();
