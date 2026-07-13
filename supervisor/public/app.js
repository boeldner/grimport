/* ── Grimport Supervisor — Frontend v0.8.0 ─────────────────── */

// ── Theme ─────────────────────────────────────────────────
(function () {
  const saved = localStorage.getItem('grimport-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
})();

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  if (theme === 'light') {
    document.getElementById('theme-icon-dark').classList.add('hidden');
    document.getElementById('theme-icon-light').classList.remove('hidden');
  } else {
    document.getElementById('theme-icon-dark').classList.remove('hidden');
    document.getElementById('theme-icon-light').classList.add('hidden');
  }
  localStorage.setItem('grimport-theme', theme);
}

document.addEventListener('DOMContentLoaded', () => {
  const saved = localStorage.getItem('grimport-theme') || 'dark';
  applyTheme(saved);
  document.getElementById('btn-theme').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'light' ? 'dark' : 'light');
  });
});

// ── SVG Icon system ───────────────────────────────────────
const IC = (path, size = 14) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
const ICON = {
  arrowUp:      IC('<path d="M12 19V5"/><path d="m5 12 7-7 7 7"/>'),
  arrowDown:    IC('<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>'),
  upload:       IC('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>'),
  download:     IC('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>'),
  plus:         IC('<path d="M12 5v14M5 12h14"/>'),
  x:            IC('<path d="M18 6 6 18M6 6l12 12"/>'),
  check:        IC('<polyline points="20 6 9 17 4 12"/>'),
  play:         IC('<polygon points="5 3 19 12 5 21 5 3"/>'),
  stop:         IC('<rect x="4" y="4" width="16" height="16" rx="2"/>'),
  settings:     IC('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>'),
  rotateCcw:    IC('<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>'),
  rotateCw:     IC('<path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M21 3v5h-5"/>'),
  warning:      IC('<path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  logs:         IC('<line x1="21" y1="6" x2="3" y2="6"/><line x1="15" y1="12" x2="3" y2="12"/><line x1="21" y1="18" x2="3" y2="18"/>'),
  layers:       IC('<polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>'),
  barChart:     IC('<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>'),
  history:      IC('<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/>'),
  trash:        IC('<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>'),
  externalLink: IC('<path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>'),
  globe:        IC('<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>'),
  cloud:        IC('<path d="M18 10h-1.26A8 8 0 1 0 9 20h9a5 5 0 0 0 0-10z"/>'),
  circle:       IC('<circle cx="12" cy="12" r="10"/>'),
  dot:          IC('<circle cx="12" cy="12" r="4" fill="currentColor" stroke="none"/>', 10),
  refreshCw:    IC('<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>'),
  shield:       IC('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>'),
  link:         IC('<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>'),
  eye:          IC('<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'),
  user:         IC('<path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>'),
  zap:          IC('<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>'),
};

// ── State ─────────────────────────────────────────────────
let sites = [];
let activeSiteId = null;
let selectedDeployFile = null;
let config = { siteBaseDomain: '', sslReady: false, acmeEmail: '' };
let searchQuery = '';
let uptimeData = {}; // siteId → { currentStatus, uptime24h }
let connectDomain = ''; // domain being connected from notification
let currentUser = { role: 'admin', username: '' }; // populated on init
let cachedUpdateData = null; // latest update check result

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
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total, e.loaded, e.total);
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
// toast(type, message) is the canonical signature per the design system,
// but every existing call site in this file predates it and calls
// toast(message, type). Both orders are accepted so nothing needs
// rewiring here; later phases will migrate call sites to (type, message).
const TOAST_TYPES = ['info', 'success', 'error', 'warn'];

function getToastStack() {
  let stack = document.getElementById('toast-container');
  if (!stack) {
    stack = document.createElement('div');
    stack.id = 'toast-container';
    document.body.appendChild(stack);
  }
  stack.classList.add('toast-stack');
  return stack;
}

function dismissToast(el) {
  if (!el || !el.isConnected) return;
  el.classList.add('toast-leaving');
  const remove = () => el.remove();
  // don't rely on animationend when reduced-motion strips the animation
  setTimeout(remove, 200);
}

function toast(a, b) {
  let type = 'info';
  let message = '';
  if (TOAST_TYPES.includes(a)) { type = a; message = b ?? ''; }
  else if (TOAST_TYPES.includes(b)) { type = b; message = a ?? ''; }
  else { message = a ?? ''; if (b) type = b; }

  const el = document.createElement('div');
  el.className = `toast toast-${type} ${type}`;
  el.setAttribute('role', 'status');

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-dismiss';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.textContent = '×';
  closeBtn.addEventListener('click', () => dismissToast(el));
  el.appendChild(closeBtn);

  getToastStack().appendChild(el);
  setTimeout(() => dismissToast(el), 4000);
  return el;
}

// Alias for call sites that expect a showToast() name.
if (typeof window !== 'undefined') {
  window.toast = toast;
  window.showToast = toast;
}

// ── Copy to clipboard ───────────────────────────────────────
function copyToClipboard(text, btnEl) {
  const done = (ok) => {
    if (!btnEl) return;
    const original = btnEl.dataset.copyLabel ?? btnEl.textContent;
    btnEl.dataset.copyLabel = original;
    btnEl.textContent = ok ? 'Copied!' : 'Copy failed';
    btnEl.classList.toggle('copied', ok);
    setTimeout(() => {
      btnEl.textContent = original;
      btnEl.classList.remove('copied');
    }, 2000);
  };

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => done(true), () => done(false));
    return;
  }

  // fallback for non-secure contexts / older environments
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    done(ok);
  } catch (err) {
    done(false);
  }
}

if (typeof window !== 'undefined') {
  window.copyToClipboard = copyToClipboard;
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.remove('hidden'); }
function closeModal(id) { document.getElementById(id).classList.add('hidden'); }

// ── Styled confirmation dialog (Promise<boolean>) ──────────
// confirmDialog({ title, body, confirmLabel, danger, warn, requireText })
// Replaces native confirm() for destructive/important actions. `requireText`,
// when set, disables the confirm button until the input matches exactly.
function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false, warn = false, requireText = null }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const btnClass = danger ? 'btn-danger' : (warn ? 'btn-warn' : 'btn-primary');
    backdrop.innerHTML = `
      <div class="modal confirm-dialog">
        <div class="modal-header"><h2>${esc(title)}</h2></div>
        <div class="confirm-body">
          <p>${esc(body)}</p>
          ${requireText ? `
          <div class="type-to-confirm">
            <label for="confirm-type-input">Type the site name to confirm</label>
            <input type="text" id="confirm-type-input" autocomplete="off" spellcheck="false" />
          </div>` : ''}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="confirm-cancel">Cancel</button>
          <button type="button" class="btn ${btnClass}" data-role="confirm-ok" ${requireText ? 'disabled' : ''}>${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);

    const confirmBtn = backdrop.querySelector('[data-role="confirm-ok"]');
    const cancelBtn = backdrop.querySelector('[data-role="confirm-cancel"]');
    const input = backdrop.querySelector('#confirm-type-input');

    function cleanup(result) {
      document.removeEventListener('keydown', onKey);
      backdrop.remove();
      resolve(result);
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); cleanup(false); }
    }

    cancelBtn.addEventListener('click', () => cleanup(false));
    confirmBtn.addEventListener('click', () => { if (!confirmBtn.disabled) cleanup(true); });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(false); });
    document.addEventListener('keydown', onKey);

    if (input) {
      input.addEventListener('input', () => {
        const matched = input.value === requireText;
        confirmBtn.disabled = !matched;
        input.classList.toggle('matched', matched && input.value.length > 0);
        input.classList.toggle('mismatch', !matched && input.value.length > 0);
      });
      input.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !confirmBtn.disabled) cleanup(true);
      });
      setTimeout(() => input.focus(), 30);
    } else {
      confirmBtn.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(true); });
      setTimeout(() => confirmBtn.focus(), 30);
    }
  });
}

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
  if (open) { closeModal(open.id); return; }
  document.querySelectorAll('.site-overflow-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
});

// ── Search ────────────────────────────────────────────────
const siteSearchInput = document.getElementById('site-search');
const siteSearchClear = document.getElementById('site-search-clear');

function clearSiteSearch() {
  searchQuery = '';
  if (siteSearchInput) siteSearchInput.value = '';
  if (siteSearchClear) siteSearchClear.classList.add('hidden');
  renderSites();
}
if (typeof window !== 'undefined') window.clearSiteSearch = clearSiteSearch;

siteSearchInput.addEventListener('input', e => {
  searchQuery = e.target.value.toLowerCase().trim();
  if (siteSearchClear) siteSearchClear.classList.toggle('hidden', !searchQuery);
  renderSites();
});
if (siteSearchClear) {
  siteSearchClear.addEventListener('click', () => {
    clearSiteSearch();
    siteSearchInput.focus();
  });
}

// ── Sites list ────────────────────────────────────────────
async function loadSites() {
  sites = await api('GET', '/sites');
  api('GET', '/uptime').then(d => { uptimeData = d; renderSites(); }).catch(() => {});
  renderSites();
  sites.forEach(s => refreshDnsDot(s.id));
  sites.forEach(s => { if (statusInfo(s.container).error) refreshDownDuration(s.id); });
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

// Best-effort "down for N min" hint on the error banner. Uses the existing
// per-site /api/uptime/:id endpoint (already used by the analytics modal) —
// no API changes. The endpoint only returns the most recent ~90 checks, so
// for outages older than that we just show the oldest known point ("over").
function humanDuration(mins) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60), m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

async function refreshDownDuration(siteId) {
  try {
    const data = await api('GET', `/uptime/${siteId}?period=24h`);
    const strip = data.strip || [];
    if (!strip.length || strip[strip.length - 1].up) return;
    let since = strip[strip.length - 1].checked_at;
    let coversWholeStrip = true;
    for (let i = strip.length - 1; i >= 0; i--) {
      if (!strip[i].up) { since = strip[i].checked_at; }
      else { coversWholeStrip = false; break; }
    }
    const mins = Math.max(1, Math.round((Date.now() / 1000 - since) / 60));
    const el = document.getElementById(`down-duration-${siteId}`);
    if (el) el.textContent = ` · down for ${coversWholeStrip ? 'over ' : ''}${humanDuration(mins)}`;
  } catch {}
}

function closeAllSiteOverflows(exceptId) {
  document.querySelectorAll('.site-overflow-menu').forEach(m => {
    if (m.id !== `overflow-${exceptId}`) m.classList.add('hidden');
  });
}
document.addEventListener('click', () => closeAllSiteOverflows());
if (typeof window !== 'undefined') window.closeAllSiteOverflows = closeAllSiteOverflows;

function renderSites() {
  const grid = document.getElementById('sites-list');
  const count = document.getElementById('site-count');

  const filtered = searchQuery
    ? sites.filter(s =>
        s.name.toLowerCase().includes(searchQuery) ||
        s.domain.toLowerCase().includes(searchQuery))
    : sites;

  if (searchQuery) {
    count.textContent = `${filtered.length} of ${sites.length} site${sites.length !== 1 ? 's' : ''} — matching "${searchQuery}"`;
  } else {
    const runningCount = sites.filter(s => s.container?.running).length;
    const downCount = sites.filter(s => statusInfo(s.container).error).length;
    count.textContent = `${sites.length} site${sites.length !== 1 ? 's' : ''}` +
      (sites.length ? ` · ${runningCount} running` : '') +
      (downCount ? ` · ${downCount} down` : '');
  }

  if (sites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.globe}</div>
        <h3>No sites yet</h3>
        <p>Upload a zip and Grimport serves it over HTTPS on your domain.</p>
        ${currentUser.role === 'admin' ? `<button class="btn btn-primary" style="margin-top:16px" onclick="document.getElementById('btn-new-site').click()">${ICON.plus} Create your first site</button>` : ''}
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.globe}</div>
        <h3>No other sites match "${esc(searchQuery)}"</h3>
        <p>Search covers names and domains · <button type="button" class="link-btn" onclick="clearSiteSearch()">Clear search</button></p>
      </div>`;
    return;
  }

  grid.innerHTML = filtered.map(s => siteCard(s)).join('');

  grid.querySelectorAll('[data-action]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const { action, id } = btn.dataset;
      const site = sites.find(s => s.id === id);
      if (action === 'deploy')          openDeploy(site);
      if (action === 'settings')        openSettings(site);
      if (action === 'logs')            openLogs(site);
      if (action === 'dns')             openDns(site);
      if (action === 'analytics')       openAnalytics(site);
      if (action === 'start')           siteAction(id, 'start');
      if (action === 'stop')            siteAction(id, 'stop');
      if (action === 'history')         openHistory(site);
      if (action === 'preview-create')  openPreviewModal(site);
      if (action === 'preview-swap')    previewSwap(site);
      if (action === 'preview-discard') previewDiscard(site);
      if (action === 'overflow') {
        const menu = document.getElementById(`overflow-${id}`);
        const wasHidden = menu?.classList.contains('hidden');
        closeAllSiteOverflows();
        if (menu && wasHidden) menu.classList.remove('hidden');
      }
    });
  });
}

