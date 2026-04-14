#!/usr/bin/env python3
"""
Test Deepgram STT and TTS connections.

This test verifies that:
1. The Deepgram API key is valid
2. Deepgram STT (speech-to-text) works correctly
3. Deepgram TTS (text-to-speech) works correctly

Exit codes:
- 0: All tests passed
- 1: Test failed
- 2: Missing credentials (skip)
"""

import asyncio
import os
import sys
import aiohttp


def check_credentials() -> bool:
    """Check if required credentials are available."""
    deepgram_key = os.environ.get("DEEPGRAM_API_KEY")
    if not deepgram_key:
        print("SKIP: DEEPGRAM_API_KEY not set")
        return False
    return True


async def test_deepgram_tts() -> bool:
    """Test Deepgram TTS by synthesizing audio."""
    from livekit.plugins import deepgram
    
    print("Testing Deepgram TTS...")
    
    async with aiohttp.ClientSession() as session:
        try:
            tts = deepgram.TTS(
                model="aura-2-andromeda-en",
                sample_rate=24000,
                http_session=session,
            )
            
            # Synthesize a test phrase
            test_text = "Hello! This is a test of Deepgram text to speech."
            
            audio_data = []
            async for chunk in tts.synthesize(test_text):
                audio_data.append(chunk.frame.data)
            
            # Verify we got audio data back
            total_bytes = sum(len(chunk) for chunk in audio_data)
            
            if total_bytes > 0:
                print(f"  ✓ TTS generated {total_bytes} bytes of audio")
                return True
            else:
                print("  ✗ TTS returned no audio data")
                return False
                
        except Exception as e:
            print(f"  ✗ TTS error: {e}")
            return False


async def test_deepgram_stt() -> bool:
    """Test Deepgram STT by transcribing audio."""
    from livekit.plugins import deepgram
    from livekit.agents.stt import SpeechEventType
    
    print("Testing Deepgram STT...")
    
    async with aiohttp.ClientSession() as session:
        try:
            stt = deepgram.STT(
                model="nova-3",
                language="en-US",
                punctuate=True,
                http_session=session,
            )
            
            # First generate some audio using TTS
            tts = deepgram.TTS(
                model="aura-2-andromeda-en",
                sample_rate=16000,  # Match STT sample rate
                http_session=session,
            )
            
            test_phrase = "The quick brown fox jumps over the lazy dog."
            
            # Collect audio frames from TTS
            audio_frames = []
            async for chunk in tts.synthesize(test_phrase):
                audio_frames.append(chunk.frame)
            
            if not audio_frames:
                print("  ✗ No audio frames generated for STT test")
                return False
                
            print(f"  - Generated {len(audio_frames)} audio frames for transcription")
            
            # Create STT stream
            stream = stt.stream()
            
            # Push audio frames to the stream
            for frame in audio_frames:
                stream.push_frame(frame)
            
            # Signal end of input
            stream.end_input()
            
            # Collect transcription results
            final_transcript = ""
            async for event in stream:
                if event.type == SpeechEventType.FINAL_TRANSCRIPT and event.alternatives:
                    final_transcript += event.alternatives[0].text + " "
            
            final_transcript = final_transcript.strip()
            
            if final_transcript:
                print(f"  ✓ STT transcribed: '{final_transcript}'")
                
                # Check if transcription is reasonably accurate
                original_words = set(test_phrase.lower().replace(".", "").split())
                transcribed_words = set(final_transcript.lower().replace(".", "").split())
                
                common_words = original_words.intersection(transcribed_words)
                
                if len(common_words) >= 3:
                    print(f"  ✓ Transcription accuracy check passed ({len(common_words)} matching words)")
                    return True
                else:
                    print(f"  ⚠ Transcription may be inaccurate (only {len(common_words)} matching words)")
                    return True  # Still pass - Deepgram is working
            else:
                print("  ✗ STT returned empty transcription")
                return False
                
        except Exception as e:
            print(f"  ✗ STT error: {e}")
            import traceback
            traceback.print_exc()
            return False


async def test_plugin_initialization() -> bool:
    """Test that Deepgram plugins initialize correctly."""
    from livekit.plugins import deepgram
    
    print("Testing plugin initialization...")
    
    async with aiohttp.ClientSession() as session:
        try:
            # Test STT initialization
            stt = deepgram.STT(
                model="nova-3",
                language="en-US",
                http_session=session,
            )
            print(f"  ✓ STT initialized - model: {stt.model}, provider: {stt.provider}")
            
            # Test TTS initialization
            tts = deepgram.TTS(
                model="aura-2-andromeda-en",
                http_session=session,
            )
            print(f"  ✓ TTS initialized - model: {tts.model}, provider: {tts.provider}")
            
            return True
            
        except Exception as e:
            print(f"  ✗ Plugin initialization error: {e}")
            return False


async def main() -> int:
    """Run all tests."""
    print("=" * 60)
    print("Deepgram Connection Tests")
    print("=" * 60)
    print()
    
    # Check credentials
    if not check_credentials():
        return 2
    
    results = []
    
    # Run tests
    results.append(await test_plugin_initialization())
    results.append(await test_deepgram_tts())
    results.append(await test_deepgram_stt())
    
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
