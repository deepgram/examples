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

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_django_imports():
    """Verify Django and Channels are importable and configured."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

    import django

    django.setup()

    from django.conf import settings

    assert settings.ASGI_APPLICATION == "asgi.application"
    assert "daphne" in settings.INSTALLED_APPS

    print("Django settings configured correctly")


def test_consumer_imports():
    """Verify the transcription consumer is importable from src/."""
    os.environ.setdefault("DJANGO_SETTINGS_MODULE", "settings")

    import django

    django.setup()

    from consumer import TranscriptionConsumer

    assert TranscriptionConsumer is not None
    assert hasattr(TranscriptionConsumer, "connect"), \
        "TranscriptionConsumer must implement connect()"
    assert hasattr(TranscriptionConsumer, "disconnect"), \
        "TranscriptionConsumer must implement disconnect()"
    assert hasattr(TranscriptionConsumer, "receive"), \
        "TranscriptionConsumer must implement receive()"

    print("TranscriptionConsumer imports correctly with all required methods")


def test_consumer_source_uses_deepgram():
    """Verify the consumer source code uses AsyncDeepgramClient with nova-3.

    We inspect source directly because a live WebSocket test would require
    a running Deepgram connection — the unit tests verify structure and config.
    """
    src = (Path(__file__).parent.parent / "src" / "consumer.py").read_text()

    assert "AsyncDeepgramClient" in src, \
        "consumer.py must use AsyncDeepgramClient for async Deepgram access"
    assert "nova-3" in src, \
        "consumer.py must configure Deepgram nova-3 model"
    assert "send_media" in src, \
        "consumer.py must forward audio bytes via send_media()"
    assert 'tag="deepgram-examples"' in src or "tag='deepgram-examples'" in src, \
        "consumer.py must include tag='deepgram-examples' on the Deepgram connection"
    assert "DEEPGRAM_API_KEY" in src, \
        "consumer.py must read DEEPGRAM_API_KEY from environment"

    print("Consumer source correctly configures Deepgram AsyncClient with nova-3")


def test_consumer_audio_forwarding():
    """Verify the consumer's receive() method forwards bytes to Deepgram.

    Checks the source to ensure binary frames are forwarded via send_media()
    rather than being silently dropped.
    """
    src = (Path(__file__).parent.parent / "src" / "consumer.py").read_text()

    assert "bytes_data" in src, \
        "consumer.py receive() must handle bytes_data for raw audio frames"
    assert "send_media" in src, \
        "consumer.py must call send_media() to forward audio to Deepgram"

    print("Consumer receive() correctly forwards binary audio frames to Deepgram")


def test_template_exists():
    """Verify the HTML template is present and contains the expected elements."""
    template = Path(__file__).parent.parent / "src" / "templates" / "index.html"
    assert template.exists(), "index.html template missing"
    content = template.read_text()
    assert "getUserMedia" in content, "Template should use getUserMedia for microphone"
    assert "ws/transcribe" in content, "Template should connect to ws/transcribe endpoint"

    print("Template exists and contains expected content")


if __name__ == "__main__":
    test_django_imports()
    test_consumer_imports()
    test_consumer_source_uses_deepgram()
    test_consumer_audio_forwarding()
    test_template_exists()
    print("\nAll tests passed")
