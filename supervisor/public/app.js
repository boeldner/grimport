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
  more:         IC('<circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.5" fill="currentColor" stroke="none"/><circle cx="5" cy="12" r="1.5" fill="currentColor" stroke="none"/>'),
  lock:         IC('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>', 10),
  tool:         IC('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>', 10),
  box:          IC('<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/>'),
  grid:         IC('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  pie:          IC('<path d="M21.21 15.89A10 10 0 1 1 8 2.83"/><path d="M22 12A10 10 0 0 0 12 2v10z"/>'),
  list:         IC('<line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>'),
  question:     IC('<circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 1 1 5.83 1c0 2-3 2.5-3 4"/><line x1="12" y1="17" x2="12.01" y2="17"/>'),
  book:         IC('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  bell:         IC('<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>'),
};
// status dot: an empty span the CSS paints as a 7px circle in currentColor
const GLYPH = '<span class="status-glyph" aria-hidden="true"></span>';

// ── Contextual help links (Phase 3 "learning") ─────────────────────
// helpLink(path) renders a small "question" icon linking into the wiki on
// GitHub. Static markup declares WHERE a link belongs with an empty
// `<span class="help-slot" data-help="Page.md#anchor">`; initHelpLinks()
// (called once below, DOM is already parsed since this script tag sits at
// the end of <body>) swaps every slot for the real link. Kept OUTSIDE any
// .g-toggle label — see .g-toggle-wrap in css/components.css — so a click never also
// toggles the switch it sits beside.
function helpLink(path) {
  return `<a class="help-link" target="_blank" rel="noopener" href="https://github.com/boeldner/grimport/blob/main/docs/wiki/${path}" title="Learn more" aria-label="Learn more">${ICON.question}</a>`;
}
function initHelpLinks() {
  document.querySelectorAll('.help-slot[data-help]').forEach(slot => {
    slot.outerHTML = helpLink(slot.dataset.help);
  });
}
initHelpLinks();

// ── State ─────────────────────────────────────────────────
let sites = [];
let activeSiteId = null;
let selectedDeployFile = null;
let config = { siteBaseDomain: '', sslReady: false, acmeEmail: '' };
let searchQuery = '';
let templatesCache = null;       // GET /templates, fetched once and reused
let newSiteTemplateId = '';      // template chosen in the New site modal ('' = none)
let applyTemplateSiteId = null;  // site targeted by the "Apply template…" modal
let applyTemplateSelectedId = null;
let uptimeData = {}; // siteId → { currentStatus, uptime24h }
let connectDomain = ''; // domain being connected from notification
let currentUser = { role: 'admin', platform_role: 'owner', capabilities: {}, username: '' }; // populated on init
function isPanelAdmin() { return currentUser.platform_role === 'owner' || currentUser.platform_role === 'admin'; }
function canCreateSites() { return ['owner', 'admin', 'member'].includes(currentUser.platform_role); }
// Beginner preset members (capability advanced_ui === false) get a reduced UI —
// site settings show only General + Access, deploy loses the "From URL" tab.
function beginnerMode() { return !isPanelAdmin() && currentUser.capabilities?.advanced_ui === false; }
function advancedRevealed() { try { return localStorage.getItem('grimport-advanced') === '1'; } catch { return false; } }
function debounce(fn, ms) {
  let t = null;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
// token routes: admins manage every token under /settings/tokens, everyone else their own under /tokens
function tokensPath(id) { return (isPanelAdmin() ? '/settings/tokens' : '/tokens') + (id ? `/${id}` : ''); }
let cachedUpdateData = null; // latest update check result

// ── API helpers ───────────────────────────────────────────
async function api(method, path, body) {
  // X-Requested-With satisfies the server's CSRF guard (src/csrf.js) on
  // mutating requests — a plain cross-site <form> post can't set this
  // header, only same-origin JS can. Sent on every call (not just
  // mutating ones) since it's harmless on GET/HEAD too.
  const opts = { method, headers: { 'X-Requested-With': 'grimport' } };
  if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = JSON.stringify(body); }
  let res;
  try {
    res = await fetch('/api' + path, opts);
  } catch (networkErr) {
    // fetch() itself threw — actual connectivity failure (panel restarting,
    // DNS hiccup, etc), as opposed to an HTTP error response below. Same
    // error is rethrown unchanged so every existing caller's catch block
    // behaves exactly as before; we just also feed the panel-restart
    // detector (see "Panel-restart / reconnect banner" section).
    _onApiNetworkFailure();
    throw networkErr;
  }
  _onApiSuccess();
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `HTTP ${res.status}`);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

async function apiUpload(siteId, file, onProgress) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append('file', file);
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `/api/deploy/${siteId}`);
    // Same CSRF header as api() above — multipart uploads never carry a
    // JSON content type, so this is the only thing that satisfies the guard.
    xhr.setRequestHeader('X-Requested-With', 'grimport');
    xhr.upload.onprogress = e => e.lengthComputable && onProgress(e.loaded / e.total, e.loaded, e.total);
    xhr.onload = () => {
      const data = JSON.parse(xhr.responseText || '{}');
      if (xhr.status >= 400) {
        const err = new Error(data.error || `HTTP ${xhr.status}`);
        err.status = xhr.status;
        err.data = data;
        reject(err);
      } else resolve(data);
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
  // errors interrupt (role="alert" ~ assertive live region); info/ok/warn
  // just announce politely once idle (role="status").
  if (type === 'error') {
    el.setAttribute('role', 'alert');
  } else {
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
  }

  const text = document.createElement('span');
  text.textContent = message;
  el.appendChild(text);

  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'toast-dismiss';
  closeBtn.setAttribute('aria-label', 'Dismiss');
  closeBtn.innerHTML = ICON.x;
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

// ── System states: skeletons ───────────────────────────────
// Matches the static skeleton markup already used for the Sites view /
// Overview / Deployments / Domains loading placeholders (phase C1) so any
// view can show/reset the same look before a fetch runs (including on a
// retry after a view-error, which needs to rebuild the skeleton itself
// since the error card overwrote the container's innerHTML).
function skeletonBlock(rows = 3) {
  return `<div class="skeleton-stack">${Array.from({ length: rows }, (_, i) =>
    `<div class="skeleton skeleton-line${i === 0 ? ' is-head' : ''}"></div>`
  ).join('')}</div>`;
}

// Skeleton <tr> rows for table-based views (n rows × cols placeholder cells).
function skeletonRows(n, cols) {
  return Array.from({ length: n }, () =>
    `<tr>${Array.from({ length: cols }, () => `<td><span class="skeleton skeleton-text"></span></td>`).join('')}</tr>`
  ).join('');
}

// ── System states: view-error ──────────────────────────────
// Consistent inline "couldn't load this view" card with a retry button,
// used in place of blank/broken UI in list-style view loaders. `message`
// is the full sentence(s) to show — the first sentence (up to the first
// ". ") is rendered as the bold heading (e.g. "Couldn't load activity."),
// anything after that as supporting body text.
function viewError(container, message, retryFn) {
  const el = typeof container === 'string' ? document.getElementById(container) : container;
  if (!el) return;
  const parts = String(message).split(/\.\s+/).filter(Boolean);
  const heading = (parts.shift() || 'Something went wrong') + '.';
  const body = parts.join('. ');
  el.innerHTML = `
    <div class="callout callout-danger view-error">
      <span class="callout-icon">${ICON.warning}</span>
      <div class="callout-body">
        <p class="callout-title">${esc(heading)}</p>
        ${body ? `<p class="callout-text">${esc(body)}</p>` : ''}
      </div>
      <div class="callout-actions"><button type="button" class="btn btn-sm view-error-retry">Try again</button></div>
    </div>`;
  const btn = el.querySelector('.view-error-retry');
  if (btn && retryFn) btn.addEventListener('click', () => retryFn());
}

// Turns an error (thrown by api()) into the "The API returned 502." /
// "Something went wrong." detail fragment used inside viewError() messages.
function apiErrorDetail(err) {
  const m = err && err.message ? String(err.message) : '';
  const httpMatch = m.match(/^HTTP (\d+)/);
  if (httpMatch) return `The API returned ${httpMatch[1]}.`;
  if (m) return m.endsWith('.') ? m : `${m}.`;
  return 'Something went wrong.';
}

function viewErrorMessage(viewLabel, err) {
  return `Couldn't load ${viewLabel}. ${apiErrorDetail(err)} Your sites keep running — only this view is affected.`;
}

// ── System states: panel-restart banner ────────────────────
// Distinguishes real connectivity loss (fetch() throwing — panel process
// restarting, network blip) from ordinary HTTP error responses, which stay
// on the per-view viewError() path above. Requires 2 consecutive network
// failures (across any api() call) before showing the banner, to avoid
// flashing it on a single blip. Reuses the same /api/health endpoint the
// update flow (pollUpdateStatus, below) already polls to detect the panel
// coming back — while an intentional update is running, _updateFlowActive
// suppresses this banner so the two mechanisms never fight over the UI;
// the update modal's own "Panel restarting…" step covers that case.
const PANEL_RESTART_FAILURE_THRESHOLD = 2;
const PANEL_RESTART_POLL_MS = 2500;
let _networkFailStreak = 0;
let _panelRestartBannerShown = false;
let _panelRestartPollTimer = null;
let _updateFlowActive = false;

function _onApiNetworkFailure() {
  _networkFailStreak++;
  if (_networkFailStreak >= PANEL_RESTART_FAILURE_THRESHOLD && !_panelRestartBannerShown && !_updateFlowActive) {
    showPanelRestartBanner();
  }
}
function _onApiSuccess() {
  _networkFailStreak = 0;
}

function showPanelRestartBanner() {
  _panelRestartBannerShown = true;
  document.getElementById('panel-restart-banner')?.classList.remove('hidden');
  startPanelRestartPolling();
}

function hidePanelRestartBanner() {
  _panelRestartBannerShown = false;
  document.getElementById('panel-restart-banner')?.classList.add('hidden');
  if (_panelRestartPollTimer) { clearInterval(_panelRestartPollTimer); _panelRestartPollTimer = null; }
}

function startPanelRestartPolling() {
  if (_panelRestartPollTimer) return;
  _panelRestartPollTimer = setInterval(async () => {
    try {
      const res = await fetch('/api/health');
      if (res.ok) {
        hidePanelRestartBanner();
        _networkFailStreak = 0;
        refreshActiveView();
      }
    } catch { /* still down — keep polling */ }
  }, PANEL_RESTART_POLL_MS);
}

// Re-runs whichever loader corresponds to the currently visible view, so
// data is fresh once the panel comes back up after a restart.
function refreshActiveView() {
  const view = document.querySelector('.nav-item.active')?.dataset.view;
  if (view === 'overview') loadOverview();
  else if (view === 'activity') loadActivity();
  else if (view === 'deployments') loadDeployments();
  else if (view === 'domains') loadDomains();
  else if (view === 'logs') loadLogsView();
  else if (view === 'panel-settings') loadPanelSettings();
  else loadSites();
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
    ta.className = 'offscreen';
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

// ── Focus trap (task H2, additive) ──────────────────────────
// Keeps Tab/Shift+Tab cycling inside `container` while it's the active
// modal/palette, and returns focus to whatever triggered it on close.
// Used by openModal/closeModal below, plus confirmDialog() and the
// command palette, which manage their own show/hide.
let _focusTrapCleanup = null;

function _focusableEls(container) {
  return Array.from(container.querySelectorAll(
    'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter(el => el.offsetParent !== null);
}

function trapFocus(container, triggerEl) {
  if (!container) return;
  releaseFocusTrap();
  const previouslyFocused = triggerEl || document.activeElement;
  // Initial focus (HIG): an explicit [autofocus], else the first text field,
  // else the dialog itself — never the close button, so no stray ring.
  const firstField = container.querySelector('[autofocus]') ||
    _focusableEls(container).find(el => el.matches('input:not([type="checkbox"]):not([type="radio"]), textarea, select'));
  if (firstField) firstField.focus({ preventScroll: true });
  else {
    if (!container.hasAttribute('tabindex')) container.setAttribute('tabindex', '-1');
    container.focus({ preventScroll: true });
  }

  function onKeydown(e) {
    if (e.key !== 'Tab') return;
    const items = _focusableEls(container);
    if (!items.length) { e.preventDefault(); return; }
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
  container.addEventListener('keydown', onKeydown);
  _focusTrapCleanup = () => {
    container.removeEventListener('keydown', onKeydown);
    if (previouslyFocused && typeof previouslyFocused.focus === 'function') {
      previouslyFocused.focus({ preventScroll: true });
    }
  };
}

function releaseFocusTrap() {
  if (_focusTrapCleanup) {
    const fn = _focusTrapCleanup;
    _focusTrapCleanup = null;
    fn();
  }
}

// ── Modal helpers ─────────────────────────────────────────
function openModal(id) {
  const backdrop = document.getElementById(id);
  if (!backdrop) return;
  const trigger = document.activeElement;
  backdrop.classList.remove('hidden');
  const dialog = backdrop.querySelector('.modal');
  trapFocus(dialog, trigger);
  requestAnimationFrame(revealActiveTabs);
}
function closeModal(id) {
  const backdrop = document.getElementById(id);
  if (!backdrop) return;
  backdrop.classList.add('hidden');
  releaseFocusTrap();
}

// ── Styled confirmation dialog (Promise<boolean>) ──────────
// confirmDialog({ title, body, confirmLabel, danger, warn, requireText })
// Replaces native confirm() for destructive/important actions. `requireText`,
// when set, disables the confirm button until the input matches exactly.
function confirmDialog({ title, body, confirmLabel = 'Confirm', danger = false, warn = false, requireText = null }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    const btnClass = danger ? 'btn-danger-solid' : (warn ? 'btn-warn' : 'btn-primary');
    backdrop.innerHTML = `
      <div class="modal modal-sm confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="confirm-dialog-title">
        <div class="modal-header"><h2 id="confirm-dialog-title">${esc(title)}</h2></div>
        <div class="confirm-body">
          <p>${esc(body)}</p>
          ${requireText ? `
          <div class="field type-to-confirm">
            <label class="field-label" for="confirm-type-input">Type <strong>${esc(requireText)}</strong> to confirm</label>
            <input type="text" class="g-input" id="confirm-type-input" autocomplete="off" spellcheck="false" />
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
    const dialogEl = backdrop.querySelector('.modal');
    trapFocus(dialogEl, document.activeElement);

    function cleanup(result) {
      document.removeEventListener('keydown', onKey);
      releaseFocusTrap();
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

// ── Prompt dialog (Promise<string|null>) — confirm with an optional text field.
// Used for suspend reasons and domain-request rejection notes.
function promptDialog({ title, body, placeholder = '', confirmLabel = 'Confirm', danger = false }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-sm confirm-dialog" role="dialog" aria-modal="true">
        <div class="modal-header"><h2>${esc(title)}</h2></div>
        <div class="confirm-body">
          <p>${esc(body)}</p>
          <input type="text" class="g-input" id="prompt-dialog-input" placeholder="${esc(placeholder)}" aria-label="${esc(placeholder || title)}" autocomplete="off" />
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="confirm-cancel">Cancel</button>
          <button type="button" class="btn ${danger ? 'btn-danger-solid' : 'btn-primary'}" data-role="confirm-ok">${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#prompt-dialog-input');
    trapFocus(backdrop.querySelector('.modal'), document.activeElement);
    function cleanup(result) { releaseFocusTrap(); backdrop.remove(); resolve(result); }
    backdrop.querySelector('[data-role="confirm-cancel"]').addEventListener('click', () => cleanup(null));
    backdrop.querySelector('[data-role="confirm-ok"]').addEventListener('click', () => cleanup(input.value.trim()));
    backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); cleanup(null); }
    });
    input.addEventListener('keydown', e => { if (e.key === 'Enter') cleanup(input.value.trim()); });
    setTimeout(() => input.focus(), 30);
  });
}

// ── Pick-a-user dialog (Promise<{id,username,display_name}|null>) — a
// username search box (GET /users/lookup) inside a modal. Used for adding
// collaborators to a site and for transferring ownership.
function pickUserDialog({ title, body, confirmLabel = 'Confirm', excludeIds = [] }) {
  return new Promise(resolve => {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal modal-sm confirm-dialog" role="dialog" aria-modal="true">
        <div class="modal-header"><h2>${esc(title)}</h2></div>
        <div class="confirm-body">
          <p>${esc(body)}</p>
          <div class="collab-lookup-wrap">
            <input type="text" class="g-input" id="pick-user-input" placeholder="Search username…" aria-label="Username" autocomplete="off" />
            <div class="collab-lookup-results hidden" id="pick-user-results"></div>
          </div>
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="confirm-cancel">Cancel</button>
          <button type="button" class="btn btn-warn" data-role="confirm-ok" disabled>${esc(confirmLabel)}</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    const input = backdrop.querySelector('#pick-user-input');
    const results = backdrop.querySelector('#pick-user-results');
    const confirmBtn = backdrop.querySelector('[data-role="confirm-ok"]');
    let picked = null;
    trapFocus(backdrop.querySelector('.modal'), document.activeElement);
    function cleanup(result) { releaseFocusTrap(); backdrop.remove(); resolve(result); }
    backdrop.querySelector('[data-role="confirm-cancel"]').addEventListener('click', () => cleanup(null));
    confirmBtn.addEventListener('click', () => { if (picked) cleanup(picked); });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); cleanup(null); }
    });
    input.addEventListener('input', debounce(async () => {
      const q = input.value.trim();
      picked = null;
      confirmBtn.disabled = true;
      if (!q) { results.classList.add('hidden'); results.innerHTML = ''; return; }
      try {
        const rows = await api('GET', `/users/lookup?q=${encodeURIComponent(q)}`);
        const filtered = rows.filter(r => !excludeIds.includes(r.id));
        results.innerHTML = filtered.length
          ? filtered.map(r => `<button type="button" class="collab-lookup-item" data-uid="${esc(r.id)}" data-uname="${esc(r.username)}" data-dname="${esc(r.display_name || '')}">${esc(r.display_name || r.username)} <span class="muted">@${esc(r.username)}</span></button>`).join('')
          : '<div class="collab-lookup-empty">No match</div>';
        results.classList.remove('hidden');
        results.querySelectorAll('[data-uid]').forEach(b => b.addEventListener('click', () => {
          picked = { id: b.dataset.uid, username: b.dataset.uname, display_name: b.dataset.dname || null };
          input.value = b.dataset.uname;
          results.classList.add('hidden');
          confirmBtn.disabled = false;
        }));
      } catch { /* ignore — keep previous results */ }
    }, 250));
    setTimeout(() => input.focus(), 30);
  });
}

// ── Support-mode banner — shown at the top of any modal opened for a site
// the current admin does not own or belong to (site.support === true, set
// server-side by decorate()/authz.isSupportAccess).
function renderSupportBanner(site) {
  if (!site?.support) return '';
  const ownerName = esc(site.owner?.display_name || site.owner?.username || 'the owner');
  return `<div class="callout callout-warning callout-sm support-banner"><span class="callout-icon">${ICON.shield}</span><div class="callout-body"><p class="callout-text">Support mode: this site belongs to ${ownerName}. Your actions are logged and ${ownerName} is notified.</p></div></div>`;
}
function setSupportBanner(modalId, site) {
  const modal = document.querySelector(`#${modalId} .modal`);
  if (!modal) return;
  modal.querySelector(':scope > .support-banner')?.remove();
  const html = renderSupportBanner(site);
  if (html) modal.querySelector('.modal-header').insertAdjacentHTML('afterend', html);
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

// ── Sites view toggle (cards / list) ────────────────────────
// Remembered per browser; phones always show cards (the toggle itself is
// hidden there via CSS, but the JS also forces cards below the same
// breakpoint so a preference set on a wider window doesn't leak into it).
const SITES_VIEW_KEY = 'grimport-sites-view';
const SITES_VIEW_PHONE_MAX = 430;

function getSitesViewPref() {
  let v;
  try { v = localStorage.getItem(SITES_VIEW_KEY); } catch {}
  return v === 'list' ? 'list' : 'cards';
}
function setSitesViewPref(v) {
  try { localStorage.setItem(SITES_VIEW_KEY, v); } catch {}
}
function currentSitesView() {
  return window.innerWidth <= SITES_VIEW_PHONE_MAX ? 'cards' : getSitesViewPref();
}

const sitesViewCardsBtn = document.getElementById('sites-view-cards');
const sitesViewListBtn = document.getElementById('sites-view-list');
function updateSitesViewButtons() {
  const pref = getSitesViewPref();
  if (sitesViewCardsBtn) sitesViewCardsBtn.classList.toggle('is-active', pref === 'cards');
  if (sitesViewListBtn) sitesViewListBtn.classList.toggle('is-active', pref === 'list');
}
updateSitesViewButtons();
if (sitesViewCardsBtn) sitesViewCardsBtn.addEventListener('click', () => {
  setSitesViewPref('cards'); updateSitesViewButtons(); renderSites();
});
if (sitesViewListBtn) sitesViewListBtn.addEventListener('click', () => {
  setSitesViewPref('list'); updateSitesViewButtons(); renderSites();
});
// Crossing the phone breakpoint while resizing (or rotating) should
// flip between the forced-cards phone layout and the stored preference.
let _sitesViewResizeTimer = null;
window.addEventListener('resize', () => {
  clearTimeout(_sitesViewResizeTimer);
  _sitesViewResizeTimer = setTimeout(renderSites, 150);
});

// ── Sites list ────────────────────────────────────────────
async function loadSites() {
  sites = await api('GET', '/sites');
  api('GET', '/uptime').then(d => { uptimeData = d; renderSites(); }).catch(() => {});
  renderSites();
  sites.forEach(s => refreshDnsDot(s.id));
  sites.forEach(s => { if (statusInfo(s.container).error) refreshDownDuration(s.id); });
}

const DNS_DOT_LABEL = { ok: 'DNS ok', proxied: 'DNS ok — proxied via Cloudflare', wrong: 'DNS wrong', pending: 'DNS pending' };
// proxied (Cloudflare proxy / tunnel) is a correct setup → same green as ok
function dnsDotClass(status) {
  return status === 'ok' || status === 'proxied' ? 'ok' : status === 'wrong' ? 'wrong' : 'pending';
}
async function refreshDnsDot(siteId) {
  try {
    const data = await api('GET', `/dns/${siteId}`);
    const dot = document.getElementById(`dns-dot-${siteId}`);
    if (!dot) return;
    const cls = dnsDotClass(data.status);
    dot.className = `dns-indicator dns-indicator-${cls}`;
    // colour is never the only signal — mirror the state as text on the
    // button that wraps this dot (the dot itself has no visible label).
    const btn = dot.closest('.dns-status-btn');
    const label = DNS_DOT_LABEL[data.status] || DNS_DOT_LABEL[cls];
    if (btn) btn.title = label;
    if (btn) btn.setAttribute('aria-label', label);
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
    if (m.id === `overflow-${exceptId}`) return;
    m.classList.add('hidden');
    m.parentElement?.querySelector('[data-action="overflow"]')?.setAttribute('aria-expanded', 'false');
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
      (downCount ? ` · ${downCount} need${downCount === 1 ? 's' : ''} attention` : '');
  }

  if (sites.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.globe}</div>
        <h3>No sites yet</h3>
        <p>Upload a zip and Grimport serves it over HTTPS on your domain.</p>
        ${canCreateSites() ? `<button type="button" class="btn btn-primary" data-empty-action="new-site">${ICON.plus} Create your first site</button>` : ''}
      </div>`;
    return;
  }

  if (filtered.length === 0) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.globe}</div>
        <h3>No sites match "${esc(searchQuery)}"</h3>
        <p>Search covers names and domains.</p>
        <button type="button" class="btn" data-empty-action="clear-search">Clear search</button>
      </div>`;
    return;
  }

  const view = currentSitesView();
  grid.classList.toggle('sites-grid', view === 'cards');
  if (view === 'list') {
    grid.innerHTML = `
      <div class="table-wrap sites-table-scroll">
        <table class="data-table data-table-stack sites-table">
          <thead>
            <tr><th>Site</th><th>Status</th><th>Details</th><th>Uptime 24h</th><th><span class="hidden">Actions</span></th></tr>
          </thead>
          <tbody>${filtered.map(s => siteRow(s)).join('')}</tbody>
        </table>
      </div>`;
  } else {
    grid.innerHTML = filtered.map(s => siteCard(s)).join('');
  }

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
      if (action === 'uptime-detail')   openUptimeDetail(site, btn);
      if (action === 'recreate')        recreateSiteContainer(site);
      if (action === 'suspend')         suspendSiteFlow(site);
      if (action === 'apply-template')  openApplyTemplateModal(site);
      if (action === 'review-deploy')   navigateTo('domains');
      if (action === 'withdraw-review') withdrawReviewFlow(site);
      if (action === 'unsuspend')       unsuspendSiteFlow(site);
      if (action === 'overflow') {
        const menu = document.getElementById(`overflow-${id}`);
        const wasHidden = menu?.classList.contains('hidden');
        closeAllSiteOverflows();
        if (menu && wasHidden) {
          menu.classList.remove('opens-up', 'hidden');
          const r = menu.getBoundingClientRect();
          if (r.bottom > window.innerHeight - 8 && r.height < btn.getBoundingClientRect().top) menu.classList.add('opens-up');
          btn.setAttribute('aria-expanded', 'true');
        }
      }
    });
  });
}

