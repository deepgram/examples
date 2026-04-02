import os
import sys
from pathlib import Path

# ── Credential check ────────────────────────────────────────────────────────
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

# We can't run the full LiveKit agent in CI (it needs a running LiveKit server
# and a real room), but we CAN verify that the agent module is structurally
# correct and wired to Deepgram correctly.

sys.path.insert(0, str(Path(__file__).parent.parent / "src"))


def test_agent_module_imports():
    """Importing the agent module verifies all dependencies are installed
    and the code is syntactically valid."""
    import agent  # noqa: F401

    print("Agent module imports correctly")


def test_voice_assistant_class():
    """Verify VoiceAssistant is defined and is a subclass of Agent."""
    from livekit.agents import Agent
    import agent

    assert issubclass(agent.VoiceAssistant, Agent), \
        "VoiceAssistant must subclass livekit.agents.Agent"
    assert hasattr(agent.VoiceAssistant, "on_enter"), \
        "VoiceAssistant must define on_enter lifecycle hook"

    print("VoiceAssistant class is correctly defined")


def test_entrypoint_is_callable():
    """Verify the entrypoint session function is defined and callable."""
    import agent

    assert callable(agent.entrypoint), \
        "entrypoint must be a callable (async function decorated with @server.rtc_session)"

    print("entrypoint is callable")


def test_deepgram_stt_configured():
    """Verify the agent source code references Deepgram's nova-3 STT model.

    We inspect the source directly because the LiveKit inference.STT call can't
    be instantiated outside a running agent process. This confirms the Deepgram
    plugin is wired in correctly.
    """
    src = (Path(__file__).parent.parent / "src" / "agent.py").read_text()

    assert "deepgram/nova-3" in src, \
        "agent.py must configure Deepgram nova-3 via inference.STT('deepgram/nova-3')"
    assert "DEEPGRAM_API_KEY" in src or "inference.STT" in src, \
        "agent.py must use Deepgram STT"

    print("Deepgram STT (nova-3) is configured in entrypoint")


def test_server_object_exists():
    """Verify the AgentServer object is created at module level."""
    import agent
    from livekit.agents import AgentServer

    assert isinstance(agent.server, AgentServer), \
        "agent.server must be an AgentServer instance"

    print("AgentServer instance exists at module level")


if __name__ == "__main__":
    test_agent_module_imports()
    test_voice_assistant_class()
    test_entrypoint_is_callable()
    test_deepgram_stt_configured()
    test_server_object_exists()
    print("\nAll tests passed")
