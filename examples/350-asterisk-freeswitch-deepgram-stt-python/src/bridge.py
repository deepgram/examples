"""WebSocket bridge: PBX audio (Asterisk / FreeSWITCH) -> Deepgram Live STT.

Asterisk (via ARI external media or AudioSocket) and FreeSWITCH
(via mod_audio_stream) can both send real-time call audio to a WebSocket
endpoint. This server accepts that audio and forwards it to Deepgram's
streaming STT API, printing live transcripts to the console.

Usage:
    python src/bridge.py                     # default: ws://0.0.0.0:8765
    python src/bridge.py --port 9000         # custom port

Asterisk dialplan (AudioSocket):
    exten => _X.,1,Answer()
     same => n,AudioSocket(ws://bridge-host:8765/asterisk)

FreeSWITCH dialplan (mod_audio_stream):
    <action application="audio_stream" data="ws://bridge-host:8765/freeswitch 16000 mono L16"/>
"""

import argparse
import asyncio
import json
import logging
import os
import struct
import sys

from dotenv import load_dotenv

load_dotenv()

import websockets
import websockets.asyncio.server
from deepgram import AsyncDeepgramClient
from deepgram.core.events import EventType
from deepgram.listen.v1.types import ListenV1Results

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger(__name__)

# Asterisk AudioSocket protocol constants — AudioSocket wraps audio in
# simple TLV (type-length-value) frames so we can distinguish audio data
# from control messages (hang-up, UUID) on the same TCP/WS connection.
AUDIOSOCKET_TYPE_UUID = 0x01
AUDIOSOCKET_TYPE_AUDIO = 0x10
AUDIOSOCKET_TYPE_HANGUP = 0x00
AUDIOSOCKET_HEADER_SIZE = 3  # 1 byte type + 2 bytes length (big-endian)


def parse_audiosocket_frame(data: bytes) -> tuple[int, bytes]:
    """Parse an Asterisk AudioSocket frame into (type, payload).

    AudioSocket frames are: [1 byte type][2 bytes big-endian length][payload].
    Returns (frame_type, payload_bytes). Raises ValueError on malformed frames.
    """
    if len(data) < AUDIOSOCKET_HEADER_SIZE:
        raise ValueError(f"Frame too short: {len(data)} bytes")
    frame_type = data[0]
    payload_len = struct.unpack(">H", data[1:3])[0]
    payload = data[3 : 3 + payload_len]
    return frame_type, payload


async def handle_deepgram_events(dg_connection, call_id: str) -> None:
    """Register event handlers for Deepgram transcript and error events."""

    async def on_message(message) -> None:
        if isinstance(message, ListenV1Results):
            transcript = message.channel.alternatives[0].transcript
            if transcript.strip():
                tag = "final" if message.is_final else "interim"
                log.info("[%s] [%s] %s", call_id, tag, transcript)

    async def on_error(error) -> None:
        log.error("[%s] Deepgram error: %s", call_id, error)

    dg_connection.on(EventType.MESSAGE, on_message)
    dg_connection.on(EventType.ERROR, on_error)


async def open_deepgram_connection(
    encoding: str = "linear16",
    sample_rate: int = 8000,
    channels: int = 1,
):
    """Open a Deepgram live STT connection with the given audio parameters.

    Returns (dg_connection, listener_task). Caller must cancel the task and
    call send_close_stream() when done.
    """
    client = AsyncDeepgramClient(api_key=os.environ["DEEPGRAM_API_KEY"])
    # ← connect() opens a persistent WebSocket to Deepgram's STT API
    dg_connection = await client.listen.v1.connect(
        model="nova-3-phonecall",  # ← optimised for telephony audio (8/16 kHz)
        encoding=encoding,
        sample_rate=sample_rate,
        channels=channels,
        smart_format=True,
        interim_results=True,
        utterance_end_ms=1000,
        tag="deepgram-examples",  # ← REQUIRED: tags traffic in the Deepgram console
    )
    listener_task = asyncio.create_task(dg_connection.start_listening())
    return dg_connection, listener_task