// ── Suspend / unsuspend a site (panel admins) ────────────────
async function suspendSiteFlow(site) {
  const reason = await promptDialog({
    title: `Suspend "${site.name}"?`,
    body: 'Stops the container and shows a suspended notice on the card. The owner is notified.',
    placeholder: 'Reason (optional)',
    confirmLabel: 'Suspend',
    danger: true,
  });
  if (reason === null) return;
  try {
    await api('POST', `/sites/${site.id}/suspend`, reason ? { reason } : {});
    toast(`"${site.name}" suspended`, 'success');
    await loadSites();
  } catch (err) { toast(err.message, 'error'); }
}

async function unsuspendSiteFlow(site) {
  const ok = await confirmDialog({
    title: `Unsuspend "${site.name}"?`,
    body: 'Restarts the container and makes the site reachable again.',
    confirmLabel: 'Unsuspend',
  });
  if (!ok) return;
  try {
    await api('POST', `/sites/${site.id}/unsuspend`);
    toast(`"${site.name}" is active again`, 'success');
    await loadSites();
  } catch (err) { toast(err.message, 'error'); }
}

// Container lifecycle → { cls, label, error }. `cls` maps 1:1 onto the
// design-system .status-<cls> classes (css/components.css, "Status");
// glyph + label + colour, never colour alone.
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

// Tags shared by the site card and the list row.
function siteTags(site) {
  const runtime = site.runtime || 'static';
  const suspended = site.status === 'suspended';
  return [
    site.support          ? `<span class="badge badge-warn">${ICON.shield}Support</span>` : '',
    suspended             ? `<span class="badge badge-err">Suspended</span>` : '',
    runtime !== 'static'  ? `<span class="badge badge-runtime">${esc(runtime.toUpperCase())}</span>` : '',
    site.spa_mode         ? `<span class="badge badge-spa">SPA</span>` : '',
    site.maintenance_mode ? `<span class="badge badge-maint">${ICON.tool}Maintenance</span>` : '',
    site.basic_auth       ? `<span class="badge badge-auth">${ICON.lock}Basic auth</span>` : '',
    site.pending_review   ? `<span class="badge badge-warn" title="An upload is waiting for review">${ICON.eye}Review pending</span>` : '',
  ].filter(Boolean).join('');
}

// Overflow menu items shared by card and row. Everything that is not one of
// the visible buttons lives here, exactly once.
function siteMenuItems(site) {
  const runtime = site.runtime || 'static';
  const suspended = site.status === 'suspended';
  return [
    `<button type="button" data-action="analytics" data-id="${site.id}" role="menuitem">${ICON.barChart} Analytics</button>`,
    `<button type="button" data-action="history" data-id="${site.id}" role="menuitem">${ICON.history} Deploy history</button>`,
    `<button type="button" data-action="dns" data-id="${site.id}" role="menuitem">${ICON.globe} DNS setup</button>`,
    `<button type="button" data-action="settings" data-id="${site.id}" role="menuitem">${ICON.settings} Settings</button>`,
    '<div class="menu-separator" role="separator"></div>',
    runtime === 'static' && site.my_role !== 'viewer' ? `<button type="button" data-action="apply-template" data-id="${site.id}" role="menuitem">${ICON.grid} Apply template…</button>` : '',
    !site.preview_container_id ? `<button type="button" data-action="preview-create" data-id="${site.id}" role="menuitem">${ICON.layers} Create preview…</button>` : '',
    currentUser.role !== 'viewer' ? `<button type="button" data-action="recreate" data-id="${site.id}" role="menuitem">${ICON.box} Update container</button>` : '',
    site.pending_review && isPanelAdmin() ? `<button type="button" data-action="review-deploy" data-id="${site.id}" role="menuitem">${ICON.eye} Review upload…</button>` : '',
    site.pending_review && site.my_role !== 'viewer' ? `<button type="button" data-action="withdraw-review" data-id="${site.id}" role="menuitem">${ICON.x} Withdraw pending upload</button>` : '',
    isPanelAdmin() ? (suspended
      ? `<button type="button" data-action="unsuspend" data-id="${site.id}" role="menuitem">${ICON.check} Unsuspend</button>`
      : `<button type="button" class="is-danger" data-action="suspend" data-id="${site.id}" role="menuitem">${ICON.warning} Suspend site…</button>`) : '',
  ].filter(Boolean).join('');
}

function siteOverflow(site, sizeClass = 'btn-sm') {
  return `<div class="site-overflow">
    <button type="button" class="btn ${sizeClass} btn-icon-only" data-action="overflow" data-id="${site.id}" aria-haspopup="menu" aria-expanded="false" title="More actions" aria-label="More actions for ${esc(site.name)}">${ICON.more}</button>
    <div class="site-overflow-menu hidden" id="overflow-${site.id}" role="menu">${siteMenuItems(site)}</div>
  </div>`;
}

function siteCard(site) {
  const container = site.container;
  const { cls, label, error } = statusInfo(container);
  const isRunning = !!container?.running;
  const suspended = site.status === 'suspended';
  const lockedForViewer = suspended && !isPanelAdmin();
  const tags = siteTags(site);

  const preview = site.preview_container_id ? `
    <div class="callout callout-violet callout-sm">
      <span class="callout-icon">${ICON.layers}</span>
      <div class="callout-body">
        <span class="callout-title">Preview</span>
        <a class="preview-link" href="http://${esc(site.preview_domain)}" target="_blank" rel="noopener"><span class="truncate">${esc(site.preview_domain)}</span>${ICON.externalLink}</a>
      </div>
      <div class="callout-actions">
        <button type="button" class="btn btn-sm" data-action="preview-discard" data-id="${site.id}">Discard</button>
        <button type="button" class="btn btn-sm btn-primary" data-action="preview-swap" data-id="${site.id}">Go live</button>
      </div>
    </div>` : '';

  const problem = suspended ? `
    <div class="callout callout-danger callout-sm">
      <span class="callout-icon">${ICON.warning}</span>
      <div class="callout-body"><p class="callout-text">Suspended. Contact the panel owner.</p></div>
    </div>` : error ? `
    <div class="callout callout-danger callout-sm">
      <span class="callout-icon">${ICON.warning}</span>
      <div class="callout-body"><p class="callout-text">${esc(errorHintText(container))}<span id="down-duration-${site.id}"></span></p></div>
    </div>` : '';

  return `
    <article class="site-card${error ? ' site-card--error' : ''}${suspended ? ' site-card--suspended' : ''}" aria-label="${esc(site.name)}">
      <header class="site-card-head">
        <div class="site-card-titles">
          <h3 class="site-name" title="${esc(site.name)}">${esc(site.name)}</h3>
          <div class="site-domain-row">
            <a class="site-domain" href="http://${esc(site.domain)}" target="_blank" rel="noopener" title="Open ${esc(site.domain)}"><span class="site-domain-text">${esc(site.domain)}</span><span class="site-domain-arrow">${ICON.externalLink}</span></a>
            <button type="button" class="dns-status-btn" data-action="dns" data-id="${site.id}" title="DNS: checking" aria-label="DNS: checking">
              <span class="dns-indicator dns-indicator-unknown" id="dns-dot-${site.id}" aria-hidden="true"></span>
            </button>
          </div>
        </div>
        <span class="status status-pill status-${cls}" data-status-for="${site.id}">${GLYPH}<span class="status-label">${esc(label)}</span></span>
      </header>
      ${tags ? `<div class="site-tags">${tags}</div>` : ''}
      ${preview}
      ${problem}
      <footer class="site-card-foot">
        ${uptimeStrip(site.id)}
        <div class="site-actions">
          <button type="button" class="btn btn-sm btn-primary site-deploy-btn" data-action="deploy" data-id="${site.id}" ${lockedForViewer ? 'disabled title="Site is suspended"' : ''}>${ICON.upload} Deploy</button>
          <span class="spacer"></span>
          <button type="button" class="btn btn-sm" data-action="logs" data-id="${site.id}">Logs</button>
          <button type="button" class="btn btn-sm" data-action="${isRunning ? 'stop' : 'start'}" data-id="${site.id}" ${lockedForViewer ? 'disabled title="Site is suspended"' : ''}>${isRunning ? 'Stop' : 'Start'}</button>
          ${siteOverflow(site)}
        </div>
      </footer>
    </article>`;
}

function uptimeParts(siteId) {
  const u = uptimeData[siteId];
  const hasPct = u && u.uptime24h !== null && u.uptime24h !== undefined;
  const pct = hasPct ? parseFloat(u.uptime24h) : null;
  const pctCls = pct === null ? 'is-none' : pct >= 99 ? 'pct-ok' : pct >= 95 ? 'pct-warn' : 'pct-err';
  const pctText = pct === null ? 'No data yet' : `${pct}%`;
  const status = u?.currentStatus;
  const liveCls = status === 'up' ? 'status-up' : status === 'down' ? 'status-down' : 'status-muted';
  const liveLabel = status === 'up' ? 'Up' : status === 'down' ? 'Down' : 'Not checked';
  return { pct, pctCls, pctText, liveCls, liveLabel };
}

// Dense table alternative to siteCard() for the Sites list view. Same
// data-action/data-id attributes so the click binding in renderSites() works.
function siteRow(site) {
  const container = site.container;
  const { cls, label, error } = statusInfo(container);
  const isRunning = !!container?.running;
  const suspended = site.status === 'suspended';
  const lockedForViewer = suspended && !isPanelAdmin();
  const tags = siteTags(site);
  const up = uptimeParts(site.id);

  return `
    <tr>
      <td class="cell-primary">
        <div class="cell-stack">
          <span class="cell-title">${esc(site.name)}${site.preview_container_id ? ' <span class="badge badge-vio">Preview</span>' : ''}</span>
          <a class="cell-sub mono site-domain" href="http://${esc(site.domain)}" target="_blank" rel="noopener">${esc(site.domain)}</a>
        </div>
      </td>
      <td data-label="Status"><span class="status status-${cls}" data-status-for="${site.id}" ${error ? `title="${esc(errorHintText(container))}"` : ''}>${GLYPH}<span class="status-label">${esc(label)}</span></span></td>
      <td data-label="Details">${tags || '<span class="cell-muted">Static</span>'}</td>
      <td data-label="Uptime 24h">
        <span class="sites-table-uptime">
          <span class="uptime-pct ${up.pctCls}">${up.pctText}</span>
          <span class="status ${up.liveCls}">${GLYPH}${up.liveLabel}</span>
        </span>
      </td>
      <td>
        <div class="cell-actions">
          <button type="button" class="btn btn-sm btn-primary" data-action="deploy" data-id="${site.id}" ${lockedForViewer ? 'disabled title="Site is suspended"' : ''}>Deploy</button>
          <button type="button" class="btn btn-sm" data-action="logs" data-id="${site.id}">Logs</button>
          <button type="button" class="btn btn-sm" data-action="${isRunning ? 'stop' : 'start'}" data-id="${site.id}" ${lockedForViewer ? 'disabled title="Site is suspended"' : ''}>${isRunning ? 'Stop' : 'Start'}</button>
          ${siteOverflow(site)}
        </div>
      </td>
    </tr>`;
}

function uptimeStrip(siteId) {
  const up = uptimeParts(siteId);
  return `<button type="button" class="uptime-row-btn" data-action="uptime-detail" data-id="${siteId}" title="Uptime history">
    <span class="uptime-row">
      <span class="uptime-pct ${up.pctCls}">${up.pctText}</span>
      <span class="uptime-label">uptime 24h</span>
      <span class="status ${up.liveCls}">${GLYPH}${up.liveLabel}</span>
    </span>
  </button>`;
}

// ── Uptime history popover (click the uptime strip on a site card) ────
let uptimePopoverEl = null;

function closeUptimePopover() {
  if (uptimePopoverEl) { uptimePopoverEl.remove(); uptimePopoverEl = null; }
  document.removeEventListener('click', onUptimePopoverOutsideClick, true);
}

function onUptimePopoverOutsideClick(e) {
  if (uptimePopoverEl && !uptimePopoverEl.contains(e.target)) closeUptimePopover();
}

async function openUptimeDetail(site, anchorEl) {
  closeAllSiteOverflows();
  const wasOpenForThisSite = uptimePopoverEl?.dataset.forSite === site.id;
  closeUptimePopover();
  if (wasOpenForThisSite) return; // toggle off on second click

  const pop = document.createElement('div');
  pop.className = 'uptime-popover';
  pop.dataset.forSite = site.id;
  pop.innerHTML = `<div class="uptime-popover-header"><span>${esc(site.name)} — 24h history</span></div>
    <div class="uptime-popover-empty">Loading…</div>`;
  document.body.appendChild(pop);
  uptimePopoverEl = pop;

  const rect = anchorEl.getBoundingClientRect();
  const top = Math.min(rect.bottom + 6, window.innerHeight - 160);
  const left = Math.max(8, Math.min(rect.left, window.innerWidth - 268));
  pop.style.top = `${top}px`;
  pop.style.left = `${left}px`;

  setTimeout(() => document.addEventListener('click', onUptimePopoverOutsideClick, true), 0);

  try {
    const data = await api('GET', `/uptime/${site.id}?period=24h`);
    if (uptimePopoverEl !== pop) return; // closed/replaced while loading
    const strip = data.strip || [];
    const bars = strip.length
      ? `<div class="uptime-popover-strip">${strip.map(c => `<span class="uptime-popover-bar ${c.up ? 'up' : 'down'}" title="${new Date(c.checked_at * 1000).toLocaleString()} — ${c.up ? 'up' : 'down'}"></span>`).join('')}</div>`
      : `<div class="uptime-popover-empty">No checks recorded yet</div>`;
    pop.innerHTML = `
      <div class="uptime-popover-header"><span>${esc(site.name)} — 24h history</span></div>
      <div class="uptime-popover-stats">
        <span>Uptime <b>${data.uptime !== null ? data.uptime + '%' : '—'}</b></span>
        <span>Avg latency <b>${data.avgLatency !== null ? data.avgLatency + 'ms' : '—'}</b></span>
      </div>
      ${bars}`;
  } catch (err) {
    if (uptimePopoverEl === pop) pop.innerHTML = `<div class="uptime-popover-empty">Couldn't load uptime history</div>`;
  }
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

// Members: hide runtimes their capabilities don't allow (admins always see all).
function applyRuntimeCaps(segId) {
  const seg = document.getElementById(segId);
  if (!seg) return;
  const allowed = isPanelAdmin() ? null : (currentUser.capabilities?.runtimes || ['static']);
  seg.querySelectorAll('button[data-runtime]').forEach(b => {
    b.classList.toggle('hidden', !!allowed && !allowed.includes(b.dataset.runtime));
  });
}

function renderNewSiteQuota() {
  const hint = document.getElementById('new-site-quota-hint');
  if (!hint) return;
  if (isPanelAdmin()) { hint.classList.add('hidden'); return; }
  const max = currentUser.capabilities?.max_sites;
  const owned = sites.filter(s => s.owner_id === currentUser.id).length;
  hint.textContent = `${owned} of ${Number.isFinite(max) ? max : '∞'} sites used`;
  hint.classList.remove('hidden');
}

// ── Starter templates (blank / one-page / portfolio) ───────────────
// Shared by the New site modal, the member first-run wizard, and the
// "Apply template…" site-card action — one fetch, one render/select routine.
async function loadTemplates() {
  if (templatesCache) return templatesCache;
  try { templatesCache = await api('GET', '/templates'); }
  catch { templatesCache = []; }
  return templatesCache;
}

/**
 * Renders template cards into `container`. `selectedId` marks the active
 * card ('' matches the synthetic "None" card when `withNone` is set).
 * `onSelect(id)` fires with the clicked card's id (never re-fetches).
 */
function renderTemplateCards(container, templates, selectedId, onSelect, { withNone = false } = {}) {
  const cards = withNone
    ? [{ id: '', name: 'None', description: 'Keep the default placeholder page', preview_bg: null }, ...templates]
    : templates;
  container.innerHTML = cards.map(t => `
    <button type="button" class="template-card${t.id === selectedId ? ' is-selected' : ''}" data-template-id="${esc(t.id)}" aria-pressed="${t.id === selectedId}">
      <span class="template-card-swatch${t.preview_bg ? '' : ' is-none'}" ${t.preview_bg ? `style="--swatch:${esc(t.preview_bg)}"` : ''}></span>
      <span class="template-card-name">${esc(t.name)}</span>
      <span class="template-card-desc">${esc(t.description)}</span>
    </button>`).join('');
  container.querySelectorAll('.template-card').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.template-card').forEach(b => { b.classList.remove('is-selected'); b.setAttribute('aria-pressed', 'false'); });
      btn.classList.add('is-selected');
      btn.setAttribute('aria-pressed', 'true');
      onSelect(btn.dataset.templateId);
    });
  });
}

// ── Apply template… (site card overflow menu) ───────────────────────
async function openApplyTemplateModal(site) {
  applyTemplateSiteId = site.id;
  applyTemplateSelectedId = null;
  document.getElementById('apply-template-site-name').textContent = site.name;
  const confirmBtn = document.getElementById('btn-apply-template-confirm');
  confirmBtn.disabled = true;
  const picker = document.getElementById('apply-template-picker');
  picker.innerHTML = '<div class="skeleton skeleton-block"></div>';
  openModal('modal-apply-template');
  const templates = await loadTemplates();
  renderTemplateCards(picker, templates, null, id => {
    applyTemplateSelectedId = id;
    confirmBtn.disabled = false;
  });
}

