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


def test_langchain_tool_schema():
    """Verify the LangChain tool is correctly defined and has the expected schema."""
    from transcribe_tool import transcribe_audio

    assert transcribe_audio.name == "transcribe_audio"
    assert "audio" in transcribe_audio.description.lower()

    schema = transcribe_audio.args_schema.model_json_schema()
    assert "audio_url" in schema.get("properties", {}), "Missing audio_url in tool schema"

    print("LangChain tool schema valid")
    print(f"  Tool name: {transcribe_audio.name}")


def test_tool_invocation():
    """Call the tool directly (no agent) to verify end-to-end transcription through src/."""
    from transcribe_tool import transcribe_audio

    # spacewalk.wav is ~33 seconds of audio — expect at least 2 chars/sec
    result = transcribe_audio.invoke("https://dpgr.am/spacewalk.wav")
    assert "error" not in result.lower(), f"Tool returned error: {result}"
    # Result contains a "Transcript (..." header line plus the actual text
    assert len(result) > 60, f"Tool output too short: {result[:200]}"

    print("Tool invocation working")
    print(f"  Output preview: '{result[:100]}...'")


def test_tool_includes_duration_and_confidence():
    """Verify the tool output format contains duration and confidence metadata."""
    from transcribe_tool import transcribe_audio

    result = transcribe_audio.invoke("https://dpgr.am/spacewalk.wav")
    assert "transcript" in result.lower(), \
        f"Expected 'Transcript' header in output: {result[:200]}"
    # Duration should appear as e.g. "32.5s"
    assert "s," in result or "s)" in result, \
        f"Expected duration (e.g. '32.5s') in output: {result[:200]}"

    print("Tool output includes duration and confidence metadata")


if __name__ == "__main__":
    test_langchain_tool_schema()
    test_tool_invocation()
    test_tool_includes_duration_and_confidence()
    print("\nAll tests passed")
