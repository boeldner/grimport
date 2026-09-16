const test = require('node:test');
const assert = require('node:assert');
const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
const { InMemoryTransport } = require('@modelcontextprotocol/sdk/inMemory.js');
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { registerTools, describeDeploy, siteSummary } = require('../src/mcp/tools');

const SITE = { id: 's1', name: 'Bakery', domain: 'bakery.test', runtime: 'static', ssl_enabled: 1, container: { status: 'running', running: true }, my_role: 'owner', owner: { username: 'anna' } };

function fakeClient(overrides = {}) {
  const calls = [];
  const rec = (m, p, b) => { calls.push({ m, p, b }); };
  return {
    calls,
    get: async p => { rec('GET', p); if (overrides.get) return overrides.get(p); if (p === '/sites') return [SITE]; if (p.startsWith('/sites/s1/logs')) return 'log line 1\nlog line 2'; if (p === '/sites/s1') return SITE; if (p === '/me') return { role: 'editor' }; const e = new Error('Not found'); e.status = 404; throw e; },
    post: async (p, b) => { rec('POST', p, b); return { ok: true, ...(p === '/sites' ? { ...SITE, id: 'new', name: b.name } : {}) }; },
    put: async (p, b) => { rec('PUT', p, b); return { ...SITE, ...b }; },
    del: async p => { rec('DELETE', p); return { ok: true }; },
    upload: async (p, buf, name) => { rec('UPLOAD', p, { size: buf.length, name }); if (overrides.upload) return overrides.upload(); return { status: 200, ok: true, files: 3, verdict: 'clean', findings: [] }; },
    request: async (m, p, o) => { rec(m, p, o?.body); return { status: 200, data: { ok: true, files: 2, verdict: 'clean' } }; },
  };
}

async function connect(client) {
  const server = new McpServer({ name: 'grimport-test', version: '0.0.0' });
  registerTools(server, client, { panelUrl: 'http://localhost:3000' });
  const [a, b] = InMemoryTransport.createLinkedPair();
  await server.connect(a);
  const mcp = new Client({ name: 'test-client', version: '0.0.0' });
  await mcp.connect(b);
  return { mcp, close: async () => { await mcp.close(); await server.close(); } };
}

test('registers the roadmap tool set, resources and the publish prompt', async () => {
  const { mcp, close } = await connect(fakeClient());
  try {
    const names = (await mcp.listTools()).tools.map(t => t.name).sort();
    for (const n of ['whoami', 'list_sites', 'get_site', 'get_site_status', 'create_site', 'deploy_zip', 'deploy_url', 'get_deploy_history', 'rollback', 'get_logs', 'set_maintenance', 'set_env_vars', 'preview_create', 'preview_swap', 'preview_discard', 'start_site', 'stop_site']) {
      assert.ok(names.includes(n), `missing tool ${n}`);
    }
    const resources = (await mcp.listResources()).resources.map(r => r.uri);
    assert.ok(resources.includes('grimport://sites'));
    const templates = (await mcp.listResourceTemplates()).resourceTemplates.map(t => t.uriTemplate);
    assert.ok(templates.includes('grimport://sites/{id}/logs'));
    const prompts = (await mcp.listPrompts()).prompts.map(p => p.name);
    assert.ok(prompts.includes('publish-project'));
  } finally { await close(); }
});

test('list_sites and get_logs call the REST API with the token client', async () => {
  const client = fakeClient();
  const { mcp, close } = await connect(client);
  try {
    const r = await mcp.callTool({ name: 'list_sites', arguments: {} });
    const sites = JSON.parse(r.content[0].text);
    assert.strictEqual(sites[0].url, 'https://bakery.test');
    assert.strictEqual(sites[0].owner, 'anna');
    const logs = await mcp.callTool({ name: 'get_logs', arguments: { site_id: 's1', lines: 50 } });
    assert.strictEqual(logs.content[0].text, 'log line 1\nlog line 2');
    assert.ok(client.calls.some(c => c.p === '/sites/s1/logs?lines=50'));
    const res = await mcp.readResource({ uri: 'grimport://sites/s1/logs' });
    assert.strictEqual(res.contents[0].mimeType, 'text/plain');
  } finally { await close(); }
});

test('deploy_zip reports live, held and blocked outcomes', async () => {
  const zip = Buffer.from('PKfake').toString('base64');
  let client = fakeClient();
  let { mcp, close } = await connect(client);
  try {
    const live = await mcp.callTool({ name: 'deploy_zip', arguments: { site_id: 's1', zip_base64: zip, filename: 'v2.zip' } });
    assert.match(live.content[0].text, /Deployed 3 files to https:\/\/bakery\.test/);
    assert.ok(client.calls.some(c => c.m === 'UPLOAD' && c.b.name === 'v2.zip'));
  } finally { await close(); }

  client = fakeClient({ upload: () => ({ status: 202, ok: true, pending_review: true, review_id: 'r9', verdict: 'review', findings: [{ category: 'external-script', severity: 'review', file: 'index.html', line: 3, detail: 'evil.example' }] }) });
  ({ mcp, close } = await connect(client));
  try {
    const held = await mcp.callTool({ name: 'deploy_zip', arguments: { site_id: 's1', zip_base64: zip } });
    assert.match(held.content[0].text, /NOT live/);
    assert.match(held.content[0].text, /external-script .*index\.html:3/);
  } finally { await close(); }

  client = fakeClient({ upload: () => { const e = new Error('Deploy blocked by the content scanner'); e.status = 422; e.data = { findings: [{ category: 'executable', severity: 'blocked', file: 'x.exe' }] }; throw e; } });
  ({ mcp, close } = await connect(client));
  try {
    const blocked = await mcp.callTool({ name: 'deploy_zip', arguments: { site_id: 's1', zip_base64: zip } });
    assert.strictEqual(blocked.isError, true);
    assert.match(blocked.content[0].text, /blocked.*\n- executable \(blocked\) x\.exe/s);
    const empty = await mcp.callTool({ name: 'deploy_zip', arguments: { site_id: 's1', zip_base64: '====' } });
    assert.strictEqual(empty.isError, true);
  } finally { await close(); }
});

test('errors from the API become isError results with a hint', async () => {
  const { mcp, close } = await connect(fakeClient());
  try {
    const r = await mcp.callTool({ name: 'get_site', arguments: { site_id: 'ghost' } });
    assert.strictEqual(r.isError, true);
    assert.match(r.content[0].text, /Not found \(no such site/);
    const env = await mcp.callTool({ name: 'set_env_vars', arguments: { site_id: 's1', vars: { A: '1' } } });
    assert.strictEqual(env.isError, true, 'static site refuses env vars');
  } finally { await close(); }
});

test('describeDeploy and siteSummary helpers', () => {
  assert.match(describeDeploy({ ok: true, files: 1, verdict: 'clean' }, SITE), /Deployed 1 files to https:\/\/bakery\.test\. Verdict: clean\./);
  assert.match(describeDeploy({ pending_review: true, review_id: 'r', findings: [] }, null), /NOT live/);
  assert.strictEqual(siteSummary({ ...SITE, ssl_enabled: 0 }).url, 'http://bakery.test');
  assert.strictEqual(siteSummary({ ...SITE, status: 'suspended' }).suspended, true);
});
