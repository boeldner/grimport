// Static design-system lint for the panel frontend (public/). Keeps every
// view on the shared tokens and components described in
// CONTRIBUTING.md ("Frontend"). The rendered-DOM counterpart is tools/ui-audit.js.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const PUBLIC = path.join(__dirname, '..', 'public');
const CSS_ORDER = ['tokens', 'base', 'layout', 'components', 'views'];
const read = rel => fs.readFileSync(path.join(PUBLIC, rel), 'utf8');
const stripComments = s => s.replace(/\/\*[\s\S]*?\*\//g, m => m.replace(/[^\n]/g, ' '));
const lineOf = (s, i) => s.slice(0, i).split('\n').length;

const css = Object.fromEntries(CSS_ORDER.map(n => [n, stripComments(read(`css/${n}.css`))]));
const nonTokenCss = CSS_ORDER.filter(n => n !== 'tokens');
const HTML = fs.readdirSync(PUBLIC).filter(f => f.endsWith('.html'));
const JS = ['app.js'];

// Collects `file:line  text` for every regex match in the given sources.
function findAll(sources, re, filter = () => true) {
  const hits = [];
  for (const [file, src] of sources) {
    for (const m of src.matchAll(re)) {
      if (filter(m, src)) hits.push(`${file}:${lineOf(src, m.index)}  ${m[0].trim().slice(0, 90)}`);
    }
  }
  return hits;
}
const cssSources = nonTokenCss.map(n => [`css/${n}.css`, css[n]]);
const declarations = prop => new RegExp(`(?:^|[;{\\s])(${prop})\\s*:\\s*([^;{}]+)`, 'gm');

test('every stylesheet sits in its cascade layer, declared once in tokens.css', () => {
  assert.match(css.tokens, /@layer tokens, base, layout, components, views, utilities;/);
  for (const n of CSS_ORDER) assert.match(css[n], new RegExp(`@layer ${n}\\s*\\{`), `css/${n}.css must wrap its rules in @layer ${n}`);
  assert.ok(!fs.existsSync(path.join(PUBLIC, 'style.css')), 'legacy style.css must not come back');
});

test('pages load the design system stylesheets in cascade order and nothing else', () => {
  for (const page of HTML) {
    const src = read(page);
    const links = [...src.matchAll(/<link[^>]+rel="stylesheet"[^>]*href="([^"]+)"/g)].map(m => m[1]);
    assert.deepStrictEqual(links, CSS_ORDER.map(n => `/css/${n}.css`), `${page} stylesheet links`);
    assert.ok(!/<style[\s>]/.test(src), `${page} must not carry a <style> block`);
  }
});

test('colour literals live only in tokens.css', () => {
  const hits = findAll(cssSources, /#[0-9a-fA-F]{3,8}\b|\b(?:rgba?|hsla?|oklch|lab|lch)\(|\b(?:white|black)\b(?![\w-])/g);
  const markup = [...HTML.map(f => [f, read(f)]), ...JS.map(f => [f, read(f)])];
  hits.push(...findAll(markup, /#[0-9a-fA-F]{6}\b|\brgba?\(\d/g, (m, src) => {
    const line = src.split('\n')[lineOf(src, m.index) - 1];
    return !/<meta name="theme-color"/.test(line);
  }));
  assert.deepStrictEqual(hits, [], 'use a colour token from css/tokens.css');
});

test('type, spacing, radius, weight and layer values come from the token scales', () => {
  const hits = [];
  const check = (prop, ok) => hits.push(...findAll(cssSources, declarations(prop), m => !ok(m[2].trim())));
  const tokenOr = (prefix, extra = []) => v => extra.includes(v) || new RegExp(`^var\\(--${prefix}[\\w-]*\\)$`).test(v);
  check('font-size', tokenOr('fs-', ['inherit']));
  check('font-weight', tokenOr('fw-', ['inherit']));
  check('z-index', tokenOr('z-', ['auto', '0', '1']));
  check('border-radius', v => v.split(/\s+/).every(part => ['0', '50%', 'inherit'].includes(part) || /^var\(--radius-[\w-]+\)$/.test(part)));
  // Spacing: tokens (or calc over tokens); literal lengths only for hairlines.
  check('padding(?:-[a-z-]+)?|margin(?:-[a-z-]+)?|gap|row-gap|column-gap', v =>
    !/(?<![\w-])-?\d*\.?\d+(?:px|rem|em)\b/.test(v.replace(/\b[01]px\b/g, '')));
  assert.deepStrictEqual(hits, [], 'add or reuse a token in css/tokens.css');
});

test('every custom property that is read is defined', () => {
  const all = CSS_ORDER.map(n => css[n]).join('\n');
  const defined = new Set([...all.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]));
  // Set from markup at runtime (style="--x: …") — the only inline styles allowed.
  for (const src of [...HTML.map(read), ...JS.map(read)]) {
    for (const m of src.matchAll(/style="(--[\w-]+)\s*:/g)) defined.add(m[1]);
    for (const m of src.matchAll(/setProperty\('(--[\w-]+)'/g)) defined.add(m[1]);
  }
  const missing = [...new Set([...all.matchAll(/var\((--[\w-]+)/g)].map(m => m[1]))].filter(v => !defined.has(v));
  assert.deepStrictEqual(missing, [], 'undefined custom properties (legacy tokens?)');
});

test('inline styles only carry custom properties; scripts only position things', () => {
  const markup = [...HTML.map(f => [f, read(f)]), ...JS.map(f => [f, read(f)])];
  const inline = findAll(markup, /style="[^"]*"/g, m => !/^style="(?:--[\w-]+\s*:[^;"]+;?\s*)+"$/.test(m[0]));
  assert.deepStrictEqual(inline, [], 'move presentation into a component class');
  const scripted = findAll(JS.map(f => [f, read(f)]), /\.style\.(\w+)\s*=/g, m => !['top', 'left', 'right', 'bottom', 'width', 'height', 'maxHeight'].includes(m[1]));
  assert.deepStrictEqual(scripted, [], 'toggle a class instead of setting styles from JS');
});

test('a component rule is defined once', () => {
  const seen = new Map();
  const dups = [];
  for (const [file, src] of cssSources.concat([['css/tokens.css', css.tokens]])) {
    src.split('\n').forEach((line, i) => {
      // Top-level rules inside the layer block are indented by two spaces;
      // media-query variants are nested deeper and do not count.
      const m = line.match(/^ {2}([^\s@}][^{]*?)\s*\{/);
      if (!m) return;
      const sel = m[1].replace(/\s+/g, ' ');
      if (seen.has(sel)) dups.push(`${sel}  ${seen.get(sel)} and ${file}:${i + 1}`);
      else seen.set(sel, `${file}:${i + 1}`);
    });
  }
  assert.deepStrictEqual(dups, [], 'merge duplicate selectors');
});

test('no emoji in the frontend (icons are inline SVG)', () => {
  const sources = [...HTML, ...JS, ...CSS_ORDER.map(n => `css/${n}.css`)].map(f => [f, read(f)]);
  const hits = findAll(sources, /\p{Extended_Pictographic}/gu);
  assert.deepStrictEqual(hits, []);
});
