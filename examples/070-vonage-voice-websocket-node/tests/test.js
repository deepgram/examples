'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');

// ── Credential check ─────────────────────────────────────────────────────────
// Exit code convention:
//   0 = all tests passed
//   1 = real test failure
//   2 = missing credentials (expected in CI until secrets are configured)
const envExample = path.join(__dirname, '..', '.env.example');
const required = fs.readFileSync(envExample, 'utf8')
  .split('\n')
  .filter(l => /^[A-Z][A-Z0-9_]+=/.test(l.trim()))
  .map(l => l.split('=')[0].trim());

const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ─────────────────────────────────────────────────────────────────────────────

const { createApp } = require('../src/index.js');

async function run() {
  // ── Test 1: createApp is exported ─────────────────────────────────────────
  if (typeof createApp !== 'function') {
    throw new Error('src/index.js must export a createApp() function');
  }
  console.log('createApp is exported from src/index.js');

  // ── Test 2: App starts and /webhooks/answer returns valid NCCO ────────────
  console.log('\nSpinning up the app to test /webhooks/answer...');

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
    // Request the Vonage answer webhook — it must return a valid NCCO array
    const ncco = await new Promise((resolve, reject) => {
      http.get(
        `http://127.0.0.1:${port}/webhooks/answer`,
        { headers: { host: `127.0.0.1:${port}` } },
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Expected 200, got ${res.statusCode}: ${body}`));
              return;
            }
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          });
        }
      ).on('error', reject);
    });

    // NCCO must be a non-empty array
    if (!Array.isArray(ncco) || ncco.length === 0) {
      throw new Error(`/webhooks/answer must return a non-empty NCCO array, got: ${JSON.stringify(ncco)}`);
    }
    console.log(`/webhooks/answer returned ${ncco.length}-action NCCO`);

    // Verify the NCCO contains a "connect" action with a websocket endpoint
    const connectAction = ncco.find(a => a.action === 'connect');
    if (!connectAction) {
      throw new Error('NCCO must include a "connect" action');
    }

    const wsEndpoint = connectAction.endpoint?.find(e => e.type === 'websocket');
    if (!wsEndpoint) {
      throw new Error('NCCO connect action must include a websocket endpoint');
    }

    if (!wsEndpoint.uri || !wsEndpoint.uri.includes('/socket')) {
      throw new Error(`Websocket endpoint URI must point to /socket, got: ${wsEndpoint.uri}`);
    }

    const contentType = wsEndpoint['content-type'];
    if (!contentType || !contentType.includes('l16')) {
      throw new Error(`Websocket endpoint must specify linear16 audio, got: ${contentType}`);
    }

    console.log(`NCCO structure valid:`);
    console.log(`  connect -> websocket -> ${wsEndpoint.uri}`);
    console.log(`  content-type: ${contentType}`);

    // ── Test 3: Health check endpoint ──────────────────────────────────────
    const health = await new Promise((resolve, reject) => {
      http.get(
        `http://127.0.0.1:${port}/`,
        (res) => {
          let body = '';
          res.on('data', (chunk) => { body += chunk; });
          res.on('end', () => {
            if (res.statusCode !== 200) {
              reject(new Error(`Health check expected 200, got ${res.statusCode}`));
              return;
            }
            try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
          });
        }
      ).on('error', reject);
    });

    if (health.status !== 'ok') {
      throw new Error(`Health check must return {status: "ok"}, got: ${JSON.stringify(health)}`);
    }
    console.log('Health check endpoint returns {status: "ok"}');

  } finally {
    await new Promise((resolve) => server.close(resolve));
    console.log('Server closed');
  }
}

run()
  .then(() => {
    console.log('\nAll tests passed');
    process.exit(0);
  })
  .catch(err => {
    console.error(`\nTest failed: ${err.message}`);
    process.exit(1);
  });
