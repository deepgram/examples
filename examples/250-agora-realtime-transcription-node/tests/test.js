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
const TMP_WAV = '/tmp/agora_test.wav';

// ── Test 1: File structure ──────────────────────────────────────────────────
function testFileStructure() {
  const root = path.join(__dirname, '..');
  const requiredFiles = [
    'package.json',
    '.env.example',
    'README.md',
    'src/server.js',
    'src/public/index.html',
  ];

  for (const f of requiredFiles) {
    const full = path.join(root, f);
    if (!fs.existsSync(full)) throw new Error(`Missing required file: ${f}`);
  }
  console.log('File structure check passed');
}

// ── Test 2: Agora token generation ──────────────────────────────────────────
function testAgoraTokenGeneration() {
  const { RtcTokenBuilder, RtcRole } = require('agora-token');

  const token = RtcTokenBuilder.buildTokenWithUid(
    process.env.AGORA_APP_ID,
    process.env.AGORA_APP_CERTIFICATE,
    'test-channel',
    0,
    RtcRole.PUBLISHER,
    3600,
    3600,
  );

  if (!token || typeof token !== 'string' || token.length < 20) {
    throw new Error('Agora token generation returned invalid token');
  }

  console.log(`Agora token generated: ${token.substring(0, 20)}...`);
  console.log('Agora token generation test passed');
}

// ── Test 3: Server module loads and exports createApp ────────────────────────
function testServerModule() {
  const { createApp } = require('../src/server');
  if (typeof createApp !== 'function') {
    throw new Error('server.js does not export createApp function');
  }
  console.log('Server module exports verified');
}

// ── Test 4: Token endpoint returns valid response ───────────────────────────
async function testTokenEndpoint() {
  const { createApp } = require('../src/server');
  const app = createApp();
  const PORT = 3098;
  const server = app.listen(PORT);
  await new Promise(r => server.on('listening', r));

  try {
    const res = await fetch(`http://localhost:${PORT}/api/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channel: 'ci-test', uid: 12345 }),
    });

    if (res.status !== 200) throw new Error(`/api/token returned ${res.status}`);

    const data = await res.json();
    if (!data.token) throw new Error('Response missing token');
    if (!data.appId) throw new Error('Response missing appId');
    if (data.channel !== 'ci-test') throw new Error('Response channel mismatch');
    if (data.uid !== 12345) throw new Error('Response uid mismatch');

    console.log('POST /api/token → valid token response');

    const healthRes = await fetch(`http://localhost:${PORT}/api/health`);
    if (healthRes.status !== 200) throw new Error(`/api/health returned ${healthRes.status}`);
    const healthData = await healthRes.json();
    if (healthData.status !== 'ok') throw new Error('Health check status not ok');

    console.log('GET /api/health → ok');
    console.log('Token endpoint test passed');
  } finally {
    server.close();
  }
}

// ── Test 5: Deepgram live STT with real audio ───────────────────────────────
async function testDeepgramLiveTranscription() {
  const { DeepgramClient } = require('@deepgram/sdk');
  const client = new DeepgramClient({ apiKey: process.env.DEEPGRAM_API_KEY });

  console.log('Downloading test audio...');
  execSync(`curl -s -L -o "${TMP_WAV}" "${AUDIO_URL}"`, { stdio: 'pipe' });

  const wavBuffer = fs.readFileSync(TMP_WAV);

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

  const connection = client.listen.v1.live({
    model: 'nova-3',
    encoding: 'linear16',
    sample_rate: 16000,
    channels: 1,
    smart_format: true,
    interim_results: true,
    utterance_end_ms: 1500,
    punctuate: true,
    diarize: true,
    tag: 'deepgram-examples',
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

      const CHUNK_BYTES = 640;
      const MAX_BYTES = 16000 * 2 * 5;
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

// ── Main ──────────────────────────────────────────────────────────────────────
async function run() {
  testFileStructure();
  testServerModule();
  testAgoraTokenGeneration();
  await testTokenEndpoint();
  await testDeepgramLiveTranscription();
}

run()
  .then(() => { console.log('\nAll tests passed'); process.exit(0); })
  .catch(err => { console.error(`\nTest failed: ${err.message}`); process.exit(1); });