// Container lifecycle → { cls, label, error }. `cls` maps 1:1 onto the
// design-system .status-<cls> classes (docs/design/design-system.md
// "Status vocabulary"); glyph + label + colour, never colour alone.
function statusInfo(container) {
  if (!container) return { cls: 'unknown', label: 'Unknown', error: false };
  switch (container.status) {
    case 'running':    return { cls: 'running',      label: 'Running',      error: false };
    case 'exited': {
      const abnormal = container.exitCode !== 0;
      return { cls: abnormal ? 'missing' : 'stopped', label: abnormal ? 'Exited' : 'Stopped', error: abnormal };
    }
    case 'created':    return { cls: 'starting',     label: 'Starting…',    error: false };
    case 'restarting': return { cls: 'restarting',   label: 'Restarting',   error: true };
    case 'paused':     return { cls: 'paused',       label: 'Paused',       error: false };
    case 'missing':    return { cls: 'missing',      label: 'Missing',      error: true };
    case 'none':       return { cls: 'no-container', label: 'No container', error: false };
    default:           return { cls: 'unknown',      label: container.status, error: false };
  }
}

// Common container exit codes → short human reason for the error hint.
function exitCodeReason(exitCode) {
  const known = { 137: 'out of memory', 139: 'segmentation fault', 143: 'terminated', 1: 'application error' };
  return known[exitCode] ? ` (${known[exitCode]})` : '';
}

function errorHintText(container) {
  if (container?.status === 'exited' && container.exitCode !== 0) {
    return `Container exited with code ${container.exitCode}${exitCodeReason(container.exitCode)} — check logs`;
  }
  if (container?.status === 'missing')    return 'Container missing — check logs';
  if (container?.status === 'restarting') return 'Container restarting repeatedly — check logs';
  return 'Check logs for details';
}

