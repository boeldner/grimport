const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { nanoid } = require('nanoid');

const MB = 1024 * 1024;

/** Limits from env (DEPLOY_MAX_ENTRIES, DEPLOY_MAX_TOTAL_MB, DEPLOY_MAX_FILE_MB). */
function defaultLimits() {
  const n = (v, d) => { const x = Number(v); return Number.isFinite(x) && x > 0 ? x : d; };
  return {
    maxEntries: n(process.env.DEPLOY_MAX_ENTRIES, 20000),
    maxTotalBytes: n(process.env.DEPLOY_MAX_TOTAL_MB, 1024) * MB,
    maxSingleBytes: n(process.env.DEPLOY_MAX_FILE_MB, 250) * MB,
  };
}

function isSymlinkEntry(entry) {
  // Unix mode lives in the high 16 bits of the external attributes.
  const mode = (entry.header.attr >>> 16) & 0xffff;
  return (mode & 0xf000) === 0xa000;
}

function dirSize(dir) {
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

/**
 * Inspect a zip without extracting: entry count, declared uncompressed size,
 * and any policy violation (limits, symlinks, NUL bytes). Throws on violation.
 * Returns { entries, totalBytes }.
 */
function inspectZip(zipPath, limits = defaultLimits()) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();
  if (entries.length > limits.maxEntries) {
    throw new Error(`Rejected: zip has ${entries.length} entries, limit is ${limits.maxEntries}`);
  }
  let totalBytes = 0;
  for (const entry of entries) {
    if (entry.entryName.includes('\0')) throw new Error('Rejected: zip entry name contains a NUL byte');
    if (isSymlinkEntry(entry)) throw new Error(`Rejected: symlinks are not allowed in deploys (${entry.entryName})`);
    const size = Number(entry.header.size) || 0;
    if (size > limits.maxSingleBytes) {
      throw new Error(`Rejected: ${entry.entryName} is ${Math.round(size / MB)} MB, single-file limit is ${Math.round(limits.maxSingleBytes / MB)} MB`);
    }
    totalBytes += size;
    if (totalBytes > limits.maxTotalBytes) {
      throw new Error(`Rejected: uncompressed size exceeds ${Math.round(limits.maxTotalBytes / MB)} MB`);
    }
  }
  return { zip, entries, totalBytes };
}

/**
 * Validate + extract a zip into targetDir atomically.
 * On any error, an existing targetDir is left untouched.
 * Returns { fileCount, totalBytes }.
 */
function atomicExtract(zipPath, targetDir, limits = defaultLimits()) {
  const resolvedTarget = path.resolve(targetDir);
  const tmpDir = path.join(path.dirname(resolvedTarget), `.deploy-tmp-${nanoid(8)}`);

  try {
    // Parse + policy-check first — throws before touching the live dir.
    const { zip, entries, totalBytes } = inspectZip(zipPath, limits);

    // Zip-slip check against the temp dir.
    for (const entry of entries) {
      const dest = path.resolve(path.join(tmpDir, entry.entryName));
      if (!dest.startsWith(tmpDir + path.sep) && dest !== tmpDir) {
        throw new Error(`Rejected: zip entry outside target directory: ${entry.entryName}`);
      }
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    zip.extractAllTo(tmpDir, true);

    // Headers can lie (zip bombs): measure what actually landed on disk.
    const onDisk = dirSize(tmpDir);
    if (onDisk > limits.maxTotalBytes) {
      throw new Error(`Rejected: extracted size ${Math.round(onDisk / MB)} MB exceeds ${Math.round(limits.maxTotalBytes / MB)} MB`);
    }

    // Hoist a single root folder so files land flat.
    const meaningful = entries.filter(e => !e.entryName.startsWith('__MACOSX') && !e.entryName.startsWith('.'));
    const rootNames = new Set(meaningful.map(e => e.entryName.split('/')[0]));
    if (rootNames.size === 1) {
      const nested = path.join(tmpDir, [...rootNames][0]);
      if (fs.existsSync(nested) && fs.statSync(nested).isDirectory()) {
        fs.cpSync(nested, tmpDir, { recursive: true });
        fs.rmSync(nested, { recursive: true, force: true });
      }
    }
    const macos = path.join(tmpDir, '__MACOSX');
    if (fs.existsSync(macos)) fs.rmSync(macos, { recursive: true, force: true });

    // Atomic swap via same-parent renames (temp is a sibling of target).
    const backupDir = fs.existsSync(resolvedTarget)
      ? path.join(path.dirname(resolvedTarget), `.deploy-bak-${nanoid(8)}`)
      : null;
    if (backupDir) fs.renameSync(resolvedTarget, backupDir);   // move live aside (atomic, same fs)
    try {
      fs.mkdirSync(path.dirname(resolvedTarget), { recursive: true });
      fs.renameSync(tmpDir, resolvedTarget);                    // move new into place (atomic)
    } catch (e) {
      // Cross-device fallback (e.g. tmp on a different mount): copy then remove.
      try {
        fs.cpSync(tmpDir, resolvedTarget, { recursive: true });
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (e2) {
        // Restore the live dir so target is never left missing.
        // Best-effort: if this restore itself fails, still throw the original error.
        try {
          if (backupDir) { fs.rmSync(resolvedTarget, { recursive: true, force: true }); fs.renameSync(backupDir, resolvedTarget); }
        } catch {}
        throw e2;
      }
    }

    // Compute result before best-effort backup cleanup, so a cleanup failure
    // can never turn a successful deploy into a reported failure.
    const fileCount = fs.readdirSync(resolvedTarget).length;
    if (backupDir) { try { fs.rmSync(backupDir, { recursive: true, force: true }); } catch {} }  // success: drop backup

    return { fileCount, totalBytes };
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

module.exports = { atomicExtract, inspectZip, defaultLimits };
