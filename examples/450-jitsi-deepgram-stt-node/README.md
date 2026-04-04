# Jitsi Meet Real-Time Transcription with Deepgram STT

Add live captions to any Jitsi Meet conference using Deepgram's Nova-3 speech-to-text model. A Node.js server hosts both the Jitsi IFrame embed and a WebSocket bridge that streams conference audio to Deepgram and relays transcripts back to the browser in real time.

## What you'll build

A Node.js application that embeds a Jitsi Meet conference via the IFrame API, captures microphone audio from the meeting using the Web Audio API, streams it to a server-side WebSocket that forwards the PCM frames to Deepgram's live STT, and displays rolling transcripts below the video feed.

## Prerequisites

- Node.js 18+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- A Jitsi room on [meet.jit.si](https://meet.jit.si) (free, no account needed) or a JaaS account on [jaas.8x8.vc](https://jaas.8x8.vc/)

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |
| `JITSI_ROOM` | Any room name you choose (e.g. `my-meeting`) |
| `JITSI_DOMAIN` | Optional — defaults to `meet.jit.si` |
| `JAAS_APP_ID` | Optional — [JaaS console](https://jaas.8x8.vc/) if using Jitsi as a Service |

## Install and run

```bash
cp .env.example .env
# Fill in DEEPGRAM_API_KEY and optionally JITSI_ROOM

npm install
npm start
# Open http://localhost:3000 in your browser
```

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's latest and most accurate STT model |
| `encoding` | `linear16` | 16-bit signed PCM — matches Web Audio API output |
| `sample_rate` | `16000` | 16 kHz — good balance of quality and bandwidth |
| `smart_format` | `true` | Auto-punctuation and number formatting |
| `interim_results` | `true` | Get partial transcripts while still speaking |
| `utterance_end_ms` | `1000` | Silence threshold before emitting an utterance boundary |

## How it works

1. The browser loads the page and embeds a Jitsi Meet room via the IFrame External API
2. The user clicks "Start Transcription" to grant microphone access
3. An AudioContext captures the microphone stream at 16 kHz and converts float samples to 16-bit PCM
4. PCM chunks are sent over a WebSocket to the `/transcribe` endpoint on the Node.js server
5. The server opens a Deepgram live STT connection and forwards each audio chunk
6. Deepgram returns interim and final transcripts, which the server relays back over the same WebSocket
7. The browser displays rolling captions below the Jitsi video feed

## Architecture

```
┌─────────────────────────────────────────────┐
│ Browser                                     │
│  ┌──────────────┐   ┌───────────────────┐   │
│  │ Jitsi IFrame │   │ Web Audio API     │   │
│  │ (conference) │   │ (mic → PCM 16kHz) │   │
│  └──────────────┘   └───────┬───────────┘   │
│                             │ WebSocket     │
│  ┌──────────────────────────▼────────────┐  │
│  │ Transcript panel (captions)           │  │
│  └───────────────────────────────────────┘  │
└─────────────────────┬───────────────────────┘
                      │ ws://host/transcribe
┌─────────────────────▼───────────────────────┐
│ Node.js Server (Express + express-ws)       │
│  ┌────────────────────────────────────────┐ │
│  │ /transcribe  →  Deepgram Live STT      │ │
│  │ PCM frames in ──► transcript events out │ │
│  └────────────────────────────────────────┘ │
└─────────────────────────────────────────────┘
```

## JaaS (Jitsi as a Service) setup

To use the hosted 8x8 JaaS instead of the free meet.jit.si:

1. Sign up at [jaas.8x8.vc](https://jaas.8x8.vc/)
2. Set `JAAS_APP_ID` in your `.env` to your JaaS App ID
3. The app will automatically use `8x8.vc` as the domain and prefix the room name with your App ID

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
