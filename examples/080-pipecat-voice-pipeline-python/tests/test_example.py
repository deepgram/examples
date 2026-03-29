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

# We can't run the full Pipecat voice pipeline in CI (it needs a microphone
# or a Daily room), but we CAN verify:
#   1. Deepgram API key works for STT (pre-recorded transcription)
#   2. Pipecat and its Deepgram plugin import correctly
#   3. The pipeline module itself is syntactically valid

from deepgram import DeepgramClient


def test_deepgram_stt():
    """Verify the Deepgram API key works and nova-3 returns a transcript."""
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


def test_pipecat_imports():
    """Verify Pipecat and the Deepgram plugin are installed and importable."""
    from pipecat.pipeline.pipeline import Pipeline
    from pipecat.services.deepgram.stt import DeepgramSTTService
    from pipecat.services.deepgram.tts import DeepgramTTSService

    assert Pipeline is not None
    assert DeepgramSTTService is not None
    assert DeepgramTTSService is not None

    print("✓ Pipecat + Deepgram plugin imports working")


def test_pipeline_module_imports():
    """Verify the pipeline source module imports without errors."""
    sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
    import pipeline  # noqa: F401

    print("✓ Pipeline module imports correctly")


if __name__ == "__main__":
    test_deepgram_stt()
    test_pipecat_imports()
    test_pipeline_module_imports()
