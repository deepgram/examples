'use strict';

const fs = require('fs');
const path = require('path');
const http = require('http');
const { execSync } = require('child_process');
const WebSocket = require('ws');

// ── Credential check — MUST be first ──────────────────────────────────────
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
// ──────────────────────────────────────────────────────────────────────────

const { createApp, handleFunctionCall, AGENT_SETTINGS, DG_AGENT_URL } = require('../src/index.js');

const PORT = 3098;
const AUDIO_URL = 'https://dpgr.am/spacewalk.wav';
const TMP_WAV = '/tmp/agent_test.wav';
const CHUNK_SIZE = 320;

const LINEAR_TO_ULAW = (() => {
  const BIAS = 0x84;
  const CLIP = 32635;
  const table = new Int8Array(65536);
  for (let i = -32768; i < 32768; i++) {
    let sample = i < 0 ? ~i : i;
    if (sample > CLIP) sample = CLIP;
    sample += BIAS;
    let exponent = 7;
    for (let expMask = 0x4000; (sample & expMask) === 0 && exponent > 0; exponent--, expMask >>= 1);
    const mantissa = (sample >> (exponent + 3)) & 0x0F;
    let ulawByte = ~(((i < 0 ? 0x80 : 0) | (exponent << 4) | mantissa)) & 0xFF;
    table[i & 0xFFFF] = ulawByte;
  }
  return table;
})();

function wavToMulaw8k(wavBuffer) {
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
  const ratio = sampleRate / 8000;
  const outLen = Math.floor(totalSamples / ratio);
  const out = Buffer.alloc(outLen);

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
    out[i] = LINEAR_TO_ULAW[sample & 0xFFFF];
  }
  return out;
}

function prepareMulawAudio() {
  console.log('Downloading test audio...');
  execSync(`curl -s -L -o "${TMP_WAV}" "${AUDIO_URL}"`, { stdio: 'pipe' });
  console.log('Converting to mulaw 8 kHz mono...');
  const wavData = fs.readFileSync(TMP_WAV);
  const audio = wavToMulaw8k(wavData);
  console.log(`Audio ready: ${audio.length} bytes of mulaw 8 kHz`);
  return audio;
}

// ── Test 1: TwiML endpoint ────────────────────────────────────────────────
function testTwimlEndpoint(port) {
  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        hostname: 'localhost', port, path: '/voice', method: 'POST',
        headers: { host: `localhost:${port}`, 'content-type': 'application/x-www-form-urlencoded' },
      },
      (res) => {
        let body = '';
        res.on('data', c => (body += c));
        res.on('end', () => {
          if (res.statusCode !== 200) return reject(new Error(`/voice returned ${res.statusCode}`));
          if (!body.includes('<Stream'))
            return reject(new Error(`TwiML missing <Stream> element:\n${body}`));
          if (!body.includes(`localhost:${port}/media`))
            return reject(new Error(`TwiML <Stream> URL should point to /media:\n${body}`));
          console.log('PASS: POST /voice returns TwiML with correct <Stream>');
          resolve();
        });
      },
    );
    req.on('error', reject);
    req.end();
  });
}

// ── Test 2: Function call handler ─────────────────────────────────────────
function testFunctionCallHandler() {
  const result = JSON.parse(handleFunctionCall('check_order_status', { order_number: '999' }));
  if (result.order_number !== '999') throw new Error('Function did not return correct order_number');
  if (!result.status) throw new Error('Function did not return a status');
  console.log('PASS: check_order_status function returns expected shape');
}

// ── Test 3: Agent Settings shape ──────────────────────────────────────────
function testSettingsShape() {
  if (AGENT_SETTINGS.type !== 'Settings') throw new Error('Settings type incorrect');
  if (!AGENT_SETTINGS.audio?.input?.encoding) throw new Error('Missing audio.input.encoding');
  if (!AGENT_SETTINGS.audio?.output?.encoding) throw new Error('Missing audio.output.encoding');
  if (!AGENT_SETTINGS.agent?.listen?.provider) throw new Error('Missing agent.listen.provider');
  if (!AGENT_SETTINGS.agent?.think?.provider) throw new Error('Missing agent.think.provider');
  if (!AGENT_SETTINGS.agent?.think?.functions?.length) throw new Error('Missing agent.think.functions');
  if (!AGENT_SETTINGS.agent?.speak?.provider) throw new Error('Missing agent.speak.provider');
  if (!AGENT_SETTINGS.agent?.greeting) throw new Error('Missing agent.greeting');
  console.log('PASS: AGENT_SETTINGS has all required fields');
}