function siteCard(site) {
  const container = site.container;
  const { cls, label, error } = statusInfo(container);
  const isRunning = !!container?.running;
  const runtime = site.runtime || 'static';

  const tags = [
    runtime !== 'static'  ? `<span class="badge badge-runtime">${esc(runtime.toUpperCase())}</span>` : '',
    site.spa_mode         ? `<span class="badge badge-spa">SPA</span>` : '',
    site.maintenance_mode ? `<span class="badge badge-maint">⛭ Maintenance</span>` : '',
    site.basic_auth       ? `<span class="badge badge-auth">🔒 Basic Auth</span>` : '',
  ].filter(Boolean).join('');

  const previewBadge = site.preview_container_id ? `
    <div class="preview-badge">
      <span class="preview-badge-label">Preview</span>
      <a href="http://${esc(site.preview_domain)}" target="_blank" rel="noopener">${esc(site.preview_domain)} ↗</a>
      <span class="preview-badge-meta">deployed</span>
      <div class="preview-badge-actions">
        <button class="btn btn-xs btn-primary" data-action="preview-swap" data-id="${site.id}">Go live</button>
        <button class="btn btn-xs btn-secondary" data-action="preview-discard" data-id="${site.id}">Discard</button>
      </div>
    </div>` : '';

  const errorHint = error ? `
    <div class="site-error-hint">
      ${ICON.warning}
      <span>${esc(errorHintText(container))}<span id="down-duration-${site.id}"></span></span>
    </div>` : '';

  return `
    <div class="site-card${error ? ' site-card--error' : ''}">
      <div class="site-card-header">
        <span class="status status-${cls}" data-status-for="${site.id}"><span class="status-glyph">●</span><span class="status-label">${esc(label)}</span></span>
        <span class="site-name" title="${esc(site.name)}">${esc(site.name)}</span>
      </div>
      <div class="site-domain-row">
        <a class="site-domain" href="http://${esc(site.domain)}" target="_blank" rel="noopener">${esc(site.domain)}<span class="site-domain-arrow">↗</span></a>
        <button class="dns-status-btn" data-action="dns" data-id="${site.id}" title="DNS status">
          <span class="dns-indicator dns-indicator-unknown" id="dns-dot-${site.id}"></span>
        </button>
      </div>
      ${tags ? `<div class="site-tags">${tags}</div>` : ''}
      ${previewBadge}
      ${errorHint}
      ${uptimeStrip(site.id)}
      <div class="site-actions">
        <button class="btn btn-sm btn-primary site-deploy-btn" data-action="deploy" data-id="${site.id}">Deploy</button>
        <button class="btn btn-sm btn-secondary" data-action="${isRunning ? 'stop' : 'start'}" data-id="${site.id}">${isRunning ? 'Stop' : 'Start'}</button>
        <button class="btn btn-sm btn-secondary" data-action="logs" data-id="${site.id}">Logs</button>
        <button class="btn btn-sm btn-secondary" data-action="analytics" data-id="${site.id}">Analytics</button>
        <div class="site-overflow">
          <button class="btn btn-sm btn-secondary" data-action="overflow" data-id="${site.id}" aria-haspopup="true" aria-expanded="false" title="More actions">⋯</button>
          <div class="site-overflow-menu hidden" id="overflow-${site.id}">
            <button data-action="history" data-id="${site.id}">${ICON.history} History</button>
            <button data-action="settings" data-id="${site.id}">${ICON.settings} Settings</button>
            ${!site.preview_container_id ? `<button data-action="preview-create" data-id="${site.id}">${ICON.layers} Create preview</button>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

function uptimeStrip(siteId) {
  const u = uptimeData[siteId];
  const hasPct = u && u.uptime24h !== null && u.uptime24h !== undefined;
  const pct = hasPct ? parseFloat(u.uptime24h) : null;
  const pctCls = pct === null ? '' : pct >= 99 ? 'pct-ok' : pct >= 95 ? 'pct-warn' : 'pct-err';
  const pctText = pct === null ? '— %' : `${pct}%`;
  const status = u?.currentStatus;
  const dotCls = status === 'up' ? 'uptime-dot-up' : status === 'down' ? 'uptime-dot-down' : 'uptime-dot-unknown';
  const liveCls = status === 'up' ? 'status-up' : status === 'down' ? 'status-down' : 'status-muted';
  const liveLabel = status === 'up' ? 'Up' : status === 'down' ? 'Down' : '?';
  return `<div class="uptime-row">
    <span class="uptime-pct ${pctCls}">${pctText}</span>
    <span class="uptime-label">uptime 24h</span>
    <span class="uptime-dot ${dotCls}"></span>
    <span class="uptime-live-label ${liveCls}">${liveLabel}</span>
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

const DOMAIN_RE = /^[a-z0-9]([a-z0-9\-\.]*[a-z0-9])?(\.[a-z]{2,})$/;
const NEW_SITE_DOMAIN_DEFAULT_HELP = 'Must match a DNS record pointing to this server. Use <code>.localhost</code> for local testing.';

function validateNewSiteDomain() {
  const input = document.getElementById('new-site-domain');
  const help = document.getElementById('new-site-domain-help');
  const field = input.closest('.field');
  const domain = input.value.trim().toLowerCase();
  if (!domain) {
    field.classList.remove('is-invalid', 'is-valid');
    help.className = 'field-help muted';
    help.innerHTML = NEW_SITE_DOMAIN_DEFAULT_HELP;
    return false;
  }
  const valid = DOMAIN_RE.test(domain);
  field.classList.toggle('is-invalid', !valid);
  field.classList.toggle('is-valid', valid);
  help.className = valid ? 'field-help ok' : 'field-help err';
  help.textContent = valid
    ? 'Available — auto-suggested from base domain'
    : 'Invalid domain — use a format like mysite.example.com or test.localhost';
  return valid;
}

document.getElementById('new-site-domain').addEventListener('input', validateNewSiteDomain);

document.getElementById('btn-new-site').addEventListener('click', async () => {
  document.getElementById('form-new-site').reset();
  setNewSiteRuntime('static');
  if (config.siteBaseDomain) {
    document.querySelector('#form-new-site input[name="domain"]').value =
      `${randomSlug()}.${config.siteBaseDomain}`;
  }
  validateNewSiteDomain();
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
  if (!validateNewSiteDomain()) {
    toast('Invalid domain — use a format like mysite.example.com or test.localhost', 'error');
    return;
  }
  const runtime = fd.get('runtime') || 'static';
  const isApp = runtime === 'node' || runtime === 'python';
  const payload = {
    name: fd.get('name'),
    domain,
    runtime,
    spa_mode: fd.get('spa_mode') === 'on',
    cache_enabled: fd.get('cache_enabled') === 'on',
    ...(isApp ? {
      build_cmd: fd.get('build_cmd') || null,
      start_cmd: fd.get('start_cmd') || null,
      app_port: fd.get('app_port') ? Number(fd.get('app_port')) : 3000,
    } : {}),
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
let activeDeployTab = 'upload';

document.querySelectorAll('.deploy-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.deploy-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    activeDeployTab = tab.dataset.dtab;
    document.getElementById('dtab-upload').classList.toggle('hidden', activeDeployTab !== 'upload');
    document.getElementById('dtab-url').classList.toggle('hidden', activeDeployTab !== 'url');
    // Enable confirm if URL tab and input has value
    const urlInput = document.getElementById('deploy-url-input');
    document.getElementById('btn-deploy-confirm').disabled =
      activeDeployTab === 'upload' ? !selectedDeployFile : !urlInput.value.trim();
  });
});

document.getElementById('deploy-url-input').addEventListener('input', e => {
  if (activeDeployTab === 'url') {
    document.getElementById('btn-deploy-confirm').disabled = !e.target.value.trim();
  }
});

function openDeploy(site) {
  activeSiteId = site.id;
  selectedDeployFile = null;
  activeDeployTab = 'upload';
  document.getElementById('deploy-site-name').textContent = site.name;
  document.getElementById('deploy-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('deploy-status-text').textContent = 'Uploading…';
  document.getElementById('btn-deploy-confirm').disabled = true;
  document.getElementById('dropzone').classList.remove('dragging', 'has-file');
  document.getElementById('deploy-url-input').value = '';
  // Reset tabs
  document.querySelectorAll('.deploy-tab').forEach(t => t.classList.remove('active'));
  document.querySelector('.deploy-tab[data-dtab="upload"]').classList.add('active');
  document.getElementById('dtab-upload').classList.remove('hidden');
  document.getElementById('dtab-url').classList.add('hidden');
  document.querySelector('#dropzone .dropzone-inner').innerHTML = `
    <span class="dropzone-icon">${ICON.upload}</span>
    <p>Drop your <strong>.zip</strong> here, or click to browse</p>
    <small>only .zip accepted · Webflow exports, React/Vue build output, any static site</small>
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
  dropzone.classList.add('has-file');
  dropzone.querySelector('.dropzone-inner').innerHTML = `
    <span class="dropzone-icon dropzone-icon--ready">${ICON.check}</span>
    <p><strong>${esc(file.name)}</strong> <span class="dropzone-filesize">· ${(file.size / 1024 / 1024).toFixed(1)} MB</span></p>
    <small>Drop another .zip to replace · only .zip accepted</small>
  `;
  document.getElementById('btn-deploy-confirm').disabled = false;
}

document.getElementById('btn-deploy-confirm').addEventListener('click', async () => {
  if (!activeSiteId) return;
  const progress = document.getElementById('deploy-progress');
  const fill = document.getElementById('progress-fill');
  const status = document.getElementById('deploy-status-text');
  progress.classList.remove('hidden');
  document.getElementById('btn-deploy-confirm').disabled = true;

  try {
    if (activeDeployTab === 'url') {
      const url = document.getElementById('deploy-url-input').value.trim();
      if (!url) throw new Error('No URL entered');
      status.textContent = 'Downloading…';
      fill.style.width = '40%';
      await api('POST', `/deploy/${activeSiteId}/url`, { url });
      fill.style.width = '100%';
    } else {
      if (!selectedDeployFile) return;
      status.textContent = 'Uploading…';
      await apiUpload(activeSiteId, selectedDeployFile, (pct, loaded, total) => {
        fill.style.width = `${Math.round(pct * 90)}%`;
        if (pct < 1) {
          const mb = n => (n / 1024 / 1024).toFixed(1);
          status.textContent = `Uploading… ${Math.round(pct * 100)}% · ${mb(loaded)} of ${mb(total)} MB · then: extract → swap → health check`;
        } else {
          status.textContent = 'Extracting…';
        }
      });
      fill.style.width = '100%';
    }
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
// Tab switching (scoped to #modal-settings — the panel-level Settings
// view has its own identically-shaped .tab/.tab-panel group)
document.querySelectorAll('#modal-settings .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#modal-settings .tab').forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    document.querySelectorAll('#modal-settings .tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`stab-${tab.dataset.stab}`).classList.remove('hidden');
    if (tab.dataset.stab === 'access' && currentUser.role === 'admin') loadSiteAccessUsers();
  });
});

async function loadSiteAccessUsers() {
  const wrap = document.getElementById('site-access-users-list');
  if (!activeSiteId) return;
  try {
    const [allUsers, siteUsers] = await Promise.all([
      api('GET', '/users'),
      api('GET', `/sites/${activeSiteId}/users`),
    ]);
    const nonAdmins = allUsers.filter(u => u.role !== 'admin');
    if (!nonAdmins.length) {
      wrap.innerHTML = '<p class="settings-desc">No editor or viewer users exist yet.</p>';
      return;
    }
    wrap.innerHTML = nonAdmins.map(u => `
      <label class="g-checkbox" style="display:flex;margin-bottom:8px">
        <input type="checkbox" class="site-user-access-cb" data-uid="${u.id}"
          ${siteUsers.user_ids.includes(u.id) ? 'checked' : ''} />
        <span class="g-checkbox-box"></span>
        ${esc(u.username)} <span class="badge badge-role-${esc(u.role)}" style="margin-left:4px">${esc(u.role)}</span>
      </label>
    `).join('');

    // Save on each toggle immediately
    wrap.querySelectorAll('.site-user-access-cb').forEach(cb => {
      cb.addEventListener('change', async () => {
        const checked = [...wrap.querySelectorAll('.site-user-access-cb:checked')].map(c => c.dataset.uid);
        await api('PUT', `/sites/${activeSiteId}/users`, { user_ids: checked }).catch(err => toast(err.message, 'error'));
      });
    });
  } catch (err) {
    wrap.innerHTML = `<p class="settings-desc" style="color:var(--red)">${esc(err.message)}</p>`;
  }
}

function openSettings(site) {
  activeSiteId = site.id;
  document.getElementById('settings-site-name').textContent = site.name;

  // Reset to General tab
  document.querySelectorAll('#modal-settings .tab').forEach((t, i) => {
    t.classList.toggle('is-active', i === 0);
    t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  });
  document.querySelectorAll('#modal-settings .tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));

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
  populateAppConfigTab(site);
  openModal('modal-settings');
}

// Headers
function renderHeadersList(headers) {
  const list = document.getElementById('headers-list');
  list.innerHTML = headers.map((h, i) => `
    <div class="header-row">
      <input class="g-input" type="text" placeholder="Header name" value="${esc(h.name)}" data-header-name data-idx="${i}" />
      <input class="g-input" type="text" placeholder="Value" value="${esc(h.value)}" data-header-value data-idx="${i}" />
      <button class="btn btn-sm btn-icon-only btn-danger" data-remove-header="${i}" title="Remove">${ICON.x}</button>
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
      <input class="g-input" type="text" placeholder="/old-path" value="${esc(r.from)}" data-redirect-from data-idx="${i}" />
      <input class="g-input" type="text" placeholder="/new-path" value="${esc(r.to)}" data-redirect-to data-idx="${i}" />
      <label class="g-checkbox redirect-permanent">
        <input type="checkbox" data-redirect-permanent data-idx="${i}" ${r.permanent ? 'checked' : ''} />
        <span class="g-checkbox-box"></span>
        301
      </label>
      <button class="btn btn-sm btn-icon-only btn-danger" data-remove-redirect="${i}" title="Remove">${ICON.x}</button>
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

  const runtime = document.getElementById('settings-runtime')?.value || 'static';
  const isApp = runtime === 'node' || runtime === 'python';
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
    runtime,
    build_cmd: isApp ? (form.elements['build_cmd']?.value || null) : null,
    start_cmd: isApp ? (form.elements['start_cmd']?.value || null) : null,
    app_port: isApp ? (Number(form.elements['app_port']?.value) || 3000) : null,
    env_vars: JSON.stringify(collectEnvVars()),
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
  const ok = await confirmDialog({
    title: `Delete "${site.name}"?`,
    body: 'This permanently removes the site, its container, files and deploy history. This cannot be undone.',
    confirmLabel: 'Delete forever',
    danger: true,
    requireText: site.name,
  });
  if (!ok) return;
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
  await fetchModalLogs();
}

async function fetchModalLogs() {
  if (!activeSiteId) return;
  try {
    const res = await fetch(`/api/sites/${activeSiteId}/logs?lines=200`);
    const text = await res.text();
    const el = document.getElementById('logs-content');
    if (!res.ok) {
      try { el.textContent = `Error: ${JSON.parse(text).error}`; } catch { el.textContent = text; }
    } else {
      el.textContent = text || '(no logs yet)';
      el.scrollTop = el.scrollHeight;
    }
  } catch (err) {
    document.getElementById('logs-content').textContent = `Error: ${err.message}`;
  }
}

document.getElementById('btn-refresh-logs').addEventListener('click', fetchModalLogs);

// ── Site start / stop ─────────────────────────────────────
async function siteAction(id, action) {
  const site = sites.find(s => s.id === id);
  if (action === 'stop' && site?.container?.running) {
    const ok = await confirmDialog({
      title: `Stop "${site.name}"?`,
      body: 'The site goes offline until you start it again. Visitors will see the maintenance page.',
      confirmLabel: 'Stop site',
      warn: true,
    });
    if (!ok) return;
  }

  // Optimistic update — flip the status pill to "starting" while the
  // request is in flight; loadSites() reconciles with the real state after.
  const card = document.querySelector(`[data-action="${action === 'stop' ? 'stop' : 'start'}"][data-id="${id}"]`)?.closest('.site-card');
  const statusEl = card?.querySelector(`[data-status-for="${id}"]`);
  const labelEl = statusEl?.querySelector('.status-label');
  if (statusEl) statusEl.className = 'status status-starting';
  if (labelEl) labelEl.textContent = action === 'start' ? 'Starting…' : 'Stopping…';

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
  if (b >= 1e9) return (b / 1e9).toFixed(2) + ' GB';
  if (b >= 1e6) return (b / 1e6).toFixed(1) + ' MB';
  if (b >= 1e3) return (b / 1e3).toFixed(1) + ' KB';
  return b + ' B';
}
function fmtNum(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'k';
  return String(n);
}

async function openAnalytics(site) {
  activeAnalyticsSiteId = site.id;
  document.getElementById('analytics-site-name').textContent = site.name;
  document.querySelectorAll('.analytics-period-btn').forEach(b =>
    b.classList.toggle('is-active', b.dataset.period === activeAnalyticsPeriod));
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
  const clientPct = totals.requests > 0 ? ((totals.client_err / totals.requests) * 100).toFixed(1) : '0.0';
  const serverPct = totals.requests > 0 ? ((totals.server_err / totals.requests) * 100).toFixed(1) : '0.0';

  document.getElementById('stat-requests').textContent = fmtNum(totals.requests);
  document.getElementById('stat-requests-1h').textContent = fmtNum(last1h.requests) + ' in the last hour';
  document.getElementById('stat-bytes').textContent = fmtBytes(totals.bytes);
  const avgBytes = totals.requests > 0 ? totals.bytes / totals.requests : 0;
  document.getElementById('stat-bytes-sub').textContent = fmtBytes(avgBytes) + ' avg / request';
  document.getElementById('stat-errors').textContent = errorRate + '%';
  document.getElementById('stat-errors-detail').innerHTML =
    `<span style="color:var(--warn)">${clientPct}% client</span> · <span style="color:var(--err)">${serverPct}% server</span>`;

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
    let requests = 0, serverErr = 0, hasError = false;
    for (let t = slotEnd - bucketSize * 3600; t < slotEnd; t += 3600) {
      const h = dataMap.get(t - (t % 3600));
      if (h) { requests += h.requests; serverErr += h.server_err; if (h.client_err + h.server_err > 0) hasError = true; }
    }
    slots.push({ requests, serverErr, hasError, label: new Date(slotEnd * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) });
  }
  const maxVal = Math.max(...slots.map(s => s.requests), 1);
  const tooltip = document.getElementById('analytics-tooltip');
  chart.innerHTML = `
    <div class="sparkline">
      ${slots.map((s, i) => `
        <div class="spark-bar-wrap" data-slot="${i}" title="${s.requests} requests at ${s.label}">
          <div class="spark-bar ${s.hasError ? 'spark-bar-error' : ''}" style="height:${Math.max(s.requests / maxVal * 100, s.requests > 0 ? 4 : 0)}%"></div>
        </div>`).join('')}
    </div>
    <div class="sparkline-labels">
      <span>${slots[0]?.label || ''}</span>
      <span>${slots[Math.floor(slots.length / 2)]?.label || ''}</span>
      <span>${slots[slots.length - 1]?.label || 'now'}</span>
    </div>`;

  if (tooltip) {
    chart.querySelectorAll('.spark-bar-wrap').forEach(wrap => {
      wrap.addEventListener('mouseenter', () => {
        const s = slots[Number(wrap.dataset.slot)];
        if (!s) return;
        tooltip.textContent = `${s.label} — ${fmtNum(s.requests)} req${s.serverErr > 0 ? ` · ${s.serverErr}× 5xx` : ''}`;
        tooltip.classList.add('is-visible');
      });
      wrap.addEventListener('mouseleave', () => tooltip.classList.remove('is-visible'));
    });
  }
}

document.querySelectorAll('.analytics-period-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    activeAnalyticsPeriod = btn.dataset.period;
    document.querySelectorAll('.analytics-period-btn').forEach(b => b.classList.toggle('is-active', b === btn));
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
      ok:      { cls: 'ok',      text: `DNS is correctly pointing to ${data.serverIp}` },
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

const DNS_BANNER_ICON = {
  ok:       ICON.check,
  wrong:    ICON.x,
  pending:  ICON.circle,
  checking: ICON.rotateCw,
};

function setBanner(state, text) {
  document.getElementById('dns-status-banner').className = `dns-banner dns-banner-${state}`;
  document.getElementById('dns-status-text').textContent = text;
  const icon = document.getElementById('dns-banner-icon');
  if (icon) icon.innerHTML = DNS_BANNER_ICON[state] || '';
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
  document.querySelectorAll('.dns-tab').forEach(t => t.classList.toggle('is-active', t.dataset.tab === name));
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
  document.getElementById('history-list').innerHTML = '<p style="color:var(--tx3);padding:16px">Loading…</p>';
  openModal('modal-history');
  await refreshHistory(site.id, site.name);
}

async function refreshHistory(siteId, siteName) {
  try {
    const history = await api('GET', `/deploy/${siteId}/history`);
    const list = document.getElementById('history-list');
    if (!history.length) {
      list.innerHTML = '<p style="color:var(--tx3);padding:16px 0">No deployments yet.</p>';
      return;
    }
    list.innerHTML = history.map((d, i) => `
      <div class="history-row">
        <span class="history-num">#${history.length - i}</span>
        <span class="history-info">
          <span class="history-file">${esc(d.filename)}</span>
          <span class="history-meta">${timeAgo(d.deployed_at)} · ${fmtBytes(d.size)}</span>
        </span>
        ${i === 0
          ? '<span class="badge badge-ok">CURRENT</span>'
          : `<button class="btn btn-sm" data-rollback="${d.id}">Roll back…</button>`}
      </div>`).join('');
    list.querySelectorAll('[data-rollback]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({
          title: 'Roll back to this deployment?',
          body: 'Current files will be replaced with this deployment’s files. This cannot be undone.',
          confirmLabel: 'Roll back',
          danger: true,
        });
        if (!ok) return;
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
          btn.textContent = 'Roll back…';
        }
      });
    });
  } catch (err) {
    document.getElementById('history-list').innerHTML = `<p style="color:var(--err);padding:16px 0">${esc(err.message)}</p>`;
  }
}

// ── Activity feed ─────────────────────────────────────────
const EVENT_ICONS = {
  deployed:         ICON.upload,
  rolled_back:      ICON.rotateCcw,
  created:          ICON.plus,
  deleted:          ICON.trash,
  started:          ICON.play,
  stopped:          ICON.stop,
  settings_changed: ICON.settings,
  up:               ICON.check,
  down:             ICON.warning,
  update_started:   ICON.download,
  update_applying:  ICON.rotateCw,
  update_failed:    ICON.x,
  login:            ICON.user,
  logout:           ICON.user,
  preview_created:  ICON.layers,
  preview_swapped:  ICON.zap,
  preview_removed:  ICON.x,
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
  update_started:   'Update started',
  update_applying:  'Update applying',
  update_failed:    'Update failed',
  login:            'Signed in',
  logout:           'Signed out',
};

let activitySiteFilter = null;
let activityLevelFilter = null;

async function loadActivity() {
  const filtersEl = document.getElementById('activity-filters');
  if (filtersEl && sites.length) {
    filtersEl.innerHTML = `
      <div class="chip-group">
        <button class="chip ${activitySiteFilter === null ? 'is-active' : ''}" data-filter="">All sites</button>
        ${sites.map(s => `<button class="chip ${activitySiteFilter === s.id ? 'is-active' : ''}" data-filter="${esc(s.id)}">${esc(s.name)}</button>`).join('')}
      </div>
      <div class="chip-group">
        <button class="chip activity-level-chip ${activityLevelFilter === null ? 'is-active' : ''}" data-level="">All levels</button>
        <button class="chip chip-err activity-level-chip ${activityLevelFilter === 'error' ? 'is-active' : ''}" data-level="error">Errors</button>
        <button class="chip chip-warn activity-level-chip ${activityLevelFilter === 'warn' ? 'is-active' : ''}" data-level="warn">Warnings</button>
      </div>
    `;
    filtersEl.querySelectorAll('.chip:not(.activity-level-chip)').forEach(btn => {
      btn.addEventListener('click', () => { activitySiteFilter = btn.dataset.filter || null; loadActivity(); });
    });
    filtersEl.querySelectorAll('.activity-level-chip').forEach(btn => {
      btn.addEventListener('click', () => { activityLevelFilter = btn.dataset.level || null; loadActivity(); });
    });
  }

  let url = '/activity?limit=200';
  if (activitySiteFilter) url += `&site_id=${activitySiteFilter}`;
  if (activityLevelFilter) url += `&level=${activityLevelFilter}`;

  try {
    const events = await api('GET', url);
    const feed = document.getElementById('activity-feed');
    const subtitle = document.getElementById('activity-subtitle');
    if (subtitle) {
      if (!events.length) {
        subtitle.textContent = 'No activity yet';
      } else {
        const oldest = events[events.length - 1].created_at;
        const spanDays = Math.max(1, Math.ceil((Date.now() / 1000 - oldest) / 86400));
        subtitle.textContent = `${events.length} event${events.length !== 1 ? 's' : ''} · last ${spanDays} day${spanDays !== 1 ? 's' : ''}`;
      }
    }
    if (!events.length) {
      feed.innerHTML = '<div class="activity-empty">No activity yet.</div>';
      return;
    }
    feed.innerHTML = events.map(e => {
      const isDown  = e.event === 'down';
      const isUp    = e.event === 'up';
      const isError = e.level === 'error';
      const isWarn  = e.level === 'warn';
      const levelBadge = isError
        ? '<span class="badge badge-err">ERROR</span>'
        : isWarn
          ? '<span class="badge badge-warn">WARN</span>'
          : '';
      const actorBadge = (e.actor && e.actor !== 'system')
        ? `<span class="badge badge-accent">${esc(e.actor)}</span>`
        : '';
      const label = EVENT_LABELS[e.event] || (e.fn ? esc(e.fn) : esc(e.event));
      const duration = e.duration_ms != null ? `<span class="activity-duration">took ${fmtDuration(e.duration_ms)}</span>` : '';
      const emphasis = isDown ? 'activity-item-down' : isUp ? 'activity-item-up' : isError ? 'activity-item-error' : '';
      return `
        <div class="activity-item ${emphasis}">
          <span class="activity-icon">${EVENT_ICONS[e.event] || (isError ? ICON.x : isWarn ? ICON.warning : ICON.dot)}</span>
          <div class="activity-body">
            <div class="activity-line">
              ${levelBadge}
              <span class="activity-label">${label}</span>
              ${actorBadge ? `<span class="activity-by">by</span>${actorBadge}` : ''}
              <span class="activity-site">${esc(e.site_name === 'grimport' ? 'Grimport' : e.site_name || 'Panel')}</span>
            </div>
            ${e.detail ? `<div class="activity-detail">${esc(e.detail)}</div>` : ''}
            ${duration}
          </div>
          <span class="activity-time">${timeAgo(e.created_at)}</span>
        </div>`;
    }).join('');
  } catch (err) {
    const feed = document.getElementById('activity-feed');
    if (feed) feed.innerHTML = '<div class="activity-empty">Failed to load activity.</div>';
    toast(err.message, 'error');
  }
}

function fmtDuration(ms) {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)} s`;
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
    if (view === 'overview') loadOverview();
    if (view === 'deployments') loadDeployments();
    if (view === 'logs') loadLogsView();
    if (view === 'domains') loadDomains();
  });
});

