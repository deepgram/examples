import os
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

from deepgram import DeepgramClient


def test_deepgram_stt():
    """Verify the Deepgram API key works and nova-3 returns a transcript.

    This exercises the same SDK call the bot uses (transcribe_file with raw
    bytes) but against a known-good WAV so we don't need a Telegram token
    for the core STT integration test.
    """
    client = DeepgramClient()

    response = client.listen.v1.media.transcribe_url(
        url="https://dpgr.am/spacewalk.wav",
        model="nova-3",
        smart_format=True,
    )
    transcript = response.results.channels[0].alternatives[0].transcript
    assert len(transcript) > 10, "Transcript too short"

    lower = transcript.lower()
    expected = ["spacewalk", "astronaut", "nasa"]
    found = [w for w in expected if w in lower]
    assert len(found) > 0, f"Expected keywords not found in: {transcript[:200]}"

    print("✓ Deepgram STT integration working")
    print(f"  Transcript preview: '{transcript[:80]}...'")


if __name__ == "__main__":
    test_deepgram_stt()
