import { DeepgramClient } from '@deepgram/sdk';

// REST endpoint — accepts { text } and returns Deepgram TTS audio as linear16 PCM.
// The Vue client plays the returned audio via the Web Audio API.
export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig();
  if (!config.deepgramApiKey) {
    throw createError({ statusCode: 500, statusMessage: 'DEEPGRAM_API_KEY not configured' });
  }

  const body = await readBody<{ text?: string }>(event);
  if (!body?.text?.trim()) {
    throw createError({ statusCode: 400, statusMessage: 'Missing "text" in request body' });
  }

  const deepgram = new DeepgramClient({ apiKey: config.deepgramApiKey });

  // speak.v1.audio.generate returns a BinaryResponse with raw audio bytes
  const response = await deepgram.speak.v1.audio.generate({
    text: body.text,
    model: 'aura-2-thalia-en',
    encoding: 'linear16',
    sample_rate: 24000,
    tag: 'deepgram-examples',
  });

  const audioBuffer = await response.getBody();

  setResponseHeaders(event, {
    'Content-Type': 'application/octet-stream',
    'X-Audio-Encoding': 'linear16',
    'X-Audio-Sample-Rate': '24000',
  });

  return audioBuffer;
});
