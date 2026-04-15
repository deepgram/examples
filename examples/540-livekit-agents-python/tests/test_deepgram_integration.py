"""
Integration tests for Deepgram STT and TTS with LiveKit Agents.

These tests verify that Deepgram's STT and TTS services work correctly
through the LiveKit plugins. Tests make real API calls to Deepgram.
"""

import os
import sys
import asyncio
import aiohttp

# Check for required credentials
DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

if not DEEPGRAM_API_KEY:
    print("DEEPGRAM_API_KEY not set - skipping tests")
    sys.exit(2)


def test_deepgram_stt_initialization():
    """Test that Deepgram STT can be initialized with the LiveKit plugin."""
    from livekit.plugins import deepgram
    
    stt = deepgram.STT(
        model="nova-3",
        language="en-US",
        punctuate=True,
        smart_format=True,
        api_key=DEEPGRAM_API_KEY,
    )
    
    assert stt is not None
    print("✓ Deepgram STT initialization successful")


def test_deepgram_tts_initialization():
    """Test that Deepgram TTS can be initialized with the LiveKit plugin."""
    from livekit.plugins import deepgram
    
    tts = deepgram.TTS(
        model="aura-2-andromeda-en",
        sample_rate=24000,
        api_key=DEEPGRAM_API_KEY,
    )
    
    assert tts is not None
    print("✓ Deepgram TTS initialization successful")


async def test_deepgram_tts_synthesis():
    """Test that Deepgram TTS can synthesize speech (real API call)."""
    from livekit.plugins import deepgram
    
    # Create our own aiohttp session
    async with aiohttp.ClientSession() as session:
        tts = deepgram.TTS(
            model="aura-2-andromeda-en",
            sample_rate=24000,
            api_key=DEEPGRAM_API_KEY,
            http_session=session,
        )
        
        # Synthesize a short phrase
        text = "Hello, this is a test of Deepgram text to speech."
        
        # Get the synthesis stream
        synthesis = tts.synthesize(text)
        
        # Collect audio chunks
        audio_chunks = []
        async for event in synthesis:
            if hasattr(event, 'frame') and event.frame is not None:
                audio_chunks.append(event.frame.data)
        
        # Verify we got audio data
        total_bytes = sum(len(chunk) for chunk in audio_chunks)
        assert total_bytes > 0, "Expected audio data from TTS synthesis"
        
        print(f"✓ Deepgram TTS synthesis successful ({total_bytes} bytes of audio)")


async def test_deepgram_tts_direct_api():
    """Test Deepgram TTS via direct API call to verify credentials work."""
    async with aiohttp.ClientSession() as session:
        url = "https://api.deepgram.com/v1/speak?model=aura-2-andromeda-en"
        headers = {
            "Authorization": f"Token {DEEPGRAM_API_KEY}",
            "Content-Type": "application/json",
        }
        data = {"text": "Hello, this is a test."}
        
        async with session.post(url, headers=headers, json=data) as response:
            assert response.status == 200, f"Expected 200, got {response.status}"
            audio_data = await response.read()
            assert len(audio_data) > 0, "Expected audio data"
            print(f"✓ Deepgram TTS API direct call successful ({len(audio_data)} bytes)")


def test_agent_creation():
    """Test that an Agent can be created with Deepgram STT/TTS."""
    from livekit.agents import Agent
    from livekit.plugins import deepgram, openai
    
    # Check if OpenAI key is available
    if not os.getenv("OPENAI_API_KEY"):
        print("⚠ OPENAI_API_KEY not set - using mock LLM configuration")
        # Create agent with just STT/TTS (no LLM)
        agent = Agent(
            instructions="You are a helpful assistant.",
            stt=deepgram.STT(model="nova-3", api_key=DEEPGRAM_API_KEY),
            tts=deepgram.TTS(model="aura-2-andromeda-en", api_key=DEEPGRAM_API_KEY),
        )
    else:
        agent = Agent(
            instructions="You are a helpful assistant.",
            stt=deepgram.STT(model="nova-3", api_key=DEEPGRAM_API_KEY),
            tts=deepgram.TTS(model="aura-2-andromeda-en", api_key=DEEPGRAM_API_KEY),
            llm=openai.LLM(model="gpt-4o-mini"),
        )
    
    assert agent is not None
    print("✓ Agent creation with Deepgram STT/TTS successful")


def test_stt_model_options():
    """Test various STT model configuration options."""
    from livekit.plugins import deepgram
    
    # Test with different model options
    configs = [
        {"model": "nova-3", "language": "en-US", "api_key": DEEPGRAM_API_KEY},
        {"model": "nova-3", "language": "en-US", "smart_format": True, "api_key": DEEPGRAM_API_KEY},
        {"model": "nova-3", "language": "en-US", "punctuate": True, "filler_words": True, "api_key": DEEPGRAM_API_KEY},
    ]
    
    for config in configs:
        stt = deepgram.STT(**config)
        assert stt is not None
    
    print("✓ STT model configurations validated")


def test_tts_voice_options():
    """Test various TTS voice/model options."""
    from livekit.plugins import deepgram
    
    # Test different voice models
    voices = [
        "aura-2-andromeda-en",
        "aura-2-helios-en",
        "aura-2-luna-en",
    ]
    
    for voice in voices:
        tts = deepgram.TTS(model=voice, sample_rate=24000, api_key=DEEPGRAM_API_KEY)
        assert tts is not None
    
    print("✓ TTS voice configurations validated")


def run_tests():
    """Run all tests."""
    print("=" * 60)
    print("Running Deepgram + LiveKit Agents Integration Tests")
    print("=" * 60)
    print()
    
    # Sync tests
    test_deepgram_stt_initialization()
    test_deepgram_tts_initialization()
    test_agent_creation()
    test_stt_model_options()
    test_tts_voice_options()
    
    # Async tests
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    
    try:
        # Test direct API call first (simpler, verifies credentials)
        loop.run_until_complete(test_deepgram_tts_direct_api())
        # Then test through LiveKit plugin
        loop.run_until_complete(test_deepgram_tts_synthesis())
    finally:
        loop.close()
    
    print()
    print("=" * 60)
    print("All tests passed! ✓")
    print("=" * 60)


if __name__ == "__main__":
    run_tests()
