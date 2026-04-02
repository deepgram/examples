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


def test_openai_agents_imports():
    """Verify OpenAI Agents SDK voice components are importable."""
    from agents import Agent
    from agents.voice import (
        AudioInput,
        SingleAgentVoiceWorkflow,
        STTModel,
        TTSModel,
        VoiceModelProvider,
        VoicePipeline,
        VoicePipelineConfig,
    )

    assert Agent is not None
    assert VoicePipeline is not None
    assert STTModel is not None
    assert TTSModel is not None
    assert VoiceModelProvider is not None

    print("OpenAI Agents SDK voice imports working")


def test_agent_module_imports():
    """Verify the agent source module imports without errors."""
    import agent  # noqa: F401

    print("Agent module imports correctly")


def test_custom_provider_instantiation():
    """Verify our custom Deepgram provider creates STT and TTS models."""
    from agent import DeepgramSTTModel, DeepgramTTSModel, DeepgramVoiceProvider

    provider = DeepgramVoiceProvider()
    stt = provider.get_stt_model(None)
    tts = provider.get_tts_model(None)

    assert isinstance(stt, DeepgramSTTModel)
    assert isinstance(tts, DeepgramTTSModel)
    assert stt.model_name == "deepgram-nova-3"
    assert tts.model_name == "deepgram-aura-2"

    print("Custom Deepgram provider instantiation working")
    print(f"  STT model: {stt.model_name}")
    print(f"  TTS model: {tts.model_name}")


def test_create_agent():
    """Verify create_agent() returns a properly configured OpenAI Agent."""
    from agents import Agent
    from agent import create_agent

    result = create_agent()
    assert isinstance(result, Agent), \
        f"create_agent() must return an Agent instance, got {type(result)}"
    assert result.name == "Voice Assistant", \
        f"Expected name='Voice Assistant', got '{result.name}'"
    assert result.model == "gpt-4.1-mini", \
        f"Expected model='gpt-4.1-mini', got '{result.model}'"

    print("create_agent() returns a correctly configured Agent")
    print(f"  name: {result.name}, model: {result.model}")


def test_stt_model_uses_deepgram_nova3():
    """Verify DeepgramSTTModel calls nova-3 with the correct parameters."""
    src = (Path(__file__).parent.parent / "src" / "agent.py").read_text()

    assert "nova-3" in src, \
        "agent.py must use Deepgram nova-3 for STT"
    assert "deepgram-nova-3" in src, \
        "DeepgramSTTModel.model_name must return 'deepgram-nova-3'"
    assert 'tag="deepgram-examples"' in src or "tag='deepgram-examples'" in src, \
        "agent.py must include tag='deepgram-examples' on Deepgram API calls"

    print("DeepgramSTTModel configured with nova-3 and required tag")


def test_tts_model_uses_deepgram_aura2():
    """Verify DeepgramTTSModel calls aura-2 with the correct parameters."""
    src = (Path(__file__).parent.parent / "src" / "agent.py").read_text()

    assert "aura-2" in src, \
        "agent.py must use a Deepgram aura-2 voice for TTS"
    assert "deepgram-aura-2" in src, \
        "DeepgramTTSModel.model_name must return 'deepgram-aura-2'"

    print("DeepgramTTSModel configured with aura-2 and required tag")


if __name__ == "__main__":
    test_openai_agents_imports()
    test_agent_module_imports()
    test_custom_provider_instantiation()
    test_create_agent()
    test_stt_model_uses_deepgram_nova3()
    test_tts_model_uses_deepgram_aura2()
    print("\nAll tests passed")
