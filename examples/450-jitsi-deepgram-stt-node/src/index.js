'use strict';

require('dotenv').config();

const path = require('path');
const express = require('express');
const expressWs = require('express-ws');
const { DeepgramClient } = require('@deepgram/sdk');

const PORT = process.env.PORT || 3000;
const JITSI_DOMAIN = process.env.JITSI_DOMAIN || 'meet.jit.si';
const JITSI_ROOM = process.env.JITSI_ROOM || 'deepgram-transcription-demo';
const JAAS_APP_ID = process.env.JAAS_APP_ID || '';

// Browser client sends 16-bit linear PCM at 16 kHz mono via the
// AudioWorklet.  These settings match that encoding so Deepgram
// decodes the stream correctly.
const DEEPGRAM_LIVE_OPTIONS = {
  model: 'nova-3',
  encoding: 'linear16',
  sample_rate: 16000,
  channels: 1,
  smart_format: true,
  interim_results: true,
  utterance_end_ms: 1000,
  tag: 'deepgram-examples',
};

function createApp() {
  const app = express();
  expressWs(app);

  if (!process.env.DEEPGRAM_API_KEY) {
    console.error('Error: DEEPGRAM_API_KEY environment variable is not set.');
    console.error('Copy .env.example to .env and add your API key.');
    process.exit(1);
  }

  const deepgram = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  app.use(express.static(path.join(__dirname, 'public')));

  // Provide Jitsi config to the browser client so it can join the
  // correct room without duplicating env values in HTML.
  app.get('/config', (_req, res) => {
    res.json({
      jitsiDomain: JAAS_APP_ID ? '8x8.vc' : JITSI_DOMAIN,
      roomName: JAAS_APP_ID ? `${JAAS_APP_ID}/${JITSI_ROOM}` : JITSI_ROOM,
    });
  });

  // Each browser client opens a WebSocket here and streams raw PCM
  // audio captured from the Jitsi conference via the Web Audio API.
  // The server opens a parallel Deepgram live connection and proxies
  // transcripts back to the browser over the same WebSocket.
  app.ws('/transcribe', (clientWs) => {
    let dgConnection = null;
    let dgReady = false;
    const mediaQueue = [];

    console.log('[ws] Browser client connected');

    clientWs.on('message', (raw) => {
      if (Buffer.isBuffer(raw) && raw.length > 0) {
        if (dgReady && dgConnection) {
          try { dgConnection.sendMedia(raw); } catch {}
        } else {
          mediaQueue.push(raw);
        }
      }
    });

    clientWs.on('close', () => {
      console.log('[ws] Browser client disconnected');
      if (dgConnection) {
        try { dgConnection.sendCloseStream({ type: 'CloseStream' }); } catch {}
        try { dgConnection.close(); } catch {}
        dgConnection = null;
      }
    });

    clientWs.on('error', (err) => {
      console.error('[ws] Client error:', err.message);
      if (dgConnection) {
        try { dgConnection.close(); } catch {}
        dgConnection = null;
      }
    });

    (async () => {
      dgConnection = await deepgram.listen.v1.connect(DEEPGRAM_LIVE_OPTIONS);

      dgConnection.on('open', () => {
        console.log('[deepgram] Connection opened');
        dgReady = true;
        for (const buf of mediaQueue) {
          try { dgConnection.sendMedia(buf); } catch {}
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
      });

      dgConnection.on('message', (data) => {
        const transcript = data?.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          const tag = data.is_final ? 'final' : 'interim';
          console.log(`[${tag}] ${transcript}`);

          // Relay transcript back to the browser so it can overlay
          // captions on the Jitsi meeting or display them in a panel.
          if (clientWs.readyState === clientWs.OPEN) {
            clientWs.send(JSON.stringify({
              type: tag,
              transcript,
              words: data.channel.alternatives[0].words || [],
            }));
          }
        }
      });

      dgConnection.connect();
      await dgConnection.waitForOpen();
    })().catch((err) => {
      console.error('[deepgram] Setup failed:', err.message);
    });
  });

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'deepgram-jitsi-realtime-transcription' });
  });

  return app;
}

if (require.main === module) {
  const app = createApp();
  app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
    console.log(`  WS   /transcribe — audio stream endpoint`);
    console.log(`  GET  /config     — Jitsi room config`);
    console.log(`  GET  /health     — health check`);
    console.log(`\nOpen http://localhost:${PORT} in your browser to join the Jitsi room.`);
  });
}

module.exports = { createApp };
