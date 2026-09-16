/**
 * OAuth 2.1 authorization server for the MCP endpoint, so clients that only
 * speak OAuth (claude.ai custom connectors, Claude Desktop) can connect to
 * /mcp without the user pasting a token.
 *
 * Flow: client registers itself (dynamic client registration, public client
 * with PKCE) -> user is sent to /authorize -> we redirect to /oauth/consent,
 * a panel page that needs a normal login -> "Allow" mints a one-time code
 * -> client exchanges it at /token for an access token + refresh token.
 *
 * Access tokens are ordinary rows in api_tokens (name "Claude via <client>",
 * owned by the user, role and site scope pinned to what the user has), so
 * they show up under Settings > API tokens and can be revoked there. Refresh
 * rotates both tokens. The SDK's router handles the protocol endpoints; this
 * module supplies storage and policy.
 */
const crypto = require('crypto');
const { Router } = require('express');
const { nanoid } = require('nanoid');
const { mcpAuthRouter } = require('@modelcontextprotocol/sdk/server/auth/router.js');
const { InvalidGrantError, InvalidTokenError, InvalidClientError, InvalidRequestError } = require('@modelcontextprotocol/sdk/server/auth/errors.js');
const db = require('../db');
const { authz, principalFromUser } = require('../auth');
const { panelBaseUrl } = require('./remote');

const CODE_TTL_S = 10 * 60;
const ACCESS_TTL_S = 24 * 60 * 60;
const REFRESH_TTL_S = 90 * 24 * 60 * 60;
const SCOPE = 'grimport';

const sha256 = s => crypto.createHash('sha256').update(s).digest('hex');
const now = () => Math.floor(Date.now() / 1000);

// ── Client store ────────────────────────────────────────────
function rowToClient(r) {
  if (!r) return undefined;
  let meta = {};
  try { meta = JSON.parse(r.metadata || '{}'); } catch {}
  return {
    ...meta,
    client_id: r.client_id,
    client_secret: r.client_secret || undefined,
    client_name: r.client_name || meta.client_name,
    redirect_uris: JSON.parse(r.redirect_uris),
    client_id_issued_at: r.created_at,
  };
}

const clientsStore = {
  getClient(clientId) {
    return rowToClient(db.prepare('SELECT * FROM oauth_clients WHERE client_id = ?').get(clientId));
  },
  registerClient(info) {
    const client_id = `gc_${nanoid(24)}`;
    const created_at = now();
    const { client_secret, redirect_uris, client_name, ...rest } = info;
    db.prepare('INSERT INTO oauth_clients (client_id, client_secret, client_name, redirect_uris, metadata, created_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(client_id, client_secret || null, (client_name || '').slice(0, 120) || null, JSON.stringify(redirect_uris), JSON.stringify(rest), created_at);
    return { ...info, client_id, client_id_issued_at: created_at };
  },
};

// ── Token minting ───────────────────────────────────────────
function mintTokens({ userId, clientId, clientName, scope = SCOPE }) {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
  if (!user || (user.status && user.status !== 'active')) throw new InvalidGrantError('Account is disabled');
  const principal = principalFromUser(user);
  if (principal.capabilities && principal.capabilities.api_tokens === false) throw new InvalidGrantError('API tokens are not enabled for this account');
  const accessible = authz.accessibleSiteIds(principal); // null = all
  const siteScope = accessible === null ? null : JSON.stringify(accessible);

  const access = `grim_${nanoid(32)}`;
  const refresh = `grimr_${nanoid(40)}`;
  const tokenId = nanoid(10);
  const expiresAt = now() + ACCESS_TTL_S;
  const name = `Claude via ${clientName || 'OAuth'}`.slice(0, 60);
  const tx = db.transaction(() => {
    db.prepare('INSERT INTO api_tokens (id, name, token_hash, role, site_scope, expires_at, user_id, oauth_client_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
      .run(tokenId, name, sha256(access), principal.role, siteScope, expiresAt, user.id, clientId);
    db.prepare('INSERT INTO oauth_refresh_tokens (token_hash, client_id, user_id, api_token_id, scope, expires_at) VALUES (?, ?, ?, ?, ?, ?)')
      .run(sha256(refresh), clientId, user.id, tokenId, scope, now() + REFRESH_TTL_S);
  });
  tx();
  return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL_S, refresh_token: refresh, scope };
}

/** Called by the consent page after the user clicked Allow. Returns the code. */
function issueAuthorizationCode({ clientId, userId, codeChallenge, redirectUri, scope, resource }) {
  const client = clientsStore.getClient(clientId);
  if (!client) throw new InvalidClientError('Unknown client');
  if (!client.redirect_uris.includes(redirectUri)) throw new InvalidRequestError('redirect_uri is not registered for this client');
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(codeChallenge || '')) throw new InvalidRequestError('code_challenge is missing or malformed');
  const code = nanoid(40);
  db.prepare('DELETE FROM oauth_codes WHERE expires_at < ?').run(now());
  db.prepare('INSERT INTO oauth_codes (code_hash, client_id, user_id, code_challenge, redirect_uri, scope, resource, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)')
    .run(sha256(code), clientId, userId, codeChallenge, redirectUri, scope || SCOPE, resource || null, now() + CODE_TTL_S);
  return code;
}