document.getElementById('btn-apply-template-confirm').addEventListener('click', async () => {
  if (!applyTemplateSiteId || !applyTemplateSelectedId) return;
  const btn = document.getElementById('btn-apply-template-confirm');
  btn.disabled = true;
  try {
    await api('POST', `/templates/${applyTemplateSelectedId}/apply/${applyTemplateSiteId}`);
    closeModal('modal-apply-template');
    toast('Template applied', 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    btn.disabled = false;
  }
});

document.getElementById('btn-new-site').addEventListener('click', async () => {
  document.getElementById('form-new-site').reset();
  setNewSiteRuntime('static');
  applyRuntimeCaps('new-site-runtime-seg');
  renderNewSiteQuota();
  newSiteTemplateId = '';
  loadTemplates().then(templates => {
    renderTemplateCards(document.getElementById('new-site-template-picker'), templates, '', id => { newSiteTemplateId = id; }, { withNone: true });
  });

  const admin = isPanelAdmin();
  const domainInput = document.querySelector('#form-new-site input[name="domain"]');
  const optionalTag = document.getElementById('new-site-domain-optional-tag');
  domainInput.required = admin;
  optionalTag.classList.toggle('hidden', admin);
  if (admin && config.siteBaseDomain) {
    domainInput.value = `${randomSlug()}.${config.siteBaseDomain}`;
  } else if (!admin) {
    domainInput.value = '';
    domainInput.placeholder = config.siteBaseDomain ? `yoursite.${config.siteBaseDomain}` : 'yoursite.example.com';
  }
  validateNewSiteDomain();
  if (!admin) {
    const help = document.getElementById('new-site-domain-help');
    help.className = 'field-help muted';
    help.textContent = 'Leave empty for an automatic address; a custom domain will be requested for approval.';
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
  const domain = (fd.get('domain') || '').trim().toLowerCase();
  if (domain || isPanelAdmin()) {
    if (!validateNewSiteDomain()) {
      toast('Invalid domain — use a format like mysite.example.com or test.localhost', 'error');
      return;
    }
  }
  const runtime = fd.get('runtime') || 'static';
  const isApp = runtime === 'node' || runtime === 'python';
  const payload = {
    name: fd.get('name'),
    runtime,
    spa_mode: fd.get('spa_mode') === 'on',
    cache_enabled: fd.get('cache_enabled') === 'on',
    ...(domain ? { domain } : {}),
    ...(isApp ? {
      build_cmd: fd.get('build_cmd') || null,
      start_cmd: fd.get('start_cmd') || null,
      app_port: fd.get('app_port') ? Number(fd.get('app_port')) : 3000,
    } : {}),
  };
  try {
    const site = await api('POST', '/sites', payload);
    if (!isApp && newSiteTemplateId) {
      try { await api('POST', `/templates/${newSiteTemplateId}/apply/${site.id}`); }
      catch (err) { toast(`Site created, but the template failed to apply: ${err.message}`, 'error'); }
    }
    closeModal('modal-new-site');
    toast(site.domain_request ? `Site "${payload.name}" created — domain request sent for approval` : `Site "${payload.name}" created`, 'success');
    await loadSites();
  } catch (err) {
    toast(err.message, 'error');
  }
});

// ── Deploy modal ──────────────────────────────────────────
let activeDeployTab = 'upload';

document.querySelectorAll('.deploy-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.deploy-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');
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
  document.getElementById('deploy-outcome').classList.add('hidden');
  document.getElementById('deploy-progress').classList.add('hidden');
  document.getElementById('progress-fill').style.width = '0%';
  document.getElementById('deploy-status-text').textContent = 'Uploading…';
  document.getElementById('btn-deploy-confirm').disabled = true;
  document.getElementById('dropzone').classList.remove('dragging', 'has-file');
  document.getElementById('deploy-url-input').value = '';
  // Reset tabs
  document.querySelectorAll('.deploy-tab').forEach(t => { t.classList.remove('active'); t.setAttribute('aria-selected', 'false'); });
  const uploadTab = document.querySelector('.deploy-tab[data-dtab="upload"]');
  uploadTab.classList.add('active');
  uploadTab.setAttribute('aria-selected', 'true');
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
  document.querySelector('.deploy-tab[data-dtab="url"]')?.classList.toggle('hidden', beginnerMode());
  setSupportBanner('modal-deploy', site);
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
  document.getElementById('deploy-outcome').classList.add('hidden');
  document.getElementById('btn-deploy-confirm').disabled = true;

  let result;
  try {
    if (activeDeployTab === 'url') {
      const url = document.getElementById('deploy-url-input').value.trim();
      if (!url) throw new Error('No URL entered');
      status.textContent = 'Downloading…';
      fill.style.width = '40%';
      result = await api('POST', `/deploy/${activeSiteId}/url`, { url });
      fill.style.width = '100%';
    } else {
      if (!selectedDeployFile) return;
      status.textContent = 'Uploading…';
      result = await apiUpload(activeSiteId, selectedDeployFile, (pct, loaded, total) => {
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
    if (result?.pending_review) {
      progress.classList.add('hidden');
      renderDeployOutcome({ outcome: 'pending', findings: result.findings });
      toast('Upload is waiting for review', 'warn');
      await loadSites();
      return;
    }
    status.textContent = 'Done!';
    await new Promise(r => setTimeout(r, 600));
    closeModal('modal-deploy');
    toast('Site deployed successfully', 'success');
    await loadSites();
  } catch (err) {
    if (err.status === 422 && Array.isArray(err.data?.findings)) {
      progress.classList.add('hidden');
      renderDeployOutcome({ outcome: 'blocked', findings: err.data.findings });
      toast('Deploy blocked by the content scanner', 'error');
      document.getElementById('btn-deploy-confirm').disabled = false;
      loadSites();
      return;
    }
    toast(err.message, 'error');
    status.textContent = err.message;
    document.getElementById('btn-deploy-confirm').disabled = false;
  }
});

// ── Content scanner outcome (deploy modal + review queue) ──
const FINDING_LABELS = {
  executable: 'Executable file', miner: 'Crypto-miner script', phishing: 'Phishing pattern',
  secret: 'Secret or private key', 'obfuscated-js': 'Obfuscated JavaScript',
  'external-form': 'Form posting to another host', redirect: 'Redirect to another host',
  'external-script': 'External script', 'large-inline-data': 'Large inline data',
};

function findingsHtml(findings) {
  if (!Array.isArray(findings) || !findings.length) return '';
  return `<ul class="findings-list">${findings.map(f => `
    <li class="finding finding-${esc(f.severity || 'review')}">
      <span class="finding-cat">${esc(FINDING_LABELS[f.category] || f.category)}</span>
      <span class="finding-file">${esc(f.file || '')}${f.line ? `:${f.line}` : ''}</span>
      ${f.detail ? `<span class="finding-detail">${esc(f.detail)}</span>` : ''}
    </li>`).join('')}</ul>`;
}

function renderDeployOutcome({ outcome, findings }) {
  const box = document.getElementById('deploy-outcome');
  if (!box) return;
  const pending = outcome === 'pending';
  box.className = `callout ${pending ? 'callout-warning' : 'callout-danger'}`;
  box.innerHTML = `
    <span class="callout-icon">${pending ? ICON.eye : ICON.warning}</span>
    <div class="callout-body">
      <p class="callout-title">${pending ? 'Waiting for review' : 'Deploy blocked'}</p>
      <p class="callout-text">${pending
        ? 'The scanner flagged something in this upload. The panel owner will look at it. The live site stays unchanged until it is approved. You can withdraw it from the card menu.'
        : 'This upload contains something the panel does not host. Remove the files listed below and deploy again.'}</p>
      ${findingsHtml(findings)}
    </div>`;
  box.classList.remove('hidden');
}

async function withdrawReviewFlow(site) {
  const ok = await confirmDialog({
    title: 'Withdraw the pending upload?',
    body: `The upload waiting for review on "${site.name}" is discarded. The live site stays as it is.`,
    confirmLabel: 'Withdraw',
    danger: true,
  });
  if (!ok) return;
  try {
    await api('DELETE', `/sites/${site.id}/review`);
    toast('Pending upload withdrawn', 'success');
    await loadSites();
  } catch (err) { toast(err.message, 'error'); }
}

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
    if (tab.dataset.stab === 'access') loadCollaborators();
  });
});

// ── Collaborators (site members) — Access tab ────────────────────────────
let collabDraft = [];
let collabPendingUser = null;
let collabSiteId = null;      // site the draft belongs to
let collabOriginal = '[]';    // JSON snapshot to detect unsaved changes

async function loadCollaborators() {
  const wrap = document.getElementById('collab-list');
  if (!activeSiteId) return;
  const site = sites.find(s => s.id === activeSiteId);
  const isOwner = site?.my_role === 'owner';
  document.getElementById('collab-add-row').classList.toggle('hidden', !isOwner);
  document.getElementById('collab-save-row').classList.toggle('hidden', !isOwner);
  document.getElementById('btn-transfer-ownership').classList.toggle('hidden', !isOwner);
  try {
    const data = await api('GET', `/sites/${activeSiteId}/members`);
    document.getElementById('collab-owner-line').textContent = data.owner
      ? `Owner: ${data.owner.display_name || data.owner.username}`
      : 'No owner set';
    collabDraft = data.members.map(m => ({ user_id: m.user_id, username: m.username, display_name: m.display_name, site_role: m.site_role }));
    collabSiteId = activeSiteId;
    collabOriginal = JSON.stringify(collabDraft.map(m => [m.user_id, m.site_role]));
    renderCollabList(isOwner);
  } catch (err) {
    wrap.innerHTML = `<p class="field-help err">${esc(err.message)}</p>`;
  }
}

function renderCollabList(isOwner) {
  const wrap = document.getElementById('collab-list');
  if (!collabDraft.length) {
    wrap.innerHTML = '<p class="list-empty">No collaborators yet.</p>';
    return;
  }
  wrap.innerHTML = collabDraft.map((m, i) => `
    <div class="list-row collab-row">
      <span class="avatar avatar-sm" aria-hidden="true">${esc(initialsFor(m))}</span>
      <div class="list-row-main">
        <span class="list-row-title">${esc(m.display_name || m.username)}</span>
        ${m.display_name ? `<span class="list-row-meta">@${esc(m.username)}</span>` : ''}
      </div>
      <div class="list-row-actions">
      ${isOwner ? `
        <select class="g-select is-auto" data-collab-role="${i}" aria-label="Role for ${esc(m.display_name || m.username)}">
          <option value="viewer" ${m.site_role === 'viewer' ? 'selected' : ''}>Viewer</option>
          <option value="editor" ${m.site_role === 'editor' ? 'selected' : ''}>Editor</option>
        </select>
        <button type="button" class="btn btn-icon-only btn-danger" data-collab-remove="${i}" title="Remove" aria-label="Remove ${esc(m.display_name || m.username)}">${ICON.x}</button>
      ` : `<span class="badge badge-role-${esc(m.site_role)}">${esc(m.site_role)}</span>`}
      </div>
    </div>`).join('');
  if (!isOwner) return;
  wrap.querySelectorAll('[data-collab-role]').forEach(sel => {
    sel.addEventListener('change', () => { collabDraft[Number(sel.dataset.collabRole)].site_role = sel.value; });
  });
  wrap.querySelectorAll('[data-collab-remove]').forEach(btn => {
    btn.addEventListener('click', () => { collabDraft.splice(Number(btn.dataset.collabRemove), 1); renderCollabList(isOwner); });
  });
}

document.getElementById('collab-add-username').addEventListener('input', debounce(async e => {
  const q = e.target.value.trim();
  collabPendingUser = null;
  const results = document.getElementById('collab-lookup-results');
  if (!q) { results.classList.add('hidden'); return; }
  const site = sites.find(s => s.id === activeSiteId);
  try {
    const rows = await api('GET', `/users/lookup?q=${encodeURIComponent(q)}`);
    const filtered = rows.filter(r => r.id !== site?.owner_id && !collabDraft.some(m => m.user_id === r.id));
    results.innerHTML = filtered.length
      ? filtered.map(r => `<button type="button" class="collab-lookup-item" data-uid="${esc(r.id)}" data-uname="${esc(r.username)}" data-dname="${esc(r.display_name || '')}">${esc(r.display_name || r.username)} <span class="muted">@${esc(r.username)}</span></button>`).join('')
      : '<div class="collab-lookup-empty">No match</div>';
    results.classList.remove('hidden');
    results.querySelectorAll('[data-uid]').forEach(btn => btn.addEventListener('click', () => {
      collabPendingUser = { id: btn.dataset.uid, username: btn.dataset.uname, display_name: btn.dataset.dname || null };
      document.getElementById('collab-add-username').value = btn.dataset.uname;
      results.classList.add('hidden');
    }));
  } catch { /* ignore */ }
}, 250));

document.getElementById('btn-collab-add').addEventListener('click', () => {
  if (!collabPendingUser) { toast('Pick a user from the list', 'error'); return; }
  const site_role = document.getElementById('collab-add-role').value;
  collabDraft.push({ user_id: collabPendingUser.id, username: collabPendingUser.username, display_name: collabPendingUser.display_name, site_role });
  collabPendingUser = null;
  document.getElementById('collab-add-username').value = '';
  renderCollabList(true);
});

document.getElementById('btn-transfer-ownership').addEventListener('click', async () => {
  const site = sites.find(s => s.id === activeSiteId);
  if (!site) return;
  const target = await pickUserDialog({
    title: `Transfer "${site.name}"`,
    body: 'Pick who should own this site. They get full control over it.',
    confirmLabel: 'Transfer',
    excludeIds: [site.owner_id].filter(Boolean),
  });
  if (!target) return;
  const ok = await confirmDialog({
    title: `Transfer to ${target.display_name || target.username}?`,
    body: 'This cannot be undone by you — only the new owner can transfer it back.',
    confirmLabel: 'Transfer ownership',
    warn: true,
  });
  if (!ok) return;
  try {
    await api('POST', `/sites/${activeSiteId}/transfer`, { user_id: target.id });
    closeModal('modal-settings');
    toast(`"${site.name}" transferred to ${target.display_name || target.username}`, 'success');
    await loadSites();
  } catch (err) { toast(err.message, 'error'); }
});

// Beginner-mode members: Behaviour/App tabs hidden behind a "Show advanced
// settings" link, remembered per browser (localStorage `grimport-advanced`).
function applyBeginnerModeSettings() {
  const beginner = beginnerMode();
  const revealed = !beginner || advancedRevealed();
  document.querySelectorAll('#modal-settings .tab[data-stab="behaviour"], #modal-settings .tab[data-stab="app"]').forEach(t => {
    t.classList.toggle('hidden', beginner && !revealed);
  });
  document.getElementById('advanced-settings-row')?.classList.toggle('hidden', !beginner || revealed);
}
document.getElementById('btn-show-advanced-settings').addEventListener('click', () => {
  try { localStorage.setItem('grimport-advanced', '1'); } catch {}
  applyBeginnerModeSettings();
});

async function applyDomainFieldUI(site) {
  const form = document.getElementById('form-settings');
  const domainInput = form.elements['domain'];
  const restartWarn = document.getElementById('settings-domain-help');
  const memberHelp = document.getElementById('settings-domain-member-help');
  const pendingBadge = document.getElementById('settings-domain-pending-badge');
  const isOwner = site.my_role === 'owner';
  const admin = isPanelAdmin();
  memberHelp.classList.add('hidden');
  pendingBadge.classList.add('hidden');
  restartWarn.classList.remove('hidden');
  domainInput.disabled = !isOwner;
  if (!isOwner) {
    restartWarn.classList.add('hidden');
    memberHelp.textContent = 'Only the site owner can change the domain.';
    memberHelp.classList.remove('hidden');
  } else if (!admin) {
    const approvalNeeded = currentUser.capabilities?.custom_domains !== 'free';
    const base = config.siteBaseDomain || 'the base domain';
    const msg = approvalNeeded
      ? `Custom domains need approval; subdomains of ${base} apply immediately.`
      : `Subdomains of ${base} and custom domains both apply immediately.`;
    memberHelp.innerHTML = `${esc(msg)} ${helpLink('Users-and-Roles.md')}`;
    memberHelp.classList.remove('hidden');
  }
  if (isOwner) {
    try {
      const req = await api('GET', `/sites/${site.id}/domain-request`);
      if (req && req.status === 'pending') {
        pendingBadge.textContent = `Pending: ${req.domain}`;
        pendingBadge.classList.remove('hidden');
      }
    } catch { /* ignore */ }
  }
}

function openSettings(site) {
  activeSiteId = site.id;
  collabSiteId = null;
  collabDraft = [];
  document.getElementById('collab-list').innerHTML = '';
  document.getElementById('settings-site-name').textContent = site.name;
  document.querySelector('#modal-settings .modal').scrollTop = 0;

  // Reset to General tab
  document.querySelectorAll('#modal-settings .tab').forEach((t, i) => {
    t.classList.toggle('is-active', i === 0);
    t.setAttribute('aria-selected', i === 0 ? 'true' : 'false');
  });
  document.querySelectorAll('#modal-settings .tab-panel').forEach((p, i) => p.classList.toggle('hidden', i !== 0));
  applyBeginnerModeSettings();
  applyRuntimeCaps('settings-runtime-seg');

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
    sslHint.textContent = 'Let\'s Encrypt via Traefik';
    form.elements['ssl_enabled'].disabled = false;
  } else {
    sslHint.textContent = 'needs a Let\'s Encrypt email in Settings, Server & DNS';
    form.elements['ssl_enabled'].disabled = true;
    form.elements['ssl_enabled'].checked = false;
  }
  form.elements['auth_remove'].checked = false;

  // Basic auth
  const auth = site.basic_auth;
  form.elements['auth_username'].value = auth ? auth.username : '';
  form.elements['auth_password'].value = '';
  document.getElementById('settings-auth-password-help').classList.toggle('hidden', !auth);
  document.getElementById('settings-auth-remove-row').classList.toggle('hidden', !auth);

  renderHeadersList(site.custom_headers || []);
  renderRedirectsList(site.redirects || []);
  const scanWrap = document.getElementById('scan-allowlist-wrap');
  scanWrap.classList.toggle('hidden', !(site.my_role === 'owner' || isPanelAdmin()));
  const scanTa = document.getElementById('settings-scan-allowlist');
  scanTa.value = (site.scan_allowlist || []).join('\n');
  scanTa.dataset.original = scanTa.value;
  populateAppConfigTab(site);
  applyDomainFieldUI(site);
  setSupportBanner('modal-settings', site);
  openModal('modal-settings');
}