async def handle_asterisk(websocket) -> None:
    """Handle an Asterisk AudioSocket connection.

    Asterisk AudioSocket sends TLV-framed messages: a UUID frame at
    connection start, then audio frames (signed-linear 16-bit, 8 kHz mono
    by default), and a hangup frame when the call ends.
    """
    call_id = "asterisk-unknown"
    dg_connection = None
    listener_task = None

    try:
        # Asterisk AudioSocket default: signed linear 16-bit, 8 kHz, mono.
        # If your Asterisk is configured for 16 kHz (codec_slin16), change
        # sample_rate to 16000 for better accuracy.
        dg_connection, listener_task = await open_deepgram_connection(
            encoding="linear16", sample_rate=8000, channels=1
        )
        await handle_deepgram_events(dg_connection, call_id)
        log.info("[%s] Deepgram connection opened", call_id)

        async for raw in websocket:
            if isinstance(raw, str):
                continue

            frame_type, payload = parse_audiosocket_frame(raw)

            if frame_type == AUDIOSOCKET_TYPE_UUID:
                call_id = payload.decode("utf-8", errors="replace").strip("\x00")
                log.info("[%s] Asterisk call connected", call_id)

            elif frame_type == AUDIOSOCKET_TYPE_AUDIO:
                if payload:
                    await dg_connection.send_media(payload)

            elif frame_type == AUDIOSOCKET_TYPE_HANGUP:
                log.info("[%s] Asterisk call hung up", call_id)
                break

    except websockets.exceptions.ConnectionClosed:
        log.info("[%s] Asterisk WebSocket closed", call_id)
    finally:
        if dg_connection:
            try:
                await dg_connection.send_close_stream()
            except Exception:
                pass
        if listener_task:
            listener_task.cancel()


async def handle_freeswitch(websocket) -> None:
    """Handle a FreeSWITCH mod_audio_stream connection.

    FreeSWITCH mod_audio_stream sends raw PCM audio as binary WebSocket
    frames — no framing protocol, no JSON metadata. The audio format is
    set in the dialplan action (typically L16 at 16 kHz mono).
    """
    call_id = "freeswitch-unknown"
    dg_connection = None
    listener_task = None

    try:
        # FreeSWITCH mod_audio_stream default when configured with "16000 mono L16"
        dg_connection, listener_task = await open_deepgram_connection(
            encoding="linear16", sample_rate=16000, channels=1
        )
        await handle_deepgram_events(dg_connection, call_id)
        log.info("[%s] Deepgram connection opened", call_id)

        async for raw in websocket:
            if isinstance(raw, str):
                # mod_audio_stream may send a JSON metadata frame at start
                try:
                    meta = json.loads(raw)
                    call_id = meta.get("uuid", call_id)
                    log.info("[%s] FreeSWITCH stream metadata: %s", call_id, meta)
                except json.JSONDecodeError:
                    pass
                continue

            if raw:
                await dg_connection.send_media(raw)

    except websockets.exceptions.ConnectionClosed:
        log.info("[%s] FreeSWITCH WebSocket closed", call_id)
    finally:
        if dg_connection:
            try:
                await dg_connection.send_close_stream()
            except Exception:
                pass
        if listener_task:
            listener_task.cancel()


async def router(websocket) -> None:
    """Route incoming WebSocket connections based on the URL path.

    /asterisk   -> Asterisk AudioSocket handler (TLV-framed audio)
    /freeswitch -> FreeSWITCH mod_audio_stream handler (raw PCM)
    """
    path = websocket.request.path if hasattr(websocket, "request") else "/"
    log.info("New connection on %s from %s", path, websocket.remote_address)

    if path.startswith("/asterisk"):
        await handle_asterisk(websocket)
    elif path.startswith("/freeswitch"):
        await handle_freeswitch(websocket)
    else:
        log.warning("Unknown path %s — closing. Use /asterisk or /freeswitch", path)
        await websocket.close(1008, "Use /asterisk or /freeswitch path")


async def serve(host: str = "0.0.0.0", port: int = 8765) -> None:
    """Start the WebSocket bridge server."""
    if not os.environ.get("DEEPGRAM_API_KEY"):
        log.error("DEEPGRAM_API_KEY not set. Copy .env.example to .env and add your key.")
        sys.exit(1)

    log.info("PBX-to-Deepgram bridge listening on ws://%s:%d", host, port)
    log.info("  /asterisk   — Asterisk AudioSocket endpoint")
    log.info("  /freeswitch — FreeSWITCH mod_audio_stream endpoint")

    async with websockets.asyncio.server.serve(router, host, port):
        await asyncio.Future()  # run forever


def main():
    parser = argparse.ArgumentParser(description="PBX to Deepgram STT bridge")
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=8765)
    args = parser.parse_args()
    asyncio.run(serve(args.host, args.port))


if __name__ == "__main__":
    main()