// ── Test 4: Full WebSocket pipeline through Deepgram Agent ────────────────
function testAgentPipeline(port, audioData) {
  return new Promise((resolve, reject) => {
    const events = [];

    const timeout = setTimeout(() => {
      reject(new Error(
        'Timed out (45s) waiting for Deepgram Voice Agent response.\n' +
        'Check DEEPGRAM_API_KEY and connectivity to agent.deepgram.com.',
      ));
    }, 45_000);

    const ws = new WebSocket(`ws://localhost:${port}/media`);

    ws.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });

    const origLog = console.log;
    console.log = (...args) => {
      origLog(...args);
      const line = args.join(' ');
      if (line.startsWith('[user]') || line.startsWith('[assistant]')) {
        events.push(line);
      }
      if (line.includes('Settings applied')) {
        events.push('settings_applied');
      }
      if (line.includes('Speaking')) {
        events.push('agent_speaking');
      }
    };

    const cleanup = (fn) => { console.log = origLog; fn(); };

    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup(() => {
        const hasSettings = events.includes('settings_applied');
        const hasConversation = events.some(e => e.startsWith('[user]') || e.startsWith('[assistant]'));

        if (!hasSettings) {
          reject(new Error('Agent never applied settings — check DEEPGRAM_API_KEY'));
        } else if (!hasConversation) {
          reject(new Error(
            'Settings were applied but no conversation text received.\n' +
            'The Voice Agent connected but did not produce transcription or responses.\n' +
            `Events seen: ${events.join(', ')}`,
          ));
        } else {
          resolve(events);
        }
      });
    };

    ws.on('open', () => {
      ws.send(JSON.stringify({ event: 'connected', protocol: 'Call', version: '1.0.0' }));

      ws.send(JSON.stringify({
        event: 'start',
        streamSid: 'MZ_ci_test',
        start: {
          streamSid: 'MZ_ci_test',
          accountSid: process.env.TWILIO_ACCOUNT_SID,
          callSid: 'CA_ci_test',
          mediaFormat: { encoding: 'audio/x-mulaw', sampleRate: 8000, channels: 1 },
        },
      }));

      let offset = 0;
      const MAX_BYTES = 8000 * 10;

      const sendChunk = () => {
        if (ws.readyState !== WebSocket.OPEN) return;

        if (offset >= audioData.length || offset >= MAX_BYTES) {
          ws.send(JSON.stringify({ event: 'stop', streamSid: 'MZ_ci_test' }));
          setTimeout(() => {
            try { ws.close(); } catch {}
            setTimeout(settle, 3000);
          }, 500);
          return;
        }

        ws.send(JSON.stringify({
          event: 'media',
          streamSid: 'MZ_ci_test',
          media: {
            track: 'inbound',
            chunk: String(Math.floor(offset / CHUNK_SIZE)),
            payload: audioData.subarray(offset, offset + CHUNK_SIZE).toString('base64'),
          },
        }));

        offset += CHUNK_SIZE;
        setTimeout(sendChunk, 20);
      };

      // Wait for agent greeting to finish before sending audio
      setTimeout(sendChunk, 3000);
    });

    ws.on('close', () => {
      setTimeout(settle, 3000);
    });
  });
}

// ── Main ──────────────────────────────────────────────────────────────────
async function run() {
  testSettingsShape();
  testFunctionCallHandler();

  const audioData = prepareMulawAudio();

  const app = createApp();
  const server = app.listen(PORT);
  await new Promise(r => server.on('listening', r));
  console.log(`\nServer started on :${PORT}`);

  try {
    await testTwimlEndpoint(PORT);

    console.log('\nStreaming audio through server → Deepgram Agent (up to 45s)...');
    const events = await testAgentPipeline(PORT, audioData);

    console.log(`\nReceived ${events.length} event(s)`);
    const conversations = events.filter(e => e.startsWith('[user]') || e.startsWith('[assistant]'));
    if (conversations.length > 0) {
      console.log(`  First: ${conversations[0]}`);
    }

    console.log('PASS: Voice Agent pipeline produced conversation text');

  } finally {
    server.close();
  }
}

run()
  .then(() => { console.log('\nAll tests passed'); process.exit(0); })
  .catch(err => { console.error(`\nTest failed: ${err.message}`); process.exit(1); });
