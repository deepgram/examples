# Pipecat Voice Pipeline — Conversational Bot with Deepgram STT & TTS

Build a real-time voice conversation bot using Pipecat with Deepgram for both speech-to-text and text-to-speech. Audio flows through a linear pipeline: microphone → Deepgram STT → OpenAI LLM → Deepgram TTS → speaker, with automatic turn detection and interruption handling.

## What you'll build

A Python voice bot you can talk to from your terminal or browser. In local mode, it uses your microphone and speakers directly. In Daily mode, it creates a WebRTC room you can join from any browser. The bot transcribes your speech with Deepgram nova-3, generates a response with OpenAI, and speaks it back with Deepgram's aura-2 TTS — all in real-time with natural turn-taking.

## Prerequisites

- Python 3.10+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- OpenAI account — [get an API key](https://platform.openai.com/api-keys)
- Daily.co account (for WebRTC mode only) — [sign up](https://dashboard.daily.co/developers)

## Environment variables

| Variable | Where to find it | Required for |
|----------|-----------------|-------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) | Both modes |
| `OPENAI_API_KEY` | [OpenAI dashboard](https://platform.openai.com/api-keys) | Both modes |
| `DAILY_API_KEY` | [Daily dashboard](https://dashboard.daily.co/developers) | WebRTC mode only |

Copy `.env.example` to `.env` and fill in your values.

## Install and run

```bash
pip install -r requirements.txt

# Local console mode — uses your microphone and speakers
python src/pipeline.py

# Daily WebRTC mode — creates a room and prints the join URL
python src/pipeline.py --daily
```

## How it works

1. **Pipecat Pipeline** orchestrates the entire flow as a chain of processors that transform "frames" (audio chunks, text, control signals)
2. **Silero VAD** runs locally to detect when you start and stop speaking — this drives turn-taking without relying on silence timeouts
3. **Deepgram STT** (nova-3) transcribes your speech in real-time over a WebSocket connection, delivering words as they're recognised
4. **OpenAI GPT-4.1-mini** generates a conversational response based on the transcript and conversation history
5. **Deepgram TTS** (aura-2) synthesises the response and streams audio chunks back as they're generated — you hear the bot start speaking before the full response is ready
6. `allow_interruptions=True` lets you cut in while the bot is speaking — it stops immediately and processes your new input

## Architecture

```
Microphone → [VAD] → [Deepgram STT] → [Context] → [OpenAI LLM] → [Deepgram TTS] → Speaker
                                          ↑                              ↓
                                     Conversation                  Conversation
                                      history                      history
```

## Related

- [Pipecat documentation](https://docs.pipecat.ai/)
- [Pipecat Deepgram plugin](https://github.com/pipecat-ai/pipecat/tree/main/src/pipecat/services/deepgram)
- [Deepgram STT docs](https://developers.deepgram.com/docs/streaming)
- [Deepgram TTS docs](https://developers.deepgram.com/docs/text-to-speech)
- [Daily.co docs](https://docs.daily.co/)

## Starter templates

If you want a ready-to-run base for your own project, check the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org — there are starter repos for every language and every Deepgram product.
