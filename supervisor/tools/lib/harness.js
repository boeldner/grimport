// Shared plumbing for the browser tools (screenshots, ui-audit): browser
// lookup, localhost guard, health wait and the fake runtime state the demo
// seed cannot produce without Docker.
'use strict';

const path = require('path');
const fs = require('fs');

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

// -------------------------------------------------------------- base url --
// Resolves GRIMPORT_URL; refuses anything but localhost unless iKnow.
function resolveBase({ iKnow = false, verb = 'screenshot' } = {}) {
  const rawBase = process.env.GRIMPORT_URL || 'http://localhost:3000';
  let baseUrl;
  try {
    baseUrl = new URL(rawBase);
  } catch {
    console.error(`Invalid GRIMPORT_URL: ${rawBase}`);
    process.exit(1);
  }
  if (baseUrl.hostname !== 'localhost' && baseUrl.hostname !== '127.0.0.1' && !iKnow) {
    console.error(
      `Refusing to ${verb} non-localhost host "${baseUrl.hostname}".\n` +
      'This tool is for local demo instances only. Pass --i-know to override.'
    );
    process.exit(1);
  }
  return rawBase.replace(/\/+$/, '');
}

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

module.exports = { resolveChrome, resolveBase, waitForHealth, FAKE_CONTAINERS, FAKE_UPTIME, FAKE_IMAGE_STATUS };
