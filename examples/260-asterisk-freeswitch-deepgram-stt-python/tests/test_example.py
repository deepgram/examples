import os
import struct
import sys
from pathlib import Path

# ── Credential check ────────────────────────────────────────────────────────
# Exit code convention across all examples in this repo:
#   0 = all tests passed
#   1 = real test failure (code bug, assertion error, unexpected API response)
#   2 = missing credentials (expected in CI until secrets are configured)
env_example = Path(__file__).parent.parent / ".env.example"
required = [
    line.split("=")[0].strip()
    for line in env_example.read_text().splitlines()
    if line and not line.startswith("#") and "=" in line and line[0].isupper()
]
missing = [k for k in required if not os.environ.get(k)]
if missing:
    print(f"MISSING_CREDENTIALS: {','.join(missing)}", file=sys.stderr)
    sys.exit(2)
# ────────────────────────────────────────────────────────────────────────────

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))

from bridge import (
    AUDIOSOCKET_TYPE_AUDIO,
    AUDIOSOCKET_TYPE_HANGUP,
    AUDIOSOCKET_TYPE_UUID,
    parse_audiosocket_frame,
)
from deepgram import DeepgramClient


def test_parse_audiosocket_uuid_frame():
    """Verify AudioSocket UUID frame parsing."""
    uuid_bytes = b"test-call-uuid-1234\x00"
    frame = struct.pack(">BH", AUDIOSOCKET_TYPE_UUID, len(uuid_bytes)) + uuid_bytes
    frame_type, payload = parse_audiosocket_frame(frame)
    assert frame_type == AUDIOSOCKET_TYPE_UUID
    assert b"test-call-uuid-1234" in payload
    print("OK parse_audiosocket_uuid_frame")


def test_parse_audiosocket_audio_frame():
    """Verify AudioSocket audio frame parsing with PCM data."""
    pcm_data = b"\x00\x01" * 160  # 320 bytes = 20ms of 8kHz 16-bit mono
    frame = struct.pack(">BH", AUDIOSOCKET_TYPE_AUDIO, len(pcm_data)) + pcm_data
    frame_type, payload = parse_audiosocket_frame(frame)
    assert frame_type == AUDIOSOCKET_TYPE_AUDIO
    assert payload == pcm_data
    print("OK parse_audiosocket_audio_frame")


def test_parse_audiosocket_hangup_frame():
    """Verify AudioSocket hangup frame parsing."""
    frame = struct.pack(">BH", AUDIOSOCKET_TYPE_HANGUP, 0)
    frame_type, payload = parse_audiosocket_frame(frame)
    assert frame_type == AUDIOSOCKET_TYPE_HANGUP
    assert payload == b""
    print("OK parse_audiosocket_hangup_frame")


def test_parse_audiosocket_malformed():
    """Verify malformed frames raise ValueError."""
    try:
        parse_audiosocket_frame(b"\x00")
        assert False, "Should have raised ValueError"
    except ValueError:
        pass
    print("OK parse_audiosocket_malformed")


def test_deepgram_prerecorded_stt():
    """Verify the Deepgram API key works by running a pre-recorded transcription.

    We use a pre-recorded call instead of a live WebSocket to keep the test
    fast and deterministic — the same SDK client and key are used for both.
    """
    client = DeepgramClient()
    response = client.listen.v1.media.transcribe_url(
        url="https://dpgr.am/spacewalk.wav",
        model="nova-3",
        smart_format=True,
        tag="deepgram-examples",
    )
    transcript = response.results.channels[0].alternatives[0].transcript
    assert len(transcript) > 10, f"Transcript too short: {transcript}"

    lower = transcript.lower()
    expected = ["spacewalk", "astronaut", "nasa"]
    found = [w for w in expected if w in lower]
    assert len(found) > 0, f"Expected keywords not found in: {transcript[:200]}"

    print("OK deepgram_prerecorded_stt")
    print(f"  Transcript preview: '{transcript[:80]}...'")


if __name__ == "__main__":
    test_parse_audiosocket_uuid_frame()
    test_parse_audiosocket_audio_frame()
    test_parse_audiosocket_hangup_frame()
    test_parse_audiosocket_malformed()
    test_deepgram_prerecorded_stt()
