# Twilio Voice + Deepgram Voice Agent — AI Phone Agent

Build an AI-powered phone agent by connecting Twilio Voice calls to Deepgram's Voice Agent API. Callers speak naturally, the agent listens (STT), thinks (LLM), and responds (TTS) — all in real-time over the phone, with function calling support for dynamic actions like order lookups.

## What you'll build

An Express server that bridges Twilio Media Streams to Deepgram's Voice Agent WebSocket API, enabling bidirectional conversational AI over the phone. The example includes a "pizza shop" agent that greets callers and can look up order statuses using a function call.

## Prerequisites

- Node.js 18+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- Twilio account — [sign up](https://www.twilio.com/try-twilio)
- A Twilio phone number with Voice capability
- A public URL for your server (use [ngrok](https://ngrok.com/) for local development)

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |
| `TWILIO_ACCOUNT_SID` | [Twilio console](https://console.twilio.com/) → Account Info |
| `TWILIO_AUTH_TOKEN` | [Twilio console](https://console.twilio.com/) → Account Info |
| `TWILIO_PHONE_NUMBER` | [Twilio console](https://console.twilio.com/) → Phone Numbers |

Copy `.env.example` to `.env` and fill in your values.

## Install and run

```bash
npm install
npm start
```

Then expose the server publicly (for local dev):

```bash
ngrok http 3000
```

Configure your Twilio phone number's Voice webhook to `https://<your-ngrok-url>/voice` (HTTP POST).

Call your Twilio number — the agent will greet you and respond conversationally.

### Outbound calls

To initiate an outbound call:

```bash
curl -X POST http://localhost:3000/outbound \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890"}'
```

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` (listen) | `nova-3` | Deepgram STT model for transcribing caller speech |
| `model` (think) | `gpt-4o-mini` | LLM that generates agent responses |
| `model` (speak) | `aura-2-thalia-en` | Deepgram TTS voice for agent speech |
| `encoding` | `mulaw` | Audio format — matches Twilio's native μ-law 8 kHz |
| `sample_rate` | `8000` | Telephony standard — no server-side conversion needed |

## How it works

1. An incoming call hits `POST /voice`, which returns TwiML with `<Connect><Stream>` pointing to the `/media` WebSocket
2. Twilio opens a bidirectional WebSocket to `/media` and streams caller audio as base64-encoded μ-law at 8 kHz
3. The server opens a WebSocket to Deepgram's Voice Agent API (`wss://agent.deepgram.com/v1/agent/converse`) and sends a Settings message configuring STT, LLM, TTS, a system prompt, and function definitions
4. Caller audio is decoded from base64 and forwarded as raw binary to the Deepgram agent
5. The agent transcribes speech, generates a response via the LLM, and streams TTS audio back as binary frames
6. TTS audio is base64-encoded and sent back to Twilio as media events, so the caller hears the agent's response
7. When the LLM decides to call a function (e.g., `check_order_status`), the server receives a `FunctionCallRequest`, executes the function locally, and sends the result back via `FunctionCallResponse`
8. If the caller interrupts (barge-in), the server sends a `clear` event to Twilio to stop playback immediately

## Starter templates

If you want a ready-to-run base for your own project, check the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org — there are starter repos for every language and every Deepgram product.
