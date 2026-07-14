const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const work = fs.mkdtempSync(path.join(os.tmpdir(), 'grim-alerts-'));
fs.mkdirSync(path.join(work, 'sites'), { recursive: true });
process.env.DATA_PATH = path.join(work, 'sites');

const db = require('../src/db');
const { sendAlert, setNtfyConfig } = require('../src/alerts');

function mockFetch() {
  const calls = [];
  global.fetch = (url, opts) => {
    calls.push({ url, opts });
    return Promise.resolve({ ok: true });
  };
  return calls;
}

function clearConfig() {
  db.prepare("DELETE FROM settings WHERE key = 'alert_ntfy'").run();
}

test('sendAlert posts to the configured ntfy URL for an enabled, opted-in event', async () => {
  clearConfig();
  const calls = mockFetch();
  setNtfyConfig({ url: 'https://ntfy.sh/grimport-test-topic', enabled: true, events: ['site_down'] });

  await sendAlert('site_down', { siteName: 'My Site', detail: 'no response' });

  assert.strictEqual(calls.length, 1);
  assert.strictEqual(calls[0].url, 'https://ntfy.sh/grimport-test-topic');
  assert.strictEqual(calls[0].opts.method, 'POST');
  assert.match(calls[0].opts.headers.Title, /Site down/);
  assert.match(calls[0].opts.body, /My Site/);
});

test('sendAlert does nothing when the channel is disabled', async () => {
  clearConfig();
  const calls = mockFetch();
  setNtfyConfig({ url: 'https://ntfy.sh/grimport-test-topic', enabled: false, events: ['site_down'] });

  await sendAlert('site_down', { siteName: 'My Site', detail: 'no response' });

  assert.strictEqual(calls.length, 0);
});

test('sendAlert does nothing when the event is not opted in', async () => {
  clearConfig();
  const calls = mockFetch();
  setNtfyConfig({ url: 'https://ntfy.sh/grimport-test-topic', enabled: true, events: ['deploy_failed'] });

  await sendAlert('site_down', { siteName: 'My Site', detail: 'no response' });

  assert.strictEqual(calls.length, 0);
});

test('sendAlert rejects a private/SSRF ntfy URL and sends nothing', async () => {
  clearConfig();
  const calls = mockFetch();
  setNtfyConfig({ url: 'http://127.0.0.1:9999/topic', enabled: true, events: ['site_down'] });

  await sendAlert('site_down', { siteName: 'My Site', detail: 'no response' });

  assert.strictEqual(calls.length, 0);
});

test('sendAlert ignores unknown event types', async () => {
  clearConfig();
  const calls = mockFetch();
  setNtfyConfig({ url: 'https://ntfy.sh/grimport-test-topic', enabled: true, events: ['site_down'] });

  await sendAlert('not_a_real_event', { siteName: 'My Site' });

  assert.strictEqual(calls.length, 0);
});
