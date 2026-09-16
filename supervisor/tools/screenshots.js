// Screenshot harness for the Grimport panel.
//
// Usage:
//   node tools/screenshots.js [--out DIR] [--themes dark,light] [--only name,name] [--all]
//
// Env:
//   CHROME         path to a Chrome/Chromium binary (auto-detected otherwise)
//   GRIMPORT_URL   panel base URL (default http://localhost:3000) — must be
//                  localhost/127.0.0.1 unless --i-know is passed
//   GRIMPORT_USER  login username (default admin)
//   GRIMPORT_PASS  login password (default changeme)
//
// With no flags, shoots the curated default set (used by README/wiki) into
// docs/screenshots/. --all shoots every view/modal the harness knows about
// into docs/screenshots/all/. --only restricts to specific shot names.
'use strict';

const puppeteer = require('puppeteer-core');
const path = require('path');
const fs = require('fs');

// ------------------------------------------------------------- arguments --
function parseArgs(argv) {
  const opts = { out: null, themes: null, only: null, all: false, iKnow: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--out') opts.out = argv[++i];
    else if (a === '--themes') opts.themes = argv[++i];
    else if (a === '--only') opts.only = argv[++i];
    else if (a === '--all') opts.all = true;
    else if (a === '--i-know') opts.iKnow = true;
    else {
      console.error(`Unknown argument: ${a}`);
      process.exit(1);
    }
  }
  return opts;
}
const args = parseArgs(process.argv.slice(2));

