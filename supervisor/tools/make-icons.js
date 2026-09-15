#!/usr/bin/env node
// Generates the PWA/home-screen icon PNGs from the Grim Mage logo SVG paths
// (the same paths used in index.html's .logo). No npm dependencies: draws a
// temporary HTML file and rasterizes it with the headless Chrome shell used
// by tools/screenshots.js.
//
// Usage: node tools/make-icons.js
// Env:   CHROME — path to a chrome-headless-shell binary (default: the
//        Puppeteer-cached one under ~/.cache/puppeteer).
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT_DIR = path.join(__dirname, '../public/icons');

const DEFAULT_CHROME = path.join(
  os.homedir(),
  '.cache/puppeteer/chrome-headless-shell/mac_arm-146.0.7680.153/chrome-headless-shell-mac-arm64/chrome-headless-shell'
);
const CHROME = process.env.CHROME || DEFAULT_CHROME;

// The two logo paths from supervisor/public/index.html's .logo svg
// (viewBox 0 0 64 64), recolored to violet for the tile.
const LOGO_PATH_1 =
  "M30 8c9 3 16 11 17 23l1 21c-6-6-11-4-16 6-5-10-10-12-16-6l1-21C18 19 23 11 30 8zm1.5 13c-6 2-9.5 7.5-9.5 14.5 0 7 4 11.5 9.5 13.5 5.5-2 9.5-6.5 9.5-13.5 0-7-3.5-12.5-9.5-14.5z";
const LOGO_PATH_2 = "M24.5 34.5l6 2M38.5 34.5l-6 2";
const LOGO_COLOR = '#a98af0';
const BG_GRADIENT = 'linear-gradient(135deg, #2a2438, #1d1d20)';

function logoSvg(scalePct) {
  // scalePct: how much of the tile the logo occupies (its viewBox square).
  return `
    <svg viewBox="0 0 64 64" fill="none" style="width:${scalePct}%;height:${scalePct}%">
      <path fill-rule="evenodd" clip-rule="evenodd" fill="${LOGO_COLOR}" d="${LOGO_PATH_1}"/>
      <path d="${LOGO_PATH_2}" stroke="${LOGO_COLOR}" stroke-width="2.6" stroke-linecap="round"/>
    </svg>`;
}

function tileHtml({ size, radiusPct, logoScalePct }) {
  const radius = radiusPct != null ? `${(size * radiusPct) / 100}px` : '0';
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html, body { margin: 0; padding: 0; background: transparent; }
  .tile {
    width: ${size}px;
    height: ${size}px;
    border-radius: ${radius};
    background: ${BG_GRADIENT};
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
</style></head>
<body>
  <div class="tile">${logoSvg(logoScalePct)}</div>
</body></html>`;
}

function render(html, outFile, size) {
  const tmpFile = path.join(os.tmpdir(), `grimport-icon-${Date.now()}-${Math.random().toString(36).slice(2)}.html`);
  fs.writeFileSync(tmpFile, html, 'utf8');
  try {
    execFileSync(CHROME, [
      '--headless',
      `--screenshot=${outFile}`,
      `--window-size=${size},${size}`,
      '--default-background-color=00000000',
      '--hide-scrollbars',
      `file://${tmpFile}`,
    ], { stdio: 'inherit' });
  } finally {
    fs.unlinkSync(tmpFile);
  }
}

function main() {
  if (!fs.existsSync(CHROME)) {
    console.error(`chrome-headless-shell not found at: ${CHROME}`);
    console.error('Set CHROME=/path/to/chrome-headless-shell and retry.');
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const targets = [
    // Standard icons: rounded-square tile, logo fills most of the tile.
    { file: 'icon-192.png', size: 192, radiusPct: 22, logoScalePct: 62 },
    { file: 'icon-512.png', size: 512, radiusPct: 22, logoScalePct: 62 },
    // Maskable: no rounded corners (the OS applies its own mask), logo
    // kept inside the central 60% "safe zone" so it survives any mask shape.
    { file: 'icon-512-maskable.png', size: 512, radiusPct: null, logoScalePct: 60 },
    // Apple touch icon: iOS rounds the corners itself, so ship a square tile.
    { file: 'apple-touch-icon.png', size: 180, radiusPct: null, logoScalePct: 62 },
  ];

  for (const t of targets) {
    const outFile = path.join(OUT_DIR, t.file);
    render(tileHtml(t), outFile, t.size);
    console.log(`wrote ${path.relative(process.cwd(), outFile)}`);
  }
}

main();
