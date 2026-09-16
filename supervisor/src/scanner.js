/**
 * Static content scanner (docs/roadmap/multi-user-platform.md section 8,
 * "Phase 4 — content safety on deploy"). Pure functions: no Docker, no
 * network, only reads files under a directory that's already on disk
 * (a staged deploy — see routes/deploy.js).
 *
 * scanDirectory() walks the tree and returns a verdict + findings. The
 * verdict is the highest severity found: blocked > review > clean
 * (an `info`-only result is still `clean`).
 */
const fs = require('fs');
const path = require('path');

const MB = 1024 * 1024;
const MAX_FILE_BYTES = 5 * MB;
const MAX_FILES = 20000;

const EXE_EXTENSIONS = new Set([
  '.exe', '.scr', '.bat', '.cmd', '.msi', '.com', '.pif', '.vbs', '.ps1', '.dll', '.apk', '.dmg', '.jar',
]);

const MINER_SIGNATURES = [
  'coinhive', 'coin-hive', 'crypto-loot', 'cryptoloot', 'webminepool', 'coinimp',
  'minero', 'deepminer', 'jsecoin', 'monerominer', 'coinhive.anonymous', 'cryptonight',
];

const BRAND_WORDS = [
  'paypal', 'apple', 'icloud', 'microsoft', 'office365', 'outlook', 'google', 'gmail',
  'amazon', 'netflix', 'instagram', 'facebook', 'whatsapp', 'dhl', 'ups', 'fedex',
  'sparkasse', 'volksbank', 'commerzbank', 'postbank', 'ing', 'n26', 'revolut', 'bank',
  'steam', 'playstation',
];

// Seeded into settings.scan_script_allowlist on first run — see routes/settings.js.
const DEFAULT_SCRIPT_ALLOWLIST = [
  'cdnjs.cloudflare.com', 'cdn.jsdelivr.net', 'unpkg.com', 'fonts.googleapis.com',
  'fonts.gstatic.com', 'plausible.io', 'umami.is', 'www.googletagmanager.com',
  'www.google-analytics.com', 'js.stripe.com', 'cdn.tailwindcss.com', 'code.jquery.com',
  'ajax.googleapis.com',
];

/** Shannon entropy (bits/char) of a string. 0 for an empty string. */
function shannonEntropy(str) {
  if (!str || !str.length) return 0;
  const freq = new Map();
  for (const ch of str) freq.set(ch, (freq.get(ch) || 0) + 1);
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / str.length;
    entropy -= p * Math.log2(p);
  }
  return entropy;
}

/**
 * Heuristic: does this buffer look like binary content (as opposed to
 * text)? A NUL byte anywhere in the sample is a strong signal; otherwise a
 * high ratio of non-printable control bytes.
 */
function isBinary(buf) {
  const len = Math.min(buf.length, 8000);
  if (len === 0) return false;
  let suspicious = 0;
  for (let i = 0; i < len; i++) {
    const b = buf[i];
    if (b === 0) return true;
    if ((b < 7 || (b > 13 && b < 32)) && b !== 27) suspicious++;
  }
  return suspicious / len > 0.3;
}

/**
 * Hostnames referenced by `<tagName attrName="http(s)://host/...">` in a
 * blob of HTML, lower-cased. Used for `<script src>` and `<form action>`.
 */
function extractHosts(html, tagName = 'script', attrName = 'src') {
  const re = new RegExp(`<${tagName}\\b[^>]*\\b${attrName}\\s*=\\s*["']\\s*(https?:)\\/\\/([^"'/\\s]+)`, 'gi');
  const hosts = [];
  let m;
  while ((m = re.exec(html))) hosts.push(m[2].toLowerCase());
  return hosts;
}