// -------------------------------------------------------- browser lookup --
function firstGlobMatch(pattern) {
  // `pattern` has exactly one '*' path segment (a version directory).
  const parts = pattern.split(path.sep);
  const starIdx = parts.indexOf('*');
  if (starIdx === -1) return fs.existsSync(pattern) ? pattern : null;
  const base = parts.slice(0, starIdx).join(path.sep) || path.sep;
  let entries;
  try {
    entries = fs.readdirSync(base);
  } catch {
    return null;
  }
  entries.sort().reverse(); // prefer the newest-looking version directory
  for (const entry of entries) {
    const candidate = path.join(base, entry, ...parts.slice(starIdx + 1));
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function resolveChrome() {
  if (process.env.CHROME) return process.env.CHROME;
  const home = process.env.HOME;
  const headlessShell = firstGlobMatch(
    path.join(home, '.cache/puppeteer/chrome-headless-shell/*/chrome-headless-shell-mac-arm64/chrome-headless-shell')
  );
  if (headlessShell) return headlessShell;
  const chromeForTesting = firstGlobMatch(
    path.join(home, '.cache/puppeteer/chrome/*/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
  );
  if (chromeForTesting) return chromeForTesting;
  const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  if (fs.existsSync(systemChrome)) return systemChrome;
  console.error(
    'No Chrome/Chromium executable found.\n' +
    'Checked: $CHROME, ~/.cache/puppeteer/chrome-headless-shell/*, ~/.cache/puppeteer/chrome/*, ' +
    systemChrome + '.\n' +
    'Set the CHROME env var to a browser binary.'
  );
  process.exit(1);
}
const EXE = resolveChrome();

// -------------------------------------------------------------- base url --
const rawBase = process.env.GRIMPORT_URL || 'http://localhost:3000';
let baseUrl;
try {
  baseUrl = new URL(rawBase);
} catch {
  console.error(`Invalid GRIMPORT_URL: ${rawBase}`);
  process.exit(1);
}
if (baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1' && !args.iKnow) {
  console.error(
    `Refusing to screenshot non-localhost host "${baseUrl.hostname}".\n` +
    'This tool is for local demo instances only. Pass --i-know to override.'
  );
  process.exit(1);
}
const BASE = rawBase.replace(/\/+$/, '');

const GRIMPORT_USER = process.env.GRIMPORT_USER || 'admin';
const GRIMPORT_PASS = process.env.GRIMPORT_PASS || 'changeme';

// ------------------------------------------------------- output / scope --
const DEFAULT_OUT = path.join(__dirname, '..', '..', 'docs', 'screenshots');
const CURATED_DEFAULT = [
  'sites', 'sites-list', 'sites-overflow', 'notifications', 'modal-deploy', 'modal-settings-general',
  'modal-settings-access', 'modal-analytics', 'overview', 'activity', 'deployments', 'settings-general',
  'settings-tokens', 'settings-users', 'settings-security', 'domains', 'modal-invite', 'sites-phone', 'sites-phone-custom-bar', 'login',
  'member-sites', 'member-new-site', 'member-settings',
];

const OUT = args.out
  ? path.resolve(args.out)
  : args.all
    ? path.join(DEFAULT_OUT, 'all')
    : DEFAULT_OUT;
fs.mkdirSync(OUT, { recursive: true });

const THEMES = args.themes ? args.themes.split(',').map(s => s.trim()).filter(Boolean) : ['dark', 'light'];
const ONLY = args.all ? null : (args.only ? args.only.split(',').map(s => s.trim()).filter(Boolean) : CURATED_DEFAULT);

// ------------------------------------------------------------ fake data --
const FAKE_CONTAINERS = {
  s1aaaaaaaa: { status: 'running', running: true, exitCode: 0 },
  s2bbbbbbbb: { status: 'exited', running: false, exitCode: 137 },
  s3cccccccc: { status: 'restarting', running: false, exitCode: 1 },
  s4dddddddd: { status: 'running', running: true, exitCode: 0 },
  s5eeeeeeee: { status: 'none', running: false },
};
const FAKE_UPTIME = {
  s1aaaaaaaa: { currentStatus: 'up', uptime24h: '99.98' },
  s2bbbbbbbb: { currentStatus: 'down', uptime24h: '89.4' },
  s3cccccccc: { currentStatus: 'up', uptime24h: '97.2' },
  s4dddddddd: { currentStatus: 'up', uptime24h: '100' },
};
const FAKE_IMAGE_STATUS = {
  images: [{ tag: 'nginx:alpine', local_image_id: 'bbbb00000000' }, { tag: 'node:22-alpine', local_image_id: 'cccc00000000' }],
  sites: [
    { id: 's1aaaaaaaa', name: 'Bakery landing', runtime: 'static', image: 'nginx:alpine', container_image_id: 'bbbb00000000', local_image_id: 'bbbb00000000', outdated: false, missing: false },
    { id: 's2bbbbbbbb', name: 'Board-game club', runtime: 'static', image: 'nginx:alpine', container_image_id: 'aaaa00000000', local_image_id: 'bbbb00000000', outdated: true, missing: false },
    { id: 's3cccccccc', name: 'Weather API', runtime: 'node', image: 'node:22-alpine', container_image_id: 'cccc00000000', local_image_id: 'cccc00000000', outdated: false, missing: false },
    { id: 's5eeeeeeee', name: 'Reading list', runtime: 'python', image: 'python:3.12-slim', container_image_id: null, local_image_id: null, outdated: false, missing: true },
  ],
  outdated: 1, total: 4, job: { status: 'idle' },
};

// ------------------------------------------------------------- health --
async function waitForHealth(base, timeoutMs = 20000) {
  const url = `${base}/api/health`;
  const start = Date.now();
  let lastErr;
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error(`Server not reachable at ${url} after ${timeoutMs}ms (${lastErr?.message || 'unknown error'}).`);
  console.error('Start it first, e.g.: npm run demo-serve');
  process.exit(1);
}

async function main() {
  await waitForHealth(BASE);

  const browser = await puppeteer.launch({ executablePath: EXE, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  page.on('pageerror', e => console.log('  [pageerror]', e.message));
  page.on('console', m => { if (m.type() === 'error') console.log('  [console]', m.text()); });

  await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
  await page.type('#username-input', GRIMPORT_USER);
  await page.type('#password-input', GRIMPORT_PASS);
  await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#btn-login')]);

  // Any action right before a shot can pop a toast (e.g. "Tab bar saved");
  // strip them so they never appear in a screenshot.
  const dismissToasts = () => page.evaluate(() => document.querySelectorAll('.toast').forEach(t => t.remove()));
  const shot = async (name, opts = {}) => {
    if (ONLY && !ONLY.includes(name.split('__')[0])) return;
    const file = path.join(OUT, `${name}.png`);
    await new Promise(r => setTimeout(r, opts.wait ?? 250));
    await dismissToasts();
    await page.screenshot({ path: file, fullPage: !!opts.fullPage });
    console.log('  shot', path.basename(file));
  };
  const fakeSites = async () => {
    await page.evaluate((fc, fu) => {
      for (const s of sites) { s.container = fc[s.id] || s.container; }
      Object.assign(uptimeData, fu);
      renderSites();
    }, FAKE_CONTAINERS, FAKE_UPTIME);
  };
  const view = async v => {
    await page.evaluate(v => document.querySelector(`.sidebar .nav-item[data-view="${v}"]`).click(), v);
    await new Promise(r => setTimeout(r, 600));
  };
  const closeModals = async () => {
    await page.evaluate(() => {
      document.querySelectorAll('.modal-backdrop:not(.hidden)').forEach(b => b.classList.add('hidden'));
      document.querySelectorAll('.modal-backdrop:not([id])').forEach(b => b.remove());
    });
  };

  for (const theme of THEMES) {
    console.log(`theme ${theme}`);
    const T = n => `${n}__${theme}`;
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await page.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
    await page.evaluate(t => { localStorage.setItem('grimport-theme', t); applyTheme(t); }, theme);
    await page.evaluate(() => { document.getElementById('onboarding-backdrop')?.classList.add('hidden'); document.getElementById('onboarding-reminder-banner')?.classList.add('hidden'); });
    await new Promise(r => setTimeout(r, 500));
    await fakeSites();
    await shot(T('sites'));

    // Sites list view (task B) — switch, shoot, then switch back to cards
    // so every shot after this one keeps seeing the card grid it expects.
    await page.evaluate(() => document.getElementById('sites-view-list').click());
    await shot(T('sites-list'), { wait: 400 });
    await page.evaluate(() => document.getElementById('sites-view-cards').click());

    await page.evaluate(() => document.querySelector('[data-action="overflow"]').click());
    await shot(T('sites-overflow'));
    await page.evaluate(() => closeAllSiteOverflows());

    await page.evaluate(() => document.querySelector('[data-action="uptime-detail"]').click());
    await shot(T('sites-uptime-popover'), { wait: 600 });
    await page.evaluate(() => closeUptimePopover());

    await page.click('#btn-bell');
    await shot(T('notifications'), { wait: 600 });
    await page.click('#btn-bell');

    const s1 = 's1aaaaaaaa';
    await page.evaluate(id => openDeploy(sites.find(s => s.id === id)), s1);
    await shot(T('modal-deploy'));
    await closeModals();

    await page.evaluate(id => openSettings(sites.find(s => s.id === id)), 's2bbbbbbbb');
    await shot(T('modal-settings-general'));
    await page.evaluate(() => document.getElementById('mtab-behaviour').click());
    await page.evaluate(() => { document.getElementById('btn-add-header').click(); });
    await shot(T('modal-settings-behaviour'));
    await page.evaluate(() => document.getElementById('mtab-access').click());
    await page.evaluate(() => { document.getElementById('btn-add-redirect').click(); });
    await shot(T('modal-settings-access'), { wait: 600 });
    await page.evaluate(() => document.getElementById('mtab-app').click());
    await page.evaluate(() => { document.getElementById('btn-add-env-var').click(); });
    await shot(T('modal-settings-app'));
    await closeModals();

    await page.evaluate(() => document.getElementById('btn-new-site').click());
    await shot(T('modal-new-site'));
    await page.evaluate(() => setNewSiteRuntime('node'));
    await shot(T('modal-new-site-node'));
    await closeModals();

    await page.evaluate(id => openAnalytics(sites.find(s => s.id === id)), s1);
    await shot(T('modal-analytics'), { wait: 800 });
    await closeModals();

    await page.evaluate(id => openDns(sites.find(s => s.id === id)), s1);
    await shot(T('modal-dns'), { wait: 800 });
    await page.evaluate(() => switchDnsTab('cloudflare'));
    await shot(T('modal-dns-cloudflare'));
    await closeModals();

    await page.evaluate(id => openLogs(sites.find(s => s.id === id)), s1);
    await shot(T('modal-logs'), { wait: 600 });
    await closeModals();

    await page.evaluate(id => openHistory(sites.find(s => s.id === id)), s1);
    await shot(T('modal-history'), { wait: 600 });
    await closeModals();

    await page.evaluate(() => openConnectDomain('blog.demo.test'));
    await shot(T('modal-connect-domain'));
    await closeModals();

    await page.evaluate(id => openPreviewModal(sites.find(s => s.id === id)), s1);
    await shot(T('modal-preview'));
    await closeModals();

    await page.evaluate(() => { openModal('modal-update'); setUpdateStep('applying'); });
    await shot(T('modal-update'));
    await closeModals();

    page.evaluate(() => confirmDialog({ title: 'Delete "Bakery landing"?', body: 'This permanently removes the container and all files.', confirmLabel: 'Delete site', danger: true, requireText: 'Bakery landing' }));
    await shot(T('confirm-dialog'), { wait: 400 });
    await page.evaluate(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    await closeModals();

    await page.evaluate(() => { openModal('cmdk-backdrop'); document.getElementById('cmdk-input').dispatchEvent(new Event('input')); });
    await shot(T('cmdk'), { wait: 400 });
    await closeModals();

    await view('overview'); await shot(T('overview'), { wait: 800 });
    await view('activity'); await shot(T('activity'), { wait: 800 });
    await view('deployments'); await shot(T('deployments'), { wait: 800 });
    await view('logs'); await shot(T('logs'));
    await view('domains'); await shot(T('domains'), { wait: 800 });
    await view('panel-settings');
    await page.evaluate(st => renderImageStatus(st), FAKE_IMAGE_STATUS);
    await shot(T('settings-general'), { wait: 800 });
    await page.evaluate(() => document.getElementById('btn-tabbar-customize-settings').click());
    await shot(T('modal-tabbar'), { wait: 500 });
    await closeModals();
    await page.evaluate(() => document.getElementById('img-update-panel').scrollIntoView({ block: 'center' }));
    await shot(T('settings-general-updates'), { wait: 300 });
    await page.evaluate(() => document.getElementById('backups-list').scrollIntoView({ block: 'center' }));
    await shot(T('settings-general-backups'), { wait: 300 });
    await page.evaluate(() => document.querySelector('.main').scrollTo(0, 0));
    for (const tab of ['server', 'tokens', 'webhooks', 'notifications', 'users', 'security']) {
      await page.evaluate(t => document.getElementById(`ptab-${t}`).click(), tab);
      await shot(T(`settings-${tab}`), { wait: 900 });
      await page.evaluate(() => { const m = document.querySelector('.main'); m.scrollTo(0, m.scrollHeight); });
      await shot(T(`settings-${tab}-bottom`), { wait: 300 });
      await page.evaluate(() => document.querySelector('.main').scrollTo(0, 0));
    }
    await page.evaluate(() => document.getElementById('ptab-users').click());
    await new Promise(r => setTimeout(r, 600));
    await page.evaluate(() => document.querySelector('[data-edit-user]')?.click());
    await shot(T('modal-edit-user'), { wait: 600 });
    await new Promise(r => setTimeout(r, 800));
    await closeModals();

    await page.evaluate(() => document.getElementById('btn-open-invite').click());
    await new Promise(r => setTimeout(r, 400));
    await page.type('#invite-label', 'Dora');
    await shot(T('modal-invite'), { wait: 300 });
    await closeModals();

    await view('sites');
    await page.setViewport({ width: 820, height: 900 });
    await fakeSites();
    await shot(T('sites-tablet'), { wait: 500 });
    await page.setViewport({ width: 400, height: 860 });
    await fakeSites();
    await shot(T('sites-phone'), { wait: 500 });
    await page.evaluate(() => document.getElementById('btn-phone-menu').click());
    await shot(T('sites-phone-menu'), { wait: 500 });
    await page.evaluate(() => document.getElementById('btn-tabbar-customize').click());
    await shot(T('modal-tabbar-phone'), { wait: 500 });
    await page.evaluate(() => { tabbarDraft = ['sites', 'logs', 'deployments', 'activity']; renderTabbarList(); });
    await shot(T('modal-tabbar-phone-edited'), { wait: 300 });
    await page.evaluate(() => document.getElementById('btn-tabbar-save').click());
    await shot(T('sites-phone-custom-bar'), { wait: 500 });
    await page.evaluate(() => { localStorage.removeItem('grimport-tabbar'); renderBottomNav(); });
    await page.evaluate(id => openSettings(sites.find(s => s.id === id)), 's2bbbbbbbb');
    await shot(T('modal-settings-phone'), { wait: 500 });
    await closeModals();
    await view('panel-settings');
    await page.evaluate(st => renderImageStatus(st), FAKE_IMAGE_STATUS);
    await shot(T('settings-phone'), { wait: 700, fullPage: true });
    await page.setViewport({ width: 1440, height: 900 });
  }

  await page.setViewport({ width: 1440, height: 900 });
  for (const theme of THEMES) {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
    await page.evaluate(t => document.documentElement.setAttribute('data-theme', t), theme);
    await shot(`login__${theme}`);
  }

  // ── Second pass: log in as carla (member, beginner preset) for the
  // member-facing shots (task 12). logOut + loginAs re-authenticate the
  // same page as a different demo user.
  async function logOut() {
    await page.evaluate(() => fetch('/api/auth/logout', { method: 'POST' }));
  }
  async function loginAs(username, password) {
    await page.goto(`${BASE}/login.html`, { waitUntil: 'networkidle0' });
    await page.type('#username-input', username);
    await page.type('#password-input', password);
    await Promise.all([page.waitForNavigation({ waitUntil: 'networkidle0' }), page.click('#btn-login')]);
  }

  await logOut();
  for (const theme of THEMES) {
    const T = n => `${n}__${theme}`;
    await loginAs('carla', 'demo-password');
    await page.evaluate(t => { localStorage.setItem('grimport-theme', t); applyTheme(t); }, theme);
    await new Promise(r => setTimeout(r, 500));
    await shot(T('member-sites'), { wait: 500 });

    await page.evaluate(() => document.getElementById('btn-new-site').click());
    await shot(T('member-new-site'), { wait: 400 });
    await closeModals();

    await page.evaluate(() => document.querySelector('.nav-item[data-view="panel-settings"]').click());
    await shot(T('member-settings'), { wait: 500 });
    await logOut();
  }

  await browser.close();

  // Default (curated) run only: keep docs/screenshot.png — the one image
  // referenced from outside docs/screenshots/ — in sync automatically.
  if (!args.all && !args.only && !args.out) {
    const src = path.join(OUT, 'sites__dark.png');
    const dest = path.join(__dirname, '..', '..', 'docs', 'screenshot.png');
    try {
      fs.copyFileSync(src, dest);
      console.log(`  copied ${path.basename(src)} -> ${path.relative(path.join(__dirname, '..', '..'), dest)}`);
    } catch (e) {
      console.error(`Could not copy ${src} -> ${dest}: ${e.message}`);
    }
  }

  console.log(`Done. Output: ${OUT}`);
}
main().catch(e => { console.error(e); process.exit(1); });
