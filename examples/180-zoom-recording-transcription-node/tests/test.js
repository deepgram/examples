'use strict';

const fs = require('fs');
const path = require('path');

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

const { DeepgramClient } = require('@deepgram/sdk');

const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const EXPECTED_WORDS = ['spacewalk', 'astronaut', 'nasa'];

async function run() {
  // ── Test 1: Deepgram pre-recorded STT works with transcribeUrl ──
  console.log('Test 1: Deepgram pre-recorded STT (nova-3)...');

  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  const data = await deepgram.listen.v1.media.transcribeUrl({
    url: KNOWN_AUDIO_URL,
    model: 'nova-3',
    smart_format: true,
    diarize: true,
    paragraphs: true,
    tag: 'deepgram-examples',
  });

  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!transcript || transcript.length < 20) {
    throw new Error(`Transcript too short or empty: "${transcript}"`);
  }

  const lower = transcript.toLowerCase();
  const found = EXPECTED_WORDS.filter(w => lower.includes(w));
  if (found.length === 0) {
    throw new Error(
      `Expected words not found in transcript.\nGot: "${transcript.substring(0, 200)}"`
    );
  }

  console.log(`✓ Transcript received (${transcript.length} chars)`);
  console.log(`✓ Expected content verified (found: ${found.join(', ')})`);

  // ── Test 2: Zoom OAuth token retrieval ──
  console.log('\nTest 2: Zoom OAuth token retrieval...');

  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const tokenResp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!tokenResp.ok) {
    throw new Error(`Zoom OAuth failed: ${tokenResp.status} ${await tokenResp.text()}`);
  }

  const tokenData = await tokenResp.json();
  if (!tokenData.access_token) {
    throw new Error('No access_token in Zoom OAuth response');
  }

  console.log('✓ Zoom OAuth token retrieved successfully');

  // ── Test 3: Webhook validation logic ──
  console.log('\nTest 3: Webhook signature validation logic...');

  const crypto = require('crypto');
  const testToken = 'test-plain-token';
  const hash = crypto
    .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(testToken)
    .digest('hex');

  if (!hash || hash.length !== 64) {
    throw new Error('HMAC hash generation failed');
  }

  console.log('✓ Webhook validation HMAC logic works');
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
