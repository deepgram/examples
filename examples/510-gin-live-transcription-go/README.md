# Gin Real-Time WebSocket Transcription Server

A Go web server using Gin and gorilla/websocket that accepts browser audio over a WebSocket, relays it to Deepgram's Live STT API (Nova-3) via the Deepgram Go SDK, and streams transcription results back in real time. Includes a built-in HTML/JS client for testing.

## What you'll build

A Gin HTTP server with two endpoints: `GET /` serves a minimal browser client that captures microphone audio, and `GET /ws` upgrades to a WebSocket that relays 16-bit PCM audio to Deepgram and returns interim and final transcripts as JSON.

## Prerequisites

- Go 1.22+
- Deepgram account — [get a free API key](https://console.deepgram.com/)

## Environment variables

Copy `.env.example` to `.env` and fill in your API key:

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |

## Install and run

```bash
cd examples/510-gin-live-transcription-go
export DEEPGRAM_API_KEY=your_key_here
go run ./src/
```

Open [http://localhost:8080](http://localhost:8080) in your browser, click **Start**, and speak into your microphone.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Latest Deepgram speech model with highest accuracy |
| `smart_format` | `true` | Adds punctuation, casing, and formatting automatically |
| `interim_results` | `true` | Returns partial transcripts for low-latency display |
| `vad_events` | `true` | Fires speech-start events for activity detection |
| `utterance_end_ms` | `1000` | Silence threshold (ms) before marking an utterance complete |
| `encoding` | `linear16` | 16-bit signed little-endian PCM — what the browser sends |
| `sample_rate` | `16000` | 16 kHz sample rate matching the browser AudioContext |

## How it works

1. The browser client captures microphone audio via `getUserMedia` and creates a 16 kHz `AudioContext`
2. A `ScriptProcessorNode` converts float32 samples to 16-bit PCM and sends binary frames over a WebSocket to `/ws`
3. Gin upgrades the HTTP connection to a WebSocket using gorilla/websocket
4. The server creates a Deepgram Live STT session using `listen.NewWSUsingCallback` from the Go SDK
5. Each binary WebSocket frame from the browser is forwarded to Deepgram via `dgClient.Write(data)`
6. Deepgram calls the `Message` callback with interim and final transcripts
7. The callback serializes each transcript as JSON and sends it back to the browser over the same WebSocket
8. The browser displays final text and shows interim results in grey until they are finalized

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
