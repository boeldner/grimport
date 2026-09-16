// UI audit for the Grimport panel: walks every view, settings tab, modal and
// standalone page of the seeded demo at several viewports and checks the
// rendered DOM against the design system rules (CONTRIBUTING.md, "Frontend").
//
// Usage:
//   npm run demo-seed && npm run demo-serve     # in another terminal
//   npm run ui-audit [-- --viewports desk,phone,light] [--out DIR] [--no-shots]
//
// Checks (every one is a hard failure, the budget is zero):
//   overflow   element sticks out of its card/modal/container
//   scroll     unexpected scroll container (tiny vertical scroller, horizontal
//              scroll anywhere except tab strips, tables and log output)
//   clipped    text cut off without an ellipsis
//   rows       controls on one row with different heights or centres
//   contrast   text below WCAG 2.2 AA (4.5:1, 3:1 for large text)
//   tiny       text smaller than 11px
//   stacked    cards touching without a gap
//   overlap    interactive elements drawn on top of each other in one layer
//   order      primary button not last in an action row (dialogs, forms, callouts),
//              or more than one primary button visible in a dialog
//   touch      (phone) targets under 44px (HIG); inline text links exempt
//   errors     uncaught page errors
//
// Exit code 1 when anything fails. report.json and one screenshot per scene
// land in OUT (default supervisor/.ui-audit/, gitignored).
'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');
const { resolveChrome, resolveBase, waitForHealth, FAKE_CONTAINERS, FAKE_UPTIME } = require('./lib/harness');

// ------------------------------------------------------------- arguments --
const argv = process.argv.slice(2);
const opts = { out: path.join(__dirname, '..', '.ui-audit'), viewports: null, shots: true, iKnow: false };
for (let i = 0; i < argv.length; i++) {
  const a = argv[i];
  if (a === '--out') opts.out = path.resolve(argv[++i]);
  else if (a === '--viewports') opts.viewports = argv[++i].split(',').map(s => s.trim()).filter(Boolean);
  else if (a === '--no-shots') opts.shots = false;
  else if (a === '--i-know') opts.iKnow = true;
  else { console.error(`Unknown argument: ${a}`); process.exit(1); }
}
const EXE = resolveChrome();
const BASE = resolveBase({ iKnow: opts.iKnow, verb: 'audit' });
fs.mkdirSync(path.join(opts.out, 'shots'), { recursive: true });

const VIEWPORTS = [
  { tag: 'desk', width: 1440, height: 900, theme: 'dark' },
  { tag: 'wide', width: 1710, height: 1000, theme: 'dark' },
  { tag: 'phone', width: 390, height: 844, theme: 'dark' },
  { tag: 'light', width: 1440, height: 900, theme: 'light' },
];