// Headers
function renderHeadersList(headers) {
  const list = document.getElementById('headers-list');
  list.innerHTML = headers.map((h, i) => `
    <div class="kv-row header-row">
      <input class="g-input is-mono" type="text" placeholder="X-Header-Name" aria-label="Header name" value="${esc(h.name)}" data-header-name data-idx="${i}" />
      <input class="g-input" type="text" placeholder="Value" aria-label="Header value" value="${esc(h.value)}" data-header-value data-idx="${i}" />
      <button type="button" class="btn btn-icon-only btn-danger" data-remove-header="${i}" title="Remove header" aria-label="Remove header">${ICON.x}</button>
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
    <div class="kv-row has-flag redirect-row">
      <input class="g-input is-mono" type="text" placeholder="/old-path" aria-label="From path" value="${esc(r.from)}" data-redirect-from data-idx="${i}" />
      <input class="g-input is-mono" type="text" placeholder="/new-path" aria-label="To path" value="${esc(r.to)}" data-redirect-to data-idx="${i}" />
      <label class="g-checkbox redirect-permanent" title="Permanent redirect (301)">
        <input type="checkbox" data-redirect-permanent data-idx="${i}" ${r.permanent ? 'checked' : ''} />
        <span class="g-checkbox-box"></span>
        Permanent
      </label>
      <button type="button" class="btn btn-icon-only btn-danger" data-remove-redirect="${i}" title="Remove redirect" aria-label="Remove redirect">${ICON.x}</button>
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
    const site = sites.find(x => x.id === activeSiteId);
    const collabNow = JSON.stringify(collabDraft.map(m => [m.user_id, m.site_role]));
    if (site?.my_role === 'owner' && collabSiteId === activeSiteId && collabNow !== collabOriginal) {
      await api('PUT', `/sites/${activeSiteId}/members`, { members: collabDraft.map(m => ({ user_id: m.user_id, site_role: m.site_role })) });
      collabOriginal = collabNow;
    }
    const scanTa = document.getElementById('settings-scan-allowlist');
    if (!document.getElementById('scan-allowlist-wrap').classList.contains('hidden') && scanTa.value !== scanTa.dataset.original) {
      await api('PUT', `/sites/${activeSiteId}/scan-allowlist`, { hosts: scanTa.value.split(/[\s,]+/).filter(Boolean) });
    }
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
  setSupportBanner('modal-logs', site);
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
  if (statusEl) statusEl.className = `status status-starting${statusEl.classList.contains('status-pill') ? ' status-pill' : ''}`;
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

// Pull the site's runtime image and rebuild its container from it (~2s downtime).
async function recreateSiteContainer(site) {
  const ok = await confirmDialog({
    title: `Update container for "${site.name}"?`,
    body: 'Pulls the latest runtime image and recreates the container with the same settings. The site is unreachable for about two seconds.',
    confirmLabel: 'Update container',
    warn: true,
  });
  if (!ok) return;
  toast(`Updating container for ${site.name}…`, 'info');
  try {
    await api('POST', `/sites/${site.id}/recreate`);
    toast(`${site.name}: container updated`, 'success');
    await loadSites();
  } catch (err) { toast(err.message, 'error'); }
}

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
  setSupportBanner('modal-analytics', site);
  openModal('modal-analytics');
  await loadAnalytics();
}

async function loadAnalytics() {
  if (!activeAnalyticsSiteId) return;
  const loadingEl = document.getElementById('analytics-loading');
  const bodyEl = document.getElementById('analytics-body');
  loadingEl.innerHTML = skeletonBlock(3);
  loadingEl.classList.remove('hidden');
  bodyEl.classList.add('hidden');
  try {
    const data = await api('GET', `/analytics/${activeAnalyticsSiteId}?period=${activeAnalyticsPeriod}`);
    renderAnalytics(data);
    loadingEl.classList.add('hidden');
    bodyEl.classList.remove('hidden');
  } catch (err) {
    viewError(loadingEl, viewErrorMessage('analytics', err), loadAnalytics);
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
    `<span class="text-warning">${clientPct}% client</span> · <span class="text-danger">${serverPct}% server</span>`;

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
          <div class="spark-bar ${s.hasError ? 'spark-bar-error' : ''}" style="--bar-h:${Math.max(s.requests / maxVal * 100, s.requests > 0 ? 4 : 0)}%"></div>
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
  setSupportBanner('modal-dns', site);
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
      proxied: { cls: 'ok',      text: `Proxied via Cloudflare — traffic reaches this server through the ${(data.cnames || []).some(c => /cfargotunnel/i.test(c)) ? 'tunnel' : 'proxy'} (resolves to ${data.resolved.join(', ') || 'Cloudflare'})` },
      pending: { cls: 'pending', text: 'DNS not resolving yet — records may not have propagated' },
      wrong:   { cls: 'wrong',   text: `Resolves to ${data.resolved.join(', ')} — expected ${data.serverIp}` },
      unknown: { cls: 'pending', text: 'Server IP unknown — set PUBLIC_IP in .env to enable checks' },
      error:   { cls: 'wrong',   text: `DNS lookup error: ${data.error}` },
    };
    const { cls, text } = bannerMap[data.status] || bannerMap.error;
    setBanner(cls, text);
    const dot = document.getElementById(`dns-dot-${siteId}`);
    if (dot) dot.className = `dns-indicator dns-indicator-${dnsDotClass(data.status)}`;
    if (data.status === 'proxied') switchDnsTab('cloudflare');
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
  const tone = { ok: 'callout-success', wrong: 'callout-danger', pending: 'callout-warning', checking: '' }[state] || '';
  document.getElementById('dns-status-banner').className = `callout ${tone}`.trim();
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
  document.querySelectorAll('.dns-tab').forEach(t => {
    const active = t.dataset.tab === name;
    t.classList.toggle('is-active', active);
    t.setAttribute('aria-selected', String(active));
  });
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
  document.getElementById('history-list').innerHTML = '<p class="list-empty">Loading…</p>';
  setSupportBanner('modal-history', site);
  openModal('modal-history');
  await refreshHistory(site.id, site.name);
}

async function refreshHistory(siteId, siteName) {
  try {
    const history = await api('GET', `/deploy/${siteId}/history`);
    const list = document.getElementById('history-list');
    if (!history.length) {
      list.innerHTML = '<p class="list-empty">No deployments yet.</p>';
      return;
    }
    list.innerHTML = history.map((d, i) => `
      <div class="list-row history-row">
        <span class="history-num">#${history.length - i}</span>
        <div class="list-row-main">
          <span class="list-row-title"><span class="truncate">${esc(d.filename)}</span></span>
          <span class="list-row-meta">${esc(timeAgo(d.deployed_at))} · ${fmtBytes(d.size)}</span>
        </div>
        <div class="list-row-actions">${i === 0
          ? '<span class="badge badge-ok">Live</span>'
          : `<button type="button" class="btn btn-sm" data-rollback="${d.id}">Roll back…</button>`}</div>
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
    document.getElementById('history-list').innerHTML = `<p class="list-empty text-danger">${esc(err.message)}</p>`;
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
  images_pulled:    ICON.download,
  containers_update_started: ICON.box,
  container_recreated:       ICON.box,
  container_recreate_failed: ICON.warning,
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
  preview_created:  'Preview created',
  preview_swapped:  'Preview went live',
  preview_removed:  'Preview discarded',
  images_pulled:    'Images pulled',
  containers_update_started: 'Container update started',
  container_recreated:       'Container updated',
  container_recreate_failed: 'Container update failed',
  deploy_review:    'Upload waiting for review',
  deploy_blocked:   'Deploy blocked',
  deploy_approved:  'Upload approved',
  deploy_rejected:  'Upload rejected',
  deploy_withdrawn: 'Upload withdrawn',
  deploy_findings:  'Scanner findings',
};

let activitySiteFilter = null;
let activityLevelFilter = null;

async function loadActivity() {
  const filtersEl = document.getElementById('activity-filters');
  if (filtersEl && sites.length) {
    filtersEl.innerHTML = `
      <div class="chip-group" role="group" aria-label="Filter by site">
        <span class="chip-group-label">Site</span>
        <button type="button" class="chip ${activitySiteFilter === null ? 'is-active' : ''}" data-filter="" aria-pressed="${activitySiteFilter === null}">All</button>
        ${sites.map(s => `<button type="button" class="chip ${activitySiteFilter === s.id ? 'is-active' : ''}" data-filter="${esc(s.id)}" aria-pressed="${activitySiteFilter === s.id}">${esc(s.name)}</button>`).join('')}
      </div>
      <div class="chip-group" role="group" aria-label="Filter by level">
        <span class="chip-group-label">Level</span>
        <button type="button" class="chip activity-level-chip ${activityLevelFilter === null ? 'is-active' : ''}" data-level="" aria-pressed="${activityLevelFilter === null}">All</button>
        <button type="button" class="chip chip-err activity-level-chip ${activityLevelFilter === 'error' ? 'is-active' : ''}" data-level="error" aria-pressed="${activityLevelFilter === 'error'}">Errors</button>
        <button type="button" class="chip chip-warn activity-level-chip ${activityLevelFilter === 'warn' ? 'is-active' : ''}" data-level="warn" aria-pressed="${activityLevelFilter === 'warn'}">Warnings</button>
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

  const feedEl = document.getElementById('activity-feed');
  if (feedEl) feedEl.innerHTML = `<div class="card-body">${skeletonBlock(4)}</div>`;

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
      feed.innerHTML = '<div class="empty-state"><h3>No activity yet</h3><p>Deploys, restarts and outages show up here.</p></div>';
      return;
    }
    feed.innerHTML = events.map(e => {
      const isDown  = e.event === 'down';
      const isUp    = e.event === 'up';
      const isError = e.level === 'error';
      const isWarn  = e.level === 'warn';
      const actor = (e.actor && e.actor !== 'system') ? e.actor : '';
      const label = EVENT_LABELS[e.event] || (e.fn ? esc(e.fn) : esc(e.event));
      const meta = [
        actor ? `by <span class="activity-actor">${esc(actor)}</span>` : '',
        e.detail ? esc(e.detail) : '',
        e.duration_ms != null ? `took ${fmtDuration(e.duration_ms)}` : '',
      ].filter(Boolean).join(' · ');
      const emphasis = isDown ? 'activity-item-down' : isUp ? 'activity-item-up' : isError ? 'activity-item-error' : isWarn ? 'activity-item-warn' : '';
      const levelText = isError ? 'Error' : isWarn ? 'Warning' : 'Info';
      return `
        <div class="activity-item ${emphasis}">
          <span class="activity-icon" title="${levelText}" aria-label="${levelText}">${EVENT_ICONS[e.event] || (isError ? ICON.x : isWarn ? ICON.warning : ICON.dot)}</span>
          <div class="activity-body">
            <div class="activity-line">
              <span class="activity-label">${label}</span>
              <span class="activity-site">${esc(e.site_name === 'grimport' ? 'Grimport' : e.site_name || 'Panel')}</span>
            </div>
            ${meta ? `<div class="activity-detail">${meta}</div>` : ''}
          </div>
          <span class="activity-time">${esc(timeAgo(e.created_at))}</span>
        </div>`;
    }).join('');
  } catch (err) {
    if (feedEl) viewError(feedEl, viewErrorMessage('activity', err), loadActivity);
  }
}

function fmtDuration(ms) {
  if (ms < 1000) return `${ms} ms`;
  const s = ms / 1000;
  return `${s % 1 === 0 ? s.toFixed(0) : s.toFixed(1)} s`;
}

// One relative-time format for the whole panel: "just now", "5m ago",
// "in 2d". Past and future both work (invitation expiry, token expiry).
function timeAgo(ts) {
  const diff = Math.floor(Date.now() / 1000) - ts;
  const abs = Math.abs(diff);
  if (abs < 60) return 'just now';
  const unit = abs < 3600 ? `${Math.floor(abs / 60)}m` : abs < 86400 ? `${Math.floor(abs / 3600)}h` : `${Math.floor(abs / 86400)}d`;
  return diff >= 0 ? `${unit} ago` : `in ${unit}`;
}
// One absolute format: "16 Sep 2026, 18:10" in the viewer's locale order.
function formatDate(ts, { time = false } = {}) {
  const d = new Date(ts * 1000);
  return d.toLocaleString(undefined, time
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}
// Initials from the name people see (display name first, username second).
function initialsFor(user) {
  const name = String(user?.display_name || user?.username || '?').trim();
  const words = name.split(/[\s._-]+/).filter(Boolean);
  const letters = words.length > 1 ? words[0][0] + words[1][0] : name.slice(0, 2);
  return letters.toUpperCase();
}

// ── View switching ────────────────────────────────────────
// One entry point for sidebar, bottom tab bar and the command palette. Every
// .nav-item sharing the same data-view gets the active class so sidebar and
// bottom bar always agree.
function navigateTo(view) {
  if (!document.getElementById(`view-${view}`)) return;
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
  document.querySelectorAll(`.nav-item[data-view="${view}"]`).forEach(n => n.classList.add('active'));
  document.querySelectorAll('.view').forEach(v => v.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  if (view === 'panel-settings') loadPanelSettings();
  if (view === 'activity') loadActivity();
  if (view === 'overview') loadOverview();
  if (view === 'deployments') loadDeployments();
  if (view === 'logs') loadLogsView();
  if (view === 'domains') loadDomains();
  const main = document.querySelector('.main');
  if (main) main.scrollTop = 0;
  requestAnimationFrame(revealActiveTabs);
}
function bindNavItem(item) {
  item.addEventListener('click', e => { e.preventDefault(); navigateTo(item.dataset.view); });
}
document.querySelectorAll('.nav-item[data-view]').forEach(bindNavItem);

// ── Phone bottom tab bar — customisable ───────────────────────────────────
// Up to TABBAR_MAX views, order and selection stored per browser; "More"
// (static in the markup) always opens the sidebar drawer with everything else.
const TABBAR_KEY = 'grimport-tabbar';
const TABBAR_MAX = 4;
const TABBAR_DEFAULT = ['sites', 'overview', 'activity'];
const TABBAR_VIEWS = [
  { id: 'sites',          label: 'Sites',       icon: ICON.grid },
  { id: 'overview',       label: 'Overview',    icon: ICON.pie },
  { id: 'activity',       label: 'Activity',    icon: ICON.list },
  { id: 'deployments',    label: 'Deployments', icon: ICON.upload,   roles: ['admin', 'editor'] },
  { id: 'logs',           label: 'Logs',        icon: ICON.logs,     roles: ['admin', 'editor'] },
  { id: 'domains',        label: 'Domains',     icon: ICON.globe,    roles: ['admin'] },
  { id: 'panel-settings', label: 'Settings',    icon: ICON.settings, roles: ['admin'] },
];
function tabbarAllowed(v) { return !v.roles || v.roles.includes(currentUser.role); }
function tabbarView(id) { return TABBAR_VIEWS.find(v => v.id === id); }
function getTabbarPrefs() {
  let ids = null;
  try { ids = JSON.parse(localStorage.getItem(TABBAR_KEY)); } catch {}
  if (!Array.isArray(ids)) ids = [...TABBAR_DEFAULT];
  return ids.filter(id => { const v = tabbarView(id); return v && tabbarAllowed(v); }).slice(0, TABBAR_MAX);
}
function setTabbarPrefs(ids) {
  try { localStorage.setItem(TABBAR_KEY, JSON.stringify(ids)); } catch {}
}
function renderBottomNav() {
  const wrap = document.getElementById('bottom-nav-tabs');
  if (!wrap) return;
  const active = document.querySelector('.sidebar .nav-item.active')?.dataset.view || 'sites';
  const ids = getTabbarPrefs();
  if (!ids.length) ids.push('sites');
  wrap.innerHTML = ids.map(id => {
    const v = tabbarView(id);
    return `<a href="#" class="nav-item bottom-nav-item${id === active ? ' active' : ''}" data-view="${id}">
      <span class="bottom-nav-icon" aria-hidden="true">${v.icon}</span><span>${esc(v.label)}</span>
    </a>`;
  }).join('');
  wrap.querySelectorAll('.nav-item[data-view]').forEach(bindNavItem);
}

let tabbarDraft = [];
function renderTabbarList() {
  const list = document.getElementById('tabbar-list');
  const hint = document.getElementById('tabbar-hint');
  if (!list) return;
  const allowed = TABBAR_VIEWS.filter(tabbarAllowed);
  const ordered = [
    ...tabbarDraft.map(id => allowed.find(v => v.id === id)).filter(Boolean),
    ...allowed.filter(v => !tabbarDraft.includes(v.id)),
  ];
  const full = tabbarDraft.length >= TABBAR_MAX;
  list.innerHTML = ordered.map(v => {
    const pos = tabbarDraft.indexOf(v.id);
    const on = pos !== -1;
    return `
      <div class="list-row tabbar-row${on ? '' : ' is-off'}">
        <label class="g-checkbox" title="${on ? 'Remove from bar' : full ? 'Bar is full' : 'Show in bar'}">
          <input type="checkbox" data-tab-toggle="${v.id}" ${on ? 'checked' : ''} ${!on && full ? 'disabled' : ''} aria-label="Show ${esc(v.label)} in the tab bar" />
          <span class="g-checkbox-box"></span>
        </label>
        <span class="tabbar-row-pos">${on ? pos + 1 : ''}</span>
        <span class="list-row-lead">${v.icon}</span>
        <div class="list-row-main"><span class="list-row-title">${esc(v.label)}</span></div>
        <span class="list-row-actions">
          <button type="button" class="btn btn-sm btn-icon-only" data-tab-move="${v.id}" data-dir="-1" title="Move up" aria-label="Move ${esc(v.label)} up" ${!on || pos === 0 ? 'disabled' : ''}>${ICON.arrowUp}</button>
          <button type="button" class="btn btn-sm btn-icon-only" data-tab-move="${v.id}" data-dir="1" title="Move down" aria-label="Move ${esc(v.label)} down" ${!on || pos === tabbarDraft.length - 1 ? 'disabled' : ''}>${ICON.arrowDown}</button>
        </span>
      </div>`;
  }).join('');
  if (hint) hint.textContent = `${tabbarDraft.length} of ${TABBAR_MAX} slots used · "More" is always shown`;

  list.querySelectorAll('[data-tab-toggle]').forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.dataset.tabToggle;
      if (cb.checked) { if (!tabbarDraft.includes(id) && tabbarDraft.length < TABBAR_MAX) tabbarDraft.push(id); }
      else tabbarDraft = tabbarDraft.filter(x => x !== id);
      renderTabbarList();
    });
  });
  list.querySelectorAll('[data-tab-move]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.tabMove;
      const dir = Number(btn.dataset.dir);
      const i = tabbarDraft.indexOf(id);
      const j = i + dir;
      if (i === -1 || j < 0 || j >= tabbarDraft.length) return;
      [tabbarDraft[i], tabbarDraft[j]] = [tabbarDraft[j], tabbarDraft[i]];
      renderTabbarList();
    });
  });
}
function openTabbarModal() {
  if (typeof closePhoneMenu === 'function') closePhoneMenu();
  tabbarDraft = getTabbarPrefs();
  renderTabbarList();
  openModal('modal-tabbar');
}
document.getElementById('btn-tabbar-customize')?.addEventListener('click', openTabbarModal);
document.getElementById('btn-tabbar-customize-settings')?.addEventListener('click', openTabbarModal);
document.getElementById('btn-tabbar-reset')?.addEventListener('click', () => {
  tabbarDraft = TABBAR_DEFAULT.filter(id => tabbarAllowed(tabbarView(id)));
  renderTabbarList();
});
document.getElementById('btn-tabbar-save')?.addEventListener('click', () => {
  const ids = tabbarDraft.length ? tabbarDraft : [...TABBAR_DEFAULT];
  setTabbarPrefs(ids);
  renderBottomNav();
  closeModal('modal-tabbar');
  toast('Tab bar saved', 'success');
});

// ── Phone off-canvas sidebar (task H1) ─────────────────────────────────────
// Toggles the sidebar as an off-canvas drawer on phone widths; the bottom
// bar's "More" button and the top-left menu button both drive it.

(function () {
  const menuBtn = document.getElementById('btn-phone-menu');
  const moreBtn = document.getElementById('btn-bottom-nav-more');
  const scrim = document.getElementById('phone-sidebar-scrim');
  if (!menuBtn && !moreBtn) return;

  function setOpen(open) {
    document.body.classList.toggle('phone-menu-open', open);
    scrim?.classList.toggle('hidden', !open);
    menuBtn?.setAttribute('aria-expanded', String(open));
  }
  function toggleOpen() { setOpen(!document.body.classList.contains('phone-menu-open')); }

  menuBtn?.addEventListener('click', toggleOpen);
  moreBtn?.addEventListener('click', toggleOpen);
  scrim?.addEventListener('click', () => setOpen(false));
  window.closePhoneMenu = () => setOpen(false);
  document.querySelectorAll('.sidebar .nav-item[data-view]').forEach(item => {
    item.addEventListener('click', () => setOpen(false));
  });
})();

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
    if (tab.dataset.stab === 'notifications') { loadNotifSettings(); loadNotifUnreadSummary(); loadAlertSettings(); }
  });
});

// ── Panel settings ────────────────────────────────────────
async function loadPanelSettings() {
  if (!isPanelAdmin()) { loadTokens(); return; }
  loadImageStatus();
  loadPolicies();
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
  if (currentUser?.role === 'admin') loadBackups();
}

// ── Backups ───────────────────────────────────────────────
function fmtBytes(n) {
  if (!n) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  while (n >= 1024 && i < units.length - 1) { n /= 1024; i++; }
  return `${n.toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

async function loadBackups() {
  const listEl = document.getElementById('backups-list');
  const form = document.getElementById('form-backup-schedule');
  if (!listEl) return;
  try {
    const data = await api('GET', '/backups');
    if (form) {
      form.elements['backup_interval_hours'].value = data.backup_interval_hours ?? 0;
      form.elements['backup_keep'].value = data.backup_keep ?? 7;
    }
    if (!data.backups.length) {
      listEl.innerHTML = '<p class="list-empty">No backups yet.</p>';
      return;
    }
    listEl.innerHTML = data.backups.map(b => `
      <div class="list-row backup-row">
        <div class="list-row-main">
          <span class="list-row-title"><span class="truncate mono" title="${esc(b.name)}">${esc(b.name)}</span></span>
          <span class="list-row-meta">${fmtBytes(b.size)} · ${esc(formatDate(b.created, { time: true }))}</span>
        </div>
      </div>
    `).join('');
  } catch (err) { toast(err.message, 'error'); }
}

document.getElementById('btn-backup-create')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-backup-create');
  btn.disabled = true;
  btn.textContent = 'Creating…';
  try {
    await api('POST', '/backups');
    toast('Backup created', 'success');
    loadBackups();
  } catch (err) { toast(err.message, 'error'); }
  btn.disabled = false;
  btn.textContent = 'Create backup now';
});

document.getElementById('form-backup-schedule')?.addEventListener('submit', async e => {
  e.preventDefault();
  const backup_interval_hours = Number(e.target.elements['backup_interval_hours'].value) || 0;
  const backup_keep = Number(e.target.elements['backup_keep'].value) || 7;
  try {
    await api('PUT', '/backups/settings', { backup_interval_hours, backup_keep });
    toast('Backup schedule saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

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

    document.querySelectorAll('[data-fill="panel-domain"]').forEach(el => { el.textContent = domain; });
    if (baseDomain) document.querySelectorAll('[data-fill="base-domain"]').forEach(el => { el.textContent = baseDomain; });

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
      banner.className = 'callout callout-success';
      document.getElementById('ssl-status-icon').innerHTML = ICON.check;
      document.getElementById('ssl-status-title').textContent = 'SSL active';
      document.getElementById('ssl-status-detail').textContent = `Certificates managed by Let's Encrypt. Registered email: ${cfg.acmeEmail}`;
    } else if (cfg.sslReady && !isHttps) {
      banner.className = 'callout callout-warning';
      document.getElementById('ssl-status-icon').innerHTML = ICON.shield;
      document.getElementById('ssl-status-title').textContent = 'Certificates ready, panel still on HTTP';
      document.getElementById('ssl-status-detail').textContent = 'Per-site SSL is available. To enable HTTPS on the panel itself, uncomment the HTTPS labels in docker-compose.yml and restart.';
    } else {
      banner.className = 'callout';
      document.getElementById('ssl-status-icon').innerHTML = ICON.lock;
      document.getElementById('ssl-status-title').textContent = 'Let\'s Encrypt is not set up';
      document.getElementById('ssl-status-detail').textContent = 'Enter an email below to request certificates. Behind Cloudflare you can skip this.';
    }
  } catch (err) {
    toast('Failed to load server info: ' + err.message, 'error');
  }
}

// ── API Tokens ────────────────────────────────────────────
function limitTokenRoleOptions() {
  const sel = document.querySelector('#form-create-token select[name="token_role"]');
  if (!sel || isPanelAdmin()) return;
  const allowed = currentUser.role === 'editor' ? ['editor', 'viewer'] : ['viewer'];
  [...sel.options].forEach(o => { if (!allowed.includes(o.value)) o.remove(); });
  sel.value = allowed[0];
}
// ── Web push (Settings > Notifications > Push notifications) ──
const PUSH_GROUPS = ['availability', 'deploys', 'requests', 'account'];
let pushRegistration = null;
let pushSubscription = null;
let pushVapidKey = null;

function pushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
}
function isIosBrowserTab() {
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return ios && !window.matchMedia('(display-mode: standalone)').matches && !navigator.standalone;
}
function deviceLabel() {
  const ua = navigator.userAgent;
  const os = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1) ? 'iPad'
    : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : 'Device';
  const browser = /Edg\//.test(ua) ? 'Edge' : /Firefox\//.test(ua) ? 'Firefox' : /Chrome\//.test(ua) ? 'Chrome' : /Safari\//.test(ua) ? 'Safari' : 'Browser';
  return `${os} · ${browser}`;
}
function urlBase64ToUint8Array(base64) {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}
function selectedPushGroups() {
  const picked = [...document.querySelectorAll('input[name="push_group"]:checked')].map(i => i.value);
  return picked.length === PUSH_GROUPS.length ? null : picked;
}
function setPushStatus(text, cls) {
  const el = document.getElementById('push-status');
  if (!el) return;
  el.className = `status ${cls || 'status-muted'}`;
  el.innerHTML = `${GLYPH}${esc(text)}`;
}
function setPushHint(text) {
  const el = document.getElementById('push-hint');
  if (!el) return;
  el.textContent = text || '';
  el.classList.toggle('hidden', !text);
}

async function refreshPushCard() {
  const toggle = document.getElementById('btn-push-toggle');
  const testBtn = document.getElementById('btn-push-test');
  if (!toggle) return;
  if (!pushSupported()) {
    setPushStatus('Not supported in this browser', 'status-muted');
    setPushHint(isIosBrowserTab() ? 'On iPhone and iPad, add Grimport to the Home Screen first (Share, Add to Home Screen) and open it from there.' : '');
    toggle.disabled = true;
    renderPushDevices();
    return;
  }
  try {
    pushRegistration = await navigator.serviceWorker.ready;
    pushSubscription = await pushRegistration.pushManager.getSubscription();
  } catch { pushSubscription = null; }
  if (Notification.permission === 'denied') {
    setPushStatus('Blocked in browser settings', 'status-down');
    setPushHint('Allow notifications for this site in the browser or system settings, then try again.');
    toggle.disabled = true;
    testBtn.classList.add('hidden');
  } else if (pushSubscription) {
    setPushStatus('On for this device', 'status-up');
    setPushHint('');
    toggle.disabled = false;
    toggle.textContent = 'Disable on this device';
    toggle.classList.remove('btn-primary');
    testBtn.classList.remove('hidden');
  } else {
    setPushStatus('Off for this device', 'status-muted');
    setPushHint(isIosBrowserTab() ? 'On iPhone and iPad, add Grimport to the Home Screen first (Share, Add to Home Screen) and open it from there.' : '');
    toggle.disabled = isIosBrowserTab();
    toggle.textContent = 'Enable on this device';
    toggle.classList.add('btn-primary');
    testBtn.classList.add('hidden');
  }
  renderPushDevices();
}

async function renderPushDevices() {
  const wrap = document.getElementById('push-devices');
  if (!wrap) return;
  try {
    const devices = await api('GET', '/push/subscriptions');
    if (!devices.length) { wrap.innerHTML = '<p class="settings-desc muted">No devices yet.</p>'; return; }
    const mine = pushSubscription?.endpoint;
    wrap.innerHTML = devices.map(d => {
      const isThis = d.endpoint === mine;
      if (isThis) {
        document.querySelectorAll('input[name="push_group"]').forEach(i => { i.checked = d.events === null || d.events.includes(i.value); });
      }
      const groups = d.events === null ? 'all events' : (d.events.length ? d.events.join(', ') : 'no events');
      return `
      <div class="list-row">
        <div class="list-row-main">
          <span class="list-row-title">${esc(d.label || 'Device')}${isThis ? ' <span class="badge badge-accent">This device</span>' : ''}</span>
          <span class="list-row-meta">${esc(groups)} · added ${esc(timeAgo(d.created_at))}${d.last_used ? ` · last push ${esc(timeAgo(d.last_used))}` : ''}</span>
        </div>
        <div class="list-row-actions"><button type="button" class="btn btn-sm btn-danger" data-push-remove="${esc(d.id)}">Remove</button></div>
      </div>`;
    }).join('');
    wrap.querySelectorAll('[data-push-remove]').forEach(btn => btn.addEventListener('click', async () => {
      try {
        await api('DELETE', `/push/subscriptions/${btn.dataset.pushRemove}`);
        const d = devices.find(x => x.id === btn.dataset.pushRemove);
        if (d && d.endpoint === mine && pushSubscription) { try { await pushSubscription.unsubscribe(); } catch {} }
        toast('Device removed', 'success');
        refreshPushCard();
      } catch (err) { toast(err.message, 'error'); }
    }));
  } catch { wrap.innerHTML = ''; }
}

async function enablePush() {
  const toggle = document.getElementById('btn-push-toggle');
  toggle.disabled = true;
  try {
    const perm = await Notification.requestPermission();
    if (perm !== 'granted') throw new Error('Notifications were not allowed');
    if (!pushVapidKey) pushVapidKey = (await api('GET', '/push/vapid-key')).publicKey;
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(pushVapidKey) });
    await api('POST', '/push/subscribe', { subscription: sub.toJSON(), events: selectedPushGroups(), label: deviceLabel() });
    toast('Push notifications enabled on this device', 'success');
  } catch (err) {
    toast(err.message || 'Could not enable push', 'error');
  }
  refreshPushCard();
}