// ── Settings page tabs ────────────────────────────────────
document.querySelectorAll('#view-panel-settings .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('#view-panel-settings .tab').forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('is-active');
    tab.setAttribute('aria-selected', 'true');
    document.querySelectorAll('#view-panel-settings .tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`spanel-${tab.dataset.stab}`).classList.remove('hidden');
    if (tab.dataset.stab === 'general')       checkForUpdate();
    if (tab.dataset.stab === 'server')        loadServerInfo();
    if (tab.dataset.stab === 'tokens')        loadTokens();
    if (tab.dataset.stab === 'webhooks')      loadWebhooks();
    if (tab.dataset.stab === 'notifications') { loadNotifSettings(); loadNotifUnreadSummary(); }
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
    const snippetEl = document.querySelector('#form-analytics-snippet [name="analytics_snippet"]');
    if (snippetEl) snippetEl.value = s.analytics_snippet || '';
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
      document.getElementById('ssl-status-icon').innerHTML = ICON.check;
      document.getElementById('ssl-status-title').textContent = 'SSL active';
      document.getElementById('ssl-status-detail').textContent = `Certificates managed by Let's Encrypt. Registered email: ${cfg.acmeEmail}`;
    } else if (cfg.sslReady && !isHttps) {
      banner.className = 'ssl-status-banner ssl-status-partial';
      document.getElementById('ssl-status-icon').innerHTML = ICON.shield;
      document.getElementById('ssl-status-title').textContent = 'ACME_EMAIL configured — panel HTTPS not yet enabled';
      document.getElementById('ssl-status-detail').textContent = 'Per-site SSL is available. To enable HTTPS on the panel itself, uncomment the HTTPS labels in docker-compose.yml and restart.';
    } else {
      banner.className = 'ssl-status-banner ssl-status-unconfigured';
      document.getElementById('ssl-status-icon').innerHTML = ICON.x;
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
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.shield}</div>
        <h3>No tokens yet.</h3>
        <p>Create one below to authenticate CI/CD deploys.</p>
      </div>`;
    return;
  }
  list.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>Created</th><th>Last used</th><th></th></tr></thead>
      <tbody>
        ${tokens.map(t => `
          <tr>
            <td>${esc(t.name)}</td>
            <td class="cell-mono">${new Date(t.created_at * 1000).toLocaleDateString()}</td>
            <td class="cell-mono">${t.last_used ? new Date(t.last_used * 1000).toLocaleDateString() : 'never'}</td>
            <td><button class="btn btn-sm btn-danger" data-revoke="${t.id}">Revoke…</button></td>
          </tr>`).join('')}
      </tbody>
    </table>`;
  list.querySelectorAll('[data-revoke]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Revoke this token?',
        body: 'Any scripts using it will stop working immediately.',
        confirmLabel: 'Revoke',
        danger: true,
      });
      if (!ok) return;
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

