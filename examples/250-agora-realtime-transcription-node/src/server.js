'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const express = require('express');
const expressWs = require('express-ws');
const path = require('path');
const { DeepgramClient } = require('@deepgram/sdk');
const { RtcTokenBuilder, RtcRole } = require('agora-token');

const PORT = process.env.PORT || 3000;

// Agora delivers audio as linear16 PCM at 16 kHz when captured via the
// Web SDK's MediaStreamTrack.  The browser client converts float32 samples
// from the AudioContext into signed 16-bit integers before sending them
// over the WebSocket — matching Deepgram's preferred live-streaming format.
const DEEPGRAM_LIVE_OPTIONS = {
  model: 'nova-3',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  smart_format: true,
  interim_results: true,
  utterance_end_ms: 1500,
  punctuate: true,
  diarize: true, // ← THIS enables speaker labels for multi-participant channels
  tag: 'deepgram-examples',
};

function createApp() {
  const app = express();
  expressWs(app);
  app.use(express.json());

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('Error: DEEPGRAM_API_KEY environment variable is not set.');
    console.error('Copy .env.example to .env and add your API key.');
    process.exit(1);
  }
  if (!process.env.AGORA_APP_ID) {
    console.error('Error: AGORA_APP_ID environment variable is not set.');
    console.error('Copy .env.example to .env and add your Agora App ID.');
    process.exit(1);
  }
  if (!process.env.AGORA_APP_CERTIFICATE) {
    console.error('Error: AGORA_APP_CERTIFICATE environment variable is not set.');
    console.error('Copy .env.example to .env and add your Agora App Certificate.');
    process.exit(1);
  }

  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  app.use(express.static(path.join(__dirname, 'public')));

  // Generate a short-lived Agora RTC token for the browser client.
  // The token is scoped to a specific channel and uid so the browser
  // can join without exposing the App Certificate.
  app.post('/api/token', (req, res) => {
    const { channel, uid } = req.body || {};
    if (!channel) {
      return res.status(400).json({ error: 'channel is required' });
    }

    const numericUid = uid ? Number(uid) : 0;
    const TOKEN_EXPIRE_SECS = 3600;
    const PRIVILEGE_EXPIRE_SECS = 3600;

    // RtcRole.PUBLISHER lets the user send and receive audio/video.
    const token = RtcTokenBuilder.buildTokenWithUid(
      process.env.AGORA_APP_ID,
      process.env.AGORA_APP_CERTIFICATE,
      channel,
      numericUid,
      RtcRole.PUBLISHER,
      TOKEN_EXPIRE_SECS,
      PRIVILEGE_EXPIRE_SECS,
    );

    res.json({ token, appId: process.env.AGORA_APP_ID, channel, uid: numericUid });
    console.log(`[token] Generated for channel="${channel}" uid=${numericUid}`);
  });

  // WebSocket endpoint: browser streams PCM audio here, server forwards to Deepgram.
  // This keeps the Deepgram API key server-side while the browser handles the
  // Agora RTC connection and audio capture.
  app.ws('/transcribe', (clientWs) => {
    let dgConnection = null;
    let dgReady = false;
    const mediaQueue = [];

    console.log('[ws] Client connected for transcription');

    clientWs.on('message', (raw) => {
      if (typeof raw !== 'string' && Buffer.isBuffer(raw)) {
        if (dgReady && dgConnection) {
          try { dgConnection.send(raw); } catch {}
        } else {
          mediaQueue.push(raw);
        }
        return;
      }

      try {
        const msg = JSON.parse(raw);
        if (msg.type === 'stop') {
          console.log('[ws] Client requested stop');
          if (dgConnection) {
            try { dgConnection.finish(); } catch {}
          }
        }
      } catch {}
    });

    clientWs.on('close', () => {
      console.log('[ws] Client disconnected');
      if (dgConnection) {
        try { dgConnection.finish(); } catch {}
        dgConnection = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
      if (dgConnection) {
        try { dgConnection.finish(); } catch {}
        dgConnection = null;
      }
    });

    (async () => {
      dgConnection = deepgram.listen.v1.live(DEEPGRAM_LIVE_OPTIONS);

      dgConnection.on('open', () => {
        console.log('[deepgram] Connection opened');
        dgReady = true;
        for (const buf of mediaQueue) {
          try { dgConnection.send(buf); } catch {}
        }
        mediaQueue.length = 0;
      });

      dgConnection.on('error', (err) => {
        console.error('[deepgram] Error:', err.message);
        dgReady = false;
      });

      dgConnection.on('close', () => {
        console.log('[deepgram] Connection closed');
        dgReady = false;
        dgConnection = null;
      });

      // data.channel.alternatives[0].transcript holds the transcribed text.
      // data.is_final distinguishes stable results from interim (partial) ones.
      dgConnection.on('message', (data) => {
        try {
          const msg = typeof data === 'string' ? JSON.parse(data) : data;
          const alt = msg?.channel?.alternatives?.[0];
          if (alt?.transcript) {
            const payload = {
              transcript: alt.transcript,
              is_final: msg.is_final,
              speaker: alt.words?.[0]?.speaker ?? null,
              confidence: alt.confidence,
            };

            if (clientWs.readyState === 1) {
              clientWs.send(JSON.stringify(payload));
            }

            const tag = msg.is_final ? 'final' : 'interim';
            const spk = payload.speaker !== null ? ` [speaker ${payload.speaker}]` : '';
            console.log(`[${tag}]${spk} ${alt.transcript}`);
          }
        } catch {}
      });
    })().catch((err) => {
      console.error('[deepgram] Setup failed:', err.message);
    });
  });

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'deepgram-agora-realtime-transcription' });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`  GET  /            — Client UI`);
    console.log(`  POST /api/token   — Generate Agora RTC token`);
    console.log(`  WS   /transcribe  — Audio→Deepgram WebSocket`);
    console.log(`  GET  /api/health  — Health check`);
  });
}

module.exports = { createApp };
