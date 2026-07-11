const test = require('node:test');
const assert = require('node:assert');
const { asyncHandler } = require('../src/async-handler');

test('forwards rejection to next', async () => {
  const boom = new Error('boom');
  const handler = asyncHandler(async () => { throw boom; });
  let passed;
  await new Promise(resolve => {
    handler({}, {}, err => { passed = err; resolve(); });
  });
  assert.strictEqual(passed, boom);
});

test('does not call next on success', async () => {
  const handler = asyncHandler(async (req, res) => { res.done = true; });
  const res = {};
  let nextCalled = false;
  await handler({}, res, () => { nextCalled = true; });
  assert.strictEqual(res.done, true);
  assert.strictEqual(nextCalled, false);
});