document.getElementById('btn-copy-token').addEventListener('click', e => {
  const val = document.getElementById('token-reveal-value').textContent;
  copyToClipboard(val, e.currentTarget);
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
    setPasswordStrengthHint('');
    toast('Password changed', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Password strength hint (Security tab) ─────────────────
function setPasswordStrengthHint(pw) {
  const hint = document.getElementById('password-strength-hint');
  if (!hint) return;
  if (!pw) {
    hint.textContent = 'Minimum 8 characters';
    hint.className = 'field-help muted';
    return;
  }
  const variety = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^A-Za-z0-9]/].filter(re => re.test(pw)).length;
  if (pw.length < 8) {
    hint.textContent = 'Too short — minimum 8 characters';
    hint.className = 'field-help err';
  } else if (pw.length >= 12 && variety >= 3) {
    hint.textContent = 'Strong — 12+ characters, mixed case, symbol';
    hint.className = 'field-help ok';
  } else if (pw.length >= 8 && variety >= 2) {
    hint.textContent = 'Okay — add length or symbols for a stronger password';
    hint.className = 'field-help warn';
  } else {
    hint.textContent = 'Weak — try mixing case, numbers, and symbols';
    hint.className = 'field-help warn';
  }
}
document.querySelector('#form-change-password [name="new_password"]')
  .addEventListener('input', e => setPasswordStrengthHint(e.target.value));

// ── Sign out ──────────────────────────────────────────────
document.getElementById('btn-signout').addEventListener('click', async () => {
  await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
  window.location.href = '/login.html';
});

// ── Init ──────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({ authenticated: false }));
  if (!me.authenticated) { window.location.href = '/login.html'; return; }
  currentUser = { role: me.role || 'admin', username: me.username || '' };
  applyRoleUI();
  config = await api('GET', '/config').catch(() => config);
  if (config.version) {
    const el = document.getElementById('sidebar-version');
    if (el) el.textContent = `Grimport v${config.version}`;
  }
  await loadSites();
  await loadNotifications();
  checkForUpdate();
  setInterval(loadSites, 15_000);
  setInterval(loadNotifications, 30_000);
  setInterval(checkForUpdate, 6 * 60 * 60 * 1000); // re-check every 6h
}
init();

// ── Notifications ─────────────────────────────────────────
let notifDropdownOpen = false;

const bellBtn = document.getElementById('btn-bell');
const notifDropdown = document.getElementById('notif-dropdown');

bellBtn.addEventListener('click', e => {
  e.stopPropagation();
  notifDropdownOpen = !notifDropdownOpen;
  notifDropdown.classList.toggle('hidden', !notifDropdownOpen);
  if (notifDropdownOpen) loadNotifications();
});

document.addEventListener('click', e => {
  if (notifDropdownOpen && !notifDropdown.contains(e.target) && e.target !== bellBtn) {
    notifDropdownOpen = false;
    notifDropdown.classList.add('hidden');
  }
});

async function loadNotifications() {
  try {
    const { unread, notifications } = await api('GET', '/notifications');
    const hasUpdateNotif = cachedUpdateData?.updateAvailable && currentUser.role === 'admin';
    const totalUnread = unread + (hasUpdateNotif ? 1 : 0);
    const badge = document.getElementById('bell-badge');
    if (totalUnread > 0) {
      badge.textContent = totalUnread > 9 ? '9+' : String(totalUnread);
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
    if (notifDropdownOpen) renderNotifList(notifications);
  } catch {}
}

function renderNotifList(notifs) {
  const list = document.getElementById('notif-list');
  const hasUpdateNotif = cachedUpdateData?.updateAvailable && currentUser.role === 'admin';

  if (!notifs.length && !hasUpdateNotif) {
    list.innerHTML = '<div class="notif-empty">No notifications so far</div>';
    return;
  }

  const updateHtml = hasUpdateNotif ? `
    <div class="notif-item notif-update notif-unread" id="notif-update-item">
      <span class="notif-icon">${ICON.arrowUp}</span>
      <div class="notif-body">
        <span class="notif-title">Update available — v${esc(cachedUpdateData.latest)}</span>
        <span class="notif-detail">Click to install the latest version</span>
      </div>
    </div>` : '';

  const NOTIF_ICONS = { unknown_domain: ICON.globe, site_down: ICON.warning, site_up: ICON.check };
  list.innerHTML = updateHtml + notifs.map(n => {
    let data = {};
    try { data = JSON.parse(n.data || '{}'); } catch {}

    let detailHtml = n.detail ? esc(n.detail) : '';
    if (n.type === 'unknown_domain' && data.domain) {
      detailHtml += `${detailHtml ? ' — ' : ''}<span class="notif-link" data-domain="${esc(data.domain)}">connect it</span>`;
    }

    const actionsHtml = (n.type === 'site_down' && data.siteId) ? `
        <span class="notif-actions">
          <button class="btn btn-xs btn-danger" data-open-logs="${esc(data.siteId)}">Open logs</button>
          <button class="btn btn-xs btn-secondary" data-restart-site="${esc(data.siteId)}">Restart</button>
        </span>` : '';

    return `
      <div class="notif-item notif-type-${esc(n.type)} ${n.read ? '' : 'notif-unread'}" data-notif-id="${n.id}">
        <span class="notif-icon">${NOTIF_ICONS[n.type] || ICON.dot}</span>
        <div class="notif-body">
          <span class="notif-title">${esc(n.title)}</span>
          ${detailHtml ? `<span class="notif-detail">${detailHtml}</span>` : ''}
          ${actionsHtml}
        </div>
        <span class="notif-time">${timeAgo(n.created_at)}</span>
        <button class="notif-dismiss" data-dismiss="${n.id}" title="Dismiss">${ICON.x}</button>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await api('DELETE', `/notifications/${btn.dataset.dismiss}`).catch(() => {});
      loadNotifications();
    });
  });

  list.querySelectorAll('.notif-link[data-domain]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      notifDropdownOpen = false;
      notifDropdown.classList.add('hidden');
      openConnectDomain(el.dataset.domain);
    });
  });

  list.querySelectorAll('[data-open-logs]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const site = sites.find(s => s.id === btn.dataset.openLogs);
      notifDropdownOpen = false;
      notifDropdown.classList.add('hidden');
      if (site) openLogs(site);
    });
  });

  list.querySelectorAll('[data-restart-site]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      notifDropdownOpen = false;
      notifDropdown.classList.add('hidden');
      await siteAction(btn.dataset.restartSite, 'start');
    });
  });

  // Pinned update notification click — open update modal
  const updateItem = document.getElementById('notif-update-item');
  if (updateItem) {
    updateItem.addEventListener('click', () => {
      notifDropdownOpen = false;
      notifDropdown.classList.add('hidden');
      openModal('modal-update');
      startUpdateFlow();
    });
  }

  // Regular notifications — mark as read on click
  list.querySelectorAll('.notif-item:not(#notif-update-item)').forEach(item => {
    item.addEventListener('click', async () => {
      if (!item.classList.contains('notif-unread')) return;
      await api('POST', `/notifications/${item.dataset.notifId}/read`).catch(() => {});
      item.classList.remove('notif-unread');
      loadNotifications();
    });
  });
}

document.getElementById('btn-notif-read-all').addEventListener('click', async () => {
  await api('POST', '/notifications/read-all').catch(() => {});
  loadNotifications();
});

// ── Connect domain modal ──────────────────────────────────
function openConnectDomain(domain) {
  connectDomain = domain;
  document.getElementById('connect-domain-name').textContent = domain;
  const siteList = document.getElementById('connect-site-list');
  if (!sites.length) {
    siteList.innerHTML = '<p style="color:var(--tx3)">No sites yet — create one below.</p>';
  } else {
    siteList.innerHTML = sites.map(s => `
      <div class="connect-site-row">
        <span class="connect-site-name">${esc(s.name)}</span>
        <span class="connect-site-domain">${esc(s.domain)}</span>
        <button class="btn btn-sm btn-accent-outline" data-assign-site="${s.id}">Assign…</button>
      </div>`).join('');
    siteList.querySelectorAll('[data-assign-site]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const site = sites.find(s => s.id === btn.dataset.assignSite);
        if (!site) return;
        if (!confirm(`Change domain of "${site.name}" from "${site.domain}" to "${connectDomain}"?`)) return;
        try {
          await api('PUT', `/sites/${site.id}`, { name: site.name, domain: connectDomain });
          closeModal('modal-connect-domain');
          toast(`Domain assigned to "${site.name}"`, 'success');
          await loadSites();
        } catch (err) {
          toast(err.message, 'error');
        }
      });
    });
  }
  openModal('modal-connect-domain');
}

document.getElementById('btn-connect-create').addEventListener('click', () => {
  closeModal('modal-connect-domain');
  document.getElementById('form-new-site').reset();
  setNewSiteRuntime('static');
  const domainInput = document.querySelector('#form-new-site input[name="domain"]');
  if (domainInput) domainInput.value = connectDomain;
  const nameInput = document.querySelector('#form-new-site input[name="name"]');
  if (nameInput) nameInput.value = connectDomain.split('.')[0];
  validateNewSiteDomain();
  openModal('modal-new-site');
});

// ── Preview modal ─────────────────────────────────────────
function openPreviewModal(site) {
  activeSiteId = site.id;
  const previewInput = document.querySelector('#form-create-preview input[name="preview_domain"]');
  if (previewInput) {
    const parts = site.domain.split('.');
    parts[0] = 'preview';
    const suggested = parts.join('.');
    previewInput.value = suggested !== site.domain ? suggested : `preview.${site.domain}`;
  }
  openModal('modal-preview');
}

document.getElementById('form-create-preview').addEventListener('submit', async e => {
  e.preventDefault();
  const domain = e.target.elements['preview_domain'].value.trim().toLowerCase();
  if (!domain) return;
  const btn = e.target.querySelector('[type="submit"]');
  btn.disabled = true;
  try {
    await api('POST', `/sites/${activeSiteId}/preview`, { preview_domain: domain });
    closeModal('modal-preview');
    toast('Preview container created', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

async function previewSwap(site) {
  if (!confirm(`Swap preview live for "${site.name}"? The preview content becomes the live site. Current live content moves to preview.`)) return;
  try {
    await api('POST', `/sites/${site.id}/preview/swap`);
    toast('Preview swapped live', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function previewDiscard(site) {
  const ok = await confirmDialog({
    title: `Discard preview for "${site.name}"?`,
    body: 'The preview container and files will be removed. This cannot be undone.',
    confirmLabel: 'Discard preview',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('DELETE', `/sites/${site.id}/preview`);
    toast('Preview discarded', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Webhooks settings ─────────────────────────────────────
async function loadWebhooks() {
  try {
    const webhooks = await api('GET', '/settings/webhooks');
    renderWebhookList(webhooks);
  } catch (err) { toast(err.message, 'error'); }
}

function renderWebhookList(webhooks) {
  const list = document.getElementById('webhooks-list');
  if (!webhooks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.zap}</div>
        <h3>No webhooks yet.</h3>
        <p>Notify chat tools or CI when deploys and outages happen.</p>
      </div>`;
    return;
  }
  list.innerHTML = `
    <table class="data-table">
      <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Enabled</th><th></th></tr></thead>
      <tbody>
        ${webhooks.map(w => {
          let events = [];
          try { events = JSON.parse(w.events || '[]'); } catch {}
          return `
          <tr>
            <td>${esc(w.name)}</td>
            <td class="cell-mono" style="max-width:220px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(w.url)}</td>
            <td>${events.map(ev => `<span class="badge badge-neutral">${esc(ev)}</span>`).join(' ')}</td>
            <td>
              <label class="g-toggle" title="${w.enabled ? 'Enabled' : 'Disabled'}">
                <input type="checkbox" class="webhook-toggle" data-id="${w.id}" ${w.enabled ? 'checked' : ''} />
                <span class="g-toggle-track"></span>
              </label>
            </td>
            <td>
              <div style="display:flex;gap:6px;justify-content:flex-end">
                <button class="btn btn-sm" data-test-webhook="${w.id}">Test</button>
                <button class="btn btn-sm btn-icon-only btn-danger" data-delete-webhook="${w.id}" title="Delete">${ICON.trash}</button>
              </div>
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  list.querySelectorAll('.webhook-toggle').forEach(input => {
    input.addEventListener('change', async () => {
      await api('PATCH', `/settings/webhooks/${input.dataset.id}`, { enabled: input.checked })
        .catch(err => toast(err.message, 'error'));
    });
  });

  list.querySelectorAll('[data-test-webhook]').forEach(btn => {
    btn.addEventListener('click', async () => {
      btn.disabled = true; btn.textContent = 'Sending…';
      try {
        await api('POST', `/settings/webhooks/${btn.dataset.testWebhook}/test`);
        toast('Test sent', 'success');
      } catch (err) { toast(err.message, 'error'); }
      btn.disabled = false; btn.textContent = 'Test';
    });
  });

  list.querySelectorAll('[data-delete-webhook]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Delete this webhook?',
        body: 'It will stop receiving deploy and status events immediately.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      await api('DELETE', `/settings/webhooks/${btn.dataset.deleteWebhook}`)
        .catch(err => toast(err.message, 'error'));
      loadWebhooks();
    });
  });
}

