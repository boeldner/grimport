const fs = require('fs');
const path = require('path');

/**
 * Total size in bytes of all regular files under `dir` (symlinks are not
 * followed, so a link cannot make a quota look bigger or smaller than it is).
 * Missing directory counts as 0.
 */
function dirSizeBytes(dir) {
  let total = 0;
  const walk = p => {
    let entries;
    try { entries = fs.readdirSync(p, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const full = path.join(p, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) walk(full);
      else if (e.isFile()) { try { total += fs.statSync(full).size; } catch {} }
    }
  };
  walk(dir);
  return total;
}

module.exports = { dirSizeBytes };
