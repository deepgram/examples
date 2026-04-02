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

from fastapi.testclient import TestClient

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))
from main import app


def test_transcribe_url_endpoint():
    """Verify the /transcribe-url endpoint returns a transcript via the FastAPI app.

    This exercises Deepgram STT through src/main.py — no standalone SDK calls.
    spacewalk.wav is ~33 s; expect at least 2 chars/sec of audio duration.
    """
    client = TestClient(app)
    resp = client.post(
        "/transcribe-url",
        json={"url": "https://dpgr.am/spacewalk.wav"},
    )
    assert resp.status_code == 200, f"Unexpected status: {resp.status_code} — {resp.text}"
    data = resp.json()

    assert "transcript" in data, "Missing transcript in response"
    assert data["duration_seconds"] > 0, "Duration should be positive"

    # Proportional assertion: at least 2 chars per second of audio
    min_chars = int(data["duration_seconds"] * 2)
    assert len(data["transcript"]) >= min_chars, (
        f"Transcript too short: {len(data['transcript'])} chars "
        f"for {data['duration_seconds']:.1f}s audio (expected >= {min_chars})"
    )

    assert data["confidence"] > 0.5, f"Confidence too low: {data['confidence']}"

    print("/transcribe-url endpoint working")
    print(f"  Transcript preview: '{data['transcript'][:80]}...'")
    print(f"  Duration: {data['duration_seconds']:.1f}s, confidence: {data['confidence']:.2f}")


def test_health_endpoint():
    """Verify the /health endpoint responds."""
    client = TestClient(app)
    resp = client.get("/health")
    assert resp.status_code == 200
    assert resp.json()["status"] == "ok"
    print("/health endpoint working")


if __name__ == "__main__":
    test_transcribe_url_endpoint()
    test_health_endpoint()
    print("\nAll tests passed")
