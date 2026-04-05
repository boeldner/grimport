const express = require('express');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Grimport Node.js Test</title>
  <style>
    body { font-family: system-ui, sans-serif; background: #0f0f0f; color: #e8e8e0; max-width: 700px; margin: 60px auto; padding: 0 24px; }
    h1 { color: #e02d2d; }
    .card { background: #1a1a1a; border: 1px solid #2a2a2a; border-radius: 10px; padding: 20px; margin: 16px 0; }
    code { background: #111; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .badge { display: inline-block; background: #1a2f1a; border: 1px solid #2d5a2d; color: #4ade80; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; }
    a { color: #e02d2d; }
  </style>
</head>
<body>
  <h1>▦ Node.js backend test</h1>
  <p class="badge">✓ Running on Node.js ${process.version}</p>

  <div class="card">
    <h3>Server info</h3>
    <p>Hostname: <code>${os.hostname()}</code></p>
    <p>Platform: <code>${os.platform()} ${os.arch()}</code></p>
    <p>Uptime: <code>${Math.floor(process.uptime())}s</code></p>
    <p>PORT env: <code>${PORT}</code></p>
  </div>

  <div class="card">
    <h3>API endpoints</h3>
    <p><a href="/api/hello">GET /api/hello</a> — JSON greeting</p>
    <p><a href="/api/env">GET /api/env</a> — safe env vars</p>
    <p><a href="/api/health">GET /api/health</a> — health check</p>
  </div>
</body>
</html>`);
});

app.get('/api/health', (req, res) => {
  res.json({ ok: true, uptime: process.uptime(), version: process.version });
});

app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Grimport test backend!', time: new Date().toISOString() });
});

app.get('/api/env', (req, res) => {
  // Only expose safe vars — never dump full process.env
  res.json({
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    hostname: os.hostname(),
    nodeVersion: process.version,
  });
});

app.listen(PORT, () => {
  console.log(`Test backend running on port ${PORT}`);
});
