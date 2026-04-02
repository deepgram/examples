"use client";

import { useState, useRef, useCallback } from "react";

// Audio constraints for microphone capture — 16 kHz mono is ideal for
// Deepgram's speech recognition and keeps bandwidth low.
const SAMPLE_RATE = 16000;

export default function Home() {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [status, setStatus] = useState("Click Start to begin");

  const wsRef = useRef<WebSocket | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startListening = useCallback(async () => {
    try {
      setStatus("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
        },
      });
      mediaStreamRef.current = stream;

      // Fetch a short-lived API key from our backend so the main key
      // never reaches the browser.
      setStatus("Getting temporary Deepgram key...");
      const keyRes = await fetch("/api/deepgram-key");
      const { key, error } = await keyRes.json();
      if (error) throw new Error(error);

      // ← Open a WebSocket directly to Deepgram's live STT endpoint
      // with nova-3 and interim_results for low-latency partial transcripts
      setStatus("Connecting to Deepgram...");
      const ws = new WebSocket(
        `wss://api.deepgram.com/v1/listen?model=nova-3&encoding=linear16&sample_rate=${SAMPLE_RATE}&channels=1&interim_results=true&smart_format=true`,
        ["token", key],
      );
      wsRef.current = ws;

      ws.onopen = () => {
        setStatus("Listening... speak into your microphone");
        setIsListening(true);

        const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
        audioContextRef.current = audioContext;
        const source = audioContext.createMediaStreamSource(stream);

        // ScriptProcessorNode captures raw PCM samples from the mic
        // and forwards them as 16-bit linear PCM to Deepgram's WebSocket.
        const processor = audioContext.createScriptProcessor(4096, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return;

          const input = e.inputBuffer.getChannelData(0);
          // Convert float32 [-1,1] to int16 for Deepgram
          const pcm = new Int16Array(input.length);
          for (let i = 0; i < input.length; i++) {
            const s = Math.max(-1, Math.min(1, input[i]));
            pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
          }
          ws.send(pcm.buffer);
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
      };

      ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const alt = data.channel?.alternatives?.[0];
        if (!alt) return;

        if (data.is_final) {
          if (alt.transcript) {
            setTranscript((prev) =>
              prev ? prev + " " + alt.transcript : alt.transcript,
            );
          }
          setInterimTranscript("");
        } else {
          setInterimTranscript(alt.transcript || "");
        }
      };

      ws.onerror = () => {
        setStatus("WebSocket error — check console");
      };

      ws.onclose = () => {
        setIsListening(false);
        setStatus("Disconnected");
      };
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus(`Error: ${message}`);
      setIsListening(false);
    }
  }, []);

  const stopListening = useCallback(() => {
    // Tell Deepgram to finalize, then close
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "CloseStream" }));
      wsRef.current.close();
    }
    processorRef.current?.disconnect();
    audioContextRef.current?.close();
    mediaStreamRef.current?.getTracks().forEach((t) => t.stop());
    setIsListening(false);
    setInterimTranscript("");
    setStatus("Stopped");
  }, []);

  // ── TTS playback ────────────────────────────────────────────────────
  // Sends the transcript to /api/speak (which uses the AI SDK's
  // generateSpeech with @ai-sdk/deepgram) and plays the returned audio.
  const speakTranscript = useCallback(async () => {
    if (!transcript) return;
    setIsSpeaking(true);
    setStatus("Generating speech...");

    try {
      const res = await fetch("/api/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: transcript }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "TTS request failed");
      }

      const arrayBuffer = await res.arrayBuffer();
      const audioCtx = new AudioContext({ sampleRate: 24000 });

      // The API returns raw linear16 PCM at 24 kHz — we need to
      // manually decode it into a float32 AudioBuffer for playback.
      const int16 = new Int16Array(arrayBuffer);
      const audioBuffer = audioCtx.createBuffer(1, int16.length, 24000);
      const channel = audioBuffer.getChannelData(0);
      for (let i = 0; i < int16.length; i++) {
        channel[i] = int16[i] / 0x8000;
      }

      const source = audioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(audioCtx.destination);
      source.onended = () => {
        setIsSpeaking(false);
        setStatus("Playback complete");
        audioCtx.close();
      };
      source.start();
      setStatus("Playing audio...");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setStatus(`TTS error: ${message}`);
      setIsSpeaking(false);
    }
  }, [transcript]);

  return (
    <main style={{ maxWidth: 700, margin: "0 auto" }}>
      <h1>Deepgram Streaming STT + TTS</h1>
      <p style={{ color: "#666" }}>
        Real-time transcription with Deepgram nova-3, TTS with Aura 2 via the
        Vercel AI SDK
      </p>

      <div style={{ display: "flex", gap: "0.5rem", margin: "1rem 0" }}>
        {!isListening ? (
          <button onClick={startListening}>Start Listening</button>
        ) : (
          <button onClick={stopListening}>Stop</button>
        )}
        <button
          onClick={speakTranscript}
          disabled={!transcript || isSpeaking || isListening}
        >
          {isSpeaking ? "Speaking..." : "Read Back (TTS)"}
        </button>
        <button
          onClick={() => {
            setTranscript("");
            setInterimTranscript("");
          }}
          disabled={isListening}
        >
          Clear
        </button>
      </div>

      <p style={{ fontSize: "0.875rem", color: "#888" }}>{status}</p>

      <div
        style={{
          border: "1px solid #ccc",
          borderRadius: 8,
          padding: "1rem",
          minHeight: 120,
          whiteSpace: "pre-wrap",
          lineHeight: 1.6,
        }}
      >
        {transcript}
        {interimTranscript && (
          <span style={{ color: "#999" }}> {interimTranscript}</span>
        )}
        {!transcript && !interimTranscript && (
          <span style={{ color: "#bbb" }}>Transcript will appear here...</span>
        )}
      </div>
    </main>
  );
}