// ---------------------------------------------------------------- checks --
// Runs inside the page. rootSel = CSS selector of the scene root.
function runChecks({ rootSel, phone }) {
  const out = { overflow: [], scroll: [], clipped: [], rows: [], touch: [], contrast: [], tiny: [], stacked: [], overlap: [], order: [] };
  const root = document.querySelector(rootSel) || document.body;

  const describe = el => {
    const parts = [];
    let e = el;
    for (let i = 0; e && e.nodeType === 1 && i < 4; i++, e = e.parentElement) {
      let s = e.tagName.toLowerCase();
      if (e.id) { s += '#' + e.id; parts.unshift(s); break; }
      const cls = [...e.classList].filter(c => !/^(is-|hidden$|active$)/.test(c)).slice(0, 2);
      if (cls.length) s += '.' + cls.join('.');
      parts.unshift(s);
    }
    return parts.join(' > ');
  };
  const text = el => (el.innerText || el.value || el.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 40);
  const onScreen = r => r.right > 0 && r.left < innerWidth && r.bottom > 0 && r.top < innerHeight;
  const isVisible = el => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1 || !onScreen(r)) return false;
    return el.checkVisibility({ opacityProperty: true, visibilityProperty: true, contentVisibilityAuto: true });
  };
  const all = [...root.querySelectorAll('*')].filter(isVisible);

  // A. overflow beyond the nearest container
  const CONTAINER = '.card, .modal, .site-card, .callout, .notif-dropdown, .menu, .popover, .cmdk, .settings-subsection, .auth-card, .sidebar, .review-item, .stat-tile, .list-row';
  const offenders = [];
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (cs.position === 'fixed' || cs.position === 'absolute') continue;
    let container = el.parentElement ? el.parentElement.closest(CONTAINER) : null;
    if (!container || !root.contains(container)) container = root;
    let clipped = false;
    for (let a = el.parentElement; a && a !== container; a = a.parentElement) {
      const acs = getComputedStyle(a);
      if (acs.overflowX !== 'visible' || acs.position === 'absolute' || acs.position === 'fixed') { clipped = true; break; }
    }
    if (clipped) continue;
    const r = el.getBoundingClientRect(), c = container.getBoundingClientRect();
    const by = Math.round(Math.max(r.right - c.right, c.left - r.left));
    if (by > 1 && !offenders.some(o => o.el.contains(el) && o.container === container)) offenders.push({ el, container, by });
  }
  out.overflow = offenders.map(o => ({ el: describe(o.el), container: describe(o.container), by: o.by, text: text(o.el) }));

  // B. scroll containers
  const SCROLL_OK_X = '.tabs, .seg-ctl, .table-wrap, .logs-output, .code-block';
  for (const el of all) {
    const cs = getComputedStyle(el);
    const scrollY = /auto|scroll/.test(cs.overflowY) && el.scrollHeight > el.clientHeight + 1;
    const scrollX = /auto|scroll/.test(cs.overflowX) && el.scrollWidth > el.clientWidth + 1;
    if (scrollY && el.clientHeight < 120) out.scroll.push({ kind: 'tiny-vertical', el: describe(el), clientH: el.clientHeight, scrollH: el.scrollHeight });
    if (scrollX && !el.matches(SCROLL_OK_X)) out.scroll.push({ kind: 'horizontal', el: describe(el), clientW: el.clientWidth, scrollW: el.scrollWidth, text: text(el) });
    if (el.tagName === 'TEXTAREA' && el.scrollWidth > el.clientWidth + 1) out.scroll.push({ kind: 'textarea-horizontal', el: describe(el) });
  }

  // C. text cut off without an ellipsis
  for (const el of all) {
    if (!['INPUT', 'TEXTAREA', 'SELECT', 'PRE', 'CODE'].includes(el.tagName)
      && [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())
      && el.clientWidth > 0 && el.scrollWidth > el.clientWidth + 1) {
      const cs = getComputedStyle(el);
      if (/auto|scroll/.test(cs.overflowX)) continue;
      if (cs.overflowX === 'hidden' && cs.textOverflow === 'ellipsis') continue;
      out.clipped.push({ el: describe(el), text: text(el), clientW: el.clientWidth, scrollW: el.scrollWidth });
    }
  }

  // D. controls on one row with mismatched heights or centres
  const CONTROL = 'input:not([type=checkbox]):not([type=radio]):not([type=hidden]):not([type=range]), select, button, .btn';
  for (const el of all) {
    const cs = getComputedStyle(el);
    if (!(cs.display.includes('flex') && cs.flexDirection.startsWith('row')) && !cs.display.includes('grid')) continue;
    const kids = [...el.children].filter(isVisible).map(k => {
      if (k.matches(CONTROL)) return k;
      const inner = k.querySelectorAll(CONTROL);
      return inner.length === 1 && k.children.length <= 2 ? inner[0] : null;
    }).filter(Boolean);
    if (kids.length < 2) continue;
    const rows = [];
    for (const k of kids) {
      const r = k.getBoundingClientRect();
      let row = rows.find(rw => r.top < rw.bottom && r.bottom > rw.top);
      if (!row) { row = { top: r.top, bottom: r.bottom, items: [] }; rows.push(row); }
      row.items.push({ k, r });
    }
    for (const row of rows) {
      if (row.items.length < 2) continue;
      const hs = row.items.map(i => Math.round(i.r.height));
      const mids = row.items.map(i => Math.round(i.r.top + i.r.height / 2));
      if (Math.max(...hs) - Math.min(...hs) > 2 || Math.max(...mids) - Math.min(...mids) > 3) {
        out.rows.push({ row: describe(el), items: row.items.map(i => `${describe(i.k).split(' > ').pop()}[${text(i.k).slice(0, 16)}]=${Math.round(i.r.height)}h`) });
      }
    }
  }

  // E. touch targets (phone). Links inside running text are exempt (WCAG 2.5.8).
  if (phone) {
    const INTERACTIVE = 'button, a[href], input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, [role=button], [role=tab], .g-checkbox, .g-switch';
    for (const el of all) {
      if (!el.matches(INTERACTIVE) || el.closest('[aria-hidden="true"]')) continue;
      if (el.matches('a') && el.parentElement.closest('p, .field-help, .callout-text, .settings-desc, .subtitle, li')) continue;
      const r = el.getBoundingClientRect();
      if (r.height < 43.5 || r.width < 43.5) out.touch.push({ el: describe(el), text: text(el).slice(0, 24), w: Math.round(r.width), h: Math.round(r.height) });
    }
  }

  // F. contrast and tiny text
  const parse = c => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 }; };
  const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const blend = (top, bot) => ({ r: top.r * top.a + bot.r * (1 - top.a), g: top.g * top.a + bot.g * (1 - top.a), b: top.b * top.a + bot.b * (1 - top.a), a: 1 });
  const bgOf = el => {
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.backgroundImage !== 'none' && !cs.backgroundImage.startsWith('url') && !e.matches('.g-select')) return null;
      const c = parse(cs.backgroundColor);
      if (c && c.a > 0) { layers.push(c); if (c.a >= 1) break; }
    }
    let col = layers.length && layers[layers.length - 1].a >= 1 ? layers.pop() : parse(getComputedStyle(document.body).backgroundColor);
    while (layers.length) col = blend(layers.pop(), col);
    return col;
  };
  const seen = new Set();
  for (const el of all) {
    if (![...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim().length > 1)) continue;
    if (el.closest('[disabled], .is-disabled, [aria-disabled="true"]') || el.matches(':disabled')) continue;
    const cs = getComputedStyle(el);
    let fg = parse(cs.color); if (!fg) continue;
    let op = 1; for (let e = el; e; e = e.parentElement) op *= parseFloat(getComputedStyle(e).opacity);
    const bg = bgOf(el); if (!bg) continue;
    fg = blend({ ...fg, a: fg.a * op }, bg);
    const L1 = lum(fg), L2 = lum(bg);
    const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    const size = parseFloat(cs.fontSize), weight = parseInt(cs.fontWeight, 10);
    const need = size >= 24 || (size >= 18.66 && weight >= 700) ? 3 : 4.5;
    const key = describe(el).split(' > ').slice(-2).join(' > ');
    if (ratio < need && !seen.has('c' + key)) { seen.add('c' + key); out.contrast.push({ el: describe(el), text: text(el).slice(0, 30), ratio: +ratio.toFixed(2), size, weight }); }
    if (size < 11 && !seen.has('t' + key)) { seen.add('t' + key); out.tiny.push({ el: describe(el), text: text(el).slice(0, 30), size }); }
  }

  // G. stacked cards without a gap
  for (const el of all) {
    if (!el.matches('.card, .settings-subsection, .callout')) continue;
    let n = el.nextElementSibling;
    while (n && !isVisible(n)) n = n.nextElementSibling;
    if (!n || !n.matches('.card, .callout, table, .table-wrap')) continue;
    const a = el.getBoundingClientRect(), b = n.getBoundingClientRect();
    if (b.top - a.bottom < 6 && b.left < a.right && b.right > a.left) out.stacked.push({ upper: describe(el), lower: describe(n), gap: Math.round(b.top - a.bottom) });
  }

  // H. overlapping interactive elements within the same layer. Floating
  // layers (fixed/sticky chrome, menus, popovers) legitimately cover content.
  const layerOf = el => {
    for (let e = el; e && e !== document.body; e = e.parentElement) {
      const cs = getComputedStyle(e);
      if (cs.position === 'fixed' || cs.position === 'sticky' || (cs.position === 'absolute' && cs.zIndex !== 'auto')) return e;
    }
    return document.body;
  };
  const ctls = all.filter(el => el.matches('button, a[href], input:not([type=hidden]), select, textarea, .badge, .status'));
  const layers = new Map(ctls.map(el => [el, layerOf(el)]));
  for (let i = 0; i < ctls.length; i++) for (let j = i + 1; j < ctls.length; j++) {
    const A = ctls[i], B = ctls[j];
    if (A.contains(B) || B.contains(A) || layers.get(A) !== layers.get(B)) continue;
    const a = A.getBoundingClientRect(), b = B.getBoundingClientRect();
    const w = Math.min(a.right, b.right) - Math.max(a.left, b.left);
    const h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
    if (w > 3 && h > 3) out.overlap.push({ a: `${describe(A)}[${text(A).slice(0, 14)}]`, b: `${describe(B)}[${text(B).slice(0, 14)}]`, w: Math.round(w), h: Math.round(h) });
  }

  // I. primary action last in action rows (HIG: default button on the right)
  for (const row of all.filter(el => el.matches('.modal-actions, .form-actions, .callout-actions, .review-actions'))) {
    const btns = [...row.querySelectorAll('.btn')].filter(isVisible);
    const primary = btns.findIndex(b => b.matches('.btn-primary'));
    if (primary !== -1 && primary !== btns.length - 1) out.order.push({ row: describe(row), buttons: btns.map(b => text(b).slice(0, 16)) });
  }
  for (const modal of all.filter(el => el.matches('.modal'))) {
    const primaries = [...modal.querySelectorAll('.btn-primary')].filter(isVisible);
    if (primaries.length > 1) out.order.push({ dialog: describe(modal), primaries: primaries.map(b => text(b).slice(0, 16)) });
  }
  return out;
}