async function disablePush() {
  const toggle = document.getElementById('btn-push-toggle');
  toggle.disabled = true;
  try {
    if (pushSubscription) {
      await api('POST', '/push/unsubscribe', { endpoint: pushSubscription.endpoint });
      try { await pushSubscription.unsubscribe(); } catch {}
    }
    toast('Push notifications disabled on this device', 'success');
  } catch (err) { toast(err.message, 'error'); }
  refreshPushCard();
}

(function bindPushCard() {
  const toggle = document.getElementById('btn-push-toggle');
  if (!toggle) return;
  toggle.addEventListener('click', () => (pushSubscription ? disablePush() : enablePush()));
  document.getElementById('btn-push-test').addEventListener('click', async () => {
    try {
      const r = await api('POST', '/push/test', pushSubscription ? { endpoint: pushSubscription.endpoint } : {});
      toast(r.sent ? 'Test notification sent' : 'Push service did not accept it', r.sent ? 'success' : 'error');
    } catch (err) { toast(err.message, 'error'); }
  });
  document.querySelectorAll('input[name="push_group"]').forEach(i => i.addEventListener('change', async () => {
    if (!pushSubscription) return;
    try {
      const devices = await api('GET', '/push/subscriptions');
      const mine = devices.find(d => d.endpoint === pushSubscription.endpoint);
      if (mine) { await api('PUT', `/push/subscriptions/${mine.id}`, { events: selectedPushGroups() }); toast('Saved for this device', 'success'); }
    } catch (err) { toast(err.message, 'error'); }
  }));
})();

// ── Pull-to-refresh (touch devices, top of the scroll container) ──
function currentViewName() {
  const v = document.querySelector('.view:not(.hidden)');
  return v ? v.id.replace(/^view-/, '') : 'sites';
}
async function refreshCurrentView() {
  const view = currentViewName();
  try {
    if (view === 'sites') await loadSites();
    else if (view === 'overview') await loadOverview();
    else if (view === 'activity') await loadActivity();
    else if (view === 'deployments') await loadDeployments();
    else if (view === 'logs') await loadLogsView();
    else if (view === 'domains') await loadDomains();
    else if (view === 'panel-settings') await loadPanelSettings();
    await loadNotifications();
  } catch { /* individual loaders show their own errors */ }
}
(function initPullToRefresh() {
  const main = document.querySelector('.main');
  if (!main || !('ontouchstart' in window)) return;
  const THRESHOLD = 72;
  const bar = document.createElement('div');
  bar.className = 'ptr-indicator';
  bar.setAttribute('aria-hidden', 'true');
  bar.innerHTML = ICON.refreshCw;
  main.prepend(bar);
  let startY = 0, dist = 0, pulling = false;
  // On phones the document scrolls (main grows); on tablets main scrolls.
  // Only a pull that starts at the very top of either may refresh.
  const scrolledDown = () => main.scrollTop > 0 || (document.scrollingElement?.scrollTop || 0) > 0;
  main.addEventListener('touchstart', e => {
    if (scrolledDown() || document.querySelector('.modal-backdrop:not(.hidden)') || document.body.classList.contains('phone-menu-open')) { pulling = false; return; }
    startY = e.touches[0].clientY; dist = 0; pulling = true;
  }, { passive: true });
  main.addEventListener('touchmove', e => {
    if (!pulling) return;
    dist = e.touches[0].clientY - startY;
    if (dist <= 0 || scrolledDown()) { bar.style.height = '0px'; return; }
    bar.style.height = `${Math.min(dist, THRESHOLD + 24) * 0.55}px`;
    bar.classList.toggle('ptr-ready', dist >= THRESHOLD);
  }, { passive: true });
  const end = async () => {
    if (!pulling) return;
    pulling = false;
    if (dist >= THRESHOLD) {
      bar.classList.add('ptr-loading');
      await refreshCurrentView();
    }
    bar.classList.remove('ptr-ready', 'ptr-loading');
    bar.style.height = '0px';
  };
  main.addEventListener('touchend', end, { passive: true });
  main.addEventListener('touchcancel', end, { passive: true });
})();

// Tab strips scroll sideways on narrow screens: keep the selected tab in view.
document.addEventListener('click', e => {
  const tab = e.target.closest('.tabs .tab');
  if (tab) tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
function revealActiveTabs() {
  document.querySelectorAll('.tabs').forEach(strip => {
    const active = strip.querySelector('.tab.is-active, .tab[aria-selected="true"]');
    if (active && strip.scrollWidth > strip.clientWidth) {
      strip.scrollLeft = active.offsetLeft - (strip.clientWidth - active.offsetWidth) / 2;
    }
    updateTabEdges(strip);
    if (!strip.dataset.edgeWatch) {
      strip.dataset.edgeWatch = '1';
      strip.addEventListener('scroll', () => updateTabEdges(strip), { passive: true });
    }
  });
}
// Marks which edge of a scrollable tab strip hides more tabs (CSS fades it).
function updateTabEdges(strip) {
  const max = strip.scrollWidth - strip.clientWidth;
  const start = strip.scrollLeft > 1, end = max > 1 && strip.scrollLeft < max - 1;
  if (start && end) strip.dataset.more = 'both';
  else if (end) strip.dataset.more = 'end';
  else if (start) strip.dataset.more = 'start';
  else delete strip.dataset.more;
}
window.addEventListener('resize', revealActiveTabs);

function initMcpConnect() {
  const ep = document.getElementById('mcp-endpoint');
  const snippet = document.getElementById('mcp-snippet');
  if (!ep || !snippet) return;
  const url = `${location.origin}/mcp`;
  ep.textContent = url;
  document.querySelectorAll('[data-fill="panel-url"]').forEach(el => { el.textContent = location.origin; });
  const cmd = `claude mcp add --transport http grimport ${url} --header "Authorization: Bearer <your token>"`;
  snippet.textContent = cmd;
  document.getElementById('btn-copy-mcp').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(cmd); toast('Command copied', 'success'); } catch { toast('Copy failed', 'error'); }
  });
}
initMcpConnect();

async function loadTokens() {
  limitTokenRoleOptions();
  const list = document.getElementById('tokens-list');
  list.innerHTML = `<table class="data-table"><tbody>${skeletonRows(3, 4)}</tbody></table>`;
  try {
    const tokens = await api('GET', tokensPath());
    renderTokens(tokens);
  } catch (err) {
    viewError(list, viewErrorMessage('API tokens', err), loadTokens);
  }
}

function renderTokenScope(siteScope) {
  if (!siteScope || siteScope === 'all') return '<span class="badge badge-accent">All sites</span>';
  const chips = siteScope.map(sid => {
    const s = sites.find(x => x.id === sid);
    return s ? `<span class="badge badge-neutral">${esc(s.name)}</span>` : '';
  }).filter(Boolean).join('');
  return `<div class="chip-wrap">${chips || '<span class="cell-muted">None</span>'}</div>`;
}

function renderTokenScopeSites() {
  const wrap = document.getElementById('token-scope-sites');
  if (!sites.length) {
    wrap.innerHTML = '<p class="list-empty">No sites created yet.</p>';
    return;
  }
  wrap.innerHTML = sites.map(s => `
    <label class="g-checkbox">
      <input type="checkbox" name="token_site" value="${s.id}" />
      <span class="g-checkbox-box"></span>
      ${esc(s.name)} <span class="field-optional">${esc(s.domain)}</span>
    </label>
  `).join('');
}

document.getElementById('token-scope-all').addEventListener('change', e => {
  const wrap = document.getElementById('token-scope-sites');
  wrap.classList.toggle('hidden', e.target.checked);
  if (!e.target.checked) renderTokenScopeSites();
});

function renderTokens(tokens) {
  const list = document.getElementById('tokens-list');
  const disclosure = document.getElementById('token-create-disclosure');
  if (!tokens.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.shield}</div>
        <h3>No tokens yet</h3>
        <p>Create one to deploy from scripts, CI or Claude.</p>
      </div>`;
    if (disclosure) disclosure.open = true;
    return;
  }
  list.innerHTML = `
    <table class="data-table data-table-stack">
      <thead><tr><th>Name</th><th>Role</th><th>Sites</th><th>Expires</th><th>Last used</th><th><span class="hidden">Actions</span></th></tr></thead>
      <tbody>
        ${tokens.map(t => `
          <tr>
            <td class="cell-primary">
              <div class="cell-stack">
                <span class="cell-title cell-nowrap">${esc(t.name)}${t.oauth_client_id ? ` <span class="badge badge-vio" title="Issued by signing in from an app (OAuth); refreshes itself">Connected app</span>` : ''}</span>
                <span class="cell-sub">Created ${esc(formatDate(t.created_at))}</span>
              </div>
            </td>
            <td data-label="Role"><span class="badge badge-neutral">${esc(t.role || 'admin')}</span></td>
            <td data-label="Sites">${renderTokenScope(t.site_scope)}</td>
            <td data-label="Expires" class="cell-nowrap">${t.expires_at ? esc(timeAgo(t.expires_at)) : '<span class="cell-muted">Never</span>'}</td>
            <td data-label="Last used" class="cell-nowrap">${t.last_used ? esc(timeAgo(t.last_used)) : '<span class="cell-muted">Never</span>'}</td>
            <td><div class="cell-actions"><button type="button" class="btn btn-sm btn-danger" data-revoke="${t.id}">Revoke…</button></div></td>
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
      await api('DELETE', tokensPath(btn.dataset.revoke));
      toast('Token revoked', 'success');
      loadTokens();
    });
  });
}

document.getElementById('form-create-token').addEventListener('submit', async e => {
  e.preventDefault();
  const name = e.target.elements['token_name'].value.trim();
  if (!name) return;
  const role = e.target.elements['token_role'].value;
  const expiry = e.target.elements['token_expiry'].value;
  const scopeAll = document.getElementById('token-scope-all').checked;
  const site_scope = scopeAll ? 'all' : [...document.querySelectorAll('#token-scope-sites input[name="token_site"]:checked')].map(cb => cb.value);
  try {
    const result = await api('POST', tokensPath(), {
      name,
      role,
      site_scope,
      expires_in_days: expiry ? Number(expiry) : null,
    });
    e.target.reset();
    document.getElementById('token-scope-all').checked = true;
    document.getElementById('token-scope-sites').classList.add('hidden');
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
    await api('PATCH', `/users/${currentUser.id}`, {
      current_password: form.elements['old_password'].value,
      password: form.elements['new_password'].value,
    });
    form.reset();
    setPasswordStrengthHint('');
    toast('Password changed', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Site container images (Settings → General → Updates) ──
let imageStatusPollTimer = null;

function renderImageStatus(st) {
  const summary = document.getElementById('img-update-summary');
  const list = document.getElementById('img-update-list');
  const applyBtn = document.getElementById('btn-images-apply');
  if (!summary || !list) return;
  const tracked = st.sites.filter(x => !x.missing);
  const outdated = st.sites.filter(x => x.outdated);
  if (!tracked.length) {
    summary.innerHTML = '<span class="muted">No site containers yet.</span>';
    list.classList.add('hidden');
    if (applyBtn) applyBtn.disabled = true;
    return;
  }
  summary.innerHTML = outdated.length
    ? `<span class="badge badge-warn">${outdated.length} outdated</span><span><strong>${outdated.length}</strong> of ${tracked.length} container${tracked.length !== 1 ? 's' : ''} run an older image or still sit on the shared network.</span>`
    : `<span class="badge badge-ok">Up to date</span><span>All ${tracked.length} container${tracked.length !== 1 ? 's' : ''} run the newest locally available image. Pull to check the registry.</span>`;
  list.innerHTML = st.sites.map(x => `
    <div class="list-row img-update-row">
      <div class="list-row-main">
        <span class="list-row-title">${esc(x.name)}</span>
        <span class="list-row-meta is-mono">${esc(x.image)}${x.container_image_id ? ` · ${esc(x.container_image_id)}` : ''}</span>
      </div>
      ${x.missing
        ? '<span class="status status-no-container">' + GLYPH + 'No container</span>'
        : x.outdated
          ? '<span class="status status-warn" title="' + esc(x.outdated_reason === 'network' ? 'Still on the shared network; recreate to isolate it' : x.outdated_reason === 'image+network' ? 'Older image and still on the shared network' : 'Older image than the one on this server') + '">' + GLYPH + 'Outdated (' + esc(x.outdated_reason === 'image+network' ? 'image + network' : x.outdated_reason || 'image') + ')</span>'
          : '<span class="status status-ok">' + GLYPH + 'Current</span>'}
    </div>`).join('');
  list.classList.remove('hidden');
  if (applyBtn) applyBtn.disabled = outdated.length === 0;
}

async function loadImageStatus() {
  const summary = document.getElementById('img-update-summary');
  if (!summary) return;
  try {
    const st = await api('GET', '/update/images');
    renderImageStatus(st);
    if (st.job && (st.job.status === 'pulling' || st.job.status === 'recreating' || st.job.status === 'starting')) {
      pollImageJob();
    }
  } catch (err) {
    summary.innerHTML = `<span class="field-help err">${esc(err.message)}</span>`;
  }
}

function setImageButtonsBusy(busy) {
  const pullBtn = document.getElementById('btn-images-pull');
  const applyBtn = document.getElementById('btn-images-apply');
  if (pullBtn) pullBtn.disabled = busy;
  if (applyBtn && busy) applyBtn.disabled = true;
}

function showImageProgress(text, spinning) {
  const el = document.getElementById('img-update-progress');
  if (!el) return;
  if (!text) { el.classList.add('hidden'); el.innerHTML = ''; return; }
  el.classList.remove('hidden');
  el.innerHTML = `${spinning ? '<span class="spinner" aria-hidden="true"></span>' : ''}<span>${esc(text)}</span>`;
}

function pollImageJob() {
  clearInterval(imageStatusPollTimer);
  setImageButtonsBusy(true);
  imageStatusPollTimer = setInterval(async () => {
    const job = await api('GET', '/update/images/status').catch(() => null);
    if (!job) return;
    if (job.status === 'pulling' || job.status === 'recreating' || job.status === 'starting') {
      showImageProgress(job.message, true);
      return;
    }
    clearInterval(imageStatusPollTimer);
    setImageButtonsBusy(false);
    showImageProgress(job.message, false);
    if (job.status === 'done') toast(job.message, job.results.some(r => !r.ok) ? 'warn' : 'success');
    if (job.status === 'error') toast(`Container update failed: ${job.message}`, 'error');
    await loadImageStatus();
    await loadSites();
  }, 1500);
}

document.getElementById('btn-images-pull')?.addEventListener('click', async () => {
  const btn = document.getElementById('btn-images-pull');
  btn.disabled = true;
  showImageProgress('Pulling runtime images from the registry…', true);
  try {
    const st = await api('POST', '/update/images/pull');
    const changed = (st.pulled || []).filter(p => p.updated).map(p => p.tag);
    showImageProgress(changed.length ? `New image${changed.length !== 1 ? 's' : ''}: ${changed.join(', ')}` : 'All images already current.', false);
    renderImageStatus(st);
  } catch (err) {
    showImageProgress('', false);
    toast(err.message, 'error');
  }
  btn.disabled = false;
});

document.getElementById('btn-images-apply')?.addEventListener('click', async () => {
  const ok = await confirmDialog({
    title: 'Update outdated site containers?',
    body: 'Containers are recreated one at a time with identical settings. Each affected site is unreachable for about two seconds.',
    confirmLabel: 'Update containers',
    warn: true,
  });
  if (!ok) return;
  try {
    await api('POST', '/update/images/apply', { pull: true });
    showImageProgress('Starting…', true);
    pollImageJob();
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

// ── First-run onboarding wizard (task J1) ──────────────────
// Shown once, right after login, when GET /api/auth/me reports
// needsOnboarding (admin still on the seeded password, or no base domain
// configured, and the wizard has never been dismissed). Every step reuses
// an existing endpoint — password change (PATCH /api/users/:id), settings
// (PUT /api/settings) — nothing new is invented server-side beyond the
// onboarding_done flag itself.
let obStep = 1;
let obPasswordChanged = false;

function showOnboardingStep(n) {
  obStep = n;
  document.querySelectorAll('.onboarding-panel').forEach(p => {
    p.classList.toggle('hidden', Number(p.dataset.onboardingPanel) !== n);
  });
  document.querySelectorAll('.onboarding-step-dot').forEach(d => {
    const step = Number(d.dataset.step);
    d.classList.toggle('is-active', step === n);
    d.classList.toggle('is-done', step < n);
  });
  const steps = document.getElementById('onboarding-steps');
  if (steps) steps.setAttribute('aria-valuenow', String(n));
  const backBtn = document.getElementById('btn-onboarding-back');
  if (backBtn) backBtn.classList.toggle('hidden', n === 1);
  const nextBtn = document.getElementById('btn-onboarding-next');
  if (nextBtn) nextBtn.textContent = n === 4 ? 'Finish' : 'Next';
}

function openOnboarding() {
  obPasswordChanged = false;
  const domainInput = document.querySelector('#onboarding-backdrop [name="site_base_domain"]');
  const acmeInput = document.querySelector('#onboarding-backdrop [name="acme_email"]');
  if (domainInput) domainInput.value = config.siteBaseDomain || '';
  if (acmeInput) acmeInput.value = config.acmeEmail || '';
  const pwForm = document.getElementById('form-onboarding-password');
  if (pwForm) pwForm.reset();
  showOnboardingStep(1);
  openModal('onboarding-backdrop');
}

async function onboardingNext() {
  const nextBtn = document.getElementById('btn-onboarding-next');
  if (obStep === 2) {
    const newPw = document.getElementById('ob-new-password').value;
    const curPw = document.getElementById('ob-current-password').value;
    if (newPw || curPw) {
      if (newPw.length < 8) return toast('New password must be at least 8 characters', 'error');
      if (!curPw) return toast('Current password required', 'error');
      nextBtn.disabled = true;
      try {
        await api('PATCH', `/users/${currentUser.id}`, { current_password: curPw, password: newPw });
        obPasswordChanged = true;
        toast('Password changed', 'success');
      } catch (err) {
        toast(err.message, 'error');
        nextBtn.disabled = false;
        return;
      }
      nextBtn.disabled = false;
    }
  } else if (obStep === 3) {
    const domain = document.getElementById('ob-base-domain').value.trim().toLowerCase();
    try {
      await api('PUT', '/settings', { site_base_domain: domain });
      config = await api('GET', '/config').catch(() => config);
    } catch (err) { return toast(err.message, 'error'); }
  } else if (obStep === 4) {
    const email = document.getElementById('ob-acme-email').value.trim();
    if (email) {
      try {
        await api('PUT', '/settings', { acme_email: email });
        config = await api('GET', '/config').catch(() => config);
      } catch (err) { return toast(err.message, 'error'); }
    }
    return finishOnboarding();
  }
  showOnboardingStep(obStep + 1);
}

function onboardingBack() {
  if (obStep > 1) showOnboardingStep(obStep - 1);
}

function setOnboardingReminder(show) {
  const banner = document.getElementById('onboarding-reminder-banner');
  if (banner) banner.classList.toggle('hidden', !show);
}

async function finishOnboarding() {
  try { await api('PUT', '/settings', { onboarding_done: true }); }
  catch (err) { toast(err.message, 'error'); }
  closeModal('onboarding-backdrop');
  setOnboardingReminder(!obPasswordChanged);
  document.querySelector('.nav-item[data-view="sites"]')?.click();
}

document.getElementById('btn-onboarding-next')?.addEventListener('click', onboardingNext);
document.getElementById('btn-onboarding-back')?.addEventListener('click', onboardingBack);
document.getElementById('btn-onboarding-skip')?.addEventListener('click', finishOnboarding);
document.getElementById('btn-onboarding-skip-2')?.addEventListener('click', finishOnboarding);
document.getElementById('btn-onboarding-reminder-dismiss')?.addEventListener('click', () => setOnboardingReminder(false));
document.getElementById('btn-onboarding-reminder-fix')?.addEventListener('click', () => {
  setOnboardingReminder(false);
  document.querySelector('.nav-item[data-view="panel-settings"]')?.click();
  document.getElementById('ptab-security')?.click();
});

// ── In-panel Help ─────────────────────────────────────────
const HELP_PAGES = [
  { label: 'Getting started', path: 'Getting-Started.md' },
  { label: 'Deploying sites', path: 'Deploying-Sites.md' },
  { label: 'Users and roles', path: 'Users-and-Roles.md' },
  { label: 'Security model', path: 'Security-Model.md' },
  { label: 'Mobile and PWA', path: 'Mobile-and-PWA.md' },
  { label: 'API reference', path: 'API-Reference.md' },
];

function openHelpModal() {
  const list = document.getElementById('help-modal-list');
  if (list) {
    list.innerHTML = HELP_PAGES.map(p =>
      `<a href="https://github.com/boeldner/grimport/blob/main/docs/wiki/${p.path}" target="_blank" rel="noopener">${ICON.book}<span>${esc(p.label)}</span></a>`
    ).join('');
  }
  const versionEl = document.getElementById('help-modal-version');
  if (versionEl) versionEl.textContent = config.version ? `Grimport v${config.version}` : 'Grimport';
  window.closePhoneMenu?.();
  openModal('modal-help');
}
document.getElementById('nav-help-btn')?.addEventListener('click', e => { e.preventDefault(); openHelpModal(); });

// ── Member first-run wizard (Phase 3) ──────────────────────
// Shown once to an invited member who owns zero sites, right after login —
// mirrors the admin onboarding wizard's step/skip mechanics above, but under
// its own class names/ids (member-onboarding-* / mob-*) and its own
// dismissal flag (localStorage, not a server setting — every member decides
// for themselves, there's no single "done" for the whole panel).
let mobStep = 1;
let mobTemplateId = 'blank';

function showMobStep(n) {
  mobStep = n;
  document.querySelectorAll('.member-onboarding-panel').forEach(p => {
    p.classList.toggle('hidden', Number(p.dataset.mobPanel) !== n);
  });
  document.querySelectorAll('.member-onboarding-step-dot').forEach(d => {
    const step = Number(d.dataset.mobStep);
    d.classList.toggle('is-active', step === n);
    d.classList.toggle('is-done', step < n);
  });
  const steps = document.getElementById('mob-steps');
  if (steps) steps.setAttribute('aria-valuenow', String(n));
  const backBtn = document.getElementById('btn-mob-back');
  if (backBtn) backBtn.classList.toggle('hidden', n === 1);
  const nextBtn = document.getElementById('btn-mob-next');
  if (nextBtn) nextBtn.textContent = n === 3 ? 'Done' : 'Next';
}

// `preloadedMe` lets init() (below) reuse the /users/me call it already made
// to decide whether to open this at all; called with no args it fetches its
// own (e.g. from the screenshot tool, which opens this directly).
async function openMemberOnboarding(preloadedMe) {
  mobTemplateId = 'blank';
  document.getElementById('mob-site-name').value = '';
  document.getElementById('mob-create-error').classList.add('hidden');
  document.getElementById('mob-create-status').classList.add('hidden');
  document.getElementById('mob-create-result').classList.add('hidden');
  const createBtn = document.getElementById('btn-mob-create');
  createBtn.disabled = false;
  createBtn.textContent = 'Create';

  const meFull = preloadedMe || await api('GET', '/users/me').catch(() => ({}));
  const base = meFull.subdomain_base || '';
  document.getElementById('mob-address-lede').innerHTML = base
    ? `Every site you create gets its own address automatically — <code>yoursite.${esc(base)}</code>. No DNS to configure.`
    : 'Every site you create gets its own address automatically — once the owner sets up a base domain.';
  document.getElementById('mob-no-base-domain').classList.toggle('hidden', !!base);
  document.getElementById('mob-domain-hint').textContent = base
    ? `Will be created as <name>.${base}`
    : '';
  const max = currentUser.capabilities?.max_sites;
  document.getElementById('mob-quota').textContent = Number.isFinite(max) ? max : '∞';
  const runtimes = currentUser.capabilities?.runtimes || ['static'];
  document.getElementById('mob-runtimes').textContent = runtimes.map(r => r === 'static' ? 'Static' : r.charAt(0).toUpperCase() + r.slice(1)).join(', ');

  const templates = await loadTemplates();
  renderTemplateCards(document.getElementById('mob-template-picker'), templates, 'blank', id => { mobTemplateId = id; });

  showMobStep(1);
  openModal('member-onboarding');
}

function finishMemberOnboarding() {
  try { localStorage.setItem('grimport-member-onboarded', '1'); } catch {}
  closeModal('member-onboarding');
  loadSites();
}

function mobNext() {
  if (mobStep >= 3) return finishMemberOnboarding();
  showMobStep(mobStep + 1);
}
function mobBack() {
  if (mobStep > 1) showMobStep(mobStep - 1);
}

document.getElementById('btn-mob-next')?.addEventListener('click', mobNext);
document.getElementById('btn-mob-back')?.addEventListener('click', mobBack);
document.getElementById('btn-mob-skip')?.addEventListener('click', finishMemberOnboarding);
document.getElementById('btn-mob-skip-2')?.addEventListener('click', finishMemberOnboarding);

document.getElementById('btn-mob-create')?.addEventListener('click', async () => {
  const name = document.getElementById('mob-site-name').value.trim();
  const errorEl = document.getElementById('mob-create-error');
  const statusEl = document.getElementById('mob-create-status');
  const resultEl = document.getElementById('mob-create-result');
  errorEl.classList.add('hidden');
  resultEl.classList.add('hidden');
  if (!name) {
    errorEl.textContent = 'Give your site a name first.';
    errorEl.classList.remove('hidden');
    return;
  }

  const btn = document.getElementById('btn-mob-create');
  btn.disabled = true;
  statusEl.classList.remove('hidden');
  statusEl.textContent = 'Creating…';
  try {
    const site = await api('POST', '/sites', { name });
    if (mobTemplateId) {
      statusEl.textContent = 'Applying template…';
      try { await api('POST', `/templates/${mobTemplateId}/apply/${site.id}`); } catch { /* site still comes up with the default page */ }
    }
    statusEl.textContent = 'Online';
    resultEl.innerHTML = `<a href="http://${esc(site.domain)}" target="_blank" rel="noopener" class="mob-result-link">${esc(site.domain)}</a>`;
    resultEl.classList.remove('hidden');
    btn.textContent = 'Created';
    await loadSites();
  } catch (err) {
    statusEl.classList.add('hidden');
    errorEl.textContent = err.message;
    errorEl.classList.remove('hidden');
    btn.disabled = false;
  }
});

// ── Init ──────────────────────────────────────────────────
async function init() {
  const me = await fetch('/api/auth/me').then(r => r.json()).catch(() => ({ authenticated: false }));
  if (!me.authenticated) { window.location.href = '/login.html'; return; }
  currentUser = { id: me.id || '', role: me.role || 'admin', platform_role: me.platform_role || (me.role === 'admin' ? 'admin' : me.role === 'editor' ? 'member' : 'guest'), capabilities: me.capabilities || {}, username: me.username || '', display_name: me.display_name || null };
  applyRoleUI();
  renderBottomNav();
  config = await api('GET', '/config').catch(() => config);
  if (config.version) {
    const el = document.getElementById('sidebar-version');
    if (el) el.textContent = `Grimport v${config.version}`;
  }
  await loadSites();
  await loadNotifications();
  if (isPanelAdmin()) checkForUpdate();
  // Deep link from a push notification: /?view=domains etc.
  try {
    const wanted = new URLSearchParams(location.search).get('view');
    if (wanted) { navigateTo(wanted); history.replaceState(null, '', location.pathname); }
  } catch {}
  if (isPanelAdmin()) { loadDomainRequests(); loadDeployReviews(); }
  if (me.needsOnboarding) openOnboarding();
  // Member first-run wizard: only members, only once, only while they own
  // nothing yet (never admins/owners — they get the wizard above — and
  // never guests, who cannot create sites at all).
  if (currentUser.platform_role === 'member') {
    try {
      if (!localStorage.getItem('grimport-member-onboarded')) {
        const meFull = await api('GET', '/users/me');
        if ((meFull.owned_sites || []).length === 0) openMemberOnboarding(meFull);
      }
    } catch { /* if this fails we just skip the wizard, never block login */ }
  }
  setInterval(loadSites, 15_000);
  setInterval(loadNotifications, 30_000);
  if (isPanelAdmin()) setInterval(checkForUpdate, 6 * 60 * 60 * 1000); // re-check every 6h
}
init();

// ── Notifications ─────────────────────────────────────────
let notifDropdownOpen = false;

const bellBtn = document.getElementById('btn-bell');
const notifDropdown = document.getElementById('notif-dropdown');

function setNotifDropdownOpen(open) {
  notifDropdownOpen = open;
  notifDropdown.classList.toggle('hidden', !open);
  bellBtn.setAttribute('aria-expanded', String(open));
}

bellBtn.addEventListener('click', e => {
  e.stopPropagation();
  setNotifDropdownOpen(!notifDropdownOpen);
  if (notifDropdownOpen) loadNotifications();
});

document.addEventListener('click', e => {
  if (notifDropdownOpen && !notifDropdown.contains(e.target) && e.target !== bellBtn) {
    setNotifDropdownOpen(false);
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
        <span class="notif-title">Grimport ${esc(cachedUpdateData.latest)} is available</span>
        <span class="notif-detail">Open to install the update.</span>
      </div>
      <span></span>
    </div>` : '';

  const NOTIF_ICONS = {
    unknown_domain: ICON.globe, site_down: ICON.warning, site_up: ICON.check,
    support_action: ICON.shield, domain_request: ICON.globe, domain_decided: ICON.check,
    site_suspended: ICON.warning, site_unsuspended: ICON.check, site_transferred: ICON.layers,
    deploy_review: ICON.eye, deploy_blocked: ICON.warning, deploy_findings: ICON.shield, deploy_decided: ICON.check,
  };
  list.innerHTML = updateHtml + notifs.map(n => {
    let data = {};
    try { data = JSON.parse(n.data || '{}'); } catch {}

    let detailHtml = n.detail ? esc(n.detail) : '';
    if (n.type === 'unknown_domain' && data.domain) {
      detailHtml += `${detailHtml ? ' · ' : ''}<button type="button" class="notif-link" data-domain="${esc(data.domain)}">Connect it</button>`;
    }

    const actionsHtml = (n.type === 'site_down' && data.siteId) ? `
        <span class="notif-actions">
          <button type="button" class="btn btn-xs" data-open-logs="${esc(data.siteId)}">Open logs</button>
          <button type="button" class="btn btn-xs" data-restart-site="${esc(data.siteId)}">Restart</button>
        </span>` : '';

    return `
      <div class="notif-item notif-type-${esc(n.type)} ${n.read ? '' : 'notif-unread'}" data-notif-id="${n.id}">
        <span class="notif-icon">${NOTIF_ICONS[n.type] || ICON.dot}</span>
        <div class="notif-body">
          <span class="notif-title">${esc(n.title)}</span>
          ${detailHtml ? `<span class="notif-detail">${detailHtml}</span>` : ''}
          ${actionsHtml}
        </div>
        <div class="notif-meta">
          <span class="notif-time">${esc(timeAgo(n.created_at))}</span>
          <button type="button" class="icon-btn icon-btn-xs notif-dismiss" data-dismiss="${n.id}" title="Dismiss" aria-label="Dismiss">${ICON.x}</button>
        </div>
      </div>`;
  }).join('');

  list.querySelectorAll('[data-dismiss]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      await api('DELETE', `/notifications/${btn.dataset.dismiss}`).catch(err => toast(err.message, 'error'));
      loadNotifications();
    });
  });

  list.querySelectorAll('.notif-link[data-domain]').forEach(el => {
    el.addEventListener('click', e => {
      e.stopPropagation();
      setNotifDropdownOpen(false);
      openConnectDomain(el.dataset.domain);
    });
  });

  list.querySelectorAll('[data-open-logs]').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      const site = sites.find(s => s.id === btn.dataset.openLogs);
      setNotifDropdownOpen(false);
      if (site) openLogs(site);
    });
  });

  list.querySelectorAll('[data-restart-site]').forEach(btn => {
    btn.addEventListener('click', async e => {
      e.stopPropagation();
      setNotifDropdownOpen(false);
      await siteAction(btn.dataset.restartSite, 'start');
    });
  });

  // Pinned update notification click — open update modal
  const updateItem = document.getElementById('notif-update-item');
  if (updateItem) {
    updateItem.addEventListener('click', () => {
      setNotifDropdownOpen(false);
      openModal('modal-update');
      startUpdateFlow();
    });
  }

  // Domain-request notifications — always navigate to Domains, read or not.
  list.querySelectorAll('.notif-item.notif-type-domain_request').forEach(item => {
    item.addEventListener('click', async () => {
      setNotifDropdownOpen(false);
      navigateTo('domains');
      if (!item.classList.contains('notif-unread')) return;
      await api('POST', `/notifications/${item.dataset.notifId}/read`).catch(() => {});
      loadNotifications();
    });
  });

  // Regular notifications — mark as read on click
  list.querySelectorAll('.notif-item:not(#notif-update-item):not(.notif-type-domain_request)').forEach(item => {
    item.addEventListener('click', async () => {
      if (!item.classList.contains('notif-unread')) return;
      await api('POST', `/notifications/${item.dataset.notifId}/read`).catch(() => {});
      item.classList.remove('notif-unread');
      loadNotifications();
    });
  });
}

