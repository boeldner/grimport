/**
 * Content-safety quarantine flow (docs/roadmap/multi-user-platform.md
 * section 8, "Phase 4"). A deploy is extracted into a staging directory,
 * scanned (scanner.js), and then — depending on the panel's scan mode and
 * the verdict — promoted live, held for an admin's review, or rejected.
 *
 *   scan_mode = off         never scan
 *   scan_mode = log         scan, always go live, keep findings for the record
 *   scan_mode = quarantine  (default) blocked -> rejected; review -> held
 *                           unless the deployer is a panel admin; clean -> live
 */
const fs = require('fs');
const path = require('path');
const { nanoid } = require('nanoid');
const db = require('./db');
const { atomicExtract, promoteDirectory } = require('./extract');
const { scanDirectory, DEFAULT_SCRIPT_ALLOWLIST } = require('./scanner');
const { siteDir } = require('./docker');
const { notify } = require('./notify');
const { isPanelAdmin } = require('./authz');

function getSetting(key) {
  return db.prepare('SELECT value FROM settings WHERE key = ?').get(key)?.value ?? '';
}

function scanMode() {
  const m = getSetting('scan_mode');
  return ['off', 'log', 'quarantine'].includes(m) ? m : 'quarantine';
}

/** Global allow-list (setting, comma/newline separated) merged with the site's own. */
function allowlistFor(siteRow) {
  const raw = getSetting('scan_script_allowlist');
  const global = raw ? raw.split(/[\s,]+/).map(s => s.trim().toLowerCase()).filter(Boolean) : DEFAULT_SCRIPT_ALLOWLIST;
  let site = [];
  try { site = JSON.parse(siteRow?.scan_allowlist || '[]'); } catch {}
  return [...new Set([...global, ...site.map(s => String(s).toLowerCase())])];
}

function pendingDir(siteId, isAppRuntime) {
  return path.join(siteDir(siteId), isAppRuntime ? 'pending_app' : 'pending_html');
}

function pendingReviewFor(siteId) {
  return db.prepare("SELECT * FROM deploy_reviews WHERE site_id = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1").get(siteId);
}

function logActivity(siteId, siteName, event, detail, actor, level = 'info', targetUserId = null) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, level, target_user_id) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null, actor || 'system', level, targetUserId);
  } catch {}
}

function summarize(findings) {
  const counts = {};
  for (const f of findings) counts[f.category] = (counts[f.category] || 0) + 1;
  return Object.entries(counts).map(([c, n]) => `${c} x${n}`).join(', ');
}

/**
 * Extract zipPath into a staging dir next to targetDir, scan it, and act on
 * the verdict. Returns:
 *   { outcome: 'live',    fileCount, verdict, findings, reviewId? }
 *   { outcome: 'pending', verdict, findings, reviewId, pendingDir }
 *   { outcome: 'blocked', verdict, findings }   (staging removed; caller responds 422)
 * `historyFilename` is the name the caller will store the zip under (kept for
 * pending reviews so an admin can download exactly what was uploaded).
 */
