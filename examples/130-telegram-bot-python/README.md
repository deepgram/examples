# Telegram Voice Transcription Bot

A Telegram bot that transcribes voice messages using Deepgram's nova-3 speech-to-text model. Send a voice message and get the transcript back instantly.

## What you'll build

A Telegram bot that listens for voice messages, sends the audio to Deepgram for transcription, and replies with the text. Telegram voice messages are Opus-encoded OGG files — Deepgram handles this format natively, so no audio conversion is needed.

## Prerequisites

- Python 3.10+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- Telegram bot token — [create one via @BotFather](https://core.telegram.org/bots/tutorial#obtain-your-bot-token)

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |
| `TELEGRAM_BOT_TOKEN` | Message [@BotFather](https://t.me/BotFather) on Telegram, use `/newbot` |

Copy `.env.example` to `.env` and fill in your values.

## Install and run

```bash
pip install -r requirements.txt
python src/bot.py
```

Then open your bot in Telegram and send a voice message.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's flagship STT model — best accuracy for general audio |
| `smart_format` | `true` | Adds punctuation, capitalisation, and number formatting |

## How it works

1. User sends a voice message to the Telegram bot
2. The bot downloads the voice file (OGG/Opus) via the Telegram Bot API
3. Raw audio bytes are sent to `deepgram.listen.v1.media.transcribe_file()` — no format conversion needed
4. Deepgram returns the transcript and the bot replies with the text

## Related

- [Deepgram STT docs](https://developers.deepgram.com/docs/stt-pre-recorded)
- [python-telegram-bot docs](https://docs.python-telegram-bot.org/)
- [Telegram Bot API — Voice](https://core.telegram.org/bots/api#voice)

## Starter templates

If you want a ready-to-run base for your own project, check the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org — there are starter repos for every language and every Deepgram product.
