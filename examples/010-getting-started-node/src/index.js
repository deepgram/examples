'use strict';

require('dotenv').config();

const { createClient } = require('@deepgram/sdk');

const AUDIO_URL = process.env.AUDIO_URL || 'https://dpgr.am/spacewalk.wav';

async function main() {
  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('Error: DEEPGRAM_API_KEY environment variable is not set.');
    console.error('Copy .env.example to .env and add your API key.');
    process.exit(1);
  }

  const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

  console.log(`Transcribing: ${AUDIO_URL}`);

  const { result, error } = await deepgram.listen.prerecorded.transcribeUrl(
    { url: AUDIO_URL },
    {
      model: 'nova-2',
      smart_format: true,
      diarize: true,
    }
  );

  if (error) {
    console.error('Deepgram error:', error.message);
    process.exit(1);
  }

  const channel = result.results.channels[0];
  const alternative = channel.alternatives[0];

  console.log('\n── Transcript ──────────────────────────────────');
  console.log(alternative.transcript);

  if (alternative.words?.length > 0) {
    const duration = alternative.words.at(-1).end;
    console.log(`\n── Metadata ────────────────────────────────────`);
    console.log(`Duration: ${duration.toFixed(1)}s`);
    console.log(`Words: ${alternative.words.length}`);
    console.log(`Confidence: ${(alternative.confidence * 100).toFixed(1)}%`);
    console.log(`Model: ${result.metadata.model_info?.name || 'nova-2'}`);
  }
}

main();
