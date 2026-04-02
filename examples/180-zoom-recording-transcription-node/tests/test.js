'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ── Credential check — MUST be first ──────────────────────────────────────────
// Exit code convention used across all examples in this repo:
//   0 = all tests passed
//   1 = real test failure (code bug, assertion error, unexpected API response)
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
// ──────────────────────────────────────────────────────────────────────────────

// Import createApp() from the example's own source.
// This tests the server's request handling logic without making real Zoom API calls.
const { createApp } = require('../src/server.js');

// Build a valid Zoom HMAC signature for a given body and timestamp.
function buildZoomSignature(secret, timestamp, body) {
  const message = `v0:${timestamp}:${JSON.stringify(body)}`;
  const hash = crypto.createHmac('sha256', secret).update(message).digest('hex');
  return `v0=${hash}`;
}

async function testServerStarts() {
  console.log('Test 1: createApp() returns a configured Express app...');

  const app = createApp();

  if (typeof app !== 'function' && typeof app.listen !== 'function') {
    throw new Error('createApp() did not return an Express application');
  }

  console.log('✓ createApp() returned an Express app');
}

async function testHealthEndpoint() {
  console.log('\nTest 2: GET /health returns { status: "ok" }...');

  const app = createApp();
  const http = require('http');

  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      try {
        const resp = await fetch(`http://localhost:${port}/health`);
        const data = await resp.json();
        if (data.status !== 'ok') {
          throw new Error(`Expected { status: "ok" }, got: ${JSON.stringify(data)}`);
        }
        console.log('✓ GET /health returned { status: "ok" }');
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on('error', reject);
  });
}

async function testWebhookUrlValidation() {
  console.log('\nTest 3: POST /webhook — endpoint.url_validation HMAC handshake...');

  const app = createApp();
  const http = require('http');

  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      try {
        const plainToken = 'test-plain-token-abc123';
        const body = {
          event: 'endpoint.url_validation',
          payload: { plainToken },
        };

        const resp = await fetch(`http://localhost:${port}/webhook`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          throw new Error(`Unexpected status ${resp.status} from /webhook`);
        }

        const data = await resp.json();

        if (data.plainToken !== plainToken) {
          throw new Error(`Expected plainToken "${plainToken}", got "${data.plainToken}"`);
        }

        // Verify the HMAC the server returned is correct.
        const expectedHash = crypto
          .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
          .update(plainToken)
          .digest('hex');

        if (data.encryptedToken !== expectedHash) {
          throw new Error(
            `encryptedToken mismatch.\nExpected: ${expectedHash}\nGot:      ${data.encryptedToken}`
          );
        }

        console.log('✓ Webhook URL validation HMAC handshake correct');
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on('error', reject);
  });
}

async function testWebhookSignatureRejection() {
  console.log('\nTest 4: POST /webhook — invalid signature returns 401...');

  const app = createApp();
  const http = require('http');

  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      try {
        const body = {
          event: 'recording.completed',
          payload: {},
        };

        const resp = await fetch(`http://localhost:${port}/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-zm-request-timestamp': '1234567890',
            'x-zm-signature': 'v0=invalidsignature',
          },
          body: JSON.stringify(body),
        });

        if (resp.status !== 401) {
          throw new Error(`Expected 401 for invalid signature, got ${resp.status}`);
        }

        const data = await resp.json();
        if (!data.error) {
          throw new Error('Expected error field in 401 response');
        }

        console.log('✓ Invalid signature correctly rejected with 401');
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on('error', reject);
  });
}

async function testWebhookValidSignatureIgnoredEvent() {
  console.log('\nTest 5: POST /webhook — valid signature, unknown event returns ignored...');

  const app = createApp();
  const http = require('http');

  await new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, async () => {
      const port = server.address().port;
      try {
        const timestamp = String(Math.floor(Date.now() / 1000));
        const body = { event: 'meeting.started', payload: {} };
        const signature = buildZoomSignature(
          process.env.ZOOM_WEBHOOK_SECRET_TOKEN,
          timestamp,
          body,
        );

        const resp = await fetch(`http://localhost:${port}/webhook`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-zm-request-timestamp': timestamp,
            'x-zm-signature': signature,
          },
          body: JSON.stringify(body),
        });

        if (!resp.ok) {
          throw new Error(`Unexpected status ${resp.status}`);
        }

        const data = await resp.json();
        if (data.status !== 'ignored') {
          throw new Error(`Expected { status: "ignored" }, got: ${JSON.stringify(data)}`);
        }

        console.log('✓ Non-recording event correctly returned { status: "ignored" }');
        resolve();
      } catch (err) {
        reject(err);
      } finally {
        server.close();
      }
    });
    server.on('error', reject);
  });
}

async function run() {
  await testServerStarts();
  await testHealthEndpoint();
  await testWebhookUrlValidation();
  await testWebhookSignatureRejection();
  await testWebhookValidSignatureIgnoredEvent();
}

run()
  .then(() => {
    console.log('\n✓ All tests passed');
    process.exit(0);
  })
  .catch(err => {
    console.error(`\n✗ Test failed: ${err.message}`);
    process.exit(1);
  });
