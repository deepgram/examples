'use strict';

const fs = require('fs');
const path = require('path');

// ── Credential check ─────────────────────────────────────────────────────────
// Must run FIRST, before any SDK imports that could throw on missing config.
// Exit code 2 = missing credentials (expected in CI, not a code bug).
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

const { createClient } = require('@deepgram/sdk');

const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
// Known words from this audio file — used to verify transcription is working
const EXPECTED_WORDS = ['spacewalk', 'astronaut', 'nasa'];

async function run() {
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  console.log('Testing Deepgram pre-recorded STT...');

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: KNOWN_AUDIO_URL },
    { model: 'nova-2', smart_format: true }
  );

  if (error) throw new Error(`Deepgram API error: ${error.message}`);

  const transcript = result?.results?.channels?.[0]?.alternatives?.[0]?.transcript;
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
