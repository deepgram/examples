# Next.js Streaming STT + TTS with Deepgram via the Vercel AI SDK

A full-stack Next.js 15 application that captures microphone audio in the browser and streams it to Deepgram for real-time transcription using nova-3, then reads the transcript back using Deepgram Aura 2 text-to-speech through the Vercel AI SDK's `generateSpeech()` interface. Builds on [050-vercel-ai-sdk-node](../050-vercel-ai-sdk-node/) by showing the complete browser-to-server streaming pattern.

## What you'll build

A Next.js App Router application where users click "Start Listening", speak into their microphone, and see a live transcript appear word-by-word. Interim (partial) results show in gray as Deepgram processes speech in real time. Once done, users can click "Read Back" to hear the transcript spoken aloud via Deepgram's Aura 2 TTS — powered by the Vercel AI SDK's provider-agnostic `generateSpeech()` function.

## Prerequisites

- Node.js 18+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- A browser with microphone access (Chrome, Firefox, Edge)

## Environment variables

Copy `.env.example` to `.env` and fill in your key:

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console → API Keys](https://console.deepgram.com/) |

## Install and run

```bash
cp .env.example .env
# Add your DEEPGRAM_API_KEY to .env

npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's latest and most accurate STT model |
| `interim_results` | `true` | Returns partial transcripts for low-latency display |
| `smart_format` | `true` | Adds punctuation, capitalization, and number formatting |
| `encoding` | `linear16` | Raw PCM audio format sent from the browser to Deepgram |
| `sample_rate` | `16000` | 16 kHz for STT (sufficient for speech, keeps bandwidth low) |
| TTS voice | `aura-2-helena-en` | Natural-sounding female English voice for text-to-speech |

## How it works

1. **Temporary key** — The browser calls `GET /api/deepgram-key`, which uses the Deepgram SDK to mint a short-lived API key (10-second TTL) so the main key never reaches the client
2. **WebSocket connection** — The browser opens a WebSocket directly to `wss://api.deepgram.com/v1/listen` using the temporary key, with nova-3, linear16 encoding, and interim results enabled
3. **Microphone capture** — `getUserMedia()` captures mono audio at 16 kHz; a `ScriptProcessorNode` converts float32 samples to int16 PCM and sends them over the WebSocket
4. **Live transcript** — Deepgram returns JSON messages with `is_final` and interim results; final results accumulate as the transcript, while interim results show as gray preview text
5. **TTS playback** — "Read Back" sends the transcript to `POST /api/speak`, which calls the Vercel AI SDK's `generateSpeech()` with `deepgram.speech('aura-2-helena-en')` and returns raw linear16 PCM audio
6. **Audio playback** — The browser decodes the linear16 PCM into a float32 AudioBuffer and plays it through the Web Audio API

## Architecture

```
Browser                          Next.js Server              Deepgram
  │                                    │                        │
  ├─ GET /api/deepgram-key ───────────►│                        │
  │                                    ├─ createKey() ─────────►│
  │◄── { key: "tmp_..." } ────────────┤◄── temporary key ──────┤
  │                                    │                        │
  ├─ WebSocket wss://api.deepgram.com/v1/listen ───────────────►│
  ├─ send(pcm audio) ─────────────────────────────────────────►│
  │◄── { transcript, is_final } ───────────────────────────────┤
  │                                    │                        │
  ├─ POST /api/speak { text } ────────►│                        │
  │                                    ├─ generateSpeech() ────►│
  │◄── audio/pcm ─────────────────────┤◄── TTS audio ─────────┤
```

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
