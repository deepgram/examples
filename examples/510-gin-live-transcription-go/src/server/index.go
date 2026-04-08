package server

const IndexHTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Gin + Deepgram Live Transcription</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: system-ui, sans-serif; max-width: 640px; margin: 2rem auto; padding: 0 1rem; }
  h1 { margin-bottom: 1rem; font-size: 1.4rem; }
  #status { margin-bottom: 1rem; color: #666; }
  #transcripts { border: 1px solid #ddd; border-radius: 8px; padding: 1rem; min-height: 200px; white-space: pre-wrap; font-size: 0.95rem; line-height: 1.6; }
  .interim { color: #999; }
  button { padding: 0.6rem 1.2rem; font-size: 1rem; border: none; border-radius: 6px; cursor: pointer; margin-right: 0.5rem; margin-top: 1rem; }
  #start { background: #1a73e8; color: #fff; }
  #stop  { background: #e53935; color: #fff; }
  button:disabled { opacity: 0.4; cursor: not-allowed; }
</style>
</head>
<body>
<h1>Gin + Deepgram Live Transcription</h1>
<div id="status">Click Start to begin transcribing.</div>
<div id="transcripts"></div>
<button id="start">Start</button>
<button id="stop" disabled>Stop</button>
<script>
(function() {
  const startBtn  = document.getElementById('start');
  const stopBtn   = document.getElementById('stop');
  const statusEl  = document.getElementById('status');
  const outputEl  = document.getElementById('transcripts');

  let ws, mediaStream, audioCtx, processor;

  startBtn.addEventListener('click', async () => {
    startBtn.disabled = true;
    stopBtn.disabled  = false;
    outputEl.textContent = '';
    statusEl.textContent = 'Requesting microphone...';

    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
    } catch (e) {
      statusEl.textContent = 'Microphone access denied.';
      startBtn.disabled = false;
      stopBtn.disabled  = true;
      return;
    }

    const proto = location.protocol === 'https:' ? 'wss' : 'ws';
    ws = new WebSocket(proto + '://' + location.host + '/ws');
    ws.binaryType = 'arraybuffer';

    ws.onopen = () => {
      statusEl.textContent = 'Connected — speak into your microphone.';

      audioCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
      const source = audioCtx.createMediaStreamSource(mediaStream);
      processor = audioCtx.createScriptProcessor(4096, 1, 1);

      processor.onaudioprocess = (e) => {
        if (ws.readyState !== WebSocket.OPEN) return;
        const float32 = e.inputBuffer.getChannelData(0);
        const int16 = new Int16Array(float32.length);
        for (let i = 0; i < float32.length; i++) {
          int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32767)));
        }
        ws.send(int16.buffer);
      };
      source.connect(processor);
      processor.connect(audioCtx.destination);
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === 'transcript') {
        if (msg.is_final) {
          const existing = outputEl.querySelector('.interim');
          if (existing) existing.remove();
          outputEl.textContent += msg.transcript + ' ';
        } else {
          let interim = outputEl.querySelector('.interim');
          if (!interim) {
            interim = document.createElement('span');
            interim.className = 'interim';
            outputEl.appendChild(interim);
          }
          interim.textContent = msg.transcript;
        }
      }
    };

    ws.onclose = () => {
      statusEl.textContent = 'Disconnected.';
      cleanup();
    };

    ws.onerror = () => {
      statusEl.textContent = 'WebSocket error.';
      cleanup();
    };
  });

  stopBtn.addEventListener('click', () => {
    if (ws) ws.close();
    cleanup();
    statusEl.textContent = 'Stopped.';
  });

  function cleanup() {
    startBtn.disabled = false;
    stopBtn.disabled  = true;
    if (processor) { processor.disconnect(); processor = null; }
    if (audioCtx)  { audioCtx.close(); audioCtx = null; }
    if (mediaStream) { mediaStream.getTracks().forEach(t => t.stop()); mediaStream = null; }
  }
})();
</script>
</body>
</html>`
