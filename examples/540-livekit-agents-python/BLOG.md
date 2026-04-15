# Building a Voice AI Agent with LiveKit and Deepgram

In this tutorial, we'll build a real-time voice AI agent using LiveKit's Agents framework with Deepgram for speech recognition and synthesis. By the end, you'll have a fully functional voice assistant that can have natural conversations and execute custom tools.

## What We're Building

Our voice agent will:
- Listen to users in real-time using Deepgram's Nova-3 speech-to-text
- Respond with natural speech using Deepgram's Aura text-to-speech
- Use GPT-4o-mini for intelligent conversation understanding
- Support custom function tools (time, weather, calculator)

LiveKit Agents is a powerful framework that handles all the real-time communication complexity—WebRTC, audio streams, voice activity detection—so we can focus on the voice AI logic.

## Prerequisites

Before we start, make sure you have:

1. **Python 3.10+** installed
2. **A Deepgram account** - [Sign up for free](https://console.deepgram.com/)
3. **An OpenAI account** - [Get an API key](https://platform.openai.com/)
4. **A LiveKit Cloud account** - [Create one here](https://cloud.livekit.io/) (or self-host)

## Step 1: Project Setup

Let's start by creating our project structure:

```bash
mkdir livekit-deepgram-agent
cd livekit-deepgram-agent

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Create directory structure
mkdir -p src tests
```

Now install the required dependencies:

```bash
pip install livekit-agents livekit-plugins-deepgram livekit-plugins-openai python-dotenv
```

These packages provide:
- `livekit-agents` - The core Agents framework
- `livekit-plugins-deepgram` - Deepgram integration for STT and TTS
- `livekit-plugins-openai` - OpenAI integration for the LLM
- `python-dotenv` - Environment variable management

## Step 2: Configure Environment Variables

Create a `.env` file in your project root:

```bash
# Deepgram API credentials
DEEPGRAM_API_KEY=your_deepgram_api_key_here

# OpenAI API credentials
OPENAI_API_KEY=your_openai_api_key_here

# LiveKit server credentials
LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret
```

You can find your LiveKit credentials in the [LiveKit Cloud dashboard](https://cloud.livekit.io/). Your Deepgram API key is in the [Deepgram Console](https://console.deepgram.com/).

## Step 3: Build the Basic Voice Agent

Let's create our first voice agent. Create `src/agent.py`:

```python
"""
LiveKit Voice Agent with Deepgram STT/TTS

A conversational voice AI agent using:
- Deepgram Nova-3 for speech-to-text
- Deepgram Aura for text-to-speech  
- OpenAI GPT-4o-mini for the LLM
"""

import os
import logging
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
)
from livekit.plugins import deepgram, openai

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("deepgram-livekit-agent")
```

Here we import the core classes:
- `Agent` - Defines the voice agent's behavior, STT, TTS, and LLM
- `AgentSession` - Manages the active conversation session
- `JobContext` - Provides context about the current room and job
- `WorkerOptions` and `cli` - Handle the agent worker lifecycle

Now let's define our voice assistant class:

```python
class VoiceAssistant(Agent):
    """A conversational voice assistant using Deepgram for STT/TTS."""

    def __init__(self):
        super().__init__(
            instructions="""You are a helpful voice assistant powered by Deepgram and LiveKit.
            
You should:
- Be conversational and friendly
- Keep responses concise (1-3 sentences) since this is a voice conversation
- Ask clarifying questions when needed
- Be helpful with a wide range of topics

Remember: You're speaking, not writing, so be natural and conversational.""",
            stt=deepgram.STT(
                model="nova-3",
                language="en-US",
                punctuate=True,
                smart_format=True,
                filler_words=True,
            ),
            tts=deepgram.TTS(
                model="aura-2-andromeda-en",
                sample_rate=24000,
            ),
            llm=openai.LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
        )
```

Let's break down the configuration:

**Speech-to-Text (STT)** with Deepgram Nova-3:
- `model="nova-3"` - Deepgram's latest and most accurate model
- `language="en-US"` - American English
- `punctuate=True` - Automatically add punctuation
- `smart_format=True` - Format numbers, dates, etc. intelligently
- `filler_words=True` - Transcribe "um", "uh" for more natural conversations

**Text-to-Speech (TTS)** with Deepgram Aura:
- `model="aura-2-andromeda-en"` - A warm, professional voice
- `sample_rate=24000` - High-quality audio output

**LLM** with OpenAI:
- `model="gpt-4o-mini"` - Fast, cost-effective model for conversations
- `temperature=0.7` - Balanced creativity and consistency

Now let's add the entry point that runs when a job is dispatched:

```python
async def entrypoint(ctx: JobContext):
    """Entry point for the LiveKit agent job."""
    logger.info(f"Agent starting for room: {ctx.room.name}")

    # Connect to the LiveKit room
    await ctx.connect()

    # Create an agent session
    session = AgentSession()

    # Create our voice assistant
    assistant = VoiceAssistant()

    # Start the agent session with the voice assistant
    await session.start(
        agent=assistant,
        room=ctx.room,
    )

    # Wait for a participant to join
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    # Greet the user
    await session.say("Hello! I'm your voice assistant powered by Deepgram. How can I help you today?")

    logger.info("Agent is now listening and ready to respond")
```

The flow is:
1. Connect to the LiveKit room
2. Create and start an agent session
3. Wait for a user to join
4. Greet them and start listening

Finally, add the main function:

```python
def main():
    """Main entry point for the LiveKit agent worker."""
    # Verify required environment variables
    required_vars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY", "LIVEKIT_URL", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        print(f"Error: Missing required environment variables: {', '.join(missing_vars)}")
        print("\nPlease set the following environment variables:")
        for var in missing_vars:
            print(f"  - {var}")
        return

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )


if __name__ == "__main__":
    main()
```

## Step 4: Test the Basic Agent

Let's run the agent:

```bash
python src/agent.py dev
```

The `dev` command is special—it starts the agent in development mode, which:
- Creates a test room automatically
- Reloads on code changes
- Provides helpful logging

You should see output like:

```
2024-XX-XX XX:XX:XX - INFO - Starting agent worker in development mode
2024-XX-XX XX:XX:XX - INFO - Agent starting for room: dev-room-XXXX
2024-XX-XX XX:XX:XX - INFO - Waiting for participant...
```

To test the agent:
1. Go to [meet.livekit.io](https://meet.livekit.io)
2. Connect to your LiveKit server
3. Join the development room
4. Start talking!

## Step 5: Add Function Tools

Now let's make our agent more capable by adding function tools. These let the agent perform actions like checking the time or weather.

Create `src/agent_with_tools.py`:

```python
"""
LiveKit Voice Agent with Deepgram STT/TTS and Function Tools
"""

import os
import logging
from datetime import datetime, timezone
from typing import Annotated
from dotenv import load_dotenv

from livekit.agents import (
    Agent,
    AgentSession,
    JobContext,
    WorkerOptions,
    cli,
    llm,
)
from livekit.plugins import deepgram, openai

load_dotenv()
logger = logging.getLogger("deepgram-livekit-agent-tools")
```

Now let's define our tools using the `@llm.function_tool` decorator:

```python
@llm.function_tool
def get_current_time(
    tz: Annotated[str, "The timezone to get the time for, e.g., 'UTC', 'EST', 'PST'"] = "UTC"
) -> str:
    """Get the current time in a specified timezone."""
    current = datetime.now(timezone.utc)
    return f"The current time in {tz} is {current.strftime('%I:%M %p on %B %d, %Y')}"


@llm.function_tool
def calculate(
    expression: Annotated[str, "A mathematical expression to evaluate, e.g., '2 + 2' or '15 * 3'"]
) -> str:
    """Evaluate a simple mathematical expression."""
    try:
        # Safety: only allow basic math operations
        allowed = set("0123456789+-*/().% ")
        if not all(c in allowed for c in expression):
            return "Sorry, I can only handle basic math with numbers and operators (+, -, *, /, %)"
        result = eval(expression)
        return f"The result of {expression} is {result}"
    except Exception as e:
        return f"I couldn't calculate that: {str(e)}"


@llm.function_tool
def get_weather(
    city: Annotated[str, "The city to get weather for, e.g., 'San Francisco', 'New York'"]
) -> str:
    """Get the current weather for a city (mock implementation)."""
    mock_weather = {
        "san francisco": "65°F, partly cloudy with a chance of fog",
        "new york": "72°F, sunny with light breeze",
        "london": "58°F, overcast with light rain",
        "tokyo": "78°F, clear skies",
    }
    
    city_lower = city.lower()
    if city_lower in mock_weather:
        return f"The weather in {city} is currently {mock_weather[city_lower]}"
    else:
        return f"I don't have weather data for {city}, but it's probably lovely there!"
```

The `@llm.function_tool` decorator does several things:
1. Registers the function as a tool the LLM can call
2. Extracts the function signature for the LLM to understand
3. Uses `Annotated` types for parameter descriptions

Now update the agent to include tools:

```python
class VoiceAssistantWithTools(Agent):
    """A conversational voice assistant with function tools."""

    def __init__(self):
        super().__init__(
            instructions="""You are a helpful voice assistant powered by Deepgram and LiveKit.
            
You have access to the following tools:
- get_current_time: Get the current time in different timezones
- calculate: Perform mathematical calculations
- get_weather: Get weather information for cities

You should:
- Be conversational and friendly
- Use your tools when users ask about time, math, or weather
- Keep responses concise (1-3 sentences) since this is a voice conversation
- Be helpful and proactive in offering assistance

Remember: You're speaking, not writing, so be natural and conversational.""",
            stt=deepgram.STT(
                model="nova-3",
                language="en-US",
                punctuate=True,
                smart_format=True,
                filler_words=True,
            ),
            tts=deepgram.TTS(
                model="aura-2-andromeda-en",
                sample_rate=24000,
            ),
            llm=openai.LLM(
                model="gpt-4o-mini",
                temperature=0.7,
            ),
            tools=[get_current_time, calculate, get_weather],  # Add tools here!
        )
```

The key addition is `tools=[get_current_time, calculate, get_weather]`. The LLM will automatically use these tools when appropriate.

## Step 6: Write Tests

Good examples need good tests. Let's create tests that verify our integration works.

Create `tests/test_deepgram_integration.py`:

```python
"""
Integration tests for Deepgram STT and TTS with LiveKit Agents.
"""

import os
import sys
import asyncio
import aiohttp

DEEPGRAM_API_KEY = os.getenv("DEEPGRAM_API_KEY")

if not DEEPGRAM_API_KEY:
    print("DEEPGRAM_API_KEY not set - skipping tests")
    sys.exit(2)


def test_deepgram_stt_initialization():
    """Test that Deepgram STT can be initialized."""
    from livekit.plugins import deepgram
    
    stt = deepgram.STT(
        model="nova-3",
        language="en-US",
        api_key=DEEPGRAM_API_KEY,
    )
    
    assert stt is not None
    print("✓ Deepgram STT initialization successful")


async def test_deepgram_tts_synthesis():
    """Test that Deepgram TTS can synthesize speech."""
    from livekit.plugins import deepgram
    
    async with aiohttp.ClientSession() as session:
        tts = deepgram.TTS(
            model="aura-2-andromeda-en",
            sample_rate=24000,
            api_key=DEEPGRAM_API_KEY,
            http_session=session,
        )
        
        text = "Hello, this is a test."
        synthesis = tts.synthesize(text)
        
        audio_chunks = []
        async for event in synthesis:
            if hasattr(event, 'frame') and event.frame is not None:
                audio_chunks.append(event.frame.data)
        
        total_bytes = sum(len(chunk) for chunk in audio_chunks)
        assert total_bytes > 0, "Expected audio data"
        print(f"✓ Deepgram TTS synthesis successful ({total_bytes} bytes)")


def run_tests():
    """Run all tests."""
    test_deepgram_stt_initialization()
    
    loop = asyncio.new_event_loop()
    loop.run_until_complete(test_deepgram_tts_synthesis())
    loop.close()
    
    print("All tests passed!")


if __name__ == "__main__":
    run_tests()
```

Run the tests:

```bash
python tests/test_deepgram_integration.py
```

You should see:

```
✓ Deepgram STT initialization successful
✓ Deepgram TTS synthesis successful (XXXXX bytes)
All tests passed!
```

## Step 7: Understanding the Voice Flow

Here's what happens when you speak to the agent:

1. **Audio Capture**: LiveKit captures your microphone audio and streams it to the agent
2. **Speech-to-Text**: Deepgram Nova-3 transcribes your speech in real-time
3. **LLM Processing**: The transcript is sent to GPT-4o-mini, which generates a response
4. **Tool Execution**: If the LLM decides to use a tool, it's executed automatically
5. **Text-to-Speech**: Deepgram Aura converts the response to natural speech
6. **Audio Playback**: LiveKit streams the audio back to you

All of this happens in under a second for typical utterances!

## Step 8: Customizing Voices

Deepgram offers multiple voice options. Here are some popular choices:

```python
# Warm, professional female voice
tts=deepgram.TTS(model="aura-2-andromeda-en")

# Confident male voice
tts=deepgram.TTS(model="aura-2-helios-en")

# Friendly, conversational female voice
tts=deepgram.TTS(model="aura-2-luna-en")
```

You can also adjust other TTS parameters:

```python
tts=deepgram.TTS(
    model="aura-2-andromeda-en",
    sample_rate=24000,  # Audio quality (16000, 24000, or 48000)
)
```

## Step 9: Production Deployment

For production, you'll want to run without the `dev` flag:

```bash
python src/agent_with_tools.py start
```

This connects to your LiveKit server and waits for job dispatches. You'll need a separate service to dispatch jobs when rooms are created—see the [LiveKit Agents deployment guide](https://docs.livekit.io/agents/deployment/).

## Common Issues and Solutions

### "Missing required environment variables"

Ensure all variables are set in your `.env` file. The agent checks for:
- `DEEPGRAM_API_KEY`
- `OPENAI_API_KEY`
- `LIVEKIT_URL`
- `LIVEKIT_API_KEY`
- `LIVEKIT_API_SECRET`

### "Connection error" from LiveKit

- Verify your `LIVEKIT_URL` starts with `wss://`
- Check that your API key and secret are correct
- Ensure your LiveKit server is running

### Audio quality issues

- Test your microphone in another application first
- Try increasing the TTS sample rate
- Check your network latency

## What's Next

Now that you have a working voice agent, here are some ideas for extending it:

1. **Add more tools** - Integrate with real APIs for weather, calendar, search, etc.
2. **Conversation memory** - Use `chat_ctx` to maintain conversation history
3. **Phone integration** - Connect via SIP trunk for phone calls
4. **Multi-language** - Change `language` in STT and use different TTS voices
5. **Custom VAD** - Fine-tune voice activity detection for your use case

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Deepgram STT Documentation](https://developers.deepgram.com/docs/stt-streaming-feature-overview)
- [Deepgram TTS Documentation](https://developers.deepgram.com/docs/text-to-speech)
- [Deepgram Voice Models](https://developers.deepgram.com/docs/models-overview)

Happy building! 🎙️
