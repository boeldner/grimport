/**
 * Remote MCP endpoint: POST /mcp (Streamable HTTP, stateless, JSON responses).
 *
 * Authentication is a Grimport API token as Bearer (created under Settings >
 * API tokens, or issued by the OAuth flow in oauth.js). Cookie sessions are
 * deliberately not accepted here: MCP clients are not browsers, and refusing
 * cookies keeps CSRF out of the picture. Each request builds a fresh server
 * whose tools call the REST API over loopback with the same token, so the
 * REST authorization rules are the only rules.
 */
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StreamableHTTPServerTransport } = require('@modelcontextprotocol/sdk/server/streamableHttp.js');
const { createClient } = require('./client');
const { registerTools } = require('./tools');
const { version } = require('../../package.json');

/** Public URL of the panel (used for OAuth metadata and in tool output). */
function panelBaseUrl() {
  if (process.env.PANEL_URL) return process.env.PANEL_URL.replace(/\/+$/, '');
  const domain = process.env.SUPERVISOR_DOMAIN || 'localhost';
  if (domain === 'localhost' || domain === '127.0.0.1') return 'http://localhost:3000';
  return `https://${domain}`;
}

function mountMcp(app, { requireAuth, port = 3000 }) {
  const metadataUrl = `${panelBaseUrl()}/.well-known/oauth-protected-resource/mcp`;

  const bearerOnly = (req, res, next) => {
    // Advertise the OAuth metadata on every 401 so clients that support it
    // (claude.ai connectors) can start the login flow on their own.
    res.setHeader('WWW-Authenticate', `Bearer resource_metadata="${metadataUrl}"`);
    if (!req.headers.authorization?.startsWith('Bearer ')) {
      return res.status(401).json({ jsonrpc: '2.0', error: { code: -32001, message: 'Unauthorized: send a Grimport API token as a Bearer token' }, id: null });
    }
    return requireAuth(req, res, () => { res.removeHeader('WWW-Authenticate'); next(); });
  };

  app.post('/mcp', bearerOnly, async (req, res) => {
    const token = req.headers.authorization.slice(7);
    const client = createClient({
      baseUrl: `http://127.0.0.1:${port}`,
      token,
      hostHeader: process.env.SUPERVISOR_DOMAIN || 'localhost',
      userAgent: `grimport-mcp/${version} (remote)`,
    });
    const server = new McpServer({ name: 'grimport', version });
    registerTools(server, client, { panelUrl: panelBaseUrl() });
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close().catch(() => {}); server.close().catch(() => {}); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, req.body);
    } catch (err) {
      console.error('[mcp]', err);
      if (!res.headersSent) res.status(500).json({ jsonrpc: '2.0', error: { code: -32603, message: 'Internal error' }, id: null });
    }
  });

  const notAllowed = (req, res) => {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ jsonrpc: '2.0', error: { code: -32000, message: 'Method not allowed: this endpoint is stateless, use POST' }, id: null });
  };
  app.get('/mcp', notAllowed);
  app.delete('/mcp', notAllowed);
}

module.exports = { mountMcp, panelBaseUrl };
