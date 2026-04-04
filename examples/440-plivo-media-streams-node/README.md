# Plivo Audio Streaming — Real-Time Call Transcription

Transcribe live phone calls in real time by connecting Plivo's audio streaming to Deepgram's streaming speech-to-text API. Every word spoken on a call is transcribed within milliseconds and logged to the console.

## What you'll build

A Node.js server that answers inbound Plivo calls with XML containing the `<Stream>` element, receives the call audio over a WebSocket, and pipes every frame into Deepgram's live transcription WebSocket. Interim and final transcripts are logged to the console as the caller speaks.

## Prerequisites

- Node.js 18+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- Plivo account — [sign up](https://console.plivo.com/)
- A Plivo phone number with a voice application configured to send webhooks to your server

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |
| `PLIVO_AUTH_ID` | [Plivo console](https://console.plivo.com/) → Account |
| `PLIVO_AUTH_TOKEN` | [Plivo console](https://console.plivo.com/) → Account |

## Install and run

```bash
cp .env.example .env
# Fill in your API keys in .env

npm install
npm start
```

Expose the server publicly so Plivo can reach it (e.g. with ngrok):

```bash
ngrok http 3000
```

Then set your Plivo application's answer URL to `https://<ngrok-id>.ngrok.io/voice` (HTTP POST).

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's latest and most accurate speech model |
| `encoding` | `mulaw` | Telephony standard — matches Plivo Stream audio format |
| `sample_rate` | `8000` | 8 kHz — standard telephony sample rate |
| `smart_format` | `true` | Adds punctuation and formatting automatically |
| `interim_results` | `true` | Returns partial transcripts for low-latency display |
| `utterance_end_ms` | `1000` | Detects end-of-utterance after 1 s of silence |

## How it works

1. An inbound call hits your Plivo phone number.
2. Plivo sends a POST webhook to `/voice`.
3. The server responds with XML containing `<Stream keepCallAlive="true" contentType="audio/x-mulaw;rate=8000">wss://…/stream</Stream>`, which tells Plivo to fork the call audio to a WebSocket.
4. Plivo opens a WebSocket to `/stream` and sends JSON messages with base64-encoded mulaw audio in the `media` event.
5. The server decodes each audio chunk and forwards it to Deepgram's live transcription WebSocket.
6. Deepgram returns interim and final transcripts, which the server logs in real time.

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
