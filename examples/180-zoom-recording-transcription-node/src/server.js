'use strict';

require('dotenv').config();

const crypto = require('crypto');
const express = require('express');
const { DeepgramClient } = require('@deepgram/sdk');

const PORT = process.env.PORT || 3000;

const REQUIRED_ENV = [
  'DEEPGRAM_API_KEY',
  'ZOOM_ACCOUNT_ID',
  'ZOOM_CLIENT_ID',
  'ZOOM_CLIENT_SECRET',
  'ZOOM_WEBHOOK_SECRET_TOKEN',
];

for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`Error: ${key} environment variable is not set.`);
    console.error('Copy .env.example to .env and add your credentials.');
    process.exit(1);
  }
}

// SDK v5: constructor takes an options object, not a bare string.
const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

const app = express();
app.use(express.json());

// ── Zoom webhook endpoint ────────────────────────────────────────────────────
// Zoom sends two event types here:
//   1. endpoint.url_validation — a challenge/response handshake when you first
//      register the webhook URL in the Zoom Marketplace.
//   2. recording.completed — fired when a cloud recording finishes processing.
app.post('/webhook', async (req, res) => {
  const { event, payload } = req.body;

  // ← THIS handles Zoom's webhook URL validation handshake.
  // Zoom POSTs a plainToken that must be hashed with your secret and returned.
  if (event === 'endpoint.url_validation') {
    const hashForValidation = crypto
      .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
      .update(req.body.payload.plainToken)
      .digest('hex');

    return res.json({
      plainToken: req.body.payload.plainToken,
      encryptedToken: hashForValidation,
    });
  }

  // Verify webhook signature to ensure the request came from Zoom.
  const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`;
  const expectedSig = `v0=${crypto
    .createHmac('sha256', process.env.ZOOM_WEBHOOK_SECRET_TOKEN)
    .update(message)
    .digest('hex')}`;

  if (req.headers['x-zm-signature'] !== expectedSig) {
    console.error('Invalid webhook signature — rejecting request');
    return res.status(401).json({ error: 'Invalid signature' });
  }

  if (event !== 'recording.completed') {
    return res.json({ status: 'ignored', event });
  }

  res.json({ status: 'processing' });

  try {
    await handleRecordingCompleted(payload);
  } catch (err) {
    console.error('Error processing recording:', err.message);
  }
});

// ── Zoom OAuth ───────────────────────────────────────────────────────────────
// Server-to-Server OAuth uses client_credentials grant with account_id.
// Token is short-lived (1 hour) — fetch a fresh one each time for simplicity.
async function getZoomAccessToken() {
  const credentials = Buffer.from(
    `${process.env.ZOOM_CLIENT_ID}:${process.env.ZOOM_CLIENT_SECRET}`
  ).toString('base64');

  const resp = await fetch(
    `https://zoom.us/oauth/token?grant_type=account_credentials&account_id=${process.env.ZOOM_ACCOUNT_ID}`,
    {
      method: 'POST',
      headers: { Authorization: `Basic ${credentials}` },
    }
  );

  if (!resp.ok) {
    throw new Error(`Zoom OAuth failed: ${resp.status} ${await resp.text()}`);
  }

  const data = await resp.json();
  return data.access_token;
}

// ── Recording handler ────────────────────────────────────────────────────────
async function handleRecordingCompleted(payload) {
  const { object } = payload;
  const meetingTopic = object.topic || 'Untitled Meeting';

  // Prefer audio_only files — smaller and faster to transcribe than video.
  const audioFile = object.recording_files.find(
    (f) => f.recording_type === 'audio_only'
  ) || object.recording_files[0];

  if (!audioFile) {
    console.log('No recording files found in payload');
    return;
  }

  console.log(`\nProcessing: "${meetingTopic}"`);
  console.log(`Recording type: ${audioFile.recording_type}, format: ${audioFile.file_extension}`);

  const accessToken = await getZoomAccessToken();

  // Zoom download URLs require an OAuth token.
  // Download the file as a buffer so we can send it to Deepgram.
  const downloadUrl = `${audioFile.download_url}?access_token=${accessToken}`;
  const downloadResp = await fetch(downloadUrl);

  if (!downloadResp.ok) {
    throw new Error(`Failed to download recording: ${downloadResp.status}`);
  }

  const audioBuffer = Buffer.from(await downloadResp.arrayBuffer());
  console.log(`Downloaded ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB`);

  // SDK v5: transcribeFile takes (buffer, options) — the buffer is the first arg.
  // SDK v5: all options are flat in a single object.
  // SDK v5: throws on error — use try/catch, not { result, error } destructuring.
  const data = await deepgram.listen.v1.media.transcribeFile(audioBuffer, {
    model: 'nova-3',
    smart_format: true,
    // ← THIS enables speaker labels — essential for multi-speaker meetings.
    diarize: true,
    // ← THIS enables paragraph detection for readable output.
    paragraphs: true,
  });

  // data.results.channels[0].alternatives[0].transcript
  const transcript = data.results.channels[0].alternatives[0].transcript;
  const paragraphs = data.results.channels[0].alternatives[0].paragraphs;

  console.log(`\n── Transcript: "${meetingTopic}" ──`);
  console.log(transcript);

  if (paragraphs?.paragraphs) {
    console.log(`\n── Paragraphs: ${paragraphs.paragraphs.length} ──`);
  }

  const words = data.results.channels[0].alternatives[0].words;
  if (words?.length > 0) {
    const duration = words.at(-1).end;
    console.log(`\nDuration: ${(duration / 60).toFixed(1)} min | Words: ${words.length}`);
  }

  return { meetingTopic, transcript };
}

app.get('/health', (_req, res) => res.json({ status: 'ok' }));

app.listen(PORT, () => {
  console.log(`Zoom recording transcription server running on port ${PORT}`);
  console.log(`Webhook endpoint: POST http://localhost:${PORT}/webhook`);
  console.log(`Health check:     GET  http://localhost:${PORT}/health`);
});

module.exports = { app, getZoomAccessToken, handleRecordingCompleted };
