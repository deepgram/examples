# Vanilla JavaScript Browser Transcription (No Bundler)

Real-time microphone transcription in the browser using plain JavaScript and Deepgram's streaming speech-to-text API. No npm, no webpack, no framework — just a single HTML file served by a lightweight Node.js backend that keeps your API key secure.

## What you'll build

A single-page web app where clicking "Start Listening" captures your microphone, streams audio to a Node.js Express server, which proxies it to Deepgram for live transcription. Interim and final transcripts appear on screen in real time.

## Prerequisites

- Node.js 18+
- A modern browser (Chrome, Firefox, Safari, Edge)
- Deepgram account — [get a free API key](https://console.deepgram.com/)

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |

Copy `.env.example` to `.env` and add your key.

## Install and run

```bash
npm install
npm start
```

Then open [http://localhost:3000/index.html](http://localhost:3000/index.html) in your browser and click **Start Listening**.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's flagship STT model (2025) — best accuracy and lowest latency |
| `encoding` | `linear16` | Raw 16-bit PCM, the format produced by the browser AudioWorklet |
| `sample_rate` | `16000` | 16 kHz — good accuracy while keeping bandwidth low |
| `smart_format` | `true` | Adds punctuation, capitalisation, and number formatting |
| `interim_results` | `true` | Returns partial transcripts while you're still speaking |
| `utterance_end_ms` | `1500` | Milliseconds of silence before Deepgram considers an utterance complete |

## How it works

1. The browser requests microphone access via `getUserMedia()`
2. An `AudioWorklet` captures raw PCM float32 samples at 16 kHz and converts them to 16-bit signed integers (linear16)
3. The browser sends each PCM buffer over a WebSocket to the Express server at `/listen`
4. The server opens a Deepgram live transcription session using the official SDK and forwards each audio chunk
5. Deepgram returns interim and final transcript events; the server relays them back to the browser over the same WebSocket
6. The frontend renders final text in black and interim (partial) text in grey, updating in real time
7. The API key never leaves the server — the browser has no access to it

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
