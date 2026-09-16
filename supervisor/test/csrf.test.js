const test = require('node:test');
const assert = require('node:assert');
const { csrfProtection } = require('../src/csrf');

function makeRes() {
  return {
    _status: null,
    _body: null,
    status(code) { this._status = code; return this; },
    json(body) { this._body = body; return this; },
  };
}

function run(req) {
  let nextCalled = false;
  const res = makeRes();
  csrfProtection(req, res, () => { nextCalled = true; });
  return { nextCalled, res };
}

test('GET is never blocked, even with no headers at all', () => {
  const { nextCalled, res } = run({ method: 'GET', path: '/api/sites', headers: {} });
  assert.strictEqual(nextCalled, true);
  assert.strictEqual(res._status, null);
});

test('mutating request outside /api/* is never blocked', () => {
  const { nextCalled } = run({ method: 'POST', path: '/login.html', headers: {} });
  assert.strictEqual(nextCalled, true);
});

test('mutating /api/* request with Content-Type: application/json passes', () => {
  const { nextCalled } = run({ method: 'POST', path: '/api/sites', headers: { 'content-type': 'application/json' } });
  assert.strictEqual(nextCalled, true);
});

test('mutating /api/* request with X-Requested-With: grimport passes (no JSON content type)', () => {
  const { nextCalled } = run({
    method: 'DELETE',
    path: '/api/sites/abc',
    headers: { 'x-requested-with': 'grimport' },
  });
  assert.strictEqual(nextCalled, true);
});

test('mutating /api/* request with neither header is rejected with 403', () => {
  const { nextCalled, res } = run({ method: 'POST', path: '/api/sites', headers: {} });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res._status, 403);
  assert.match(res._body.error, /X-Requested-With/);
});

test('mutating /api/* request with a form content type and no custom header is rejected', () => {
  const { nextCalled, res } = run({
    method: 'PUT',
    path: '/api/settings',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res._status, 403);
});

test('a Bearer-token request is exempt even with no JSON/header (API tokens are not cookie-riding browsers)', () => {
  const { nextCalled } = run({
    method: 'POST',
    path: '/api/deploy/site1',
    headers: { authorization: 'Bearer grim_sometoken' },
  });
  assert.strictEqual(nextCalled, true);
});

test('an incorrect Bearer-less authorization header does not exempt the request', () => {
  const { nextCalled, res } = run({
    method: 'POST',
    path: '/api/sites',
    headers: { authorization: 'Basic abc123' },
  });
  assert.strictEqual(nextCalled, false);
  assert.strictEqual(res._status, 403);
});

test('PATCH is treated as mutating', () => {
  const { nextCalled } = run({ method: 'PATCH', path: '/api/users/1', headers: {} });
  assert.strictEqual(nextCalled, false);
});
