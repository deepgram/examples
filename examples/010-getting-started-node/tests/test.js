'use strict';

const fs = require('fs');
const path = require('path');

// ── Credential check ─────────────────────────────────────────────────────────
// Must run BEFORE any SDK imports.
//
// If DeepgramClient is constructed without an API key it will still load, but
// the first API call throws an AuthenticationError that looks like a code bug
// rather than a missing secret. Exiting here with code 2 signals to CI that
// this is an expected "not yet configured" state, not a test failure.
//
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
// ─────────────────────────────────────────────────────────────────────────────

// Import the exported function from the example's own source.
// This verifies the example code path works end-to-end, not just the SDK.
const { transcribe } = require('../src/index.js');

// A stable Deepgram-hosted audio file used in Deepgram docs.
// dpgr.am links are long-lived and won't disappear like third-party URLs.
const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';

// spacewalk.wav is ~33 seconds. At >= 2 chars/second the transcript should
// be at least 66 characters — a simple sanity check that real speech was
// returned, not an empty or near-empty result.
const MIN_CHARS = 66;

async function run() {
  console.log('Testing transcribe() from src/index.js...');

  // Call the actual example function — exercises the src/ code path.
  const data = await transcribe(KNOWN_AUDIO_URL, {
    apiKey: process.env.DEEPGRAM_API_KEY,
  });

  // Defensive optional chaining — if the response shape ever changes,
  // this throws a clear "cannot read property of undefined" pointing
  // at the exact path that changed, not a cryptic downstream error.
  const transcript = data?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!transcript || transcript.length < MIN_CHARS) {
    // A very short transcript usually means the model returned empty results,
    // which can happen with silent audio or a corrupted source file.
    throw new Error(`Transcript too short or empty (got ${transcript?.length ?? 0} chars, want >= ${MIN_CHARS}): "${transcript}"`);
  }

  console.log(`✓ transcribe() returned a transcript (${transcript.length} chars)`);
  console.log(`  Preview: "${transcript.substring(0, 100)}..."`);
}

run()
  .then(() => {
    console.log('\n✓ All tests passed');
    process.exit(0);
  })
  .catch(err => {
    // Common causes if this fires in CI with credentials present:
    //   AuthenticationError  — API key valid but wrong project permissions
    //   PaymentRequiredError — quota exceeded
    //   Network error        — dpgr.am unreachable from CI runner
    console.error(`\n✗ Test failed: ${err.message}`);
    process.exit(1);
  });
