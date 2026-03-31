'use strict';

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// ── Credential check — MUST be first ──────────────────────────────────────
const required = fs.readFileSync(path.join(__dirname, '..', '.env.example'), 'utf8')
  .split('\n').filter(l => /^[A-Z][A-Z0-9_]+=/.test(l.trim())).map(l => l.split('=')[0].trim());
const missing = required.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`MISSING_CREDENTIALS: ${missing.join(',')}`);
  process.exit(2);
}
// ──────────────────────────────────────────────────────────────────────────

const AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const TMP_WAV = '/tmp/electron_test.wav';

// ── Test 1: Deepgram SDK connects and transcribes pre-recorded audio ──────
// Electron-specific UI testing requires a display server, so we verify the
// Deepgram integration directly: connect via live WebSocket, send real audio,
// and assert that transcript text comes back.
async function testDeepgramLiveTranscription() {
  const { DeepgramClient } = require('@deepgram/sdk');
  const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  console.log('Downloading test audio...');
  execSync(`curl -s -L -o "${TMP_WAV}" "${AUDIO_URL}"`, { stdio: 'pipe' });

  const wavBuffer = fs.readFileSync(TMP_WAV);

  // Parse WAV header to find the data chunk
  let offset = 12;
  let dataStart = 0;
  let dataSize = 0;
  let sampleRate = 0;
  let bitsPerSample = 0;
  let numChannels = 0;
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

  // Resample to 16 kHz mono linear16 (matching Electron app config)
  const bytesPerSample = bitsPerSample / 8;
  const totalSamples = Math.floor(dataSize / (bytesPerSample * numChannels));
  const ratio = sampleRate / 16000;
  const outLen = Math.floor(totalSamples / ratio);
  const pcm16 = Buffer.alloc(outLen * 2);

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
    pcm16.writeInt16LE(sample, i * 2);
  }

  console.log(`Audio ready: ${pcm16.length} bytes of linear16 16 kHz`);

  // Connect to Deepgram live STT
  const connection = client.listen.v1.live({
    model: 'nova-3',
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1500,
    punctuate: true,
  });

  const transcripts = [];

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timed out (30s) waiting for Deepgram transcript.'));
    }, 30_000);

    connection.on('error', (err) => {
      clearTimeout(timeout);
      reject(new Error(`Deepgram connection error: ${err.message}`));
    });

    connection.on('message', (data) => {
      try {
        const msg = typeof data === 'string' ? JSON.parse(data) : data;
        const transcript = msg?.channel?.alternatives?.[0]?.transcript;
        if (transcript) {
          const tag = msg.is_final ? 'final' : 'interim';
          console.log(`[${tag}] ${transcript}`);
          transcripts.push(transcript);
        }
      } catch {}
    });

    connection.on('open', () => {
      console.log('[deepgram] Connected — streaming audio...');

      // Stream 5 seconds of audio in real-time-paced chunks
      const CHUNK_BYTES = 640; // 20ms at 16kHz * 2 bytes
      const MAX_BYTES = 16000 * 2 * 5; // 5 seconds
      let pos = 0;

      const sendChunk = () => {
        if (pos >= pcm16.length || pos >= MAX_BYTES) {
          console.log('[deepgram] Audio sent — waiting for final results...');
          try { connection.finish(); } catch {}
          return;
        }
        connection.send(pcm16.subarray(pos, pos + CHUNK_BYTES));
        pos += CHUNK_BYTES;
        setTimeout(sendChunk, 20);
      };

      sendChunk();
    });

    connection.on('close', () => {
      clearTimeout(timeout);
      setTimeout(() => {
        if (transcripts.length === 0) {
          reject(new Error('No transcripts received from Deepgram.'));
          return;
        }

        const combined = transcripts.join(' ').toLowerCase();
        const expectedWords = ['spacewalk', 'astronaut', 'nasa'];
        const found = expectedWords.filter(w => combined.includes(w));

        if (found.length === 0) {
          reject(new Error(
            `Transcripts arrived but no expected words found.\nGot: ${transcripts.slice(0, 3).join(' | ')}`
          ));
          return;
        }

        console.log(`\nTranscript content verified (found: ${found.join(', ')})`);
        resolve(transcripts);
      }, 1000);
    });
  });
}

// ── Test 2: File structure check ────────────────────────────────────────────
function testFileStructure() {
  const root = path.join(__dirname, '..');
  const requiredFiles = [
    'package.json',
    '.env.example',
    'README.md',
    'src/main.js',
    'src/preload.js',
    'src/renderer.js',
    'src/index.html',
  ];

  for (const f of requiredFiles) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) throw new Error(`Missing required file: ${f}`);
  }
  console.log('File structure check passed');
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  testFileStructure();
  await testDeepgramLiveTranscription();
}

run()
  .then(() => { console.log('\nAll tests passed'); process.exit(0); })
  .catch(err => { console.error(`\nTest failed: ${err.message}`); process.exit(1); });