function hasSensitiveInput(html) {
  if (/type\s*=\s*["']password["']/i.test(html)) return true;
  const nameRe = /<input\b[^>]*\b(?:name|id)\s*=\s*["']([^"']*)["'][^>]*>/gi;
  let m;
  while ((m = nameRe.exec(html))) {
    if (/\b(card|cvv|iban|pin)\b/i.test(m[1])) return true;
  }
  return false;
}

/**
 * True when this page has a password/card-style input AND its text
 * mentions a well-known brand — the base phishing signal, before deciding
 * whether the form target upgrades it from "review" to "blocked".
 */
function isBrandPhish(html) {
  if (!hasSensitiveInput(html)) return false;
  return BRAND_WORDS.some(word => new RegExp(`\\b${word.replace(/[.]/g, '\\.')}\\b`, 'i').test(html));
}

function detectPhishing(html) {
  if (!isBrandPhish(html)) return null;
  const formHosts = extractHosts(html, 'form', 'action');
  if (formHosts.length) {
    return { severity: 'blocked', detail: `password/brand page with a form posting to ${formHosts[0]}` };
  }
  return { severity: 'review', detail: 'password or payment field combined with a known brand name' };
}

function detectMiner(text) {
  const lower = text.toLowerCase();
  for (const sig of MINER_SIGNATURES) {
    if (lower.includes(sig)) return { detail: `known miner signature "${sig}"` };
  }
  if (/webassembly/i.test(text) && /(hashrate|stratum)/i.test(text)) {
    return { detail: 'WebAssembly combined with hashrate/stratum' };
  }
  return null;
}

const SECRET_PATTERNS = [
  ['AWS access key', /AKIA[0-9A-Z]{16}/],
  ['private key block', /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['GitHub token', /ghp_[A-Za-z0-9]{36}/],
  ['Slack token', /xox[baprs]-/],
];
const GENERIC_SECRET_PATTERN = ['possible API key, secret or password literal', /(api[_-]?key|secret|password)\s*[:=]\s*['"][^'"]{12,}['"]/i];

function scanSecrets(text, rel, filename, isHtml, add) {
  if (filename === '.env' || filename.toLowerCase().endsWith('.env')) {
    add('secret', 'review', rel, '.env file present in deploy');
  }
  const patterns = isHtml ? SECRET_PATTERNS : [...SECRET_PATTERNS, GENERIC_SECRET_PATTERN];
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    for (const [name, re] of patterns) {
      if (re.test(lines[i])) add('secret', 'review', rel, name, i + 1);
    }
  }
}

function scanObfuscation(text, rel, add) {
  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.length > 5000 && shannonEntropy(line) > 5.0) {
      add('obfuscated-js', 'review', rel, 'long high-entropy line (possibly packed/obfuscated)', i + 1);
      break; // one finding per file is enough
    }
  }
  if (text.includes('eval(atob(')) add('obfuscated-js', 'review', rel, 'eval(atob(...)) pattern');
  if (text.includes('eval(unescape(')) add('obfuscated-js', 'review', rel, 'eval(unescape(...)) pattern');
  if (/Function\(["'][^)]*\\x[0-9a-fA-F]{2}/.test(text)) add('obfuscated-js', 'review', rel, 'Function("...") built from hex escapes');
  const hexEscapes = text.match(/\\x[0-9a-fA-F]{2}/g);
  if (hexEscapes && hexEscapes.length > 200) add('obfuscated-js', 'review', rel, `${hexEscapes.length} hex escape sequences in one file`);
}

function scanRedirect(html, rel, add) {
  const metaMatch = html.match(/<meta\s+http-equiv=["']refresh["'][^>]*content=["'][^"']*url=(https?:\/\/[^"'>\s]+)/i);
  if (metaMatch) {
    try { add('redirect', 'review', rel, `meta refresh to ${new URL(metaMatch[1]).hostname}`); } catch {}
  }
  const scriptMatch = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/i);
  if (scriptMatch) {
    const head = scriptMatch[1].slice(0, 3000);
    const redirMatch = head.match(/location\.(?:href\s*=|replace\()\s*["'](https?:\/\/[^"']+)["']/);
    if (redirMatch) {
      try { add('redirect', 'review', rel, `script redirects to ${new URL(redirMatch[1]).hostname}`); } catch {}
    }
  }
}

function scanInlineData(text, rel, add) {
  const re = /data:[^;,\s"']+;base64,([A-Za-z0-9+/=]+)/g;
  let m;
  while ((m = re.exec(text))) {
    const bytes = Math.floor((m[1].length * 3) / 4);
    if (bytes > 200 * 1024) add('large-inline-data', 'info', rel, `data: URI ~${Math.round(bytes / 1024)} KB`);
  }
}

/**
 * Walk `dir` and return { verdict, findings, stats }.
 * opts.allowlist overrides the default external-script allow-list (an
 * array of hostnames; merged with the site's own list by the caller).
 */
function scanDirectory(dir, opts = {}) {
  const allowlist = new Set((opts.allowlist && opts.allowlist.length ? opts.allowlist : DEFAULT_SCRIPT_ALLOWLIST).map(h => String(h).toLowerCase()));
  const findings = [];
  let fileCount = 0;
  let byteCount = 0;
  const externalHostsSet = new Set();

  function add(category, severity, file, detail, line) {
    const finding = { category, severity, file, detail };
    if (line) finding.line = line;
    findings.push(finding);
  }

  function walk(current) {
    if (fileCount >= MAX_FILES) return;
    let entries;
    try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { return; }
    for (const entry of entries) {
      if (fileCount >= MAX_FILES) return;
      if (entry.isSymbolicLink()) continue;
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) { walk(full); continue; }
      if (!entry.isFile()) continue;

      fileCount++;
      const rel = path.relative(dir, full) || entry.name;
      let stat;
      try { stat = fs.statSync(full); } catch { continue; }
      byteCount += stat.size;

      const ext = path.extname(entry.name).toLowerCase();
      // Extension-based executable check runs regardless of size/binary-ness.
      if (EXE_EXTENSIONS.has(ext)) {
        add('executable', 'blocked', rel, `executable file extension "${ext}"`);
      }

      if (stat.size > MAX_FILE_BYTES) continue; // too big to read content

      let buf;
      try { buf = fs.readFileSync(full); } catch { continue; }

      if (buf.length >= 2 && buf[0] === 0x4d && buf[1] === 0x5a) {
        add('executable', 'blocked', rel, 'file starts with the MZ (Windows PE) header');
      } else if (buf.length >= 4 && buf[0] === 0x7f && buf[1] === 0x45 && buf[2] === 0x4c && buf[3] === 0x46) {
        add('executable', 'blocked', rel, 'file starts with the ELF header');
      }

      if (isBinary(buf)) continue; // content-based scans only make sense on text

      const text = buf.toString('utf8');
      const isHtml = ext === '.html' || ext === '.htm';
      const isJs = ext === '.js' || ext === '.mjs';

      scanSecrets(text, rel, entry.name, isHtml, add);
      if (isJs || isHtml) scanObfuscation(text, rel, add);

      const miner = detectMiner(text);
      if (miner) add('miner', 'blocked', rel, miner.detail);

      if (isHtml) {
        const phishing = detectPhishing(text);
        if (phishing) add('phishing', phishing.severity, rel, phishing.detail);

        for (const host of extractHosts(text, 'script', 'src')) {
          externalHostsSet.add(host);
          add('external-script', allowlist.has(host) ? 'info' : 'review', rel, `script loaded from ${host}`);
        }
        for (const host of extractHosts(text, 'form', 'action')) {
          if (!allowlist.has(host)) add('external-form', 'review', rel, `form posts to ${host}`);
        }
        if (entry.name.toLowerCase() === 'index.html') scanRedirect(text, rel, add);
      }

      scanInlineData(text, rel, add);
    }
  }

  walk(dir);

  const hasBlocked = findings.some(f => f.severity === 'blocked');
  const hasReview = findings.some(f => f.severity === 'review');
  const verdict = hasBlocked ? 'blocked' : hasReview ? 'review' : 'clean';

  return {
    verdict,
    findings,
    stats: { files: fileCount, bytes: byteCount, externalHosts: [...externalHostsSet] },
  };
}

module.exports = {
  scanDirectory,
  shannonEntropy,
  isBinary,
  extractHosts,
  isBrandPhish,
  DEFAULT_SCRIPT_ALLOWLIST,
};