// ── Provider (OAuthServerProvider) ──────────────────────────
const provider = {
  get clientsStore() { return clientsStore; },

  async authorize(client, params, res) {
    const q = new URLSearchParams({
      client_id: client.client_id,
      redirect_uri: params.redirectUri,
      code_challenge: params.codeChallenge,
    });
    if (params.state) q.set('state', params.state);
    if (params.scopes?.length) q.set('scope', params.scopes.join(' '));
    if (params.resource) q.set('resource', String(params.resource));
    res.redirect(`/oauth/consent?${q.toString()}`);
  },

  async challengeForAuthorizationCode(client, code) {
    const row = db.prepare('SELECT * FROM oauth_codes WHERE code_hash = ?').get(sha256(code));
    if (!row || row.client_id !== client.client_id || row.expires_at < now()) throw new InvalidGrantError('Invalid or expired authorization code');
    return row.code_challenge;
  },

  async exchangeAuthorizationCode(client, code, _codeVerifier, redirectUri) {
    const hash = sha256(code);
    const row = db.prepare('SELECT * FROM oauth_codes WHERE code_hash = ?').get(hash);
    db.prepare('DELETE FROM oauth_codes WHERE code_hash = ?').run(hash); // one-time, even on failure
    if (!row || row.client_id !== client.client_id || row.expires_at < now()) throw new InvalidGrantError('Invalid or expired authorization code');
    if (redirectUri && redirectUri !== row.redirect_uri) throw new InvalidGrantError('redirect_uri does not match the authorization request');
    return mintTokens({ userId: row.user_id, clientId: client.client_id, clientName: client.client_name, scope: row.scope || SCOPE });
  },

  async exchangeRefreshToken(client, refreshToken) {
    const hash = sha256(refreshToken);
    const row = db.prepare('SELECT * FROM oauth_refresh_tokens WHERE token_hash = ?').get(hash);
    if (!row || row.client_id !== client.client_id) throw new InvalidGrantError('Invalid refresh token');
    db.prepare('DELETE FROM oauth_refresh_tokens WHERE token_hash = ?').run(hash);
    db.prepare('DELETE FROM api_tokens WHERE id = ?').run(row.api_token_id);
    if (row.expires_at < now()) throw new InvalidGrantError('Refresh token has expired, sign in again');
    return mintTokens({ userId: row.user_id, clientId: client.client_id, clientName: client.client_name, scope: row.scope || SCOPE });
  },

  async verifyAccessToken(token) {
    const row = db.prepare('SELECT id, user_id, expires_at, oauth_client_id FROM api_tokens WHERE token_hash = ?').get(sha256(token));
    if (!row) throw new InvalidTokenError('Unknown token');
    if (row.expires_at && row.expires_at < now()) throw new InvalidTokenError('Token has expired');
    return { token, clientId: row.oauth_client_id || 'grimport-token', scopes: [SCOPE], expiresAt: row.expires_at || undefined, extra: { userId: row.user_id } };
  },

  async revokeToken(client, { token }) {
    const hash = sha256(token);
    const rt = db.prepare('SELECT api_token_id FROM oauth_refresh_tokens WHERE token_hash = ? AND client_id = ?').get(hash, client.client_id);
    if (rt) {
      db.prepare('DELETE FROM oauth_refresh_tokens WHERE token_hash = ?').run(hash);
      db.prepare('DELETE FROM api_tokens WHERE id = ?').run(rt.api_token_id);
      return;
    }
    const at = db.prepare('SELECT id FROM api_tokens WHERE token_hash = ? AND oauth_client_id = ?').get(hash, client.client_id);
    if (at) {
      db.prepare('DELETE FROM oauth_refresh_tokens WHERE api_token_id = ?').run(at.id);
      db.prepare('DELETE FROM api_tokens WHERE id = ?').run(at.id);
    }
  },
};

