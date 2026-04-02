'use strict';

const fs = require('fs');
const path = require('path');

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

const { transcribe, speak } = require('../src/index.js');

const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';

async function run() {
  // ── Test 1: Module exports ────────────────────────────────────────────────
  if (typeof transcribe !== 'function') {
    throw new Error('src/index.js must export a transcribe() function');
  }
  if (typeof speak !== 'function') {
    throw new Error('src/index.js must export a speak() function');
  }
  console.log('src/index.js exports transcribe and speak functions');

  // ── Test 2: Transcription via src/index.js ───────────────────────────────
  console.log('\nTesting transcribe() from src/index.js...');

  const transcript = await transcribe(KNOWN_AUDIO_URL);

  if (!transcript.text || transcript.text.length < 20) {
    throw new Error(`Transcript too short or empty: "${transcript.text}"`);
  }

  // spacewalk.wav is ~33 s — expect at least 2 chars/sec
  const minChars = Math.floor(33 * 2);
  if (transcript.text.length < minChars) {
    throw new Error(
      `Transcript suspiciously short (${transcript.text.length} chars) for 33 s audio`
    );
  }

  console.log(`Transcription working (${transcript.text.length} chars)`);
  console.log(`  Preview: "${transcript.text.substring(0, 100)}..."`);

  // ── Test 3: Text-to-Speech via src/index.js ──────────────────────────────
  console.log('\nTesting speak() from src/index.js...');

  const speech = await speak('Hello from the Vercel AI SDK test suite.');

  // linear16 at 24 kHz for a short sentence should produce at least a few KB.
  // If we get fewer than 1000 bytes, the TTS call likely returned silence or an error.
  if (!speech.audio?.uint8Array || speech.audio.uint8Array.length < 1000) {
    throw new Error(`TTS audio too small: ${speech.audio?.uint8Array?.length || 0} bytes`);
  }

  console.log(`TTS working (${speech.audio.uint8Array.length} bytes)`);
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
