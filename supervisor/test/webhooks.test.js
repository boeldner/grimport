const test = require('node:test');
const assert = require('node:assert');
const { sendToWebhook } = require('../src/webhooks');

function mockFetch() {
  const calls = [];
  global.fetch = (url, opts) => {
    calls.push({ url, body: JSON.parse(opts.body) });
    return Promise.resolve({ ok: true });
  };
  return calls;
}

test('sendToWebhook builds a Discord payload for a discord.com URL', () => {
  const calls = mockFetch();
  const wh = {
    url: 'https://discord.com/api/webhooks/123/abc',
    events: JSON.stringify(['deploy']),
  };

  assert.doesNotThrow(() => sendToWebhook(wh, 'deploy', 'site-1', 'My Site', 'detail.zip'));

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, wh.url);
  assert.ok(Array.isArray(calls[0].body.embeds), 'discord payload should have embeds');
  assert.strictEqual(calls[0].body.embeds[0].title, 'Grimport — Deploy');
});

test('sendToWebhook builds a generic payload for a non-Discord URL', () => {
  const calls = mockFetch();
  const wh = {
    url: 'https://example.com/hook',
    events: JSON.stringify(['deploy']),
  };

  assert.doesNotThrow(() => sendToWebhook(wh, 'deploy', 'site-1', 'My Site', 'detail.zip'));

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, wh.url);
  assert.strictEqual(calls[0].body.event, 'deploy');
  assert.deepStrictEqual(calls[0].body.site, { id: 'site-1', name: 'My Site' });
  assert.strictEqual(calls[0].body.detail, 'detail.zip');
});

test('sendToWebhook does not send when event is not subscribed', () => {
  const calls = mockFetch();
  const wh = {
    url: 'https://example.com/hook',
    events: JSON.stringify(['rollback']),
  };

  assert.doesNotThrow(() => sendToWebhook(wh, 'deploy', 'site-1', 'My Site', 'detail.zip'));
  assert.strictEqual(calls.length, 0);
});
