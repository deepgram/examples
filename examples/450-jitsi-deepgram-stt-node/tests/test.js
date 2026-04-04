'use strict';

const fs = require('fs');
const http = require('http');
const { execSync } = require('child_process');
const WebSocket = require('ws');

// ── Credential check — MUST be first ──────────────────────────────────────
const required = ['DEEPGRAM_API_KEY'];
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────────

const { createApp } = require('../src/index.js');

const PORT = 3098;
const AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const TMP_WAV = '/tmp/jitsi_test.wav';
const CHUNK_SIZE = 640;

function wavToLinear16at16k(wavBuffer) {
  let offset = 12;
  let sampleRate = 0, bitsPerSample = 0, numChannels = 0, dataStart = 0, dataSize = 0;
  while (offset < wavBuffer.length - 8) {
    const chunkId = wavBuffer.toString('ascii', offset, offset + 4);
    const chunkSize = wavBuffer.readUInt32LE(offset + 4);
    if (chunkId === 'fmt ') {
      numChannels = wavBuffer.readUInt16LE(offset + 10);
      sampleRate = wavBuffer.readUInt32LE(offset + 12);
      bitsPerSample = wavBuffer.readUInt16LE(offset + 22);
    } else if (chunkId === 'data') {
      dataStart = offset + 8;
      dataSize = chunkSize;
      break;
    }
    offset += 8 + chunkSize;
  }
  if (!dataStart) throw new Error('Invalid WAV: no data chunk');

  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
  const ratio = sampleRate / 16000;
  const outLen = Math.floor(totalSamples / ratio);
  const out = Buffer.alloc(outLen * 2);

  for (let i = 0; i < outLen; i++) {
    const srcIdx = Math.floor(i * ratio);
    const byteOff = dataStart + srcIdx * bytesPerSample * numChannels;
    let sample;
    if (bitsPerSample === 16) {
      sample = wavBuffer.readInt16LE(byteOff);
    } else if (bitsPerSample === 24) {
      sample = (wavBuffer[byteOff] | (wavBuffer[byteOff + 1] << 8) | (wavBuffer[byteOff + 2] << 16));
      if (sample & 0x800000) sample |= ~0xFFFFFF;
      sample = sample >> 8;
    } else if (bitsPerSample === 32) {
      sample = wavBuffer.readInt32LE(byteOff) >> 16;
    } else {
      sample = (wavBuffer[byteOff] - 128) << 8;
    }
    out.writeInt16LE(sample, i * 2);
  }
  return out;
}

function prepareAudio() {
  console.log('Downloading test audio...');
  execSync(`curl -s -L -o "${TMP_WAV}" "${AUDIO_URL}"`, { stdio: 'pipe' });

  console.log('Converting to linear16 16 kHz mono...');
  const wavData = fs.readFileSync(TMP_WAV);
  const audio = wavToLinear16at16k(wavData);
  console.log(`Audio ready: ${audio.length} bytes of linear16 16 kHz`);
  return audio;
}

function testHealthEndpoint(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/health`, (res) => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`/health returned ${res.statusCode}`));
        const data = JSON.parse(body);
        if (data.status !== 'ok') return reject(new Error(`Health check status: ${data.status}`));
        if (data.service !== 'deepgram-jitsi-realtime-transcription')
          return reject(new Error(`Unexpected service name: ${data.service}`));
        console.log('GET /health -> OK');
        resolve();
      });
    }).on('error', reject);
  });
}

function testConfigEndpoint(port) {
  return new Promise((resolve, reject) => {
    http.get(`http://localhost:${port}/config`, (res) => {
      let body = '';
      res.on('data', c => (body += c));
      res.on('end', () => {
        if (res.statusCode !== 200) return reject(new Error(`/config returned ${res.statusCode}`));
        const data = JSON.parse(body);
        if (!data.jitsiDomain) return reject(new Error('Missing jitsiDomain in /config'));
        if (!data.roomName) return reject(new Error('Missing roomName in /config'));
        console.log(`GET /config -> domain=${data.jitsiDomain}, room=${data.roomName}`);
        resolve();
      });
    }).on('error', reject);
  });
}

function testTranscribeWebSocket(port, audioData) {
  return new Promise((resolve, reject) => {
    const transcripts = [];
    let settled = false;

    const timeout = setTimeout(() => {
      if (!settled) {
        settled = true;
        reject(new Error(
          'Timed out (30s) waiting for Deepgram transcript.\n' +
          'Check DEEPGRAM_API_KEY and connectivity to api.deepgram.com.',
        ));
      }
    }, 30_000);

    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (transcripts.length === 0) {
        reject(new Error(
          'No transcripts received from Deepgram after streaming audio.\n' +
          'This may indicate a Deepgram connection issue or audio encoding problem.',
        ));
      } else {
        resolve(transcripts);
      }
    };

    const ws = new WebSocket(`ws://localhost:${port}/transcribe`);

    ws.on('error', (err) => {
      if (!settled) { settled = true; clearTimeout(timeout); reject(err); }
    });

    ws.on('message', (raw) => {
      const msg = JSON.parse(raw);
      if (msg.transcript) {
        transcripts.push(msg);
      }
    });

    ws.on('open', () => {
      let offset = 0;
      const MAX_BYTES = 16000 * 2 * 10;

      const sendChunk = () => {
        if (ws.readyState !== WebSocket.OPEN) return;

        if (offset >= audioData.length || offset >= MAX_BYTES) {
          setTimeout(() => {
            try { ws.close(); } catch {}
            setTimeout(settle, 2000);
          }, 500);
          return;
        }

        ws.send(audioData.subarray(offset, offset + CHUNK_SIZE));
        offset += CHUNK_SIZE;
        setTimeout(sendChunk, 20);
      };

      setTimeout(sendChunk, 500);
    });

    ws.on('close', () => {
      setTimeout(settle, 2000);
    });
  });
}

async function run() {
  const audioData = prepareAudio();

  const app = createApp();
  const server = app.listen(PORT);
  await new Promise(r => server.on('listening', r));
  console.log(`\nServer started on :${PORT}`);

  try {
    await testHealthEndpoint(PORT);
    await testConfigEndpoint(PORT);

    console.log('\nStreaming audio through /transcribe -> Deepgram (up to 30s)...');
    const transcripts = await testTranscribeWebSocket(PORT, audioData);

    console.log(`\nReceived ${transcripts.length} transcript event(s)`);
    console.log(`  First: [${transcripts[0].type}] ${transcripts[0].transcript}`);

    const combined = transcripts.map(t => t.transcript).join(' ');
    const audioSentSecs = Math.min(audioData.length, 16000 * 2 * 10) / (16000 * 2);
    const minChars = Math.max(5, audioSentSecs * 2);
    if (combined.length < minChars) {
      throw new Error(
        `Transcript too short: ${combined.length} chars for ${audioSentSecs}s of audio`,
      );
    }
    console.log(`Transcript length verified: ${combined.length} chars for ${audioSentSecs}s audio`);

    const finals = transcripts.filter(t => t.type === 'final');
    if (finals.length === 0) {
      throw new Error('Expected at least one final transcript');
    }
    console.log(`Final transcripts: ${finals.length}`);

    const withWords = finals.filter(t => t.words && t.words.length > 0);
    if (withWords.length > 0) {
      console.log(`Transcripts with word-level timing: ${withWords.length}`);
    }

  } finally {
    server.close();
  }
}

run()
  .then(() => { console.log('\nAll tests passed'); process.exit(0); })
  .catch(err => { console.error(`\nTest failed: ${err.message}`); process.exit(1); });
