'use strict';

const fs = require('fs');
const path = require('path');

// ── Credential check — MUST be first ──────────────────────────────────────
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
// ──────────────────────────────────────────────────────────────────────────

const { deepgram } = require('@ai-sdk/deepgram');
const {
  experimental_transcribe: transcribe,
  experimental_generateSpeech: generateSpeech,
} = require('ai');
const { createClient } = require('@deepgram/sdk');

const KNOWN_AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const EXPECTED_WORDS = ['spacewalk', 'astronaut', 'nasa'];

async function run() {
  // ── Test 1: Pre-recorded transcription via AI SDK ──────────────────────
  // Validates that @ai-sdk/deepgram can transcribe audio through the
  // Vercel AI SDK's unified interface — same pattern used in production.
  console.log('Test 1: Transcription via Vercel AI SDK...');

  const result = await transcribe({
    model: deepgram.transcription('nova-3'),
    audio: new URL(KNOWN_AUDIO_URL),
    providerOptions: {
      deepgram: { smart_format: true },
    },
  });

  if (!result.text || result.text.length < 20) {
    throw new Error(`Transcript too short or empty: "${result.text}"`);
  }

  const lower = result.text.toLowerCase();
  const found = EXPECTED_WORDS.filter(w => lower.includes(w));
  if (found.length === 0) {
    throw new Error(
      `Expected words not found.\nGot: "${result.text.substring(0, 200)}"`
    );
  }

  console.log(`  OK  transcription (${result.text.length} chars, found: ${found.join(', ')})`);

  // ── Test 2: TTS via AI SDK ─────────────────────────────────────────────
  // Validates generateSpeech() with deepgram.speech() — the same call
  // used by the /api/speak route in the Next.js app.
  console.log('Test 2: Text-to-Speech via Vercel AI SDK...');

  const speech = await generateSpeech({
    model: deepgram.speech('aura-2-helena-en'),
    text: 'Hello from the Deepgram Next.js example test suite.',
    providerOptions: {
      deepgram: {
        encoding: 'linear16',
        sample_rate: 24000,
      },
    },
  });

  if (!speech.audio?.uint8Array || speech.audio.uint8Array.length < 1000) {
    throw new Error(`TTS audio too small: ${speech.audio?.uint8Array?.length || 0} bytes`);
  }

  console.log(`  OK  TTS (${speech.audio.uint8Array.length} bytes linear16)`);

  // ── Test 3: Deepgram SDK project access ────────────────────────────────
  // The app's /api/deepgram-key route uses manage.getProjects() +
  // keys.createKey() to mint temporary browser keys.  Verify project
  // access works with the configured API key.
  console.log('Test 3: Deepgram SDK project access (for temp key creation)...');

  const client = createClient(process.env.DEEPGRAM_API_KEY);
  const { result: projectsResult } = await client.manage.getProjects();

  if (!projectsResult.projects || projectsResult.projects.length === 0) {
    throw new Error('No Deepgram projects found — API key may lack manage scope');
  }

  console.log(`  OK  found ${projectsResult.projects.length} project(s)`);
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
