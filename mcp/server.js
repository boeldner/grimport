#!/usr/bin/env node
/**
 * grimport-mcp — local stdio MCP server for Claude Code / Claude Desktop.
 *
 * Same tools as the panel's remote /mcp endpoint (they share
 * supervisor/src/mcp/tools.js) plus deploy_directory, which zips a folder on
 * this machine and uploads it. Talks to the panel over its REST API.
 *
 *   GRIMPORT_URL=https://panel.example.com GRIMPORT_TOKEN=grim_... node mcp/server.js
 *
 * Dependencies are resolved from supervisor/node_modules, so run `npm ci`
 * in supervisor/ once (a checkout of this repo is all that is needed).
 */
const path = require('path');
const fs = require('fs');

const SUPERVISOR = path.join(__dirname, '..', 'supervisor');
const resolveFrom = m => require(require.resolve(m, { paths: [SUPERVISOR] }));

const { McpServer } = resolveFrom('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = resolveFrom('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = resolveFrom('zod');
const AdmZip = resolveFrom('adm-zip');
const { createClient } = require(path.join(SUPERVISOR, 'src', 'mcp', 'client.js'));
const { registerTools, describeDeploy, findingsText } = require(path.join(SUPERVISOR, 'src', 'mcp', 'tools.js'));
const { zipDirectory } = require('./zip-directory.js');
const { version } = require(path.join(SUPERVISOR, 'package.json'));

const url = (process.env.GRIMPORT_URL || '').trim();
const token = (process.env.GRIMPORT_TOKEN || '').trim();
if (!url || !token) {
  console.error('grimport-mcp: set GRIMPORT_URL (panel address) and GRIMPORT_TOKEN (API token from Settings > API tokens)');
  process.exit(2);
}

const client = createClient({ baseUrl: url, token, userAgent: `grimport-mcp/${version} (stdio)` });
const server = new McpServer({ name: 'grimport', version });
registerTools(server, client, { panelUrl: url });

server.registerTool('deploy_directory', {
  title: 'Deploy a folder',
  description: 'Zip a folder on this machine (build output: index.html at its root) and publish it to a site. Skips .git, node_modules and entries from the folder\'s .gitignore. Same scanner rules as deploy_zip.',
  inputSchema: {
    site_id: z.string().min(1).describe('Site id (from list_sites)'),
    path: z.string().min(1).describe('Absolute or relative folder path'),
  },
}, async ({ site_id, path: dir }) => {
  try {
    const abs = path.resolve(process.cwd(), dir);
    if (!fs.existsSync(path.join(abs, 'index.html'))) {
      const entries = fs.existsSync(abs) ? fs.readdirSync(abs).slice(0, 20).join(', ') : '(missing)';
      return { isError: true, content: [{ type: 'text', text: `No index.html in ${abs}. Point me at the build output (dist/, build/, out/ ...). Entries: ${entries}` }] };
    }
    const { buffer, files, bytes } = zipDirectory(abs, { AdmZip });
    const result = await client.upload(`/deploy/${encodeURIComponent(site_id)}`, buffer, `${path.basename(abs) || 'site'}.zip`);
    const site = await client.get(`/sites/${encodeURIComponent(site_id)}`).catch(() => null);
    return { content: [{ type: 'text', text: `Zipped ${files} files (${(bytes / 1024).toFixed(0)} KB) from ${abs}.\n${describeDeploy(result, site)}` }] };
  } catch (e) {
    if (e.status === 422 && e.data?.findings) {
      return { isError: true, content: [{ type: 'text', text: `Deploy blocked by the content scanner. Remove these and try again:\n${findingsText(e.data.findings)}` }] };
    }
    return { isError: true, content: [{ type: 'text', text: e.message || String(e) }] };
  }
});

server.connect(new StdioServerTransport()).catch(err => {
  console.error('grimport-mcp:', err.message);
  process.exit(1);
});
