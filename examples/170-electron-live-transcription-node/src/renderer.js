'use strict';

const transcriptEl = document.getElementById('transcript');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const statusEl = document.getElementById('status');

let mediaStream = null;
let audioContext = null;
let processorNode = null;

const MAX_LINES = 4;
const finalLines = [];
let currentInterim = '';

function renderTranscript() {
  const visible = finalLines.slice(-MAX_LINES);
  let html = visible.map(l => `<span>${l}</span>`).join('<br>');
  if (currentInterim) {
    html += `<br><span class="interim">${currentInterim}</span>`;
  }
  transcriptEl.innerHTML = html || 'Listening...';
}

// ── Audio capture ───────────────────────────────────────────────────────────
// Capture microphone at 16 kHz, extract linear16 PCM, send to main process.
async function startAudioCapture() {
  mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });

  // Force 16 kHz so we match the Deepgram encoding config exactly.
  // This avoids needing a manual resampler.
  audioContext = new AudioContext({ sampleRate: 16000 });
  const source = audioContext.createMediaStreamSource(mediaStream);

  // ScriptProcessorNode is deprecated but universally supported in Electron.
  // AudioWorklet would be the modern alternative but adds file complexity
  // that isn't worth it for this example.
  processorNode = audioContext.createScriptProcessor(4096, 1, 1);

  processorNode.onaudioprocess = (event) => {
    const float32 = event.inputBuffer.getChannelData(0);

    // Convert float32 [-1,1] to signed 16-bit PCM
    const int16 = new Int16Array(float32.length);
    for (let i = 0; i < float32.length; i++) {
      const s = Math.max(-1, Math.min(1, float32[i]));
      int16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
    }

    window.deepgramBridge.sendAudio(int16.buffer);
  };

  source.connect(processorNode);
  processorNode.connect(audioContext.destination);
}

function stopAudioCapture() {
  if (processorNode) { processorNode.disconnect(); processorNode = null; }
  if (audioContext) { audioContext.close(); audioContext = null; }
  if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
}

// ── Button handlers ─────────────────────────────────────────────────────────
btnStart.addEventListener('click', async () => {
  btnStart.disabled = true;
  btnStop.disabled = false;
  btnStart.classList.add('active');
  btnStop.classList.remove('active');

  finalLines.length = 0;
  currentInterim = '';
  transcriptEl.textContent = 'Connecting...';

  window.deepgramBridge.startTranscription();
  await startAudioCapture();
});

btnStop.addEventListener('click', () => {
  btnStop.disabled = true;
  btnStart.disabled = false;
  btnStop.classList.remove('active');
  btnStart.classList.remove('active');

  stopAudioCapture();
  window.deepgramBridge.stopTranscription();
  statusEl.textContent = 'disconnected';
  statusEl.className = '';
});

// ── Mouse event forwarding for click-through ────────────────────────────────
// When the mouse enters the overlay container, disable click-through so
// buttons work. When it leaves, re-enable click-through so the overlay
// doesn't block interaction with windows underneath.
const container = document.getElementById('container');
container.addEventListener('mouseenter', () => {
  window.deepgramBridge.setIgnoreMouse(false);
});
container.addEventListener('mouseleave', () => {
  window.deepgramBridge.setIgnoreMouse(true);
});

// ── Deepgram event listeners ────────────────────────────────────────────────
window.deepgramBridge.onTranscript((data) => {
  if (data.is_final) {
    finalLines.push(data.text);
    currentInterim = '';
  } else {
    currentInterim = data.text;
  }
  renderTranscript();
});

window.deepgramBridge.onStatus((status) => {
  statusEl.textContent = status;
  statusEl.className = status;
});
