/**
 * Zip a local folder for deploy_directory. Always skips .git, node_modules
 * and OS junk; honours simple patterns from the folder's own .gitignore
 * (exact names, directory names, "*.ext" suffixes, "dir/**"). Negations and
 * nested .gitignore files are ignored. Returns { buffer, files, bytes }.
 */
const fs = require('fs');
const path = require('path');

const ALWAYS_SKIP = new Set(['.git', 'node_modules', '.DS_Store', 'Thumbs.db', '.grimport-deploy.zip']);
const DEFAULT_MAX_BYTES = 100 * 1024 * 1024;

function parseGitignore(dir) {
  const file = path.join(dir, '.gitignore');
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('!'))
    .map(l => l.replace(/^\//, '').replace(/\/\*\*$/, '').replace(/\/$/, ''));
}

function ignored(rel, name, patterns) {
  if (ALWAYS_SKIP.has(name)) return true;
  for (const p of patterns) {
    if (p.startsWith('*.') && name.endsWith(p.slice(1))) return true;
    if (p === name || p === rel) return true;
    if (rel.startsWith(`${p}/`)) return true;
  }
  return false;
}

function zipDirectory(dir, { AdmZip, maxBytes = DEFAULT_MAX_BYTES } = {}) {
  if (!AdmZip) throw new Error('zipDirectory needs the AdmZip constructor');
  const root = path.resolve(dir);
  if (!fs.existsSync(root) || !fs.statSync(root).isDirectory()) throw new Error(`Not a directory: ${root}`);
  const patterns = parseGitignore(root);
  const zip = new AdmZip();
  let files = 0;
  let bytes = 0;

  function walk(current) {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const abs = path.join(current, entry.name);
      const rel = path.relative(root, abs).split(path.sep).join('/');
      if (ignored(rel, entry.name, patterns)) continue;
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) { walk(abs); continue; }
      if (!entry.isFile()) continue;
      const data = fs.readFileSync(abs);
      bytes += data.length;
      if (bytes > maxBytes) throw new Error(`Folder exceeds ${Math.round(maxBytes / 1048576)} MB; build output only, no sources or dependencies`);
      zip.addFile(rel, data);
      files++;
    }
  }
  walk(root);
  if (!files) throw new Error(`Nothing to deploy in ${root} (everything ignored or empty)`);
  return { buffer: zip.toBuffer(), files, bytes };
}

module.exports = { zipDirectory, parseGitignore, ignored };
