# Asterisk / FreeSWITCH PBX to Deepgram Streaming STT

Bridge real-time phone call audio from Asterisk or FreeSWITCH into Deepgram's live speech-to-text API. This example shows how to capture RTP/PCM audio from a PBX and stream it over a WebSocket to Deepgram for real-time transcription.

## What you'll build

A Python WebSocket server that acts as a bridge between your PBX and Deepgram. Incoming calls on Asterisk (via AudioSocket) or FreeSWITCH (via mod_audio_stream) send their audio to this server, which forwards it to Deepgram's streaming STT API and prints live transcripts to the console.

## Prerequisites

- Python 3.11+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- Asterisk 16+ with `app_audiosocket` module, **or** FreeSWITCH with `mod_audio_stream`

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) |

Copy `.env.example` to `.env` and fill in your values.

## Install and run

```bash
cd examples/260-asterisk-freeswitch-deepgram-stt-python

pip install -r requirements.txt

cp .env.example .env
# Edit .env and add your DEEPGRAM_API_KEY

python src/bridge.py
```

The bridge listens on `ws://0.0.0.0:8765` by default. Use `--port` to change it.

### Asterisk dialplan configuration

Add to your Asterisk dialplan (`extensions.conf`) to route call audio to the bridge:

```ini
[transcribe]
exten => _X.,1,Answer()
 same => n,AudioSocket(ws://bridge-host:8765/asterisk)
 same => n,Hangup()
```

Asterisk AudioSocket sends signed-linear 16-bit PCM at 8 kHz mono by default. The bridge parses AudioSocket's TLV framing (type-length-value) to extract audio frames.

### FreeSWITCH dialplan configuration

Add to your FreeSWITCH dialplan to stream call audio to the bridge:

```xml
<action application="answer"/>
<action application="audio_stream" data="ws://bridge-host:8765/freeswitch 16000 mono L16"/>
```

FreeSWITCH `mod_audio_stream` sends raw PCM frames directly — no framing protocol, just binary audio on the WebSocket.

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3-phonecall` | Deepgram model optimised for telephony audio (8/16 kHz) |
| `encoding` | `linear16` | Signed 16-bit little-endian PCM — the native format of both PBX platforms |
| `sample_rate` | `8000` / `16000` | 8 kHz for Asterisk default, 16 kHz for FreeSWITCH (higher = better accuracy) |
| `smart_format` | `True` | Adds punctuation, capitalisation, and number formatting |
| `interim_results` | `True` | Returns partial transcripts while the caller is still speaking |
| `utterance_end_ms` | `1000` | Fires an utterance-end event after 1 second of silence |

## How it works

1. **PBX receives a call** — Asterisk or FreeSWITCH answers and is configured to stream audio to this bridge
2. **Audio reaches the bridge** — Asterisk sends AudioSocket TLV frames to `/asterisk`; FreeSWITCH sends raw PCM to `/freeswitch`
3. **Bridge opens a Deepgram connection** — using the Python SDK's `client.listen.v1.connect()` with telephony-optimised settings
4. **Audio is forwarded** — each PCM chunk is sent to Deepgram via `connection.send_media()`
5. **Transcripts arrive** — Deepgram fires `EventType.MESSAGE` callbacks with interim and final transcripts, which the bridge logs to the console
6. **Call ends** — the PBX closes the WebSocket; the bridge sends `close_stream` to Deepgram

## Architecture

```
Phone Call
    |
    | RTP audio
    v
Asterisk / FreeSWITCH PBX
    |
    | WebSocket (AudioSocket TLV or raw PCM)
    v
bridge.py (this server)
    |
    | Deepgram Python SDK (WebSocket)
    v
Deepgram Live STT (nova-3-phonecall)
    |
    | transcript events
    v
Console output (or your application)
```

## Related

- [Deepgram FreeSWITCH integration](https://developers.deepgram.com/docs/freeswitch)
- [Deepgram Live STT docs](https://developers.deepgram.com/docs/getting-started-with-live-streaming-audio)
- [Asterisk AudioSocket](https://docs.asterisk.org/Asterisk_16_Documentation/API_Documentation/Dialplan_Applications/AudioSocket/)
- [FreeSWITCH mod_audio_stream](https://developer.signalwire.com/freeswitch/FreeSWITCH-Explained/Modules/mod_audio_stream/)

## Starter templates

If you want a ready-to-run base for your own project, check the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org — there are starter repos for every language and every Deepgram product.
