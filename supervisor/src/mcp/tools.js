/**
 * MCP tools, resources and prompts for Grimport. Thin wrappers over the REST
 * API (see docs/wiki/API-Reference.md): every call goes through `client`
 * with the caller's own token, so roles, site scope, quotas and the content
 * scanner apply exactly as they do for the panel.
 *
 * Shared by the remote /mcp endpoint (src/mcp/remote.js) and the local stdio
 * server (mcp/server.js).
 */
const { z } = require('zod');
const { ResourceTemplate } = require('@modelcontextprotocol/sdk/server/mcp.js');

const MAX_ZIP_BYTES = 250 * 1024 * 1024;

function text(value) {
  return { content: [{ type: 'text', text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) }] };
}

function fail(err) {
  const msg = err?.message || String(err);
  const hint = err?.status === 403 ? ' (your token or role does not allow this)'
    : err?.status === 404 ? ' (no such site, or your token cannot see it)'
    : err?.status === 429 ? ' (rate limit, try again in a few minutes)' : '';
  return { isError: true, content: [{ type: 'text', text: `${msg}${hint}` }] };
}

function siteUrl(s) {
  return `${s.ssl_enabled ? 'https' : 'http'}://${s.domain}`;
}

function siteSummary(s) {
  return {
    id: s.id,
    name: s.name,
    domain: s.domain,
    url: siteUrl(s),
    runtime: s.runtime || 'static',
    container: s.container ? { status: s.container.status, running: !!s.container.running } : null,
    ssl_enabled: !!s.ssl_enabled,
    maintenance_mode: !!s.maintenance_mode,
    spa_mode: !!s.spa_mode,
    suspended: s.status === 'suspended',
    my_role: s.my_role || null,
    owner: s.owner ? s.owner.username : null,
    preview: s.preview_container_id ? { domain: s.preview_domain, url: `http://${s.preview_domain}` } : null,
    pending_review: s.pending_review || null,
  };
}

function siteDetail(s) {
  return {
    ...siteSummary(s),
    cache_enabled: !!s.cache_enabled,
    basic_auth: s.basic_auth ? { username: s.basic_auth.username } : null,
    custom_headers: s.custom_headers || [],
    redirects: s.redirects || [],
    build_cmd: s.build_cmd || null,
    start_cmd: s.start_cmd || null,
    app_port: s.app_port || null,
    scan_allowlist: s.scan_allowlist || [],
    created_at: s.created_at || null,
  };
}

function findingsText(findings) {
  if (!Array.isArray(findings) || !findings.length) return '';
  return findings.map(f => `- ${f.category} (${f.severity}) ${f.file || ''}${f.line ? `:${f.line}` : ''}${f.detail ? ` — ${f.detail}` : ''}`).join('\n');
}

/** Turn a deploy response (200 live / 202 held) into a message for the agent. */
function describeDeploy(result, site) {
  if (result.pending_review) {
    return [
      `Upload accepted but NOT live: the content scanner flagged it and the panel owner has to approve it (review ${result.review_id}).`,
      `The live site ${site ? siteUrl(site) : ''} is unchanged until then. Findings:`,
      findingsText(result.findings),
    ].join('\n');
  }
  const url = site ? siteUrl(site) : '';
  const notes = Array.isArray(result.findings) && result.findings.length
    ? `\nScanner notes (published anyway):\n${findingsText(result.findings)}` : '';
  return `Deployed ${result.files ?? '?'} files${url ? ` to ${url}` : ''}. Verdict: ${result.verdict || 'clean'}.${notes}`;
}

const siteIdArg = z.string().min(1).describe('Site id (from list_sites)');

/**
 * registerTools(server, client, { panelUrl })
 */
