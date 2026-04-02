'use strict';

const fs = require('fs');
const path = require('path');

// ── Credential check ─────────────────────────────────────────────────────────
// Exit code convention across all examples in this repo:
//   0 = all tests passed
//   1 = real test failure (code bug, assertion error, unexpected API response)
//   2 = missing credentials (expected in CI until secrets are configured)
//
// Note: SLACK_BOT_TOKEN and SLACK_APP_TOKEN are listed in .env.example because
// they are needed to run the bot, but we only need DEEPGRAM_API_KEY to exercise
// the core transcription logic tested here.
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
// This exercises the bot's core logic without needing a Slack workspace connection.
const { transcribeAudio } = require('../src/bot.js');

// spacewalk.wav is ~33 seconds of clear speech.
// At >= 2 chars/second the transcript should be at least 66 characters.
const AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const AUDIO_DURATION_SECONDS = 33;
const MIN_CHARS = AUDIO_DURATION_SECONDS * 2;

async function run() {
  console.log('Testing transcribeAudio() from src/bot.js...');
  console.log(`Audio: ${AUDIO_URL}`);

  // Call the exported function — exercises the src/ download + transcription path.
  const transcript = await transcribeAudio(AUDIO_URL, process.env.DEEPGRAM_API_KEY);

  if (!transcript || transcript.length < MIN_CHARS) {
    throw new Error(
      `Transcript too short (got ${transcript?.length ?? 0} chars, want >= ${MIN_CHARS}): "${transcript}"`
    );
  }

  console.log(`✓ transcribeAudio() returned a transcript (${transcript.length} chars)`);
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
