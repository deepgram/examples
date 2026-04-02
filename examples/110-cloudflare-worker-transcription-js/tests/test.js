// ESM module — package.json has "type": "module" so .js files are ESM.
// Node.js 18+ supports top-level await and has fetch/Request/Response as globals.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Credential check ─────────────────────────────────────────────────────────
// Exit code convention across all examples in this repo:
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
// ─────────────────────────────────────────────────────────────────────────────

// Import the worker's default export directly — the same object Cloudflare
// calls with (request, env) in production.
import handler from '../src/index.js';

const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';

// spacewalk.wav is ~33 seconds. At >= 2 chars/second the transcript should
// be at least 66 characters.
const AUDIO_DURATION_SECONDS = 33;
const MIN_CHARS = AUDIO_DURATION_SECONDS * 2;

// Construct a minimal mock env object matching the Workers runtime shape.
function makeEnv(overrides = {}) {
  return {
    DEEPGRAM_API_KEY: process.env.DEEPGRAM_API_KEY,
    ...overrides,
  };
}

// Build a mock Request using the WHATWG Request class (built-in in Node 18+).
function makeRequest(method, urlPath, { body, headers = {} } = {}) {
  const base = 'https://worker.example.com';
  const reqInit = { method, headers: { 'Content-Type': 'application/json', ...headers } };
  if (body !== undefined) {
    reqInit.body = JSON.stringify(body);
  }
  return new Request(`${base}${urlPath}`, reqInit);
}

async function testHealthEndpoint() {
  console.log('Test 1: GET /health returns { status: "ok" }...');

  const req = makeRequest('GET', '/health');
  const resp = await handler.fetch(req, makeEnv());

  if (resp.status !== 200) {
    throw new Error(`Expected 200, got ${resp.status}`);
  }

  const data = await resp.json();
  if (data.status !== 'ok') {
    throw new Error(`Expected { status: "ok" }, got: ${JSON.stringify(data)}`);
  }

  console.log('✓ GET /health returned { status: "ok" }');
}

async function testMissingApiKey() {
  console.log('\nTest 2: Missing DEEPGRAM_API_KEY returns 500...');

  const req = makeRequest('POST', '/transcribe-url', {
    body: { url: KNOWN_AUDIO_URL },
  });
  const resp = await handler.fetch(req, makeEnv({ DEEPGRAM_API_KEY: '' }));

  if (resp.status !== 500) {
    throw new Error(`Expected 500 for missing API key, got ${resp.status}`);
  }

  const data = await resp.json();
  if (!data.error || !data.error.includes('DEEPGRAM_API_KEY')) {
    throw new Error(`Expected error mentioning DEEPGRAM_API_KEY, got: ${JSON.stringify(data)}`);
  }

  console.log('✓ Missing API key correctly returns 500 with descriptive error');
}

async function testMethodNotAllowed() {
  console.log('\nTest 3: GET /transcribe-url returns 405...');

  const req = makeRequest('GET', '/transcribe-url');
  const resp = await handler.fetch(req, makeEnv());

  if (resp.status !== 405) {
    throw new Error(`Expected 405, got ${resp.status}`);
  }

  console.log('✓ GET /transcribe-url correctly returns 405');
}

async function testUnknownPath() {
  console.log('\nTest 4: POST /unknown-path returns 404...');

  const req = makeRequest('POST', '/unknown-path', { body: {} });
  const resp = await handler.fetch(req, makeEnv());

  if (resp.status !== 404) {
    throw new Error(`Expected 404, got ${resp.status}`);
  }

  console.log('✓ Unknown path correctly returns 404');
}

async function testTranscribeUrl() {
  console.log(`\nTest 5: POST /transcribe-url transcribes ${KNOWN_AUDIO_URL}...`);

  const req = makeRequest('POST', '/transcribe-url', {
    body: { url: KNOWN_AUDIO_URL },
  });
  const resp = await handler.fetch(req, makeEnv());

  if (!resp.ok) {
    const errBody = await resp.text();
    throw new Error(`POST /transcribe-url failed with ${resp.status}: ${errBody}`);
  }

  const data = await resp.json();

  if (typeof data.transcript !== 'string' || data.transcript.length < MIN_CHARS) {
    throw new Error(
      `Transcript too short (got ${data.transcript?.length ?? 0} chars, want >= ${MIN_CHARS}): "${data.transcript}"`
    );
  }

  if (typeof data.confidence !== 'number') {
    throw new Error(`Expected confidence to be a number, got: ${typeof data.confidence}`);
  }

  console.log(`✓ POST /transcribe-url returned transcript (${data.transcript.length} chars)`);
  console.log(`  confidence: ${data.confidence.toFixed(3)}, duration: ${data.duration_seconds}s`);
  console.log(`  Preview: "${data.transcript.substring(0, 100)}..."`);
}

async function run() {
  await testHealthEndpoint();
  await testMissingApiKey();
  await testMethodNotAllowed();
  await testUnknownPath();
  await testTranscribeUrl();
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