document.getElementById('btn-notif-read-all').addEventListener('click', async () => {
  await api('POST', '/notifications/read-all').catch(err => toast(err.message, 'error'));
  loadNotifications();
});

// ── Connect domain modal ──────────────────────────────────
function openConnectDomain(domain) {
  connectDomain = domain;
  document.getElementById('connect-domain-name').textContent = domain;
  const siteList = document.getElementById('connect-site-list');
  if (!sites.length) {
    siteList.innerHTML = '<p class="list-empty">No sites yet. Create one above.</p>';
  } else {
    siteList.innerHTML = sites.map(s => `
      <div class="list-row">
        <div class="list-row-main">
          <span class="list-row-title">${esc(s.name)}</span>
          <span class="list-row-meta is-mono">${esc(s.domain)}</span>
        </div>
        <div class="list-row-actions"><button type="button" class="btn btn-sm" data-assign-site="${s.id}">Assign…</button></div>
      </div>`).join('');
    siteList.querySelectorAll('[data-assign-site]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const site = sites.find(s => s.id === btn.dataset.assignSite);
        if (!site) return;
        const ok = await confirmDialog({
          title: `Move ${connectDomain} to "${site.name}"?`,
          body: `The site stops answering on ${site.domain} and serves ${connectDomain} instead. The container restarts briefly.`,
          confirmLabel: 'Change domain',
          warn: true,
        });
        if (!ok) return;
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
  const list = document.getElementById('webhooks-list');
  list.innerHTML = `<table class="data-table"><tbody>${skeletonRows(3, 5)}</tbody></table>`;
  try {
    const webhooks = await api('GET', '/settings/webhooks');
    renderWebhookList(webhooks);
  } catch (err) {
    viewError(list, viewErrorMessage('webhooks', err), loadWebhooks);
  }
}

function renderWebhookList(webhooks) {
  const list = document.getElementById('webhooks-list');
  if (!webhooks.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.zap}</div>
        <h3>No webhooks yet</h3>
        <p>Notify chat tools or CI when deploys and outages happen.</p>
      </div>`;
    return;
  }
  list.innerHTML = `
    <table class="data-table data-table-stack">
      <thead><tr><th>Name</th><th>URL</th><th>Events</th><th>Enabled</th><th><span class="hidden">Actions</span></th></tr></thead>
      <tbody>
        ${webhooks.map(w => {
          let events = [];
          try { events = JSON.parse(w.events || '[]'); } catch {}
          return `
          <tr>
            <td class="cell-primary"><span class="cell-title">${esc(w.name)}</span></td>
            <td data-label="URL" class="cell-mono cell-url" title="${esc(w.url)}">${esc(w.url)}</td>
            <td data-label="Events">${events.length ? `<div class="chip-wrap">${events.map(ev => `<span class="badge badge-neutral badge-mono">${esc(ev)}</span>`).join('')}</div>` : '<span class="cell-muted">All events</span>'}</td>
            <td data-label="Enabled">
              <label class="g-toggle" title="${w.enabled ? 'Enabled' : 'Disabled'}">
                <input type="checkbox" class="webhook-toggle" data-id="${w.id}" ${w.enabled ? 'checked' : ''} aria-label="Enabled" />
                <span class="g-toggle-track"></span>
              </label>
            </td>
            <td>
              <div class="cell-actions">
                <button type="button" class="btn btn-sm" data-test-webhook="${w.id}">Send test</button>
                <button type="button" class="btn btn-sm btn-icon-only btn-danger" data-delete-webhook="${w.id}" title="Delete webhook" aria-label="Delete webhook">${ICON.trash}</button>
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
  const { role, username, display_name } = currentUser;

  // Sidebar user info — display name when set, username as the title attribute
  const usernameEl = document.getElementById('sidebar-username');
  const roleBadge = document.getElementById('sidebar-role-badge');
  const avatarEl = document.getElementById('sidebar-avatar');
  if (usernameEl) { usernameEl.textContent = display_name || username; usernameEl.title = username; }
  if (roleBadge) { const pr = currentUser.platform_role || role; roleBadge.textContent = pr; roleBadge.dataset.role = pr; }
  if (avatarEl) avatarEl.textContent = initialsFor({ username, display_name });

  // Hide admin-only elements for non-admins (platform role owner/admin)
  if (!isPanelAdmin()) {
    document.querySelectorAll('.admin-only, .nav-admin, .nav-section-admin').forEach(el => el.classList.add('hidden'));
    // Settings stays reachable for everyone (own tokens, password): open it on the Tokens tab
    document.querySelectorAll('#view-panel-settings .tab').forEach(t => { t.classList.remove('is-active'); t.setAttribute('aria-selected', 'false'); });
    document.querySelectorAll('#view-panel-settings .tab-panel').forEach(p => p.classList.add('hidden'));
    const tokTab = document.getElementById('ptab-tokens'); const tokPanel = document.getElementById('spanel-tokens');
    if (tokTab) { tokTab.classList.add('is-active'); tokTab.setAttribute('aria-selected', 'true'); }
    if (tokPanel) tokPanel.classList.remove('hidden');
    // Settings sits in the Admin group in the sidebar; give it its own label for members
    const adminLabel = document.querySelector('.nav-section-admin');
    if (adminLabel) { adminLabel.textContent = 'Account'; adminLabel.classList.remove('hidden'); }
  }
  const btnNew = document.getElementById('btn-new-site');
  if (btnNew) btnNew.classList.toggle('hidden', !canCreateSites());
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
    const active = b.dataset.runtime === runtime;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('new-site-static-opts').classList.toggle('hidden', isApp || isPhp);
  document.getElementById('new-site-app-opts').classList.toggle('hidden', !isApp);
  document.getElementById('new-site-template-section')?.classList.toggle('hidden', isApp || isPhp);
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
    const active = b.dataset.runtime === runtime;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('app-config-fields').classList.toggle('hidden', !isApp);
  document.getElementById('env-vars-section')?.classList.toggle('hidden', !isApp);
  const descMap = {
    static: 'Static files served by nginx. Upload a .zip to deploy.',
    php: 'PHP files served by Apache. Upload a .zip with your PHP app.',
    node: 'Node.js app. Upload your source .zip; the build command runs on each deploy.',
    python: 'Python app. Upload your source .zip; the build command runs on each deploy.',
  };
  const appDesc = document.getElementById('app-config-desc');
  if (appDesc) appDesc.textContent = descMap[runtime] || '';
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
    list.innerHTML = '<p class="list-empty">No variables yet.</p>';
    return;
  }
  list.innerHTML = entries.map(([k, v], i) => `
    <div class="kv-row env-var-row">
      <input class="g-input is-mono" type="text" placeholder="KEY" aria-label="Variable name" value="${esc(k)}" data-env-key data-idx="${i}" />
      <input class="g-input is-mono" type="text" placeholder="value" aria-label="Variable value" value="${esc(v)}" data-env-val data-idx="${i}" />
      <button type="button" class="btn btn-icon-only btn-danger" data-remove-env="${i}" title="Remove variable" aria-label="Remove variable">${ICON.x}</button>
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
  let envVars = {};
  try { envVars = JSON.parse(site.env_vars || '{}'); } catch {}
  renderEnvVarList(envVars);
}

// ── Users management ──────────────────────────────────────
let cachedUsers = [];
let cachedPresets = null;

async function ensurePresetsLoaded() {
  if (cachedPresets) return cachedPresets;
  cachedPresets = await api('GET', '/users/presets');
  return cachedPresets;
}

function presetDescription(p) {
  if (!p) return '';
  return `${p.max_sites} site${p.max_sites === 1 ? '' : 's'} · ${p.runtimes.join(', ')} · ${p.max_upload_mb} MB uploads · ${p.disk_quota_mb} MB disk · custom domains: ${p.custom_domains}`;
}

async function loadUsers() {
  const list = document.getElementById('users-list');
  list.innerHTML = `<table class="data-table"><tbody>${skeletonRows(3, 5)}</tbody></table>`;
  try {
    const [users] = await Promise.all([api('GET', '/users'), ensurePresetsLoaded()]);
    cachedUsers = users;
    renderUserList(users);
  } catch (err) {
    viewError(list, viewErrorMessage('users', err), loadUsers);
  }
}

function renderUserList(users) {
  const list = document.getElementById('users-list');
  if (!users.length) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${ICON.user}</div>
        <h3>No users yet</h3>
        <p>Invite someone to grant access.</p>
      </div>`;
    return;
  }
  list.innerHTML = `
    <table class="data-table data-table-stack">
      <thead><tr><th>User</th><th>Role</th><th>Status</th><th>Sites</th><th>Last login</th><th><span class="hidden">Actions</span></th></tr></thead>
      <tbody>
        ${users.map(u => {
          const isSelf = u.id === currentUser.id;
          const initials = initialsFor(u);
          const ownedSites = u.owned_sites || [];
          const memberSites = u.member_sites || [];
          const isAll = u.sites === 'all';
          const siteCount = ownedSites.length + memberSites.length;
          const siteNames = [...ownedSites, ...memberSites].map(s => s.name).join(', ');
          return `
          <tr>
            <td class="cell-primary">
              <div class="cell-user">
                <span class="avatar avatar-sm" aria-hidden="true">${esc(initials)}</span>
                <div class="cell-stack">
                  <span class="cell-title">${esc(u.display_name || u.username)}${isSelf ? ' <span class="badge badge-neutral">You</span>' : ''}</span>
                  ${u.display_name ? `<span class="cell-sub">@${esc(u.username)}</span>` : ''}
                </div>
              </div>
            </td>
            <td data-label="Role"><span class="badge badge-role-${esc(u.platform_role)}">${esc(u.platform_role.charAt(0).toUpperCase() + u.platform_role.slice(1))}</span></td>
            <td data-label="Status">${u.status === 'disabled' ? '<span class="badge badge-err">Disabled</span>' : '<span class="cell-muted">Active</span>'}</td>
            <td data-label="Sites" class="num">${isAll ? '<span class="cell-muted">All</span>' : (siteCount ? `<span title="${esc(siteNames)}">${siteCount}</span>` : '<span class="cell-muted">None</span>')}</td>
            <td data-label="Last login" class="cell-nowrap">${u.last_login_at ? esc(timeAgo(u.last_login_at)) : '<span class="cell-muted">Never</span>'}</td>
            <td>
              ${(!isSelf && u.platform_role !== 'owner') ? `
                <div class="cell-actions">
                  <button type="button" class="btn btn-sm" data-edit-user="${u.id}">Edit</button>
                  <button type="button" class="btn btn-sm" data-toggle-user="${u.id}" data-status="${u.status}">${u.status === 'disabled' ? 'Enable' : 'Disable'}</button>
                  <button type="button" class="btn btn-sm btn-icon-only btn-danger" data-delete-user="${u.id}" title="Delete user" aria-label="Delete ${esc(u.display_name || u.username)}">${ICON.trash}</button>
                </div>` : ''}
            </td>
          </tr>`;
        }).join('')}
      </tbody>
    </table>`;

  list.querySelectorAll('[data-delete-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const user = cachedUsers.find(u => u.id === btn.dataset.deleteUser);
      if (!user) return;
      const choice = await confirmDeleteUser(user);
      if (!choice) return;
      try {
        await api('DELETE', `/users/${user.id}${choice.deleteSites ? '?delete_sites=1' : ''}`);
        toast('User deleted', 'success');
        loadUsers();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  list.querySelectorAll('[data-toggle-user]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const next = btn.dataset.status === 'disabled' ? 'active' : 'disabled';
      if (next === 'disabled') {
        const ok = await confirmDialog({
          title: 'Disable this user?',
          body: 'Their sessions end immediately and their sites are suspended.',
          confirmLabel: 'Disable',
          danger: true,
        });
        if (!ok) return;
      }
      try {
        await api('PATCH', `/users/${btn.dataset.toggleUser}`, { status: next });
        loadUsers();
      } catch (err) { toast(err.message, 'error'); }
    });
  });

  list.querySelectorAll('[data-edit-user]').forEach(btn => {
    btn.addEventListener('click', () => openEditUser(btn.dataset.editUser));
  });
}

// Custom-delete dialog: transfer the user's sites to the owner (default) or
// delete them outright. Resolves to { deleteSites } or null (cancelled).
function confirmDeleteUser(user) {
  return new Promise(resolve => {
    const owned = user.owned_sites || [];
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
      <div class="modal confirm-dialog" role="dialog" aria-modal="true">
        <div class="modal-header"><h2>Delete user "${esc(user.username)}"?</h2></div>
        <div class="confirm-body">
          <p>They immediately lose access to this panel. This cannot be undone.</p>
          ${owned.length ? `
          <div class="role-select-list" role="radiogroup" aria-label="What happens to their sites">
            <label class="role-select-opt">
              <input type="radio" name="delete-user-sites" value="transfer" checked />
              <span class="role-select-body">
                <span class="role-select-name">Transfer ${owned.length} site${owned.length === 1 ? '' : 's'} to the owner</span>
                <span class="role-select-desc">Recommended — sites keep running</span>
              </span>
            </label>
            <label class="role-select-opt">
              <input type="radio" name="delete-user-sites" value="delete" />
              <span class="role-select-body">
                <span class="role-select-name">Delete their sites</span>
                <span class="role-select-desc">Removes containers and files permanently</span>
              </span>
            </label>
          </div>` : ''}
        </div>
        <div class="modal-actions">
          <button type="button" class="btn" data-role="confirm-cancel">Cancel</button>
          <button type="button" class="btn btn-danger" data-role="confirm-ok">Delete</button>
        </div>
      </div>`;
    document.body.appendChild(backdrop);
    trapFocus(backdrop.querySelector('.modal'), document.activeElement);
    function cleanup(result) { releaseFocusTrap(); backdrop.remove(); resolve(result); }
    backdrop.querySelector('[data-role="confirm-cancel"]').addEventListener('click', () => cleanup(null));
    backdrop.querySelector('[data-role="confirm-ok"]').addEventListener('click', () => {
      const choice = backdrop.querySelector('input[name="delete-user-sites"]:checked')?.value || 'transfer';
      cleanup({ deleteSites: choice === 'delete' });
    });
    backdrop.addEventListener('click', e => { if (e.target === backdrop) cleanup(null); });
    document.addEventListener('keydown', function onKey(e) {
      if (e.key === 'Escape') { document.removeEventListener('keydown', onKey); cleanup(null); }
    });
  });
}

// ── Edit user modal ───────────────────────────────────────
function setEditUserRole(role) {
  document.querySelectorAll('#edit-user-role-list input[name="role"]').forEach(input => {
    input.checked = input.value === role;
    input.closest('.role-select-opt').classList.toggle('is-active', input.value === role);
  });
}

function populateCapFields(caps) {
  const c = { runtimes: ['static'], max_sites: 0, max_upload_mb: 100, disk_quota_mb: 1000, custom_domains: 'approval', api_tokens: true, webhooks: false, advanced_ui: false, ...caps };
  document.getElementById('edit-user-max-sites').value = c.max_sites;
  document.querySelectorAll('#edit-user-runtimes input[type=checkbox]').forEach(cb => { cb.checked = (c.runtimes || []).includes(cb.value); });
  document.getElementById('edit-user-upload-mb').value = c.max_upload_mb;
  document.getElementById('edit-user-disk-mb').value = c.disk_quota_mb;
  document.getElementById('edit-user-custom-domains').value = c.custom_domains;
  document.getElementById('edit-user-api-tokens').checked = !!c.api_tokens;
  document.getElementById('edit-user-webhooks').checked = !!c.webhooks;
  document.getElementById('edit-user-advanced-ui').checked = !!c.advanced_ui;
}

function setEditUserPreset(name, overrideCaps) {
  document.getElementById('edit-user-preset').value = name;
  document.querySelectorAll('#edit-user-preset-seg button').forEach(b => {
    const active = b.dataset.preset === name;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('edit-user-custom-caps').classList.toggle('hidden', name !== 'custom');
  const caps = name === 'custom' ? (overrideCaps || {}) : (cachedPresets?.presets?.[name] || {});
  populateCapFields(caps);
}

document.getElementById('edit-user-preset-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-preset]');
  if (!btn) return;
  setEditUserPreset(btn.dataset.preset);
});

function samePreset(overrideCaps, presetCaps) {
  if (!overrideCaps || !presetCaps) return false;
  const keys = ['runtimes', 'max_sites', 'max_upload_mb', 'disk_quota_mb', 'custom_domains', 'api_tokens', 'webhooks', 'advanced_ui'];
  return keys.every(k => JSON.stringify(overrideCaps[k]) === JSON.stringify(presetCaps[k]));
}

async function openEditUser(userId) {
  const user = cachedUsers.find(u => u.id === userId);
  if (!user) return;
  await ensurePresetsLoaded();
  document.getElementById('edit-user-id').value = user.id;
  document.getElementById('edit-user-name').textContent = user.display_name || user.username;
  setEditUserRole(user.platform_role);

  const ownerOnly = currentUser.platform_role === 'owner';
  document.querySelectorAll('#edit-user-role-list [data-role-opt="admin"]').forEach(el => el.classList.toggle('hidden', !ownerOnly));
  const adminLocked = user.platform_role === 'admin' && !ownerOnly;
  document.getElementById('edit-user-admin-hint').classList.toggle('hidden', !adminLocked);
  document.querySelectorAll('#edit-user-role-list input[name="role"]').forEach(input => { input.disabled = adminLocked; });
  document.getElementById('form-edit-user').dataset.adminLocked = adminLocked ? '1' : '0';

  let presetName = 'custom';
  if (samePreset(user.capabilities_override, cachedPresets.presets.beginner)) presetName = 'beginner';
  else if (samePreset(user.capabilities_override, cachedPresets.presets.maker)) presetName = 'maker';
  setEditUserPreset(presetName, user.capabilities_override);

  openModal('modal-edit-user');
}

document.getElementById('form-edit-user').addEventListener('submit', async e => {
  e.preventDefault();
  const userId = document.getElementById('edit-user-id').value;
  const preset = document.getElementById('edit-user-preset').value;
  const payload = {};
  // Only an owner may change an admin's role — see openEditUser's adminLocked
  // check; omitting platform_role here avoids tripping that same guard
  // server-side for an unrelated preset/capability-only edit.
  if (e.target.dataset.adminLocked !== '1') {
    payload.platform_role = document.querySelector('#edit-user-role-list input[name="role"]:checked')?.value;
  }
  if (preset === 'custom') {
    payload.capabilities = {
      max_sites: Number(document.getElementById('edit-user-max-sites').value) || 0,
      runtimes: [...document.querySelectorAll('#edit-user-runtimes input:checked')].map(cb => cb.value),
      max_upload_mb: Number(document.getElementById('edit-user-upload-mb').value) || 1,
      disk_quota_mb: Number(document.getElementById('edit-user-disk-mb').value) || 1,
      custom_domains: document.getElementById('edit-user-custom-domains').value,
      api_tokens: document.getElementById('edit-user-api-tokens').checked,
      webhooks: document.getElementById('edit-user-webhooks').checked,
      advanced_ui: document.getElementById('edit-user-advanced-ui').checked,
    };
  } else {
    payload.preset = preset;
  }
  try {
    await api('PATCH', `/users/${userId}`, payload);
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
      platform_role: fd.get('platform_role'),
      preset: fd.get('preset'),
    });
    e.target.reset();
    toast('User created', 'success');
    loadUsers();
  } catch (err) { toast(err.message, 'error'); }
});

// ── Invitations ────────────────────────────────────────────
async function loadInvitations() {
  const wrap = document.getElementById('invitations-list');
  try {
    const invites = await api('GET', '/users/invitations');
    renderInvitations(invites);
  } catch (err) {
    wrap.innerHTML = `<p class="field-help err">${esc(err.message)}</p>`;
  }
}

function renderInvitations(invites) {
  const wrap = document.getElementById('invitations-list');
  const open = invites.filter(i => !i.used_by);
  if (!open.length) {
    wrap.innerHTML = '<p class="list-empty">No open invitations.</p>';
    return;
  }
  wrap.innerHTML = open.map(i => `
    <div class="list-row invite-row">
      <div class="list-row-main">
        <span class="list-row-title">${esc(i.label)} <span class="badge badge-role-${esc(i.platform_role)}">${esc(i.platform_role.charAt(0).toUpperCase() + i.platform_role.slice(1))}</span></span>
        <span class="list-row-meta">${i.expired ? 'Expired' : `Link expires ${esc(timeAgo(i.expires_at))}`}</span>
      </div>
      <div class="list-row-actions"><button type="button" class="btn btn-sm btn-danger" data-revoke-invite="${i.id}">Revoke</button></div>
    </div>`).join('');
  wrap.querySelectorAll('[data-revoke-invite]').forEach(btn => {
    btn.addEventListener('click', async () => {
      try { await api('DELETE', `/users/invitations/${btn.dataset.revokeInvite}`); loadInvitations(); }
      catch (err) { toast(err.message, 'error'); }
    });
  });
}

function setInvitePreset(name) {
  document.getElementById('invite-preset').value = name;
  document.querySelectorAll('#invite-preset-seg button').forEach(b => {
    const active = b.dataset.preset === name;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
  document.getElementById('invite-preset-desc').textContent = presetDescription(cachedPresets?.presets?.[name]);
}

document.getElementById('invite-preset-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-preset]');
  if (!btn) return;
  setInvitePreset(btn.dataset.preset);
});

document.getElementById('btn-open-invite').addEventListener('click', async () => {
  await ensurePresetsLoaded();
  document.getElementById('form-invite').reset();
  document.getElementById('form-invite').classList.remove('hidden');
  document.getElementById('invite-reveal').classList.add('hidden');
  document.querySelector('#invite-role-list input[value="member"]').checked = true;
  document.getElementById('invite-role-admin-opt').classList.toggle('hidden', currentUser.platform_role !== 'owner');
  setInvitePreset('beginner');
  document.getElementById('invite-ttl').value = 48;
  openModal('modal-invite');
});

document.getElementById('form-invite').addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(e.target);
  const platform_role = document.querySelector('#invite-role-list input[name="invite_role"]:checked')?.value || 'member';
  try {
    const inv = await api('POST', '/users/invitations', {
      label: fd.get('label').trim(),
      platform_role,
      preset: document.getElementById('invite-preset').value,
      ttl_hours: Number(fd.get('ttl_hours')) || 48,
    });
    document.getElementById('form-invite').classList.add('hidden');
    const reveal = document.getElementById('invite-reveal');
    document.getElementById('invite-reveal-value').textContent = inv.url;
    document.getElementById('btn-copy-invite').textContent = 'Copy';
    reveal.classList.remove('hidden');
    loadInvitations();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btn-copy-invite').addEventListener('click', e => {
  copyToClipboard(document.getElementById('invite-reveal-value').textContent, e.currentTarget);
});

