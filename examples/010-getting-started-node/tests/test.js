'use strict';

const fs = require('fs');
const path = require('path');

// ── Credential check ─────────────────────────────────────────────────────────
// This MUST run before any SDK imports.
//
// Why: if @deepgram/sdk is imported without a valid API key it will still load
// fine, but the first API call will throw a 401 that looks like a code error
// rather than a missing secret. By checking here and exiting with code 2, we
// signal to CI that this is an expected "not yet configured" state, not a bug.
//
// Exit code convention used across all examples in this repo:
//   0 = all tests passed
//   1 = real test failure (code bug, assertion error, unexpected API response)
//   2 = missing credentials (expected in CI until secrets are configured)
const envExample = path.join(__dirname, '..', '.env.example');
const required = fs.readFileSync(envExample, 'utf8')
  .split('\n')
  // Match lines like DEEPGRAM_API_KEY= (uppercase, may have a value or not)
  .filter(l => /^[A-Z][A-Z0-9_]+=/.test(l.trim()))
  .map(l => l.split('=')[0].trim());

const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  // Print to stderr so it doesn't pollute stdout test output.
  // The CI workflow parses this exact format to extract variable names
  // for the @deepgram-devrel comment.
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ─────────────────────────────────────────────────────────────────────────────

const { createClient } = require('@deepgram/sdk');

// Use a well-known audio file with a known transcript so the test is
// deterministic. dpgr.am/spacewalk.wav is Deepgram's own hosted sample —
// it's stable and won't disappear. Using a random URL risks flaky tests
// if the source goes down.
const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';

// These words appear in the spacewalk recording. We check for at least one
// of them rather than an exact transcript match, because:
//   - Minor model updates can change punctuation or spelling
//   - smart_format may format some words differently over time
//   - An exact match would be a brittle test
const EXPECTED_WORDS = ['spacewalk', 'astronaut', 'nasa'];

async function run() {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  console.log('Testing Deepgram pre-recorded STT...');

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: KNOWN_AUDIO_URL },
    { model: 'nova-2', smart_format: true }
  );

  // An error here most likely means:
  //   - The API key is valid but has no balance (402)
  //   - The Deepgram API is unreachable from CI (network issue)
  //   - The audio URL is down (check dpgr.am)
  if (error) throw new Error(`Deepgram API error: ${error.message}`);

  // Defensive access — future API versions might change the response shape.
  // If this throws, the test will fail with a clear "cannot read property of
  // undefined" that points directly at the response structure change.
  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;

  if (!transcript || transcript.length < 20) {
    // A very short transcript usually means the model returned empty results,
    // which can happen with silent audio or a corrupted file. The minimum of
    // 20 chars is a loose lower bound — the spacewalk audio is ~4 minutes.
    throw new Error(`Transcript too short or empty: "${transcript}"`);
  }

  const lower = transcript.toLowerCase();
  const found = EXPECTED_WORDS.filter(w => lower.includes(w));
  if (found.length === 0) {
    // This would mean the model returned a transcript but it doesn't contain
    // any of the expected words — suggesting the wrong audio was transcribed
    // or the model is returning garbage. Worth investigating if this fires.
    throw new Error(
      `Expected words not found in transcript.\nGot: "${transcript.substring(0, 200)}"`
    );
  }

  console.log(`✓ Transcript received (${transcript.length} chars)`);
  console.log(`✓ Expected content verified (found: ${found.join(', ')})`);
  console.log(`  Preview: "${transcript.substring(0, 100)}..."`);
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
