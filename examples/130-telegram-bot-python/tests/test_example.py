import os
import sys
from pathlib import Path

# ── Credential check ────────────────────────────────────────────────────────
# Exit code convention across all examples in this repo:
#   0 = all tests passed
#   1 = real test failure (code bug, assertion error, unexpected API response)
#   2 = missing credentials (expected in CI until secrets are configured)
#
# Note: TELEGRAM_BOT_TOKEN is listed in .env.example because it is needed to
# run the bot, but we only need DEEPGRAM_API_KEY to exercise the core
# transcription logic tested here.
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

# Add src/ to the path so we can import from the example's own module.
sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from bot import transcribe_voice


# spacewalk.wav is ~33 seconds of clear speech.
# At >= 2 chars/second the transcript should be at least 66 characters.
AUDIO_URL = "https://dpgr.am/spacewalk.wav"
AUDIO_DURATION_SECONDS = 33
MIN_CHARS = AUDIO_DURATION_SECONDS * 2


def test_transcribe_voice():
    """Verify transcribe_voice() from src/bot.py downloads audio and returns a transcript.

    Calls the exported function directly — exercises the src/ code path without
    needing a real Telegram bot token or running bot process.
    """
    print(f"Testing transcribe_voice() from src/bot.py...")
    print(f"Audio: {AUDIO_URL}")

    transcript = transcribe_voice(AUDIO_URL, os.environ["DEEPGRAM_API_KEY"])

    assert transcript is not None, "transcribe_voice() returned None — no speech detected"
    assert len(transcript) >= MIN_CHARS, (
        f"Transcript too short (got {len(transcript)} chars, want >= {MIN_CHARS}): '{transcript}'"
    )

    print(f"  transcribe_voice() returned a transcript ({len(transcript)} chars)")
    print(f"  Preview: '{transcript[:80]}...'")


if __name__ == "__main__":
    test_transcribe_voice()
    print("\n✓ All tests passed")
