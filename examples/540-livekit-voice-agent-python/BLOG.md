# Building a Real-Time Voice Agent with LiveKit and Deepgram

In this tutorial, we'll build a voice-based AI assistant that can have natural conversations with users in real-time. We'll use LiveKit's Agents framework for the real-time communication infrastructure, Deepgram for speech recognition and synthesis, and OpenAI for the conversational intelligence.

## What We're Building

Our voice agent will:
- Join a LiveKit room and listen for user speech
- Transcribe speech in real-time using Deepgram's Nova-3 model
- Generate intelligent responses using OpenAI's GPT-4o-mini
- Speak responses back using Deepgram's Aura-2 voices
- Handle natural turn-taking and interruptions

The end result is a conversational AI you can talk to just like a human—with low latency and natural voice quality.

## Prerequisites

Before we start, make sure you have:
- Python 3.10 or later
- A Deepgram account ([sign up free](https://console.deepgram.com/))
- A LiveKit Cloud account ([get started](https://cloud.livekit.io/))
- An OpenAI account with API access

## Project Setup

Let's start by creating our project structure:

```bash
mkdir livekit-voice-agent
cd livekit-voice-agent
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

Create a `requirements.txt` file with our dependencies:

```
# LiveKit Agents framework
livekit-agents>=1.5.0

# Deepgram plugins for STT and TTS
livekit-plugins-deepgram>=1.5.0

# OpenAI plugin for LLM
livekit-plugins-openai>=1.5.0

# Silero plugin for Voice Activity Detection
livekit-plugins-silero>=1.5.0

# Additional dependencies
python-dotenv>=1.0.0
```

Install the dependencies:

```bash
pip install -r requirements.txt
```

## Understanding the Architecture

Before we write code, let's understand how LiveKit Agents works:

```
┌─────────────────────────────────────────────────────────────────┐
│                        LiveKit Room                              │
│                                                                  │
│  ┌──────────┐    Audio    ┌──────────────────────────────────┐  │
│  │   User   │ ──────────► │          Voice Agent             │  │
│  │ (Browser)│             │                                  │  │
│  │          │ ◄────────── │  VAD → STT → LLM → TTS          │  │
│  └──────────┘    Audio    │       (Deepgram)  (Deepgram)    │  │
│                           └──────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

1. **User connects** to a LiveKit room via browser
2. **Audio streams** to the agent in real-time
3. **VAD** (Voice Activity Detection) detects when the user speaks
4. **STT** (Deepgram Nova-3) transcribes speech to text
5. **LLM** (OpenAI) generates a response
6. **TTS** (Deepgram Aura-2) synthesizes speech
7. **Audio streams** back to the user

The LiveKit Agents framework handles all the complexity of managing these streams, detecting turns, handling interruptions, and more.

## Creating the Agent

Create `src/agent.py`:

```python
"""
LiveKit Voice Agent with Deepgram STT and TTS.
"""

import logging
from livekit.agents import Agent, AgentSession, JobContext
from livekit.agents.cli import run_app
from livekit.plugins import deepgram, openai, silero

logger = logging.getLogger("voice-agent")


async def entrypoint(ctx: JobContext) -> None:
    """Main entrypoint for the agent session."""
    
    logger.info(f"Agent joining room: {ctx.room.name}")
    
    # Connect to the LiveKit room
    await ctx.connect()
    
    # Initialize the Deepgram STT plugin
    deepgram_stt = deepgram.STT(
        model="nova-3",
        language="en-US",
        interim_results=True,
        punctuate=True,
        filler_words=True,
        endpointing_ms=25,
    )
    
    # Initialize the Deepgram TTS plugin
    deepgram_tts = deepgram.TTS(
        model="aura-2-andromeda-en",
        sample_rate=24000,
    )
    
    # Initialize the OpenAI LLM
    openai_llm = openai.LLM(
        model="gpt-4o-mini",
        temperature=0.7,
    )
    
    # Initialize Voice Activity Detection
    vad = silero.VAD.load()
    
    # Create the agent with instructions
    agent = Agent(
        instructions="""You are a helpful voice assistant powered by Deepgram and LiveKit.
        
Your role is to:
- Have natural, friendly conversations with users
- Answer questions clearly and concisely
- Be helpful and informative
- Keep responses brief since this is a voice conversation

Remember: You're speaking, not writing. Keep your responses conversational.""",
    )
    
    # Create and start the agent session
    session = AgentSession(
        stt=deepgram_stt,
        tts=deepgram_tts,
        llm=openai_llm,
        vad=vad,
    )
    
    await session.start(room=ctx.room, agent=agent)
    logger.info("Agent session started successfully")


if __name__ == "__main__":
    from livekit.agents import AgentServer
    
    server = AgentServer()
    
    @server.rtc_session
    async def _entrypoint(ctx: JobContext) -> None:
        await entrypoint(ctx)
    
    run_app(server)
```

Let's break down the key components:

### Deepgram STT Configuration

```python
deepgram_stt = deepgram.STT(
    model="nova-3",           # Latest and most accurate model
    language="en-US",         # Primary language
    interim_results=True,     # Get partial transcripts as user speaks
    punctuate=True,           # Automatic punctuation
    filler_words=True,        # Include "um", "uh" for natural turn detection
    endpointing_ms=25,        # Quick response to silence
)
```

Nova-3 is Deepgram's latest model with the best accuracy. The `interim_results=True` setting is crucial for responsive agents—it lets the agent start processing before the user finishes speaking.

### Deepgram TTS Configuration

```python
deepgram_tts = deepgram.TTS(
    model="aura-2-andromeda-en",  # Natural female voice
    sample_rate=24000,             # High quality audio
)
```

Aura-2 is Deepgram's latest text-to-speech model, offering natural-sounding voices with low latency. The `andromeda-en` voice is conversational and works well for assistant use cases.

### Agent Instructions

The agent's instructions shape its personality and behavior. For voice agents, it's important to emphasize:
- **Brevity**: Long responses are tiresome to listen to
- **Conversational tone**: Written text sounds robotic when spoken
- **Clarity**: Avoid complex sentence structures

## Environment Configuration

Create a `.env` file (copy from `.env.example`):

```bash
# Deepgram API key
DEEPGRAM_API_KEY=your_deepgram_api_key

# LiveKit credentials
LIVEKIT_URL=wss://your-app.livekit.cloud
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_api_secret

# OpenAI API key
OPENAI_API_KEY=your_openai_api_key
```

### Getting Your API Keys

**Deepgram:**
1. Go to [console.deepgram.com](https://console.deepgram.com/)
2. Create a new API key with STT and TTS permissions

**LiveKit:**
1. Go to [cloud.livekit.io](https://cloud.livekit.io/)
2. Create a new project
3. Copy the URL, API Key, and API Secret from the Settings page

**OpenAI:**
1. Go to [platform.openai.com](https://platform.openai.com/)
2. Create a new API key

## Running the Agent

Start the agent in development mode:

```bash
python src/agent.py dev
```

You'll see output like:

```
INFO - Starting agent in development mode
INFO - Agent server listening on port 8081
INFO - Registered with LiveKit server
```

Now open the [LiveKit Agents Playground](https://agents-playground.livekit.io/):

1. Enter your LiveKit URL
2. Click "Connect"
3. Grant microphone access
4. Start talking!

The agent will transcribe your speech, generate a response, and speak back to you.

## Understanding the Agent Pipeline

When you speak, here's what happens:

1. **Audio capture**: LiveKit captures your microphone audio
2. **VAD processing**: Silero VAD detects speech boundaries
3. **Streaming STT**: Deepgram transcribes audio in real-time
4. **Turn detection**: Agent decides when you've finished speaking
5. **LLM inference**: OpenAI generates a response
6. **Streaming TTS**: Deepgram synthesizes speech
7. **Audio playback**: LiveKit plays audio to your speakers

The framework handles all of this automatically, including:
- **Interruption handling**: If you speak while the agent is talking, it stops
- **Turn management**: Natural conversation flow
- **Error recovery**: Automatic retries on transient failures

## Customizing the Agent

### Changing the Voice

Deepgram offers several Aura-2 voices:

```python
deepgram_tts = deepgram.TTS(
    model="aura-2-orion-en",   # Male voice
    # model="aura-2-luna-en",  # Female, more casual
    # model="aura-2-stella-en", # British female
)
```

### Adjusting STT Sensitivity

For noisy environments, adjust endpointing:

```python
deepgram_stt = deepgram.STT(
    model="nova-3",
    endpointing_ms=100,  # Wait longer before ending turn
    filler_words=False,  # Ignore filler words
)
```

### Multi-language Support

Deepgram supports 30+ languages:

```python
deepgram_stt = deepgram.STT(
    model="nova-3",
    language="es",  # Spanish
    # language="fr",  # French
    # language="de",  # German
)
```

### Adding Tools

Give your agent capabilities:

```python
from livekit.agents import llm

@llm.function_tool
async def get_weather(location: str) -> str:
    """Get the current weather for a location."""
    # Implementation here
    return f"The weather in {location} is sunny and 72°F"

agent = Agent(
    instructions="You are a helpful assistant that can check the weather.",
    tools=[get_weather],
)
```

## Testing Your Agent

Create `tests/test_deepgram_connection.py` to verify your setup:

```python
import asyncio
import os
import aiohttp
from livekit.plugins import deepgram

async def test_tts():
    """Test Deepgram TTS."""
    async with aiohttp.ClientSession() as session:
        tts = deepgram.TTS(
            model="aura-2-andromeda-en",
            http_session=session,
        )
        
        audio_bytes = 0
        async for chunk in tts.synthesize("Hello, this is a test."):
            audio_bytes += len(chunk.frame.data)
        
        print(f"✓ TTS generated {audio_bytes} bytes of audio")

if __name__ == "__main__":
    asyncio.run(test_tts())
```

Run the test:

```bash
python tests/test_deepgram_connection.py
```

## Production Deployment

For production, run the agent in server mode:

```bash
python src/agent.py start
```

This registers the agent with your LiveKit server. When users join rooms, LiveKit automatically dispatches agents to serve them.

### Scaling Considerations

- **Multiple workers**: Run multiple agent processes for high availability
- **Load balancing**: LiveKit handles distribution automatically
- **Monitoring**: Use the built-in Prometheus metrics endpoint

## What's Next

Now that you have a basic voice agent working, consider:

1. **Add memory**: Store conversation history for context
2. **Implement tools**: Give the agent capabilities like web search, calendar access
3. **Custom wake words**: Trigger the agent with specific phrases
4. **Sentiment analysis**: Adjust responses based on user emotion
5. **Multi-modal**: Add video understanding using the video sampler

## Resources

- [LiveKit Agents Documentation](https://docs.livekit.io/agents/)
- [Deepgram API Reference](https://developers.deepgram.com/reference/)
- [LiveKit Agents GitHub](https://github.com/livekit/agents)
- [Deepgram Nova-3 Announcement](https://deepgram.com/learn/nova-3-speech-to-text-api)
- [Deepgram Aura-2 TTS](https://deepgram.com/learn/aura-2-text-to-speech-api)

## Conclusion

You've built a fully functional voice AI agent that combines:
- LiveKit's real-time infrastructure
- Deepgram's industry-leading speech AI
- OpenAI's conversational intelligence

The LiveKit Agents framework handles the complexity of real-time voice applications, letting you focus on building great experiences. Deepgram's low-latency STT and natural TTS make conversations feel fluid and natural.

Happy building! 🎙️