document.getElementById('form-create-webhook').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('POST', '/settings/webhooks', {
      name: fd.get('webhook_name'),
      url: fd.get('webhook_url'),
      events: ['deploy', 'rollback', 'site_down', 'site_up'],
    });
    e.target.reset();
    toast('Webhook created', 'success');
    loadWebhooks();
  } catch (err) { toast(err.message, 'error'); }
});

// ── Analytics snippet ─────────────────────────────────────
document.getElementById('form-analytics-snippet').addEventListener('submit', async e => {
  e.preventDefault();
  const snippet = e.target.elements['analytics_snippet'].value;
  try {
    await api('PUT', '/settings', { analytics_snippet: snippet });
    toast('Analytics snippet saved — redeploy sites to apply', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Role-aware UI ─────────────────────────────────────────
function applyRoleUI() {
  const { role, username } = currentUser;

  // Sidebar user info
  const usernameEl = document.getElementById('sidebar-username');
  const roleBadge = document.getElementById('sidebar-role-badge');
  const avatarEl = document.getElementById('sidebar-avatar');
  if (usernameEl) usernameEl.textContent = username;
  if (roleBadge) { roleBadge.textContent = role; roleBadge.dataset.role = role; }
  if (avatarEl) avatarEl.textContent = (username || '?').slice(0, 2).toUpperCase();

  // Hide admin-only elements for non-admins
  if (role !== 'admin') {
    document.querySelectorAll('.admin-only, .nav-admin, .nav-section-admin').forEach(el => el.classList.add('hidden'));
    const btnNew = document.getElementById('btn-new-site');
    if (btnNew) btnNew.classList.add('hidden');
  }
  // Hide editor+ elements for viewers. Viewer keeps a single ungrouped
  // nav group, so its "Monitor" section label is dropped too — never
  // show a lone group label (canvas 7a).
  if (role === 'viewer') {
    document.querySelectorAll('.nav-editor, .nav-section-editor').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.nav-section-monitor').forEach(el => el.classList.add('hidden'));
  }
}

// ── Runtime selector in new site modal ───────────────────
function setNewSiteRuntime(runtime) {
  const isApp = runtime === 'node' || runtime === 'python';
  const isPhp = runtime === 'php';
  document.getElementById('new-site-runtime').value = runtime;
  document.querySelectorAll('#new-site-runtime-seg button').forEach(b => {
    b.classList.toggle('is-active', b.dataset.runtime === runtime);
  });
  document.getElementById('new-site-static-opts').classList.toggle('hidden', isApp || isPhp);
  document.getElementById('new-site-app-opts').classList.toggle('hidden', !isApp);
}

document.getElementById('new-site-runtime-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-runtime]');
  if (!btn) return;
  setNewSiteRuntime(btn.dataset.runtime);
});

// ── Runtime selector in site settings ────────────────────
function setSettingsRuntime(runtime) {
  const isApp = runtime === 'node' || runtime === 'python';
  document.getElementById('settings-runtime').value = runtime;
  document.querySelectorAll('#settings-runtime-seg button').forEach(b => {
    b.classList.toggle('is-active', b.dataset.runtime === runtime);
  });
  document.getElementById('app-config-fields').classList.toggle('hidden', !isApp);
}

document.getElementById('settings-runtime-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-runtime]');
  if (!btn) return;
  setSettingsRuntime(btn.dataset.runtime);
});

// ── App Config tab: env vars ──────────────────────────────
function renderEnvVarList(envVars) {
  const list = document.getElementById('env-vars-list');
  const entries = Object.entries(envVars);
  if (!entries.length) {
    list.innerHTML = '<p class="settings-desc" style="margin-bottom:8px">No variables yet.</p>';
    return;
  }
  list.innerHTML = entries.map(([k, v], i) => `
    <div class="env-var-row">
      <input class="g-input" type="text" placeholder="KEY" value="${esc(k)}" data-env-key data-idx="${i}" />
      <input class="g-input" type="text" placeholder="Value" value="${esc(v)}" data-env-val data-idx="${i}" />
      <button class="btn btn-sm btn-icon-only btn-danger" data-remove-env="${i}" title="Remove">${ICON.x}</button>
    </div>`).join('');
  list.querySelectorAll('[data-remove-env]').forEach(btn => {
    btn.addEventListener('click', () => {
      const newVars = collectEnvVars();
      const keys = Object.keys(newVars);
      delete newVars[keys[Number(btn.dataset.removeEnv)]];
      renderEnvVarList(newVars);
    });
  });
}

function collectEnvVars() {
  const rows = document.getElementById('env-vars-list').querySelectorAll('.env-var-row');
  const result = {};
  rows.forEach(row => {
    const k = row.querySelector('[data-env-key]').value.trim();
    const v = row.querySelector('[data-env-val]').value;
    if (k) result[k] = v;
  });
  return result;
}

document.getElementById('btn-add-env-var').addEventListener('click', () => {
  const vars = collectEnvVars();
  vars[''] = '';
  renderEnvVarList(vars);
  // Focus the last key input
  const rows = document.getElementById('env-vars-list').querySelectorAll('[data-env-key]');
  if (rows.length) rows[rows.length - 1].focus();
});

// ── App Config tab population (called from openSettings) ─
function populateAppConfigTab(site) {
  const runtime = site.runtime || 'static';
  setSettingsRuntime(runtime);
  const form = document.getElementById('form-settings');
  if (form.elements['build_cmd']) form.elements['build_cmd'].value = site.build_cmd || '';
  if (form.elements['start_cmd']) form.elements['start_cmd'].value = site.start_cmd || '';
  if (form.elements['app_port']) form.elements['app_port'].value = site.app_port || 3000;
  const descMap = {
    static: 'Static files served by nginx. Upload a .zip to deploy.',
    php: 'PHP files served by Apache. Upload a .zip with your PHP app.',
    node: 'Node.js app. Upload your source .zip — the build command runs on each deploy.',
    python: 'Python app. Upload your source .zip — the build command runs on each deploy.',
  };
  const appDesc = document.getElementById('app-config-desc');
  if (appDesc) appDesc.textContent = descMap[runtime] || '';
  let envVars = {};
  try { envVars = JSON.parse(site.env_vars || '{}'); } catch {}
  renderEnvVarList(envVars);
}

// ── Users management ──────────────────────────────────────
async function loadUsers() {
  try {
    const users = await api('GET', '/users');
    renderUserList(users);
  } catch (err) { toast(err.message, 'error'); }
}

function renderUserList(users) {
  const list = document.getElementById('users-list');
  if (!users.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.user}</div>
        <h3>No users yet.</h3>
        <p>Create one below to grant access.</p>
      </div>`;
    return;
  }
  list.innerHTML = `
    <table class="data-table">
      <thead><tr><th>User</th><th>Role</th><th>Site access</th><th></th></tr></thead>
      <tbody>
        ${users.map(u => {
          const isSelf = u.id === currentUser.id;
          const initials = (u.username || '?').slice(0, 2).toUpperCase();
          return `
          <tr>
            <td>
              <div class="table-user">
                <span class="table-avatar">${esc(initials)}</span>
                <span>${esc(u.username)}</span>
                ${isSelf ? '<span class="badge badge-neutral">YOU</span>' : ''}
              </div>
            </td>
            <td><span class="badge badge-role-${esc(u.role)}">${esc(u.role)}</span></td>
            <td>${renderUserSites(u)}</td>
            <td>
              ${!isSelf ? `
                <div style="display:flex;gap:6px;justify-content:flex-end">
                  <button class="btn btn-sm" data-edit-user="${u.id}" data-username="${esc(u.username)}" data-role="${u.role}">Edit</button>
                  <button class="btn btn-sm btn-danger" data-delete-user="${u.id}" data-username="${esc(u.username)}">Delete…</button>
                </div>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  list.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: `Delete user "${btn.dataset.username}"?`,
        body: 'They will immediately lose access to this panel. This cannot be undone.',
        confirmLabel: 'Delete',
        danger: true,
      });
      if (!ok) return;
      await api('DELETE', `/users/${btn.dataset.deleteUser}`).catch(err => toast(err.message, 'error'));
      loadUsers();
    });
  });

  list.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => openEditUser(btn.dataset.editUser, btn.dataset.username, btn.dataset.role));
  });
}

function renderUserSites(u) {
  if (u.role === 'admin' || u.sites === 'all') return '<span class="badge badge-accent">All sites</span>';
  if (!u.sites?.length) return '<span style="color:var(--tx3)">None</span>';
  const chips = u.sites.map(sid => {
    const s = sites.find(x => x.id === sid);
    return s ? `<span class="badge badge-neutral">${esc(s.name)}</span>` : '';
  }).filter(Boolean).join('');
  return `<div class="chip-wrap">${chips}</div>`;
}

function setEditUserRole(role) {
  document.querySelectorAll('#edit-user-role-list input[name="role"]').forEach(input => {
    input.checked = input.value === role;
    input.closest('.role-select-opt').classList.toggle('is-active', input.value === role);
  });
  document.getElementById('edit-user-sites-wrap').classList.toggle('hidden', role === 'admin');
}

async function openEditUser(userId, username, role) {
  document.getElementById('edit-user-id').value = userId;
  document.getElementById('edit-user-name').textContent = username;
  setEditUserRole(role);

  // Load current site assignments for this user
  const [siteData] = await Promise.all([
    api('GET', `/users/${userId}/sites`).catch(() => ({ all: false, sites: [] })),
  ]);

  renderEditUserSites(siteData);
  openModal('modal-edit-user');
}

// Role change hides/shows site list (delegated — radios are re-rendered per open)
document.getElementById('edit-user-role-list').addEventListener('change', e => {
  const input = e.target.closest('input[name="role"]');
  if (!input) return;
  setEditUserRole(input.value);
});

function renderEditUserSites(siteData) {
  const wrap = document.getElementById('edit-user-sites-list');
  if (!sites.length) {
    wrap.innerHTML = '<p class="settings-desc">No sites created yet.</p>';
    return;
  }
  wrap.innerHTML = sites.map(s => `
    <label class="g-checkbox" style="display:flex;margin-bottom:8px">
      <input type="checkbox" name="site_access" value="${s.id}"
        ${siteData.all || (siteData.sites || []).includes(s.id) ? 'checked' : ''} />
      <span class="g-checkbox-box"></span>
      ${esc(s.name)} <span class="field-help muted" style="display:inline">${esc(s.domain)}</span>
    </label>
  `).join('');
}

document.getElementById('form-edit-user').addEventListener('submit', async e => {
  e.preventDefault();
  const userId = document.getElementById('edit-user-id').value;
  const newRole = document.querySelector('#edit-user-role-list input[name="role"]:checked')?.value;

  try {
    await api('PATCH', `/users/${userId}`, { role: newRole });

    // Update site assignments only for non-admin users
    if (newRole !== 'admin') {
      const checked = [...document.querySelectorAll('#edit-user-sites-list input[type=checkbox]:checked')];
      const site_ids = checked.map(cb => cb.value);
      await api('PUT', `/users/${userId}/sites`, { site_ids });
    }

    closeModal('modal-edit-user');
    toast('User updated', 'success');
    loadUsers();
  } catch (err) {
    toast(err.message, 'error');
  }
});

