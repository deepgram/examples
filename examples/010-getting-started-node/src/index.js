'use strict';

// Load env vars from .env if present — safe to call even in production
// (dotenv only loads vars that aren't already set, so real env vars win)
require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

// Allow overriding the audio URL via env so this script is reusable.
// The default is a NASA spacewalk recording Deepgram uses in their docs —
// it's a good test because it has clear speech, multiple speakers, and
// domain-specific vocabulary (a stress test for accuracy).
const AUDIO_URL = process.env.AUDIO_URL || 'https://dpgr.am/spacewalk.wav';

async function main() {
  if (!process.env.DEEPGRAM_API_KEY) {
    // Fail fast with a clear message rather than a confusing SDK error.
    // The SDK will throw something like "401 Unauthorized" which is less
    // helpful than telling the developer exactly what's missing.
    console.error('Error: DEEPGRAM_API_KEY environment variable is not set.');
    console.error('Copy .env.example to .env and add your API key.');
    process.exit(1);
  }

  // createClient() is the main entry point for the JS SDK.
  // It returns a typed client with methods for every Deepgram product.
  // You can also pass options here: createClient(key, { global: { url: '...' } })
  // to point at a self-hosted or on-prem Deepgram instance.
  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  console.log(`Transcribing: ${AUDIO_URL}`);

  // transcribeUrl() is the simplest way to transcribe pre-recorded audio.
  // Deepgram fetches the URL server-side — no need to download and re-upload.
  // For local files use transcribeFile() instead (accepts a Buffer or stream).
  //
  // The JS SDK returns { result, error } instead of throwing — this is
  // intentional. It lets you handle API errors without try/catch everywhere.
  // Always check `error` before using `result`.
  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: AUDIO_URL },
    {
      // nova-2 is the recommended general-purpose model as of 2024.
      // For phone calls or low-quality audio use 'nova-2-phonecall'.
      // For medical content use 'nova-2-medical'.
      // For video content use 'nova-2-video'.
      model: 'nova-2',

      // smart_format adds punctuation, capitalisation, paragraphs, and
      // formats numbers, dates, and currency. Highly recommended — the
      // raw transcript without it is hard to read.
      smart_format: true,

      // diarize: true labels each word with a speaker number (0, 1, 2...).
      // Useful when multiple people are speaking. Adds ~200ms to response time.
      // Omit if you only have one speaker — it adds noise to the output.
      diarize: true,
    }
  );

  if (error) {
    // Common errors:
    //   "401 Unauthorized"  — bad or expired API key
    //   "400 Bad Request"   — unsupported audio format or URL not reachable
    //   "402 Payment Required" — free tier quota exceeded
    console.error('Deepgram error:', error.message);
    process.exit(1);
  }

  // The response always has at least one channel (stereo audio has two).
  // Each channel has at least one alternative (you can request N-best lists
  // with the `alternatives` option, but 1 is the default).
  const channel = result.results.channels[0];
  const alternative = channel.alternatives[0];

  console.log('\n── Transcript ──────────────────────────────────');
  console.log(alternative.transcript);

  // word-level data is only present when smart_format or diarize is enabled.
  // Each word has: word, start, end, confidence, speaker (if diarized).
  if (alternative.words?.length > 0) {
    // `words.at(-1).end` gives the total duration of the audio in seconds —
    // a quick way to get duration without parsing the media file.
    const duration = alternative.words.at(-1).end;

    console.log('\n── Metadata ────────────────────────────────────');
    console.log(`Duration:    ${duration.toFixed(1)}s`);
    console.log(`Words:       ${alternative.words.length}`);
    // Confidence is 0–1. Anything above 0.9 is excellent; below 0.7 suggests
    // poor audio quality, a rare accent, or heavy domain jargon.
    console.log(`Confidence:  ${(alternative.confidence * 100).toFixed(1)}%`);
    console.log(`Model:       ${result.metadata.model_info?.name || 'nova-2'}`);
  }
}

main();
