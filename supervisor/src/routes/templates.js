const { Router } = require('express');
const path = require('path');
const db = require('../db');
const { requireSiteRole, isPanelAdmin } = require('../auth');
const { asyncHandler } = require('../async-handler');
const { applySiteSettings, siteDir } = require('../docker');
const { parseSiteForContainer } = require('../site-model');
const { listTemplates, getTemplate, applyTemplateToDir, isValidTemplateId } = require('../templates');

const router = Router();

function logActivity(siteId, siteName, event, detail, actor = 'system', targetUserId = null) {
  try {
    db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor, target_user_id) VALUES (?, ?, ?, ?, ?, ?)')
      .run(siteId, siteName, event, detail || null, actor, targetUserId);
  } catch {}
}

// GET /api/templates — every starter template (any authenticated user)
router.get('/', (req, res) => {
  res.json(listTemplates());
});

// POST /api/templates/:id/apply/:siteId — copy a starter template's files
// into the site's html/ directory and apply them (editor+ on the site).
router.post('/:id/apply/:siteId', requireSiteRole('editor', 'siteId'), asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!isValidTemplateId(id)) return res.status(404).json({ error: 'Unknown template' });
  const template = getTemplate(id);
  if (!template) return res.status(404).json({ error: 'Unknown template' });

  const row = db.prepare('SELECT * FROM sites WHERE id = ?').get(req.params.siteId);
  if (!row) return res.status(404).json({ error: 'Not found' });
  if ((row.runtime || 'static') !== 'static') {
    return res.status(400).json({ error: 'Templates only apply to static sites' });
  }
  if (row.status === 'suspended' && !isPanelAdmin(req.user)) {
    return res.status(423).json({ error: 'Site is suspended' });
  }

  const htmlDir = path.join(siteDir(row.id), 'html');
  applyTemplateToDir(id, htmlDir, { siteName: row.name, siteDomain: row.domain });
  await applySiteSettings(parseSiteForContainer(row));

  const ownerId = row.owner_id;
  logActivity(row.id, row.name, 'template_applied', id, req.user?.username || 'system', req.supportMode ? ownerId : null);

  res.json({ ok: true, template: id });
}));

module.exports = router;