document.getElementById('form-create-user').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  try {
    await api('POST', '/users', {
      username: fd.get('username').trim(),
      password: fd.get('password'),
      role: fd.get('role'),
    });
    e.target.reset();
    toast('User created', 'success');
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
});

// ── Extend settings ptab to load users ───────────────────
document.querySelectorAll('#view-panel-settings .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.stab === 'users') loadUsers();
  });
});

// ── Notification settings ─────────────────────────────────
async function loadNotifSettings() {
  try {
    const s = await api('GET', '/settings');
    const events = s.notification_events
      ? JSON.parse(s.notification_events)
      : ['unknown_domain', 'site_down', 'site_up'];
    const form = document.getElementById('form-notif-settings');
    form.elements['notif_unknown_domain'].checked = events.includes('unknown_domain');
    form.elements['notif_site_down'].checked      = events.includes('site_down');
    form.elements['notif_site_up'].checked        = events.includes('site_up');
  } catch {}
}

document.getElementById('form-notif-settings').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const events = [];
  if (form.elements['notif_unknown_domain'].checked) events.push('unknown_domain');
  if (form.elements['notif_site_down'].checked)      events.push('site_down');
  if (form.elements['notif_site_up'].checked)        events.push('site_up');
  try {
    await api('POST', '/settings', { notification_events: JSON.stringify(events) });
    toast('Notification settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

async function loadNotifUnreadSummary() {
  const el = document.getElementById('notif-unread-summary');
  if (!el) return;
  try {
    const { unread } = await api('GET', '/notifications');
    el.textContent = `${unread} unread notification${unread === 1 ? '' : 's'}`;
  } catch {
    el.textContent = '— unread notifications';
  }
}

document.getElementById('btn-notif-clear-all').addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Delete all notifications?',
    body: 'This clears the entire notification feed. This cannot be undone.',
    confirmLabel: 'Clear all',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('DELETE', '/notifications');
    loadNotifications();
    loadNotifUnreadSummary();
    toast('All notifications cleared', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Deployments view ──────────────────────────────────────
let allDeployments = [];

async function loadDeployments() {
  document.getElementById('deployments-loading').classList.remove('hidden');
  document.getElementById('deployments-table-wrap').classList.add('hidden');
  try {
    allDeployments = await api('GET', '/deploy');
    // Populate site filter
    const siteIds = [...new Set(allDeployments.map(d => d.site_id))];
    const filter = document.getElementById('deployments-filter');
    const current = filter.value;
    filter.innerHTML = '<option value="">All sites</option>' +
      siteIds.map(id => {
        const d = allDeployments.find(x => x.site_id === id);
        return `<option value="${esc(id)}"${current === id ? ' selected' : ''}>${esc(d.site_name)}</option>`;
      }).join('');
    const subtitle = document.getElementById('deployments-subtitle');
    if (subtitle) subtitle.textContent = `${allDeployments.length} deploy${allDeployments.length !== 1 ? 's' : ''} total`;
    renderDeployments();
  } catch {
    document.getElementById('deployments-loading').textContent = 'Failed to load deployments.';
  }
}

function renderDeployments() {
  const filterVal = document.getElementById('deployments-filter').value;
  const rows = filterVal ? allDeployments.filter(d => d.site_id === filterVal) : allDeployments;
  const isAdmin = currentUser.role === 'admin';

  // allDeployments is ordered newest-first per site (server: ORDER BY deployed_at DESC),
  // so the first row seen for a given site_id is that site's current live deploy.
  const seenSites = new Set();

  document.getElementById('deployments-tbody').innerHTML = rows.length === 0
    ? `<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:24px">No deployments yet</td></tr>`
    : rows.map(d => {
      const isCurrent = !seenSites.has(d.site_id);
      seenSites.add(d.site_id);
      return `
    <tr>
      <td>
        <span style="font-weight:600;color:var(--tx)">${esc(d.site_name)}</span>
        <span style="display:block;font-size:11px;color:var(--tx3)">${esc(d.site_domain)}</span>
      </td>
      <td class="cell-mono">${esc(d.filename)}</td>
      <td class="num">${fmtBytes(d.size)}</td>
      <td>${timeAgo(d.deployed_at)} ${isCurrent ? '<span class="badge badge-ok">CURRENT</span>' : ''}</td>
      <td>${isAdmin && !isCurrent ? `<button class="btn btn-sm btn-secondary" data-rollback-site="${esc(d.site_id)}" data-rollback-id="${esc(d.id)}">Roll back…</button>` : ''}</td>
    </tr>`;
    }).join('');

  document.querySelectorAll('[data-rollback-site]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'Roll back to this deployment?',
        body: 'Current files will be replaced with this deployment’s files. This cannot be undone.',
        confirmLabel: 'Roll back',
        danger: true,
      });
      if (!ok) return;
      try {
        await api('POST', `/deploy/${btn.dataset.rollbackSite}/rollback/${btn.dataset.rollbackId}`);
        toast('Rolled back successfully', 'success');
        loadDeployments();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  document.getElementById('deployments-loading').classList.add('hidden');
  document.getElementById('deployments-table-wrap').classList.remove('hidden');
}

document.getElementById('deployments-filter').addEventListener('change', renderDeployments);

// ── Logs view ─────────────────────────────────────────────
let logsAutoInterval = null;
let logsLineCount = 100;

async function loadLogsView() {
  // Populate site selector from already-loaded sites list
  const select = document.getElementById('logs-site-select');
  const currentVal = select.value;
  select.innerHTML = '<option value="">Select a site…</option>' +
    sites.map(s => `<option value="${esc(s.id)}"${s.id === currentVal ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
  if (currentVal) fetchLogs(currentVal);
}

async function fetchLogs(siteId) {
  const out = document.getElementById('logs-output');
  if (!siteId) {
    clearInterval(logsAutoInterval);
    out.textContent = 'Select a site to view logs.';
    return;
  }
  out.textContent = 'Loading…';
  try {
    const res = await fetch(`/api/sites/${siteId}/logs?lines=${logsLineCount}`);
    const text = await res.text();
    if (!res.ok) {
      try { out.textContent = `Error: ${JSON.parse(text).error}`; } catch { out.textContent = text; }
      return;
    }
    const site = sites.find(s => s.id === siteId);
    const containerRunning = site?.container?.running;
    out.textContent = text || '(no output)';
    if (containerRunning === false) {
      out.textContent += '\n\n— end of stream · container is not running —';
    }
    out.scrollTop = out.scrollHeight;
  } catch { out.textContent = 'Failed to fetch logs.'; }
}

document.getElementById('logs-site-select').addEventListener('change', e => fetchLogs(e.target.value));
document.getElementById('btn-logs-refresh').addEventListener('click', () => fetchLogs(document.getElementById('logs-site-select').value));

document.querySelectorAll('#logs-lines-seg button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#logs-lines-seg button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    logsLineCount = Number(btn.dataset.lines);
    fetchLogs(document.getElementById('logs-site-select').value);
  });
});

document.getElementById('logs-auto-refresh').addEventListener('click', e => {
  const btn = e.currentTarget;
  const active = btn.dataset.active !== 'true';
  btn.dataset.active = String(active);
  btn.classList.toggle('is-active', active);
  btn.setAttribute('aria-pressed', String(active));
  clearInterval(logsAutoInterval);
  if (active) {
    logsAutoInterval = setInterval(() => fetchLogs(document.getElementById('logs-site-select').value), 3000);
  }
});

// ── Domains view ──────────────────────────────────────────
async function loadDomains() {
  document.getElementById('domains-loading').classList.remove('hidden');
  document.getElementById('domains-table-wrap').classList.add('hidden');
  try {
    const data = await api('GET', '/sites');
    const wildcard = config.siteBaseDomain ? ` · wildcard *.${esc(config.siteBaseDomain)} active` : '';
    document.getElementById('domains-count').textContent =
      `${data.length} domain${data.length !== 1 ? 's' : ''}${wildcard}`;

    const containerStatus = s => {
      if (s?.running) return '<span class="status status-running"><span class="status-glyph">●</span>Running</span>';
      if (!s || s.status === 'none') return '<span class="status status-no-container"><span class="status-glyph">●</span>No container</span>';
      if (s.status === 'restarting') return '<span class="status status-restarting"><span class="status-glyph">●</span>Restarting</span>';
      if (s.status === 'paused') return '<span class="status status-paused"><span class="status-glyph">●</span>Paused</span>';
      return '<span class="status status-stopped"><span class="status-glyph">●</span>Exited</span>';
    };

    document.getElementById('domains-tbody').innerHTML = data.length === 0
      ? `<tr><td colspan="5" style="text-align:center;color:var(--tx3);padding:24px">No sites yet</td></tr>`
      : data.map(s => `
      <tr>
        <td><a href="http://${esc(s.domain)}" target="_blank" rel="noopener" style="color:var(--tx);text-decoration:none">${esc(s.domain)} ↗</a></td>
        <td style="color:var(--tx2)">${esc(s.name)}</td>
        <td><span class="badge badge-runtime">${esc((s.runtime || 'static').toUpperCase())}</span></td>
        <td>${s.ssl_enabled ? '<span class="status status-ssl-active"><span class="status-glyph">●</span>On</span>' : '<span class="status status-muted"><span class="status-glyph">●</span>Off</span>'}</td>
        <td>${containerStatus(s.container)}</td>
      </tr>`).join('');

    document.getElementById('domains-loading').classList.add('hidden');
    document.getElementById('domains-table-wrap').classList.remove('hidden');
  } catch {
    document.getElementById('domains-loading').textContent = 'Failed to load domains.';
  }
}

// ── Overview ──────────────────────────────────────────────
let overviewPeriod = '24h';
let overviewData = null;
let overviewSort = 'requests';
let overviewSortDir = 'desc';
let overviewRefreshedAt = null;
let overviewRefreshedTimer = null;

async function loadOverview() {
  document.getElementById('overview-loading').classList.remove('hidden');
  document.getElementById('overview-table-wrap').classList.add('hidden');
  try {
    overviewData = await api('GET', `/analytics/overview?period=${overviewPeriod}`);
    overviewRefreshedAt = Date.now();
    renderOverview();
    tickOverviewRefreshed();
  } catch (err) {
    document.getElementById('overview-loading').textContent = 'Failed to load overview.';
  }
}

function tickOverviewRefreshed() {
  clearInterval(overviewRefreshedTimer);
  const el = document.getElementById('overview-refreshed');
  const update = () => {
    if (!el || !overviewRefreshedAt) return;
    const secs = Math.max(0, Math.round((Date.now() - overviewRefreshedAt) / 1000));
    el.textContent = secs < 1 ? 'refreshed just now' : `refreshed ${secs}s ago`;
  };
  update();
  overviewRefreshedTimer = setInterval(update, 1000);
}

const PERIOD_DAYS = { '24h': 1, '7d': 7, '30d': 30 };

function renderOverview() {
  if (!overviewData) return;
  const { sites, grand } = overviewData;
  const total = sites.length;

  // Grand totals
  document.getElementById('ov-requests').textContent = fmtNum(grand.requests);
  document.getElementById('ov-requests-sub').textContent = `over last ${overviewPeriod}`;

  document.getElementById('ov-bytes').textContent = fmtBytes(grand.bytes);
  const perDay = grand.bytes / (PERIOD_DAYS[overviewPeriod] || 1);
  document.getElementById('ov-bytes-sub').textContent = `${fmtBytes(perDay)}/day avg`;

  document.getElementById('ov-errors').textContent = fmtNum(grand.server_err);
  const errPct = grand.requests > 0 ? ((grand.server_err / grand.requests) * 100).toFixed(2) : '0.00';
  document.getElementById('ov-errors-sub').textContent = `${errPct}% of requests`;

  document.getElementById('ov-sites-up').textContent = `${grand.sitesUp} / ${total}`;

  document.getElementById('ov-sites-down').textContent = grand.sitesDown;
  const downNames = sites.filter(s => s.currentStatus === 'down').map(s => s.name);
  document.getElementById('ov-sites-down-sub').textContent = downNames.length ? downNames.join(', ') : 'none';

  // Sort
  const dir = overviewSortDir === 'asc' ? 1 : -1;
  const sorted = [...sites].sort((a, b) => {
    if (overviewSort === 'requests') return dir * (a.requests - b.requests);
    if (overviewSort === 'bytes')    return dir * (a.bytes - b.bytes);
    if (overviewSort === 'uptime')   return dir * ((parseFloat(a.uptime) || 0) - (parseFloat(b.uptime) || 0));
    if (overviewSort === 'latency')  return dir * ((a.avgLatency ?? 99999) - (b.avgLatency ?? 99999));
    if (overviewSort === 'name')     return dir * a.name.localeCompare(b.name);
    return 0;
  });

  const statusBadge = s =>
    s === 'up'   ? '<span class="status status-ok"><span class="status-glyph">●</span>Up</span>' :
    s === 'down' ? '<span class="status status-err"><span class="status-glyph">●</span>Down</span>' :
                   '<span class="status status-muted"><span class="status-glyph">●</span>Unknown</span>';

  const pctClass = u =>
    u === null ? '' : parseFloat(u) >= 99 ? 'pct-ok' : parseFloat(u) >= 95 ? 'pct-warn' : 'pct-err';

  document.getElementById('overview-tbody').innerHTML = sorted.map(s => `
    <tr class="ov-row is-clickable" data-id="${esc(s.id)}">
      <td>
        <div class="ov-site-cell">
          <span class="ov-site-name">${esc(s.name)}</span>
          <span class="ov-site-domain">${esc(s.domain)}</span>
        </div>
      </td>
      <td class="num">${fmtNum(s.requests)}</td>
      <td class="num">${fmtBytes(s.bytes)}</td>
      <td class="num">${fmtNum(s.ok)}</td>
      <td class="num">${fmtNum(s.redirects)}</td>
      <td class="num cell-emph ${s.client_err > 0 ? 'warn' : ''}">${fmtNum(s.client_err)}</td>
      <td class="num cell-emph ${s.server_err > 0 ? 'err' : ''}">${fmtNum(s.server_err)}</td>
      <td class="num ${pctClass(s.uptime)}">${s.uptime !== null ? s.uptime + '%' : '—'}</td>
      <td class="num">${s.avgLatency !== null ? s.avgLatency + ' ms' : '—'}</td>
      <td>${statusBadge(s.currentStatus)}</td>
    </tr>
  `).join('');

  document.getElementById('overview-loading').classList.add('hidden');
  document.getElementById('overview-table-wrap').classList.remove('hidden');

  // Click row → open site analytics
  document.querySelectorAll('.ov-row').forEach(row => {
    row.addEventListener('click', () => {
      const site = sites.find(s => s.id === row.dataset.id);
      if (site) openAnalytics(site);
    });
  });
}

document.querySelectorAll('#overview-period-btns button').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#overview-period-btns button').forEach(b => b.classList.remove('is-active'));
    btn.classList.add('is-active');
    overviewPeriod = btn.dataset.period;
    loadOverview();
  });
});

document.querySelectorAll('#overview-table th.sortable').forEach(th => {
  th.addEventListener('click', () => {
    const key = th.dataset.sort;
    if (overviewSort === key) {
      overviewSortDir = overviewSortDir === 'asc' ? 'desc' : 'asc';
    } else {
      overviewSort = key;
      overviewSortDir = key === 'name' ? 'asc' : 'desc';
    }
    document.querySelectorAll('#overview-table th.sortable').forEach(h => h.removeAttribute('data-dir'));
    th.setAttribute('data-dir', overviewSortDir);
    renderOverview();
  });
});

// ── Update checker ────────────────────────────────────────
let _updateCheckInFlight = null;
async function checkForUpdate() {
  if (_updateCheckInFlight) return _updateCheckInFlight;
  _updateCheckInFlight = api('GET', '/update/check')
    .then(data => {
      const wasAvailable = cachedUpdateData?.updateAvailable;
      cachedUpdateData = data;
      if (data.updateAvailable && currentUser.role === 'admin') {
        document.getElementById('update-version').textContent = `v${data.latest} available`;
        document.getElementById('update-banner').classList.remove('hidden');
        // Refresh notification bell to show pinned update item
        if (!wasAvailable) loadNotifications();
      }
      renderSettingsUpdateInfo(data);
      return data;
    })
    .catch(() => null)
    .finally(() => { _updateCheckInFlight = null; });
  return _updateCheckInFlight;
}

function renderSettingsUpdateInfo(data) {
  const elCurrent = document.getElementById('settings-version-current');
  const elLatest  = document.getElementById('settings-version-latest');
  const elMsg     = document.getElementById('settings-update-msg');
  const btnUpdate = document.getElementById('btn-settings-do-update');
  const elNotes   = document.getElementById('settings-release-notes');
  if (!elCurrent) return;
  elCurrent.textContent = `v${data.current}`;
  elLatest.textContent  = `v${data.latest}`;
  elLatest.className    = `update-version-pill${data.updateAvailable ? ' update-version-pill--new' : ''}`;
  if (data.updateAvailable) {
    elMsg.textContent = `v${data.latest} is available.`;
    if (currentUser.role === 'admin') btnUpdate.classList.remove('hidden');
    if (elNotes && data.releaseNotes) {
      elNotes.innerHTML = renderMarkdown(data.releaseNotes);
      elNotes.classList.remove('hidden');
    }
  } else {
    elMsg.textContent = 'You are on the latest version.';
    btnUpdate.classList.add('hidden');
    if (elNotes) elNotes.classList.add('hidden');
  }
}

// Minimal markdown renderer: bold, code, list items, headings → plain HTML
function renderMarkdown(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^#{1,3} (.+)$/gm, '<strong>$1</strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
    .replace(/\n{2,}/g, '<br>')
    .replace(/\n/g, ' ');
}

document.getElementById('btn-settings-check-update').addEventListener('click', async () => {
  const btn = document.getElementById('btn-settings-check-update');
  btn.disabled = true;
  btn.textContent = 'Checking…';
  try {
    // Bust the server-side cache by fetching directly (cache is 1h, this is a manual action)
    const data = await api('GET', '/update/check?force=1');
    renderSettingsUpdateInfo(data);
  } catch { document.getElementById('settings-update-msg').textContent = 'Could not reach GitHub.'; }
  btn.disabled = false;
  btn.textContent = 'Check now';
});

document.getElementById('btn-settings-do-update').addEventListener('click', () => {
  openModal('modal-update');
  startUpdateFlow();
});

document.getElementById('btn-update-now').addEventListener('click', () => {
  document.getElementById('update-banner').classList.add('hidden');
  openModal('modal-update');
  startUpdateFlow();
});

async function startUpdateFlow() {
  // Show release notes + target version in modal if available
  try {
    const data = await api('GET', '/update/check');
    const titleEl = document.getElementById('update-modal-title');
    if (titleEl && data.latest) titleEl.textContent = `Updating to ${data.latest}`;
    const detailEl = document.getElementById('update-pull-detail');
    if (detailEl && data.latest) detailEl.textContent = `— grimport:${data.latest}`;
    const el = document.getElementById('update-modal-release-notes');
    if (el && data.releaseNotes) {
      el.innerHTML = renderMarkdown(data.releaseNotes);
      el.classList.remove('hidden');
    }
  } catch {}
  // Fire-and-forget: start the update
  await api('POST', '/update/apply').catch(() => {});
  pollUpdateStatus();
}

function setUpdateStep(activeStatus) {
  const stepOrder = ['pulling', 'applying', 'restarting', 'done'];
  const activeIdx = stepOrder.indexOf(activeStatus);
  stepOrder.forEach((s, i) => {
    const iconEl = document.getElementById(`ustep-${s}-icon`);
    const stepEl = document.getElementById(`ustep-${s}`);
    if (!iconEl) return;
    if (i < activeIdx) { iconEl.innerHTML = ICON.check; stepEl.className = 'step done'; }
    else if (i === activeIdx) { iconEl.innerHTML = ICON.rotateCw; stepEl.className = 'step active'; }
    else { iconEl.innerHTML = ICON.circle; stepEl.className = 'step'; }
  });
  // Progress bar: each step is worth 25%, active step animates within its slice
  const bar = document.getElementById('update-progressbar');
  if (!bar) return;
  const pct = activeStatus === 'done'
    ? 100
    : Math.round((activeIdx / stepOrder.length) * 100) + 10; // +10 so it doesn't start at 0
  bar.style.width = `${Math.min(pct, 95)}%`;
}

async function pollUpdateStatus() {
  let panelWasDown = false;
  let seenNonIdle = false;  // true once we've seen pulling/applying/restarting
  let pollInterval;

  const finish = (health) => {
    clearInterval(pollInterval);
    setUpdateStep('done');
    const doneIcon = document.getElementById('ustep-done-icon');
    if (doneIcon) doneIcon.innerHTML = ICON.check;
    document.getElementById('update-status-msg').textContent = `Updated to v${health?.version || '?'}!`;

    // Show countdown reload box
    const box = document.getElementById('update-reload-box');
    const countdownEl = document.getElementById('update-reload-countdown');
    const bar = document.getElementById('update-countdown-bar');
    const btnReload = document.getElementById('btn-reload-now');
    if (!box) { window.location.reload(); return; }

    box.classList.remove('hidden');
    const TOTAL = 30;
    let remaining = TOTAL;

    const tick = () => {
      remaining--;
      if (countdownEl) countdownEl.textContent = remaining;
      if (bar) bar.style.width = `${(remaining / TOTAL) * 100}%`;
      if (remaining <= 0) { window.location.reload(); }
    };

    if (bar) bar.style.width = '100%';
    const timer = setInterval(tick, 1000);

    if (btnReload) btnReload.addEventListener('click', () => {
      clearInterval(timer);
      window.location.reload();
    });
  };

  const check = async () => {
    try {
      const health = await fetch('/api/health').then(r => r.json()).catch(() => null);

      if (!health) {
        // Panel is down — supervisor is restarting
        panelWasDown = true;
        setUpdateStep('restarting');
        document.getElementById('update-status-msg').textContent = 'Panel restarting… sites are still online.';
        return;
      }

      if (panelWasDown) {
        // Panel came back after being down — definitely done
        finish(health);
        return;
      }

      // Panel is still up — check update status
      const status = await api('GET', '/update/status').catch(() => null);
      if (!status) return;

      if (status.status === 'error') {
        clearInterval(pollInterval);
        document.getElementById('update-status-msg').textContent = `Error: ${status.message}`;
        setUpdateStep('pulling');
        return;
      }

      if (status.status !== 'idle') {
        seenNonIdle = true;
        setUpdateStep(status.status);
        document.getElementById('update-status-msg').textContent = status.message;
      } else if (seenNonIdle) {
        // Was busy, now idle on a fresh process — container swapped without detectable downtime
        finish(health);
      }

    } catch {
      panelWasDown = true;
      setUpdateStep('restarting');
      document.getElementById('update-status-msg').textContent = 'Panel restarting… sites are still online.';
    }
  };

  setUpdateStep('pulling');
  pollInterval = setInterval(check, 1500);
}
