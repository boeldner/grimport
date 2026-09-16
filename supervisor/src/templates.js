/**
 * Starter templates (docs/roadmap/multi-user-platform.md Phase 3, section 4
 * "First-run per role"). Each template lives in templates/<id>/ as a
 * self-contained static site: index.html, an optional style.css, and a
 * template.json manifest ({ id, name, description, preview_bg }).
 *
 * Pure filesystem helpers only — no Docker, no Express — so they're cheap
 * to unit test (see test/templates.test.js) and safe to call from the route
 * handler in routes/templates.js.
 */
const fs = require('fs');
const path = require('path');

const TEMPLATES_DIR = path.join(__dirname, '../templates');

// Same convention as site ids elsewhere: lowercase letters, digits, hyphens
// only — guards against path tricks (../, absolute paths, etc) since the id
// is used directly as a directory name below.
const ID_RE = /^[a-z0-9-]+$/;

function isValidTemplateId(id) {
  return typeof id === 'string' && id.length > 0 && ID_RE.test(id);
}

function templateDir(id) {
  return path.join(TEMPLATES_DIR, id);
}

/** List every valid template as its parsed template.json, sorted by id. */
function listTemplates() {
  if (!fs.existsSync(TEMPLATES_DIR)) return [];
  return fs.readdirSync(TEMPLATES_DIR, { withFileTypes: true })
    .filter(e => e.isDirectory() && isValidTemplateId(e.name))
    .map(e => {
      const manifest = path.join(TEMPLATES_DIR, e.name, 'template.json');
      if (!fs.existsSync(manifest)) return null;
      try {
        const meta = JSON.parse(fs.readFileSync(manifest, 'utf8'));
        return {
          id: e.name,
          name: meta.name || e.name,
          description: meta.description || '',
          preview_bg: meta.preview_bg || '#8f83c4',
        };
      } catch {
        return null;
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.id.localeCompare(b.id));
}

function getTemplate(id) {
  if (!isValidTemplateId(id)) return null;
  return listTemplates().find(t => t.id === id) || null;
}

/** Replace {{SITE_NAME}} / {{SITE_DOMAIN}} placeholders in template source text. */
function applyPlaceholders(content, { siteName = '', siteDomain = '' } = {}) {
  return String(content)
    .split('{{SITE_NAME}}').join(siteName)
    .split('{{SITE_DOMAIN}}').join(siteDomain);
}

/**
 * Copy a template's own files (index.html, style.css — whichever exist)
 * into `htmlDir`, replacing placeholders. Only those two filenames are ever
 * written; anything else already in htmlDir (uploaded assets, other pages)
 * is left alone. Throws { status } errors for an invalid or unknown id so
 * the route can turn them straight into an HTTP response.
 */
function applyTemplateToDir(id, htmlDir, vars = {}) {
  if (!isValidTemplateId(id)) throw Object.assign(new Error('Invalid template id'), { status: 400 });
  const dir = templateDir(id);
  if (!fs.existsSync(path.join(dir, 'template.json'))) {
    throw Object.assign(new Error('Unknown template'), { status: 404 });
  }

  fs.mkdirSync(htmlDir, { recursive: true });
  for (const file of ['index.html', 'style.css']) {
    const src = path.join(dir, file);
    if (!fs.existsSync(src)) continue;
    const content = applyPlaceholders(fs.readFileSync(src, 'utf8'), vars);
    fs.writeFileSync(path.join(htmlDir, file), content);
  }
}

module.exports = {
  TEMPLATES_DIR,
  isValidTemplateId,
  listTemplates,
  getTemplate,
  applyPlaceholders,
  applyTemplateToDir,
};
