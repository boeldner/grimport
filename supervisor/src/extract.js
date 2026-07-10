const fs = require('fs');
const path = require('path');
const AdmZip = require('adm-zip');
const { nanoid } = require('nanoid');

/**
 * Validate + extract a zip into targetDir atomically.
 * On any error, an existing targetDir is left untouched.
 * Returns { fileCount }.
 */
function atomicExtract(zipPath, targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  const tmpDir = path.join(path.dirname(resolvedTarget), `.deploy-tmp-${nanoid(8)}`);

  try {
    // Parse first — throws here on corrupt zip, before touching live dir.
    const zip = new AdmZip(zipPath);
    const entries = zip.getEntries();

    // Zip-slip check against the temp dir.
    for (const entry of entries) {
      const dest = path.resolve(path.join(tmpDir, entry.entryName));
      if (!dest.startsWith(tmpDir + path.sep) && dest !== tmpDir) {
        throw new Error(`Rejected: zip entry outside target directory: ${entry.entryName}`);
      }
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    zip.extractAllTo(tmpDir, true);

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
        if (backupDir) { fs.rmSync(resolvedTarget, { recursive: true, force: true }); fs.renameSync(backupDir, resolvedTarget); }
        throw e2;
      }
    }
    if (backupDir) fs.rmSync(backupDir, { recursive: true, force: true });  // success: drop backup

    return { fileCount: fs.readdirSync(resolvedTarget).length };
  } catch (err) {
    fs.rmSync(tmpDir, { recursive: true, force: true });
    throw err;
  }
}

module.exports = { atomicExtract };
