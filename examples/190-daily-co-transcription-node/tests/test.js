'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Credential check — MUST be first ──────────────────────────────────────
const required = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  .split('\n').filter(l => /^[A-Z][A-Z0-9_]+=/.test(l.trim())).map(l => l.split('=')[0].trim());
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────────

// ── Test 1: File structure ──────────────────────────────────────────────────
function testFileStructure() {
  const root = path.join(__dirname, '..');
  const requiredFiles = [
    'package.json',
    '.env.example',
    'README.md',
    'src/server.js',
    'src/public/index.html',
  ];

  for (const f of requiredFiles) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) throw new Error(`Missing required file: ${f}`);
  }
  console.log('File structure check passed');
}

// ── Test 2: Server module exports createApp ─────────────────────────────────
function testServerModuleExports() {
  const { createApp } = require('../src/server');
  if (typeof createApp !== 'function') {
    throw new Error('server.js does not export a createApp function');
  }
  console.log('server.js exports createApp()');
}

// ── Test 3: Health endpoint via createApp() ─────────────────────────────────
async function testHealthEndpoint(port) {
  const health = await new Promise((resolve, reject) => {
    http.get(
      `http://127.0.0.1:${port}/api/health`,
      (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          if (res.statusCode !== 200) {
            reject(new Error(`/api/health expected 200, got ${res.statusCode}: ${body}`));
            return;
          }
          try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
        });
      }
    ).on('error', reject);
  });

  if (health.status !== 'ok') {
    throw new Error(`/api/health must return {status: "ok"}, got: ${JSON.stringify(health)}`);
  }
  console.log('/api/health returns {status: "ok"}');
}

// ── Test 4: /api/room endpoint via createApp() ──────────────────────────────
// Tests that the app proxies the Daily room creation — exercising the Daily
// API integration through src/server.js, not a standalone API call.
async function testRoomEndpoint(port) {
  const result = await new Promise((resolve, reject) => {
    const body = JSON.stringify({});
    const options = {
      hostname: '127.0.0.1',
      port,
      path: '/api/room',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, body: parsed });
        } catch (e) {
          reject(new Error(`/api/room returned non-JSON: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });

  if (result.status !== 200) {
    throw new Error(
      `/api/room returned ${result.status}: ${JSON.stringify(result.body)}`
    );
  }

  if (!result.body.url || !result.body.name) {
    throw new Error(
      `/api/room must return {url, name}, got: ${JSON.stringify(result.body)}`
    );
  }

  console.log(`/api/room returned Daily room: ${result.body.url}`);
  return result.body.name;
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  testFileStructure();
  testServerModuleExports();

  // Spin up the app on a random port for endpoint tests
  const { createApp } = require('../src/server');
  const app = createApp();
  const server = http.createServer(app);

  await new Promise((resolve, reject) => {
    server.listen(0, '127.0.0.1', (err) => {
      if (err) reject(err);
      else resolve();
    });
  });

  const { port } = server.address();
  console.log(`App listening on port ${port}`);

  try {
    await testHealthEndpoint(port);
    const roomName = await testRoomEndpoint(port);
    console.log(`Daily room created via /api/room (name: ${roomName})`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('Server closed');
  }
}

run()
  .then(() => { console.log('\nAll tests passed'); process.exit(0); })
  .catch(err => { console.error(`\nTest failed: ${err.message}`); process.exit(1); });