function stageScanAndDecide({ req, row, zipPath, targetDir, isAppRuntime, originalName, size, historyFilename }) {
  const mode = scanMode();
  if (mode === 'off') {
    const { fileCount } = atomicExtract(zipPath, targetDir);
    return { outcome: 'live', fileCount, verdict: 'skipped', findings: [] };
  }

  const stageDir = path.join(siteDir(row.id), `.deploy-stage-${nanoid(8)}`);
  atomicExtract(zipPath, stageDir);
  let scan;
  try {
    scan = scanDirectory(stageDir, { allowlist: allowlistFor(row) });
  } catch (err) {
    fs.rmSync(stageDir, { recursive: true, force: true });
    throw err;
  }
  const actor = req.user?.username || 'system';
  const admin = isPanelAdmin(req.user);
  const findingsJson = JSON.stringify(scan.findings);

  const recordReview = (status, reviewId = nanoid(10)) => {
    db.prepare('INSERT INTO deploy_reviews (id, site_id, filename, size, verdict, findings, status, created_by, decided_by, decided_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
      .run(reviewId, row.id, historyFilename || originalName || 'deploy.zip', size || 0, scan.verdict, findingsJson, status, req.user?.id || null,
        status === 'approved' ? (req.user?.id || null) : null, status === 'approved' ? Math.floor(Date.now() / 1000) : null);
    return reviewId;
  };

  if (scan.verdict === 'clean') {
    const { fileCount } = promoteDirectory(stageDir, targetDir);
    return { outcome: 'live', fileCount, verdict: 'clean', findings: scan.findings };
  }

  if (mode === 'log') {
    const { fileCount } = promoteDirectory(stageDir, targetDir);
    const reviewId = recordReview('approved');
    logActivity(row.id, row.name, 'deploy_findings', summarize(scan.findings), actor, scan.verdict === 'blocked' ? 'error' : 'warn', row.owner_id);
    notify({ type: 'deploy_findings', title: `Scanner flagged a deploy to ${row.name} (${scan.verdict})`, detail: summarize(scan.findings), data: { siteId: row.id, reviewId }, force: true });
    return { outcome: 'live', fileCount, verdict: scan.verdict, findings: scan.findings, reviewId };
  }

  // quarantine mode
  if (scan.verdict === 'blocked') {
    fs.rmSync(stageDir, { recursive: true, force: true });
    const reviewId = nanoid(10);
    db.prepare('INSERT INTO deploy_reviews (id, site_id, filename, size, verdict, findings, status, created_by, decided_at, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), ?)')
      .run(reviewId, row.id, originalName || 'deploy.zip', size || 0, 'blocked', findingsJson, 'rejected', req.user?.id || null, 'blocked automatically');
    logActivity(row.id, row.name, 'deploy_blocked', summarize(scan.findings), actor, 'error', row.owner_id);
    notify({ type: 'deploy_blocked', title: `Blocked deploy to ${row.name}`, detail: summarize(scan.findings), data: { siteId: row.id, reviewId }, siteId: row.id, force: true });
    return { outcome: 'blocked', verdict: 'blocked', findings: scan.findings, reviewId };
  }

  // verdict === 'review'
  if (admin) {
    const { fileCount } = promoteDirectory(stageDir, targetDir);
    const reviewId = recordReview('approved');
    logActivity(row.id, row.name, 'deploy_findings', summarize(scan.findings), actor, 'warn', null);
    return { outcome: 'live', fileCount, verdict: 'review', findings: scan.findings, reviewId };
  }

  const pending = pendingDir(row.id, isAppRuntime);
  const previous = pendingReviewFor(row.id);
  if (previous) {
    db.prepare("UPDATE deploy_reviews SET status = 'rejected', decided_at = unixepoch(), note = 'replaced by a newer upload' WHERE id = ?").run(previous.id);
    try { fs.unlinkSync(path.join(siteDir(row.id), 'history', previous.filename)); } catch {}
  }
  fs.rmSync(pending, { recursive: true, force: true });
  fs.renameSync(stageDir, pending);
  const reviewId = recordReview('pending');
  logActivity(row.id, row.name, 'deploy_review', summarize(scan.findings), actor, 'warn', row.owner_id);
  notify({ type: 'deploy_review', title: `${actor} uploaded to ${row.name} — waiting for review`, detail: summarize(scan.findings), data: { siteId: row.id, reviewId }, force: true });
  if (req.user?.id && !admin) {
    notify({ type: 'deploy_review', title: `Your upload to ${row.name} is waiting for review`, detail: 'The live site is unchanged until the owner approves it', data: { siteId: row.id, reviewId }, userIds: [req.user.id], admins: false, force: true });
  }
  return { outcome: 'pending', verdict: 'review', findings: scan.findings, reviewId, pendingDir: pending };
}

module.exports = { stageScanAndDecide, scanMode, allowlistFor, pendingDir, pendingReviewFor, summarize };