function registerTools(server, client, opts = {}) {
  const getSite = id => client.get(`/sites/${encodeURIComponent(id)}`);

  server.registerTool('whoami', {
    title: 'Who am I',
    description: 'The account behind this token: role, capabilities, site quota, base domain for automatic subdomains, and which sites the token may touch. Call this first when a request might exceed limits.',
    inputSchema: {},
  }, async () => {
    try { return text(await client.get('/me')); } catch (e) { return fail(e); }
  });

  server.registerTool('list_sites', {
    title: 'List sites',
    description: 'All sites this token can see, with domain, runtime, container state and role.',
    inputSchema: {},
  }, async () => {
    try { const sites = await client.get('/sites'); return text(sites.map(siteSummary)); } catch (e) { return fail(e); }
  });

  server.registerTool('get_site', {
    title: 'Get site',
    description: 'Full settings of one site (domain, runtime, SPA/cache/maintenance flags, headers, redirects, build and start command).',
    inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(siteDetail(await getSite(site_id))); } catch (e) { return fail(e); }
  });

  server.registerTool('get_site_status', {
    title: 'Site status',
    description: 'Container state, 24h uptime and DNS status for one site. Use it to explain why a site is unreachable.',
    inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try {
      const id = encodeURIComponent(site_id);
      const [site, uptime, dns] = await Promise.all([
        getSite(site_id),
        client.get(`/uptime/${id}`).catch(e => ({ error: e.message })),
        client.get(`/dns/${id}`).catch(e => ({ error: e.message })),
      ]);
      return text({ site: siteSummary(site), uptime, dns });
    } catch (e) { return fail(e); }
  });

  server.registerTool('create_site', {
    title: 'Create site',
    description: 'Create a site. Members get an automatic <slug>.<base domain> address when domain is omitted; a custom domain may become a request the panel owner approves. Runtime defaults to static.',
    inputSchema: {
      name: z.string().min(1).max(80).describe('Display name'),
      domain: z.string().optional().describe('Custom domain (optional)'),
      runtime: z.enum(['static', 'php', 'node', 'python']).optional(),
      spa_mode: z.boolean().optional().describe('Serve index.html for unknown paths (single-page apps)'),
    },
  }, async (args) => {
    try {
      const created = await client.post('/sites', args);
      return text({ created: siteSummary(created), note: created.domain_request ? `Custom domain requested; the site uses ${created.domain} until the owner approves.` : undefined });
    } catch (e) { return fail(e); }
  });

  server.registerTool('deploy_zip', {
    title: 'Deploy a zip',
    description: 'Upload a zip (base64) and publish it to the site. The zip is scanned first: clean uploads go live, flagged uploads by members wait for the panel owner, dangerous ones are rejected with the reasons. Zip layout: index.html at the root, or a single folder that contains it.',
    inputSchema: {
      site_id: siteIdArg,
      zip_base64: z.string().min(4).describe('Zip file contents, base64 encoded'),
      filename: z.string().max(120).optional().describe('Name shown in the deploy history'),
    },
  }, async ({ site_id, zip_base64, filename }) => {
    try {
      const buf = Buffer.from(zip_base64, 'base64');
      if (!buf.length) return fail(new Error('zip_base64 decoded to an empty file'));
      if (buf.length > MAX_ZIP_BYTES) return fail(new Error(`Zip is ${(buf.length / 1048576).toFixed(1)} MB; the limit is ${MAX_ZIP_BYTES / 1048576} MB`));
      const result = await client.upload(`/deploy/${encodeURIComponent(site_id)}`, buf, filename || 'deploy.zip');
      const site = await getSite(site_id).catch(() => null);
      return text(describeDeploy(result, site));
    } catch (e) {
      if (e.status === 422 && e.data?.findings) {
        return { isError: true, content: [{ type: 'text', text: `Deploy blocked by the content scanner. Remove these and try again:\n${findingsText(e.data.findings)}` }] };
      }
      return fail(e);
    }
  });

  server.registerTool('deploy_url', {
    title: 'Deploy from URL',
    description: 'Download a public .zip (direct link, e.g. a GitHub release asset) and publish it. Same scanner rules as deploy_zip.',
    inputSchema: { site_id: siteIdArg, url: z.string().url().describe('Direct https link to a .zip') },
  }, async ({ site_id, url }) => {
    try {
      const r = await client.request('POST', `/deploy/${encodeURIComponent(site_id)}/url`, { body: { url } });
      const result = { status: r.status, ...(typeof r.data === 'object' ? r.data : {}) };
      const site = await getSite(site_id).catch(() => null);
      return text(describeDeploy(result, site));
    } catch (e) {
      if (e.status === 422 && e.data?.findings) {
        return { isError: true, content: [{ type: 'text', text: `Deploy blocked by the content scanner. Remove these and try again:\n${findingsText(e.data.findings)}` }] };
      }
      return fail(e);
    }
  });

  server.registerTool('get_deploy_history', {
    title: 'Deploy history',
    description: 'The last deployments of a site (id, filename, size, time). Deployment ids feed rollback.',
    inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(await client.get(`/deploy/${encodeURIComponent(site_id)}/history`)); } catch (e) { return fail(e); }
  });

  server.registerTool('rollback', {
    title: 'Roll back',
    description: 'Restore an earlier deployment from the history and restart the site.',
    inputSchema: { site_id: siteIdArg, deployment_id: z.string().min(1) },
  }, async ({ site_id, deployment_id }) => {
    try { return text(await client.post(`/deploy/${encodeURIComponent(site_id)}/rollback/${encodeURIComponent(deployment_id)}`)); } catch (e) { return fail(e); }
  });

  server.registerTool('get_logs', {
    title: 'Container logs',
    description: 'Recent log lines of the site container (nginx access/error log, or the app output for node/python).',
    inputSchema: { site_id: siteIdArg, lines: z.number().int().min(1).max(2000).optional().describe('Default 100') },
  }, async ({ site_id, lines }) => {
    try {
      const logs = await client.get(`/sites/${encodeURIComponent(site_id)}/logs?lines=${lines || 100}`);
      return text(typeof logs === 'string' ? (logs || '(no output)') : logs);
    } catch (e) { return fail(e); }
  });

  server.registerTool('start_site', {
    title: 'Start site', description: 'Start a stopped site container.', inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(await client.post(`/sites/${encodeURIComponent(site_id)}/start`)); } catch (e) { return fail(e); }
  });

  server.registerTool('stop_site', {
    title: 'Stop site', description: 'Stop a running site container (visitors get the "not connected" page).', inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(await client.post(`/sites/${encodeURIComponent(site_id)}/stop`)); } catch (e) { return fail(e); }
  });

  server.registerTool('set_maintenance', {
    title: 'Maintenance mode',
    description: 'Switch the maintenance page on or off for a site.',
    inputSchema: { site_id: siteIdArg, on: z.boolean() },
  }, async ({ site_id, on }) => {
    try {
      const updated = await client.put(`/sites/${encodeURIComponent(site_id)}`, { maintenance_mode: on });
      return text({ ok: true, maintenance_mode: !!(updated.maintenance_mode ?? on) });
    } catch (e) { return fail(e); }
  });

  server.registerTool('set_env_vars', {
    title: 'Set environment variables',
    description: 'Replace the environment variables of a node/python site (the container is recreated). Requires the Maker preset or an admin account.',
    inputSchema: { site_id: siteIdArg, vars: z.record(z.string(), z.string()).describe('Key/value map; replaces the existing set') },
  }, async ({ site_id, vars }) => {
    try {
      const site = await getSite(site_id);
      if (!['node', 'python'].includes(site.runtime)) return fail(new Error(`Environment variables only apply to node/python sites; ${site.name} is ${site.runtime || 'static'}`));
      await client.put(`/sites/${encodeURIComponent(site_id)}`, { env_vars: JSON.stringify(vars) });
      return text({ ok: true, keys: Object.keys(vars) });
    } catch (e) { return fail(e); }
  });

  server.registerTool('preview_create', {
    title: 'Create preview',
    description: 'Stand up a second container with a copy of the live files on a preview domain (blue-green). Members must use a subdomain of the base domain.',
    inputSchema: { site_id: siteIdArg, preview_domain: z.string().min(3) },
  }, async ({ site_id, preview_domain }) => {
    try { return text(await client.post(`/sites/${encodeURIComponent(site_id)}/preview`, { preview_domain })); } catch (e) { return fail(e); }
  });

  server.registerTool('preview_swap', {
    title: 'Preview go live',
    description: 'Promote the preview container to production. Ask the user before calling this.',
    inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(await client.post(`/sites/${encodeURIComponent(site_id)}/preview/swap`)); } catch (e) { return fail(e); }
  });

  server.registerTool('preview_discard', {
    title: 'Discard preview', description: 'Remove the preview container without swapping.', inputSchema: { site_id: siteIdArg },
  }, async ({ site_id }) => {
    try { return text(await client.del(`/sites/${encodeURIComponent(site_id)}/preview`)); } catch (e) { return fail(e); }
  });

  // ── Resources ───────────────────────────────────────────
  server.registerResource('sites', 'grimport://sites', {
    title: 'Sites', description: 'All sites this token can see', mimeType: 'application/json',
  }, async uri => {
    const sites = await client.get('/sites');
    return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify(sites.map(siteSummary), null, 2) }] };
  });

  server.registerResource('site-logs', new ResourceTemplate('grimport://sites/{id}/logs', {
    list: async () => {
      const sites = await client.get('/sites').catch(() => []);
      return { resources: sites.map(s => ({ uri: `grimport://sites/${s.id}/logs`, name: `${s.name} logs`, mimeType: 'text/plain' })) };
    },
  }), { title: 'Site logs', description: 'Last 200 log lines of a site container', mimeType: 'text/plain' },
  async (uri, { id }) => {
    const logs = await client.get(`/sites/${encodeURIComponent(id)}/logs?lines=200`);
    return { contents: [{ uri: uri.href, mimeType: 'text/plain', text: typeof logs === 'string' ? logs : JSON.stringify(logs) }] };
  });

  // ── Prompt ──────────────────────────────────────────────
  server.registerPrompt('publish-project', {
    title: 'Publish a project',
    description: 'Deploy a build output to a Grimport site and report the result',
    argsSchema: {
      site: z.string().optional().describe('Site name or id (omit to pick or create one)'),
      source: z.string().optional().describe('Folder, zip file or URL with the build output'),
    },
  }, ({ site, source }) => ({
    messages: [{
      role: 'user',
      content: {
        type: 'text',
        text: [
          `Publish ${source ? `"${source}"` : 'the current build output'} to my Grimport site${site ? ` "${site}"` : ''}.`,
          'Steps: call whoami to learn my limits; call list_sites and pick the matching site (create one with create_site only if none fits and I agreed).',
          'Zip the build output (index.html at the root) and call deploy_zip, or deploy_url for a public zip.',
          'If the result says the upload waits for review, tell me what the scanner found and stop; do not retry.',
          'On success give me the live URL. If a preview exists, do not call preview_swap unless I say go live.',
          'If anything fails, use get_site_status and get_logs to explain why before suggesting a fix.',
        ].join('\n'),
      },
    }],
  }));
}

module.exports = { registerTools, siteSummary, siteDetail, describeDeploy, findingsText };