/** Express router with /authorize, /token, /register, /revoke and the .well-known documents. */
function createAuthRouter({ issuerUrl = panelBaseUrl() } = {}) {
  return mcpAuthRouter({
    provider,
    issuerUrl: new URL(issuerUrl),
    resourceServerUrl: new URL('/mcp', issuerUrl),
    resourceName: 'Grimport',
    scopesSupported: [SCOPE],
    serviceDocumentationUrl: new URL('https://github.com/boeldner/grimport/blob/main/docs/wiki/MCP.md'),
    clientRegistrationOptions: { clientSecretExpirySeconds: 0 },
  });
}

/**
 * Consent API used by public/oauth.html (session + human user required by
 * the caller's mounting). GET describes the client, POST records the decision.
 */
function createConsentRouter() {
  const router = Router();

  router.get('/consent-info', (req, res) => {
    const client = clientsStore.getClient(String(req.query.client_id || ''));
    if (!client) return res.status(404).json({ error: 'Unknown client. Start the connection again from the app.' });
    res.json({
      client_id: client.client_id,
      client_name: client.client_name || 'An app',
      client_uri: client.client_uri || null,
      redirect_uris: client.redirect_uris,
      user: { username: req.user.username, display_name: req.user.display_name || null },
    });
  });

  router.post('/consent', (req, res) => {
    const { client_id, redirect_uri, code_challenge, state, scope, resource, decision } = req.body || {};
    const client = clientsStore.getClient(String(client_id || ''));
    if (!client) return res.status(404).json({ error: 'Unknown client' });
    if (!client.redirect_uris.includes(redirect_uri)) return res.status(400).json({ error: 'redirect_uri is not registered for this client' });
    const target = new URL(redirect_uri);
    if (state) target.searchParams.set('state', String(state));
    if (decision !== 'allow') {
      target.searchParams.set('error', 'access_denied');
      target.searchParams.set('error_description', 'The user declined');
      return res.json({ redirect: target.href });
    }
    try {
      const code = issueAuthorizationCode({ clientId: client.client_id, userId: req.user.id, codeChallenge: code_challenge, redirectUri: redirect_uri, scope, resource });
      target.searchParams.set('code', code);
      db.prepare('INSERT INTO activity (site_id, site_name, event, detail, actor) VALUES (NULL, ?, ?, ?, ?)')
        .run('grimport', 'oauth_connected', client.client_name || client.client_id, req.user.username);
      res.json({ redirect: target.href });
    } catch (err) {
      res.status(err.status || 400).json({ error: err.message });
    }
  });

  return router;
}

module.exports = { provider, clientsStore, mintTokens, issueAuthorizationCode, createAuthRouter, createConsentRouter, SCOPE, ACCESS_TTL_S, REFRESH_TTL_S, CODE_TTL_S };