// ── Profile (Settings > Security) ─────────────────────────
function loadProfile() {
  document.getElementById('f-display-name').value = currentUser.display_name || '';
  document.getElementById('f-profile-username').value = currentUser.username;
  const badge = document.getElementById('profile-role-badge');
  badge.textContent = currentUser.platform_role;
  badge.className = `badge badge-role-${currentUser.platform_role}`;
}

document.getElementById('form-profile').addEventListener('submit', async e => {
  e.preventDefault();
  const display_name = e.target.elements['display_name'].value.trim();
  try {
    await api('PATCH', `/users/${currentUser.id}`, { display_name: display_name || null });
    currentUser.display_name = display_name || null;
    applyRoleUI();
    toast('Profile saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Members policy (Settings > General) ───────────────────
function setPolicyDomainSeg(value) {
  document.getElementById('policy-domain-value').value = value;
  document.querySelectorAll('#policy-domain-seg button').forEach(b => {
    const active = b.dataset.value === value;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}
document.getElementById('policy-domain-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-value]');
  if (!btn) return;
  setPolicyDomainSeg(btn.dataset.value);
});

function setScanModeSeg(value) {
  document.getElementById('policy-scan-value').value = value;
  document.querySelectorAll('#policy-scan-seg button').forEach(b => {
    const active = b.dataset.value === value;
    b.classList.toggle('is-active', active);
    b.setAttribute('aria-pressed', String(active));
  });
}
document.getElementById('policy-scan-seg').addEventListener('click', e => {
  const btn = e.target.closest('button[data-value]');
  if (!btn) return;
  setScanModeSeg(btn.dataset.value);
});

async function loadPolicies() {
  try {
    const p = await api('GET', '/settings/policies');
    setPolicyDomainSeg(p.custom_domain_policy);
    document.getElementById('f-default-preset').value = p.default_preset;
    document.getElementById('f-invite-ttl').value = p.invite_ttl_hours;
    setScanModeSeg(p.scan_mode || 'quarantine');
    document.getElementById('f-scan-allowlist').value = (p.scan_script_allowlist || []).join('\n');
  } catch { /* ignore */ }
}

document.getElementById('form-scanner').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('PUT', '/settings/policies', {
      scan_mode: document.getElementById('policy-scan-value').value,
      scan_script_allowlist: document.getElementById('f-scan-allowlist').value.split(/[\s,]+/).filter(Boolean),
    });
    toast('Scanner settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('form-policies').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    await api('PUT', '/settings/policies', {
      custom_domain_policy: document.getElementById('policy-domain-value').value,
      default_preset: document.getElementById('f-default-preset').value,
      invite_ttl_hours: Number(document.getElementById('f-invite-ttl').value) || 48,
    });
    toast('Policies saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Extend settings ptab to load users ───────────────────
document.querySelectorAll('#view-panel-settings .tab').forEach(tab => {
  tab.addEventListener('click', () => {
    if (tab.dataset.stab === 'users') { loadUsers(); loadInvitations(); }
    if (tab.dataset.stab === 'security') loadProfile();
    if (tab.dataset.stab === 'notifications') refreshPushCard();
  });
});

// ── Notification settings ─────────────────────────────────
async function loadNotifSettings() {
  try {
    const { events } = await api('GET', '/settings/notification-events');
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
    await api('PUT', '/settings/notification-events', { events });
    toast('Notification settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

// ── Alert channels (ntfy) ──────────────────────────────────
async function loadAlertSettings() {
  try {
    const { ntfy } = await api('GET', '/settings/alerts');
    const form = document.getElementById('form-alert-ntfy');
    form.elements['ntfy_enabled'].checked = !!ntfy.enabled;
    form.elements['ntfy_url'].value = ntfy.url || '';
    const events = ntfy.events || [];
    form.elements['ntfy_event_site_down'].checked     = events.includes('site_down');
    form.elements['ntfy_event_site_up'].checked       = events.includes('site_up');
    form.elements['ntfy_event_deploy_failed'].checked = events.includes('deploy_failed');
    form.elements['ntfy_event_cert_expiry'].checked   = events.includes('cert_expiry');
  } catch {}
}

document.getElementById('form-alert-ntfy').addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  const events = [];
  if (form.elements['ntfy_event_site_down'].checked)     events.push('site_down');
  if (form.elements['ntfy_event_site_up'].checked)       events.push('site_up');
  if (form.elements['ntfy_event_deploy_failed'].checked) events.push('deploy_failed');
  if (form.elements['ntfy_event_cert_expiry'].checked)   events.push('cert_expiry');
  try {
    await api('PUT', '/settings/alerts', {
      ntfy: {
        enabled: form.elements['ntfy_enabled'].checked,
        url: form.elements['ntfy_url'].value.trim(),
        events,
      },
    });
    toast('Alert settings saved', 'success');
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btn-alert-ntfy-test').addEventListener('click', async () => {
  try {
    await api('POST', '/settings/alerts/test');
    toast('Test alert sent', 'success');
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
  const loadingEl = document.getElementById('deployments-loading');
  loadingEl.innerHTML = skeletonBlock(3);
  loadingEl.classList.remove('hidden');
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
  } catch (err) {
    viewError(loadingEl, viewErrorMessage('deployments', err), loadDeployments);
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
    ? `<tr class="is-empty"><td colspan="5">No deployments yet</td></tr>`
    : rows.map(d => {
      const isCurrent = !seenSites.has(d.site_id);
      seenSites.add(d.site_id);
      return `
    <tr>
      <td class="cell-primary">
        <div class="cell-stack">
          <span class="cell-title">${esc(d.site_name)}</span>
          <span class="cell-sub mono">${esc(d.site_domain)}</span>
        </div>
      </td>
      <td data-label="File" class="cell-mono">${esc(d.filename)}</td>
      <td data-label="Size" class="num">${fmtBytes(d.size)}</td>
      <td data-label="Deployed" class="cell-nowrap">${esc(timeAgo(d.deployed_at))} ${isCurrent ? '<span class="badge badge-ok">Live</span>' : ''}</td>
      <td class="admin-only${isAdmin ? '' : ' hidden'}">${isAdmin && !isCurrent ? `<div class="cell-actions"><button type="button" class="btn btn-sm" data-rollback-site="${esc(d.site_id)}" data-rollback-id="${esc(d.id)}">Roll back…</button></div>` : ''}</td>
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
  const loadingEl = document.getElementById('domains-loading');
  loadingEl.innerHTML = skeletonBlock(3);
  loadingEl.classList.remove('hidden');
  document.getElementById('domains-table-wrap').classList.add('hidden');
  try {
    const data = await api('GET', '/sites');
    const wildcard = config.siteBaseDomain ? ` · wildcard *.${esc(config.siteBaseDomain)} active` : '';
    document.getElementById('domains-count').textContent =
      `${data.length} domain${data.length !== 1 ? 's' : ''}${wildcard}`;

    const containerStatus = s => {
      if (s?.running) return `<span class="status status-running">${GLYPH}Running</span>`;
      if (!s || s.status === 'none') return `<span class="status status-no-container">${GLYPH}No container</span>`;
      if (s.status === 'restarting') return `<span class="status status-restarting">${GLYPH}Restarting</span>`;
      if (s.status === 'paused') return `<span class="status status-paused">${GLYPH}Paused</span>`;
      return `<span class="status status-stopped">${GLYPH}Exited</span>`;
    };

    document.getElementById('domains-tbody').innerHTML = data.length === 0
      ? `<tr class="is-empty"><td colspan="5">No sites yet</td></tr>`
      : data.map(s => `
      <tr>
        <td class="cell-primary"><a class="site-domain" href="http://${esc(s.domain)}" target="_blank" rel="noopener"><span class="site-domain-text">${esc(s.domain)}</span><span class="site-domain-arrow">${ICON.externalLink}</span></a></td>
        <td data-label="Site">${esc(s.name)}</td>
        <td data-label="Runtime">${(s.runtime || 'static') === 'static' ? '<span class="cell-muted">Static</span>' : `<span class="badge badge-runtime">${esc(s.runtime.toUpperCase())}</span>`}</td>
        <td data-label="HTTPS">${s.ssl_enabled ? `<span class="status status-ssl-active">${GLYPH}On</span>` : `<span class="status status-muted">${GLYPH}Off</span>`}</td>
        <td data-label="Container">${containerStatus(s.container)}</td>
      </tr>`).join('');

    document.getElementById('domains-loading').classList.add('hidden');
    document.getElementById('domains-table-wrap').classList.remove('hidden');
    if (isPanelAdmin()) { loadDomainRequests(); loadDeployReviews(); }
  } catch (err) {
    viewError(loadingEl, viewErrorMessage('domains', err), loadDomains);
  }
}

const domainsBadgeCounts = { requests: 0, reviews: 0 };
function updateDomainsBadge(kind, n) {
  if (kind) domainsBadgeCounts[kind] = n;
  const count = domainsBadgeCounts.requests + domainsBadgeCounts.reviews;
  const badge = document.getElementById('domains-badge');
  if (!badge) return;
  if (count > 0) { badge.textContent = count > 9 ? '9+' : String(count); badge.classList.remove('hidden'); }
  else badge.classList.add('hidden');
}

async function loadDomainRequests() {
  const wrap = document.getElementById('domain-requests-list');
  if (!wrap) return;
  try {
    const reqs = await api('GET', '/domains/requests?status=pending');
    updateDomainsBadge('requests', reqs.length);
    if (!reqs.length) { wrap.innerHTML = '<p class="list-empty">No pending requests.</p>'; return; }
    wrap.innerHTML = `
      <table class="data-table data-table-stack">
        <thead><tr><th>Site</th><th>Current domain</th><th>Requested domain</th><th>Requested by</th><th><span class="hidden">Actions</span></th></tr></thead>
        <tbody>
          ${reqs.map(r => `
            <tr>
              <td class="cell-primary"><span class="cell-title">${esc(r.site_name)}</span></td>
              <td data-label="Current" class="cell-mono">${esc(r.current_domain)}</td>
              <td data-label="Requested" class="cell-mono">${esc(r.domain)}</td>
              <td data-label="By" class="cell-nowrap">${esc(r.requested_by_name || '—')} <span class="cell-muted">· ${esc(timeAgo(r.created_at))}</span></td>
              <td>
                <div class="cell-actions">
                  <button type="button" class="btn btn-sm btn-danger" data-reject-request="${r.id}">Reject…</button>
                  <button type="button" class="btn btn-sm btn-primary" data-approve-request="${r.id}">Approve</button>
                </div>
              </td>
            </tr>`).join('')}
        </tbody>
      </table>`;
    wrap.querySelectorAll('[data-approve-request]').forEach(btn => {
      btn.addEventListener('click', async () => {
        try { await api('POST', `/domains/requests/${btn.dataset.approveRequest}/approve`); toast('Domain approved', 'success'); loadDomains(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
    wrap.querySelectorAll('[data-reject-request]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const note = await promptDialog({ title: 'Reject this domain request?', body: 'Optionally add a note for the requester.', placeholder: 'Note (optional)', confirmLabel: 'Reject', danger: true });
        if (note === null) return;
        try { await api('POST', `/domains/requests/${btn.dataset.rejectRequest}/reject`, note ? { note } : {}); toast('Domain request rejected', 'success'); loadDomains(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch { /* admin-only endpoint — ignore for non-admins */ }
}

async function loadDeployReviews() {
  const wrap = document.getElementById('deploy-reviews-list');
  if (!wrap) return;
  try {
    const reviews = await api('GET', '/reviews?status=pending');
    updateDomainsBadge('reviews', reviews.length);
    if (!reviews.length) { wrap.innerHTML = '<p class="settings-desc muted">Nothing waiting for review.</p>'; return; }
    const mb = n => `${(n / 1024 / 1024).toFixed(1)} MB`;
    wrap.innerHTML = reviews.map(r => `
      <div class="review-item">
        <div class="review-head">
          <div class="review-meta">
            <span class="review-site">${esc(r.site_name)} <span class="review-domain">${esc(r.site_domain || '')}</span></span>
            <span class="review-by">${esc(r.created_by_name || 'unknown')} · ${timeAgo(r.created_at)} · ${esc(r.filename)}${r.size ? ` · ${mb(r.size)}` : ''}</span>
          </div>
          <span class="badge badge-warn">${r.findings_count} finding${r.findings_count === 1 ? '' : 's'}</span>
        </div>
        ${findingsHtml(r.findings)}
        <div class="review-actions">
          <a class="btn btn-sm btn-secondary" href="/api/reviews/${esc(r.id)}/download">${ICON.download} Download zip</a>
          <button type="button" class="btn btn-sm btn-danger" data-reject-review="${esc(r.id)}">Reject…</button>
          <button type="button" class="btn btn-sm btn-primary" data-approve-review="${esc(r.id)}">Approve</button>
        </div>
      </div>`).join('');
    wrap.querySelectorAll('[data-approve-review]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ok = await confirmDialog({ title: 'Approve this upload?', body: 'The files go live on the site exactly as uploaded. Check the findings first.', confirmLabel: 'Approve' });
        if (!ok) return;
        btn.disabled = true;
        try { await api('POST', `/reviews/${btn.dataset.approveReview}/approve`); toast('Upload approved and live', 'success'); loadDomains(); loadSites(); }
        catch (err) { toast(err.message, 'error'); btn.disabled = false; }
      });
    });
    wrap.querySelectorAll('[data-reject-review]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const note = await promptDialog({ title: 'Reject this upload?', body: 'The files are discarded. Optionally tell the uploader why.', placeholder: 'Note (optional)', confirmLabel: 'Reject', danger: true });
        if (note === null) return;
        try { await api('POST', `/reviews/${btn.dataset.rejectReview}/reject`, note ? { note } : {}); toast('Upload rejected', 'success'); loadDomains(); loadSites(); }
        catch (err) { toast(err.message, 'error'); }
      });
    });
  } catch { /* admin-only endpoint — ignore for non-admins */ }
}

// ── Overview ──────────────────────────────────────────────
let overviewPeriod = '24h';
let overviewData = null;
let overviewSort = 'requests';
let overviewSortDir = 'desc';
let overviewRefreshedAt = null;
let overviewRefreshedTimer = null;

async function loadOverview() {
  const loadingEl = document.getElementById('overview-loading');
  loadingEl.innerHTML = skeletonBlock(4);
  loadingEl.classList.remove('hidden');
  document.getElementById('overview-table-wrap').classList.add('hidden');
  try {
    overviewData = await api('GET', `/analytics/overview?period=${overviewPeriod}`);
    overviewRefreshedAt = Date.now();
    renderOverview();
    tickOverviewRefreshed();
  } catch (err) {
    viewError(loadingEl, viewErrorMessage('overview', err), loadOverview);
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
  document.getElementById('ov-sites-down').closest('.stat-tile')?.classList.toggle('is-alert', grand.sitesDown > 0);

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
    s === 'up'   ? `<span class="status status-ok">${GLYPH}Up</span>` :
    s === 'down' ? `<span class="status status-err">${GLYPH}Down</span>` :
                   `<span class="status status-muted">${GLYPH}Unknown</span>`;

  const pctClass = u =>
    u === null ? '' : parseFloat(u) >= 99 ? 'pct-ok' : parseFloat(u) >= 95 ? 'pct-warn' : 'pct-err';

  document.getElementById('overview-tbody').innerHTML = sorted.map(s => `
    <tr class="ov-row is-clickable" data-id="${esc(s.id)}">
      <td>
        <div class="cell-stack">
          <span class="cell-title">${esc(s.name)}</span>
          <span class="cell-sub mono">${esc(s.domain)}</span>
        </div>
      </td>
      <td class="num">${fmtNum(s.requests)}</td>
      <td class="num">${fmtBytes(s.bytes)}</td>
      <td class="num">${fmtNum(s.ok)}</td>
      <td class="num">${fmtNum(s.redirects)}</td>
      <td class="num${s.client_err > 0 ? ' cell-emph warn' : ''}">${fmtNum(s.client_err)}</td>
      <td class="num${s.server_err > 0 ? ' cell-emph err' : ''}">${fmtNum(s.server_err)}</td>
      <td class="num ${pctClass(s.uptime)}">${s.uptime !== null ? s.uptime + '%' : '<span class="cell-muted">—</span>'}</td>
      <td class="num">${s.avgLatency !== null ? s.avgLatency + ' ms' : '<span class="cell-muted">—</span>'}</td>
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

function sortOverviewBy(th) {
  const key = th.dataset.sort;
  if (overviewSort === key) {
    overviewSortDir = overviewSortDir === 'asc' ? 'desc' : 'asc';
  } else {
    overviewSort = key;
    overviewSortDir = key === 'name' ? 'asc' : 'desc';
  }
  document.querySelectorAll('#overview-table th.sortable').forEach(h => {
    h.removeAttribute('data-dir');
    h.setAttribute('aria-sort', 'none');
  });
  th.setAttribute('data-dir', overviewSortDir);
  th.setAttribute('aria-sort', overviewSortDir === 'asc' ? 'ascending' : 'descending');
  renderOverview();
}

document.querySelectorAll('#overview-table th.sortable').forEach(th => {
  th.addEventListener('click', () => sortOverviewBy(th));
  // th isn't natively focusable/actionable — tabindex+role="button" was
  // added in markup, so mirror click activation for Enter/Space.
  th.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sortOverviewBy(th); }
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
  elLatest.className    = `badge${data.updateAvailable ? ' badge-ok' : ''}`;
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
  // Mark the update flow active so the global panel-restart banner (which
  // reacts to any repeated network failure) steps aside — the update
  // modal's own "Panel restarting…" step already covers this case, and
  // showing both would be a confusing double-message.
  _updateFlowActive = true;
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
    _updateFlowActive = false;
    _networkFailStreak = 0;
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
        _updateFlowActive = false;
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

// ── Command Palette (⌘K) ──────────────────────────────────
// Thin launcher over existing nav/modal functions (canvas 6j). Does not
// duplicate any logic — every result just calls a function/handler that
// already exists elsewhere in this file.
(function () {
  const backdrop = document.getElementById('cmdk-backdrop');
  const input = document.getElementById('cmdk-input');
  const resultsEl = document.getElementById('cmdk-results');
  if (!backdrop || !input || !resultsEl) return;

  let flatItems = []; // currently rendered, keyboard-navigable items
  let activeIndex = 0;

  function gotoView(view) { navigateTo(view); }

  function actionDefs() {
    const isAdmin = currentUser.role === 'admin';
    const isViewer = currentUser.role === 'viewer';
    const defs = [
      { label: 'Overview', desc: 'Jump to Overview', run: () => gotoView('overview') },
      { label: 'Activity', desc: 'Jump to Activity', run: () => gotoView('activity') },
    ];
    if (!isViewer) {
      defs.push({ label: 'Deployments — open history', desc: 'Jump to Deployments', run: () => gotoView('deployments') });
      defs.push({ label: 'Logs', desc: 'Jump to Logs', run: () => gotoView('logs') });
    }
    if (isAdmin) {
      defs.push({ label: 'Domains', desc: 'Jump to Domains', run: () => gotoView('domains') });
      defs.push({ label: 'Settings', desc: 'Panel settings', run: () => gotoView('panel-settings') });
      defs.push({ label: 'New site', desc: 'Create a new site', run: () => { gotoView('sites'); document.getElementById('btn-new-site')?.click(); } });
    }
    defs.push({ label: 'Deploy to a site…', desc: 'Type a site name below, then ↵', run: () => { gotoView('sites'); input.value = ''; renderResults(); input.focus(); } });
    const isLight = document.documentElement.getAttribute('data-theme') === 'light';
    defs.push({ label: isLight ? 'Switch to dark theme' : 'Switch to light theme', desc: 'Toggle appearance', run: () => document.getElementById('btn-theme')?.click() });
    defs.push({ label: 'Help', desc: 'Wiki, version, report a problem', run: () => openHelpModal() });
    return defs;
  }

  function siteMatches(site, q) {
    if (!q) return true;
    return site.name.toLowerCase().includes(q) || (site.domain || '').toLowerCase().includes(q);
  }

  function renderResults() {
    const q = input.value.trim().toLowerCase();

    const actions = actionDefs().filter(a => !q || a.label.toLowerCase().includes(q));
    const siteList = sites.filter(s => siteMatches(s, q));

    flatItems = [];
    let html = '';

    if (actions.length) {
      html += '<div class="cmdk-group"><div class="cmdk-group-label">Actions</div>';
      actions.forEach(a => {
        const idx = flatItems.length;
        flatItems.push({ type: 'action', run: a.run });
        html += `<div class="cmdk-item" id="cmdk-item-${idx}" data-idx="${idx}" role="option" aria-selected="false"><span class="cmdk-item-main">${esc(a.label)}</span><span class="cmdk-item-sub">${esc(a.desc)}</span></div>`;
      });
      html += '</div>';
    }

    if (siteList.length) {
      html += '<div class="cmdk-group"><div class="cmdk-group-label">Sites</div>';
      siteList.forEach(s => {
        const idx = flatItems.length;
        const { cls, label } = statusInfo(s.container);
        flatItems.push({ type: 'site', run: () => { gotoView('sites'); openDeploy(s); } });
        html += `<div class="cmdk-item" id="cmdk-item-${idx}" data-idx="${idx}" role="option" aria-selected="false">
          <span class="cmdk-item-main">${esc(s.name)} <span class="cmdk-item-sub-inline">— deploy, logs, settings</span></span>
          <span class="status status-${cls} cmdk-item-status">${GLYPH}<span class="status-label">${esc(label)}</span></span>
        </div>`;
      });
      html += '</div>';
    }

    if (!flatItems.length) {
      html = `<div class="cmdk-empty">No matches for "${esc(input.value)}"</div>`;
    }

    resultsEl.innerHTML = html;
    activeIndex = 0;
    highlightActive();

    resultsEl.querySelectorAll('.cmdk-item').forEach(el => {
      el.addEventListener('mouseenter', () => { activeIndex = Number(el.dataset.idx); highlightActive(); });
      el.addEventListener('click', () => runActive());
    });
  }

  function highlightActive() {
    resultsEl.querySelectorAll('.cmdk-item').forEach(el => {
      const isActive = Number(el.dataset.idx) === activeIndex;
      el.classList.toggle('is-active', isActive);
      el.setAttribute('aria-selected', String(isActive));
    });
    const active = resultsEl.querySelector('.cmdk-item.is-active');
    if (active) active.scrollIntoView({ block: 'nearest' });
    input.setAttribute('aria-activedescendant', active ? active.id : '');
  }

  function moveActive(delta) {
    if (!flatItems.length) return;
    activeIndex = (activeIndex + delta + flatItems.length) % flatItems.length;
    highlightActive();
  }

  function runActive() {
    const item = flatItems[activeIndex];
    if (!item) return;
    closePalette();
    item.run();
  }

  function openPalette() {
    // Close any other open modal/overflow menu first — palette is exclusive.
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(m => { if (m !== backdrop) m.classList.add('hidden'); });
    document.querySelectorAll('.site-overflow-menu:not(.hidden)').forEach(m => m.classList.add('hidden'));
    input.value = '';
    backdrop.classList.remove('hidden');
    renderResults();
    trapFocus(backdrop.querySelector('.cmdk'), document.activeElement);
    setTimeout(() => input.focus(), 20);
  }

  function closePalette() {
    backdrop.classList.add('hidden');
    releaseFocusTrap();
  }

  function isPaletteOpen() {
    return !backdrop.classList.contains('hidden');
  }

  document.addEventListener('keydown', e => {
    const key = e.key.toLowerCase();
    if ((e.metaKey || e.ctrlKey) && key === 'k') {
      e.preventDefault();
      isPaletteOpen() ? closePalette() : openPalette();
    }
  });

  document.querySelector('.search-kbd')?.addEventListener('click', e => {
    e.preventDefault();
    openPalette();
  });

  backdrop.addEventListener('click', e => { if (e.target === backdrop) closePalette(); });

  input.addEventListener('input', renderResults);
  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); closePalette(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); return; }
    if (e.key === 'Enter') { e.preventDefault(); runActive(); return; }
  });
})();

// ══════════════════════════════════════════════════════════════
// PWA: service worker registration, update prompt, install hint
// (roadmap docs/roadmap/multi-user-platform.md §6). Self-contained,
// guarded end to end — a failure here must never break the app.
// ══════════════════════════════════════════════════════════════
(function () {
  // ── Service worker registration + update prompt ──────────────
  try {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js').then(registration => {
          registration.addEventListener('updatefound', () => {
            const installing = registration.installing;
            if (!installing) return;
            installing.addEventListener('statechange', () => {
              if (installing.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateToast(registration);
              }
            });
          });
        }).catch(() => {});
      });
    }
  } catch {}

  function showUpdateToast(registration) {
    try {
      const el = toast('New version available — reload to update', 'info');
      if (!el) return;
      const stack = document.getElementById('toast-container');
      const lastToast = stack ? stack.querySelector('.toast:last-child') : el;
      const target = lastToast || el;

      const reloadBtn = document.createElement('button');
      reloadBtn.type = 'button';
      reloadBtn.className = 'btn btn-xs';
      reloadBtn.textContent = 'Reload';
      reloadBtn.addEventListener('click', () => {
        try {
          if (registration.waiting) {
            registration.waiting.postMessage({ type: 'SKIP_WAITING' });
          }
          let reloaded = false;
          navigator.serviceWorker.addEventListener('controllerchange', () => {
            if (reloaded) return;
            reloaded = true;
            window.location.reload();
          });
        } catch {}
      });
      target.appendChild(reloadBtn);
    } catch {}
  }

  // ── Install hint (once, from the second visit onward) ────────
  try {
    let deferredInstallPrompt = null;
    window.addEventListener('beforeinstallprompt', e => {
      try {
        e.preventDefault();
        deferredInstallPrompt = e;
      } catch {}
    });

    let visits = 0;
    try {
      visits = parseInt(localStorage.getItem('grimport-visits') || '0', 10) || 0;
      visits += 1;
      localStorage.setItem('grimport-visits', String(visits));
    } catch {}

    let alreadyHinted = false;
    try {
      alreadyHinted = localStorage.getItem('grimport-install-hinted') === '1';
    } catch {}

    if (visits >= 2 && !alreadyHinted) {
      window.addEventListener('load', () => {
        setTimeout(() => {
          try {
            if (!deferredInstallPrompt) return;
            const el = toast('Install Grimport as an app', 'info');
            if (!el) return;
            try { localStorage.setItem('grimport-install-hinted', '1'); } catch {}

            const installBtn = document.createElement('button');
            installBtn.type = 'button';
            installBtn.className = 'btn btn-xs';
            installBtn.textContent = 'Install';
            installBtn.addEventListener('click', () => {
              try {
                if (deferredInstallPrompt) {
                  deferredInstallPrompt.prompt();
                  deferredInstallPrompt = null;
                }
              } catch {}
            });
            el.appendChild(installBtn);
          } catch {}
        }, 1500);
      });
    }
  } catch {}
})();

/* ══════════════════════════════════════════════════════════════════
 * Panel login hardening — appended block (docs/roadmap/multi-user-
 * platform.md §4 "Login and panel hardening"). Self-contained: only
 * touches elements inside #spanel-security (Two-factor authentication +
 * Sessions cards), the two data-empty-action buttons in the sites empty
 * states, and reads GET /api/auth/me once more to enforce a forced 2FA
 * setup notice. Does not modify any function defined above this block.
 * ══════════════════════════════════════════════════════════════════ */

// ── Empty-state actions (CSP forbids inline onclick=; delegated here) ──
document.addEventListener('click', e => {
  const el = e.target.closest('[data-empty-action]');
  if (!el) return;
  if (el.dataset.emptyAction === 'new-site') document.getElementById('btn-new-site')?.click();
  else if (el.dataset.emptyAction === 'clear-search') clearSiteSearch();
});

// ── Helpers ─────────────────────────────────────────────────────────
function fmtSessionTime(ms) {
  if (!ms) return '—';
  try { return new Date(ms).toLocaleString(); } catch { return '—'; }
}

function shortenUa(ua) {
  if (!ua) return 'Unknown device';
  const browserMatch = ua.match(/(Firefox|Chrome|Safari|Edg|OPR)\/[\d.]+/);
  const osMatch = ua.match(/(Windows NT [\d.]+|Mac OS X [\d_.]+|Linux|Android [\d.]+|iPhone OS [\d_]+|CPU OS [\d_]+)/);
  const browser = browserMatch
    ? browserMatch[0].replace('Edg/', 'Edge ').replace('OPR/', 'Opera ').replace('/', ' ')
    : 'Unknown browser';
  const os = osMatch
    ? osMatch[0].replace(/_/g, '.').replace('CPU OS', 'iOS').replace('Mac OS X', 'macOS').replace('Windows NT', 'Windows')
    : '';
  return [browser, os].filter(Boolean).join(' · ');
}

// ── Two-factor authentication ───────────────────────────────────────
async function loadTotpStatus() {
  const badge = document.getElementById('totp-status-badge');
  if (!badge) return;
  let me;
  try { me = await api('GET', '/auth/me'); } catch (err) { toast(err.message, 'error'); return; }

  const enabled = !!me.totp_enabled;
  badge.textContent = enabled ? 'Enabled' : 'Disabled';
  badge.className = `badge ${enabled ? 'badge-ok' : 'badge-warn'}`;
  const text = document.getElementById('totp-status-text');
  if (text) {
    text.textContent = enabled
      ? 'Your account requires a 6-digit code (or a recovery code) at login.'
      : 'Add a 6-digit authenticator code as a second factor at login.';
  }
  document.getElementById('totp-setup-actions')?.classList.toggle('hidden', enabled);
  document.getElementById('form-totp-disable')?.classList.toggle('hidden', !enabled);
  if (!me.totp_setup_required) document.getElementById('totp-required-notice')?.classList.add('hidden');
}

document.getElementById('btn-totp-start-setup')?.addEventListener('click', async () => {
  try {
    const data = await api('POST', '/auth/totp/setup');
    document.getElementById('totp-qr-img').src = data.qr_data_url;
    document.getElementById('totp-secret-value').textContent = data.secret;
    document.getElementById('f-totp-enable-code').value = '';
    document.getElementById('totp-setup-actions')?.classList.add('hidden');
    document.getElementById('totp-setup-flow')?.classList.remove('hidden');
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btn-totp-cancel-setup')?.addEventListener('click', () => {
  document.getElementById('totp-setup-flow')?.classList.add('hidden');
  document.getElementById('totp-setup-actions')?.classList.remove('hidden');
});

document.getElementById('form-totp-enable')?.addEventListener('submit', async e => {
  e.preventDefault();
  const code = document.getElementById('f-totp-enable-code').value.trim();
  try {
    const data = await api('POST', '/auth/totp/enable', { code });
    document.getElementById('totp-setup-flow')?.classList.add('hidden');
    const list = document.getElementById('totp-recovery-list');
    if (list) list.innerHTML = data.recovery_codes.map(c => `<code class="totp-recovery-code">${esc(c)}</code>`).join('');
    document.getElementById('totp-recovery-reveal')?.classList.remove('hidden');
    toast('Two-factor authentication enabled', 'success');
    await loadTotpStatus();
  } catch (err) { toast(err.message, 'error'); }
});

document.getElementById('btn-copy-recovery-codes')?.addEventListener('click', e => {
  const codes = Array.from(document.querySelectorAll('#totp-recovery-list .totp-recovery-code')).map(el => el.textContent);
  copyToClipboard(codes.join('\n'), e.currentTarget);
});

document.getElementById('btn-totp-recovery-confirm')?.addEventListener('click', () => {
  document.getElementById('totp-recovery-reveal')?.classList.add('hidden');
  document.getElementById('totp-setup-actions')?.classList.remove('hidden');
  document.getElementById('totp-required-notice')?.classList.add('hidden');
});

document.getElementById('form-totp-disable')?.addEventListener('submit', async e => {
  e.preventDefault();
  const form = e.target;
  try {
    await api('POST', '/auth/totp/disable', { password: form.elements['password'].value });
    form.reset();
    toast('Two-factor authentication disabled', 'success');
    await loadTotpStatus();
  } catch (err) { toast(err.message, 'error'); }
});

// ── Sessions ─────────────────────────────────────────────────────────
async function loadSessionsList() {
  const container = document.getElementById('sessions-list');
  if (!container) return;
  let data;
  try { data = await api('GET', '/auth/sessions'); } catch (err) {
    container.innerHTML = `<p class="muted">${esc(err.message)}</p>`;
    return;
  }
  if (!data.sessions.length) {
    container.innerHTML = '<p class="muted">No active sessions.</p>';
    return;
  }
  container.innerHTML = `
    <table class="data-table data-table-stack">
      <thead><tr><th>Device</th><th>IP address</th><th>Last seen</th><th><span class="hidden">Actions</span></th></tr></thead>
      <tbody>
        ${data.sessions.map(s => `
          <tr>
            <td class="cell-primary"><span class="cell-title">${esc(shortenUa(s.ua))}${s.current ? ' <span class="badge badge-ok">This device</span>' : ''}</span></td>
            <td data-label="IP address" class="cell-mono">${esc(s.ip || '—')}</td>
            <td data-label="Last seen" class="cell-nowrap" title="${esc(fmtSessionTime(s.last_seen))}">${s.last_seen ? esc(timeAgo(Math.floor(s.last_seen / 1000))) : '—'}</td>
            <td>${s.current ? '' : `<div class="cell-actions"><button type="button" class="btn btn-sm btn-danger" data-revoke-session="${esc(s.sid)}">Revoke</button></div>`}</td>
          </tr>`).join('')}
      </tbody>
    </table>`;
}

document.getElementById('sessions-list')?.addEventListener('click', async e => {
  const btn = e.target.closest('[data-revoke-session]');
  if (!btn) return;
  btn.disabled = true;
  try {
    await api('DELETE', `/auth/sessions/${encodeURIComponent(btn.dataset.revokeSession)}`);
    toast('Session revoked', 'success');
    await loadSessionsList();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
  }
});

document.getElementById('btn-sessions-revoke-others')?.addEventListener('click', async () => {
  try {
    const res = await api('POST', '/auth/sessions/revoke-others');
    toast(`Signed out ${res.revoked} other session${res.revoked === 1 ? '' : 's'}`, 'success');
    await loadSessionsList();
  } catch (err) { toast(err.message, 'error'); }
});

// Load Security tab data whenever it's opened (additional listener —
// doesn't touch the existing settings-tab switch statement above).
document.getElementById('ptab-security')?.addEventListener('click', () => {
  loadTotpStatus();
  loadSessionsList();
});

// ── Forced 2FA setup (require_totp_admins) ──────────────────────────
// A second, independent read of /me (the main init() above already
// consumed its own copy) — if the server says this admin must set up 2FA
// before doing anything else, jump to Security and pin a non-dismissable
// notice at the top of it.
(async function enforceTotpSetup() {
  let me;
  try { me = await fetch('/api/auth/me', { headers: { 'X-Requested-With': 'grimport' } }).then(r => r.json()); }
  catch { return; }
  if (!me || !me.totp_setup_required) return;
  document.getElementById('totp-required-notice')?.classList.remove('hidden');
  document.querySelector('.nav-item[data-view="panel-settings"]')?.click();
  document.getElementById('ptab-security')?.click();
})();