// ---------------------------------------------------------------- scenes --
async function main() {
  await waitForHealth(BASE);
  const browser = await puppeteer.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const report = [];
  const errors = [];
  let current = '';
  const sleep = ms => new Promise(r => setTimeout(r, ms));

  // One isolated browser context per identity, so the run signs in exactly
  // twice and stays far below the login rate limit.
  async function openPage(user, pass) {
    const ctx = await browser.createBrowserContext();
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push({ scene: current, message: e.message }));
    if (user) {
      await p.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
      await p.type('#username-input', user);
      await p.type('#password-input', pass);
      await Promise.all([p.waitForNavigation({ waitUntil: 'networkidle0' }), p.click('#btn-login')]);
      if (new URL(p.url()).pathname.startsWith('/login')) throw new Error(`Login as ${user} failed (rate limited? restart the demo server)`);
    }
    return p;
  }
  const adminPage = await openPage('admin', 'changeme');
  const memberPage = await openPage('carla', 'demo-password');
  const anonPage = await openPage();
  let page = adminPage;

  // Load the app shell fresh in the given theme with onboarding out of the way.
  async function home(p, theme, vp) {
    page = p;
    await page.setViewport(vp);
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(theme => {
      try { localStorage.setItem('grimport-member-onboarded', '1'); localStorage.setItem('grimport-theme', theme); } catch {}
      applyTheme(theme);
      document.getElementById('onboarding-backdrop')?.classList.add('hidden');
      document.getElementById('onboarding-reminder-banner')?.classList.add('hidden');
    }, theme);
    await sleep(400);
  }
  const closeModals = () => page.evaluate(() => {
    document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(b => b.classList.add('hidden'));
    document.querySelectorAll('.modal-backdrop:not([id])').forEach(b => b.remove());
    try { closeAllSiteOverflows(); } catch {}
    document.querySelectorAll('.notif-dropdown:not(.hidden)').forEach(d => d.classList.add('hidden'));
    document.querySelectorAll('.toast').forEach(t => t.remove());
  });
  const fake = () => page.evaluate((fc, fu) => { for (const s of sites) s.container = fc[s.id] || s.container; Object.assign(uptimeData, fu); renderSites(); }, FAKE_CONTAINERS, FAKE_UPTIME);
  const view = async v => { await page.evaluate(v => navigateTo(v), v); await sleep(700); };

  async function scene(name, rootSel, { vp, full = true, wait = 400 } = {}) {
    current = name;
    await sleep(wait);
    await page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
    const phone = vp.width < 500;
    // Grow the viewport so the whole scrollable content is checked and shot.
    let h = vp.height;
    if (full) {
      h = await page.evaluate(() => {
        const modal = document.querySelector('.modal-backdrop:not(.hidden) .modal');
        const main = document.querySelector('.main');
        let need = Math.max(innerHeight, document.scrollingElement.scrollHeight);
        if (modal) need = Math.max(need, innerHeight + modal.scrollHeight - modal.clientHeight + 40);
        else if (main) need = Math.max(need, innerHeight + main.scrollHeight - main.clientHeight);
        return Math.min(Math.ceil(need), 6000);
      });
      if (h > vp.height) { await page.setViewport({ ...vp, height: h }); await sleep(250); }
    }
    const res = await page.evaluate(runChecks, { rootSel, phone });
    if (opts.shots) await page.screenshot({ path: path.join(opts.out, 'shots', `${name}.png`) });
    if (h > vp.height) await page.setViewport(vp);
    report.push({ scene: name, viewport: `${vp.width}x${vp.height}`, ...res });
    const counts = Object.entries(res).filter(([, v]) => v.length).map(([k, v]) => `${k}=${v.length}`).join(' ');
    console.log(`  ${counts ? 'FAIL' : 'ok  '} ${name}${counts ? '  ' + counts : ''}`);
  }

  const only = opts.viewports;
  for (const V of VIEWPORTS) {
    if (only && !only.includes(V.tag)) continue;
    const vp = { width: V.width, height: V.height, deviceScaleFactor: 1 };
    const N = n => `${V.tag}__${n}`;
    const full = V.tag !== 'light';
    await home(adminPage, V.theme, vp);
    await fake();

    await scene(N('sites-cards'), 'body', { vp });
    if (full) {
      await page.evaluate(() => document.getElementById('sites-view-list')?.click());
      await scene(N('sites-list'), 'body', { vp });
      await page.evaluate(() => document.getElementById('sites-view-cards')?.click());
      await fake();
      await page.evaluate(() => document.querySelector('[data-action="overflow"]').click());
      await scene(N('sites-overflow'), 'body', { vp, full: false });
      await closeModals();
      await page.evaluate(() => document.getElementById('btn-bell')?.click());
      await scene(N('notifications'), 'body', { vp, full: false, wait: 700 });
      await closeModals();
      if (V.tag === 'phone') {
        await page.evaluate(() => document.getElementById('btn-phone-menu')?.click());
        await scene(N('phone-drawer'), 'body', { vp, full: false });
        await page.evaluate(() => document.getElementById('btn-phone-menu')?.click());
        await closeModals();
      }
    }

    for (const v of ['overview', 'activity', 'deployments', 'logs', 'domains']) {
      await view(v);
      await scene(N(v), `#view-${v}`, { vp, wait: 800 });
    }
    await view('panel-settings');
    for (const tab of ['general', 'server', 'tokens', 'webhooks', 'notifications', 'users', 'security']) {
      await page.evaluate(t => document.getElementById(`ptab-${t}`).click(), tab);
      await page.evaluate(() => { document.querySelector('.main').scrollTo(0, 0); scrollTo(0, 0); });
      await scene(N(`settings-${tab}`), '#view-panel-settings', { vp, wait: 900 });
    }
    if (!full) continue;

    // Site settings: static site with basic auth (s2), node site (s3).
    for (const [sid, label] of [['s2bbbbbbbb', 'static'], ['s3cccccccc', 'node']]) {
      await view('sites'); await fake();
      await page.evaluate(id => openSettings(sites.find(s => s.id === id)), sid);
      for (const t of ['general', 'behaviour', 'access', 'app']) {
        await page.evaluate(t => document.getElementById(`mtab-${t}`)?.click(), t);
        await scene(N(`modal-settings-${label}-${t}`), '#modal-settings .modal', { vp, wait: 600 });
      }
      await closeModals();
    }

    const s1 = 's1aaaaaaaa';
    const modals = [
      ['modal-deploy', `openDeploy(sites.find(s => s.id === '${s1}'))`, '#modal-deploy .modal'],
      ['modal-deploy-review', `openDeploy(sites.find(s => s.id === '${s1}')); renderDeployOutcome({ outcome: 'pending', findings: [{ category: 'external-script', severity: 'review', file: 'index.html', line: 12, detail: 'script loaded from analytics.tracker-example.net' }, { category: 'secret', severity: 'review', file: 'js/config.js', line: 3, detail: 'looks like an API key' }] })`, '#modal-deploy .modal'],
      ['modal-new-site', `document.getElementById('btn-new-site').click()`, '#modal-new-site .modal'],
      ['modal-analytics', `openAnalytics(sites.find(s => s.id === '${s1}'))`, '#modal-analytics .modal'],
      ['modal-dns', `openDns(sites.find(s => s.id === '${s1}'))`, '#modal-dns .modal'],
      ['modal-dns-cloudflare', `openDns(sites.find(s => s.id === '${s1}')); setTimeout(() => switchDnsTab('cloudflare'), 300)`, '#modal-dns .modal'],
      ['modal-logs', `openLogs(sites.find(s => s.id === '${s1}'))`, '#modal-logs .modal'],
      ['modal-history', `openHistory(sites.find(s => s.id === '${s1}'))`, '#modal-history .modal'],
      ['modal-connect-domain', `openConnectDomain('blog.demo.test')`, '#modal-connect-domain .modal'],
      ['modal-preview', `openPreviewModal(sites.find(s => s.id === '${s1}'))`, '#modal-preview .modal'],
      ['modal-apply-template', `openApplyTemplateModal(sites.find(s => s.id === '${s1}'))`, '#modal-apply-template .modal'],
      ['modal-update', `openModal('modal-update'); setUpdateStep('applying')`, '#modal-update .modal'],
      ['modal-help', `openHelpModal()`, '#modal-help .modal'],
      ['cmdk', `openModal('cmdk-backdrop'); document.getElementById('cmdk-input').dispatchEvent(new Event('input'))`, '#cmdk-backdrop'],
      ['confirm-dialog', `confirmDialog({ title: 'Delete "Bakery landing"?', body: 'This permanently removes the container and all files.', confirmLabel: 'Delete site', danger: true, requireText: 'Bakery landing' })`, '.modal-backdrop:not([id]) .modal'],
    ];
    for (const [name, js, rootSel] of modals) {
      await view('sites'); await fake();
      await page.evaluate(js => { try { (0, eval)(js); } catch (e) { console.error(e); } }, js);
      await scene(N(name), rootSel, { vp, wait: 900 });
      await closeModals();
    }
    await view('panel-settings');
    await page.evaluate(() => document.getElementById('ptab-users').click());
    await sleep(700);
    await page.evaluate(() => document.querySelector('[data-edit-user]')?.click());
    await scene(N('modal-edit-user'), '.modal-backdrop:not(.hidden) .modal', { vp, wait: 800 });
    await closeModals();
    await page.evaluate(() => document.getElementById('btn-open-invite')?.click());
    await scene(N('modal-invite'), '.modal-backdrop:not(.hidden) .modal', { vp, wait: 500 });
    await closeModals();
    await page.evaluate(() => document.getElementById('ptab-general').click());
    await sleep(500);
    await page.evaluate(() => document.getElementById('btn-tabbar-customize-settings')?.click());
    await scene(N('modal-tabbar'), '.modal-backdrop:not(.hidden) .modal', { vp, wait: 500 });
    await closeModals();

    // OAuth consent page (signed in as admin).
    const consent = await page.evaluate(async () => {
      const c = await (await fetch('/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ redirect_uris: ['https://claude.ai/api/mcp/auth_callback'], client_name: 'Claude', token_endpoint_auth_method: 'none' }) })).json();
      return `/oauth/consent?${new URLSearchParams({ client_id: c.client_id, redirect_uri: 'https://claude.ai/api/mcp/auth_callback', code_challenge: 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM' })}`;
    });
    await page.goto(`${BASE}${consent}`, { waitUntil: 'networkidle0' });
    await scene(N('page-oauth-consent'), 'body', { vp, wait: 600 });

    // Standalone pages (signed out).
    page = anonPage;
    await page.setViewport(vp);
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
    await scene(N('page-login'), 'body', { vp });
    await page.goto(`${BASE}/invite/demo-invite-dora-token`, { waitUntil: 'networkidle0' });
    await scene(N('page-invite'), 'body', { vp, wait: 800 });
    await page.goto(`${BASE}/offline.html`, { waitUntil: 'networkidle0' });
    await scene(N('page-offline'), 'body', { vp });

    // Member account.
    await home(memberPage, V.theme, vp);
    await scene(N('member-sites'), 'body', { vp });
    await page.evaluate(() => { try { localStorage.removeItem('grimport-member-onboarded'); } catch {} openMemberOnboarding(); });
    await scene(N('member-onboarding'), '.modal-backdrop:not(.hidden) .modal', { vp, wait: 600 });
    await page.evaluate(() => document.getElementById('btn-mob-next').click());
    await scene(N('member-onboarding-site'), '.modal-backdrop:not(.hidden) .modal', { vp, wait: 600 });
    await closeModals();
    await view('panel-settings');
    await scene(N('member-settings'), '#view-panel-settings', { vp, wait: 800 });
    await page.evaluate(() => { if (sites[0]) openSettings(sites[0]); });
    await scene(N('member-modal-settings'), '#modal-settings .modal', { vp, wait: 600 });
    await closeModals();

  }
  await browser.close();

  // ------------------------------------------------------------- summary --
  const KEYS = ['overflow', 'scroll', 'clipped', 'rows', 'contrast', 'tiny', 'stacked', 'overlap', 'order', 'touch'];
  const totals = Object.fromEntries(KEYS.map(k => [k, report.reduce((n, s) => n + s[k].length, 0)]));
  totals.errors = errors.length;
  fs.writeFileSync(path.join(opts.out, 'report.json'), JSON.stringify({ totals, errors, report }, null, 1));
  const failing = report.filter(s => KEYS.some(k => s[k].length));
  console.log(`\n${report.length} scenes, ${failing.length} failing. ${Object.entries(totals).map(([k, v]) => `${k}=${v}`).join(' ')}`);
  for (const s of failing) {
    for (const k of KEYS) for (const f of s[k].slice(0, 3)) console.log(`  ${s.scene}  ${k}: ${JSON.stringify(f)}`);
  }
  for (const e of errors) console.log(`  ${e.scene}  page error: ${e.message}`);
  console.log(`Report: ${path.join(opts.out, 'report.json')}`);
  process.exit(failing.length || errors.length ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
