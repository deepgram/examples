#!/usr/bin/env python3
"""
Integration test for the LiveKit Voice Agent.

This test verifies that:
1. All plugins can be loaded and configured
2. An AgentSession can be created with Deepgram STT/TTS
3. The agent module imports correctly

Exit codes:
- 0: All tests passed
- 1: Test failed  
- 2: Missing credentials (skip)
"""

import asyncio
import os
import sys


def check_credentials() -> bool:
    """Check if required credentials are available."""
    if not os.environ.get("DEEPGRAM_API_KEY"):
        print("SKIP: DEEPGRAM_API_KEY not set")
        return False
    return True


async def test_imports() -> bool:
    """Test that all required modules can be imported."""
    print("Testing module imports...")
    
    try:
        from livekit.agents import Agent, AgentSession, JobContext
        from livekit.agents.cli import run_app
        from livekit.plugins import deepgram, silero
        
        print("  ✓ All modules imported successfully")
        return True
        
    except ImportError as e:
        print(f"  ✗ Import error: {e}")
        return False


async def test_agent_session_creation() -> bool:
    """Test creating an AgentSession with Deepgram plugins."""
    print("Testing AgentSession creation...")
    
    try:
        from livekit.agents import Agent, AgentSession
        from livekit.plugins import deepgram, silero
        
        # Initialize Deepgram STT
        stt = deepgram.STT(
            model="nova-3",
            language="en-US",
            interim_results=True,
            punctuate=True,
        )
        
        # Initialize Deepgram TTS
        tts = deepgram.TTS(
            model="aura-2-andromeda-en",
            sample_rate=24000,
        )
        
        # Initialize VAD
        vad = silero.VAD.load()
        
        # Create agent
        agent = Agent(
            instructions="You are a helpful assistant.",
        )
        
        # Create session (without starting it)
        session = AgentSession(
            stt=stt,
            tts=tts,
            vad=vad,
        )
        
        print("  ✓ AgentSession created successfully")
        print(f"    - STT model: {stt.model}")
        print(f"    - TTS model: {tts.model}")
        
        return True
        
    except Exception as e:
        print(f"  ✗ AgentSession creation error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def test_deepgram_models() -> bool:
    """Test that Deepgram models are available."""
    print("Testing Deepgram models...")
    
    try:
        from livekit.plugins.deepgram import models
        
        # Check if expected models are available
        print(f"  - Available model definitions loaded")
        
        from livekit.plugins import deepgram
        
        # Verify STT model options
        stt = deepgram.STT(model="nova-3")
        print(f"  ✓ Nova-3 STT model available")
        
        # Verify TTS model options
        tts = deepgram.TTS(model="aura-2-andromeda-en")
        print(f"  ✓ Aura-2 TTS model available")
        
        return True
        
    except Exception as e:
        print(f"  ✗ Model test error: {e}")
        return False


async def test_agent_module_import() -> bool:
    """Test importing the main agent module."""
    print("Testing agent module...")
    
    try:
        # Add src to path
        sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))
        
        # Import should not fail
        import agent
        
        # Verify entrypoint exists
        if hasattr(agent, 'entrypoint'):
            print("  ✓ Agent module loaded, entrypoint found")
            return True
        else:
            print("  ✗ Agent module missing entrypoint")
            return False
            
    except Exception as e:
        print(f"  ✗ Agent module error: {e}")
        import traceback
        traceback.print_exc()
        return False


async def main() -> int:
    """Run all tests."""
    print("=" * 60)
    print("Integration Tests")
    print("=" * 60)
    print()
    
    # Check credentials
    if not check_credentials():
        return 2
    
    results = []
    
    # Run tests
    results.append(await test_imports())
    results.append(await test_deepgram_models())
    results.append(await test_agent_session_creation())
    results.append(await test_agent_module_import())
    
    print()
    print("=" * 60)
    
    if all(results):
        print("All tests passed! ✓")
        return 0
    else:
        passed = sum(results)
        total = len(results)
        print(f"Tests: {passed}/{total} passed")
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
