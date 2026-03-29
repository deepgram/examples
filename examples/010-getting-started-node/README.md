# Getting Started — Transcribe a URL with Node.js

Transcribe a pre-recorded audio file from a URL using the Deepgram JavaScript SDK in Node.js. This is the simplest possible Deepgram integration — a good starting point before adding platform-specific code.

## What you'll build

A Node.js script that takes an audio URL, sends it to Deepgram's pre-recorded speech-to-text API, and prints a formatted transcript with speaker detection and punctuation.

## Prerequisites

- Node.js 18 or later
- Deepgram account — [get a free API key](https://console.deepgram.com/)

## Environment variables

Copy `.env.example` to `.env` and fill in your API key:

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console → API Keys](https://console.deepgram.com/) |

## Run

```bash
npm install
npm start
```

To transcribe a different file, set the `AUDIO_URL` environment variable:

```bash
AUDIO_URL=https://example.com/my-audio.wav npm start
```

## How it works

1. `createClient()` initializes the Deepgram SDK with your API key
2. `transcribeUrl()` sends the audio URL to Deepgram's pre-recorded API
3. The response contains a `results.channels[0].alternatives[0].transcript` with the full text
4. `smart_format: true` adds punctuation and formats numbers, dates, etc.
5. `diarize: true` labels speakers as "Speaker 0", "Speaker 1", etc.

The pre-recorded API accepts URLs (no file upload needed) — Deepgram fetches the audio directly.

## Supported audio formats

MP3, MP4, MP2, AAC, WAV, FLAC, PCM, M4A, Ogg, Opus, WebM, and more.

## Next steps

- **Real-time transcription** — see `examples/020-*` for WebSocket-based live STT
- **Twilio integration** — see `examples/030-*` for transcribing phone calls
- **Text-to-speech** — see `examples/040-*` for TTS examples

## Related

- [Deepgram pre-recorded STT docs](https://developers.deepgram.com/docs/pre-recorded-audio)
- [Deepgram JS SDK](https://github.com/deepgram/deepgram-js-sdk)
- [nova-2 model](https://developers.deepgram.com/docs/models-languages-overview)

## Starter templates

Start your own project from a ready-to-run template in the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org:

| Starter | What it includes |
|---------|-----------------|
| [prerecorded-node](https://github.com/deepgram-starters/prerecorded-node) | Pre-recorded STT with Node.js — closest to this example |
| [live-node](https://github.com/deepgram-starters/live-node) | Real-time STT over WebSocket with Node.js |
| [text-to-speech-node](https://github.com/deepgram-starters/text-to-speech-node) | TTS with Node.js |
