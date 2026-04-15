# Building a Real-Time Voice AI Assistant with LiveKit and Deepgram

In this guide, we'll walk through building a voice AI assistant using LiveKit's agent framework alongside Deepgram for speech-to-text (STT), OpenAI for generating responses, and Cartesia for text-to-speech (TTS). This tutorial assumes familiarity with Python programming and basic understanding of real-time communication concepts.

## Prerequisites

1. **Accounts and Keys Required:**
   - **Deepgram Account:** Obtain a free API key from the [Deepgram Console](https://console.deepgram.com/).
   - **LiveKit Account:** You can use LiveKit Cloud or self-host your own instance. Sign up at [LiveKit Cloud](https://cloud.livekit.io/).
   - **OpenAI Account:** Get an API key from the [OpenAI Dashboard](https://platform.openai.com/api-keys).

2. **Environment Setup:** Ensure you have Python 3.10+ installed on your system. You can verify this with:
   ```bash
   python --version
   ```

3. **Dependencies Installation:**
   We'll be using various Python libraries, so make sure to install the required packages listed in `requirements.txt`:
   ```bash
   pip install -r requirements.txt
   ```

## Environment Configuration

Before you start coding, set up your environment variables. Create a `.env` file in the project root by copying `.env.example` and filling in your credentials:

```env
DEEPGRAM_API_KEY=your_deepgram_api_key
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_livekit_api_key
LIVEKIT_API_SECRET=your_livekit_secret
OPENAI_API_KEY=your_openai_api_key
```

## Building the Voice Assistant

### 1. Define the Agent Class

Start by defining a custom `VoiceAssistant` class that inherits from the `Agent` base class:

```python
class VoiceAssistant(Agent):
    """Minimal Voice Assistant built with LiveKit and Deepgram STT."""

    def __init__(self) -> None:
        super().__init__(
            instructions=(
                "You are a friendly voice assistant powered by Deepgram "
                "speech-to-text and LiveKit. Keep answers concise and "
                "conversational."
            ),
        )

    async def on_enter(self) -> None:
        self.session.generate_reply(
            instructions="Greet the user warmly and ask how you can help."
        )
```

### 2. Setup the LiveKit Server

Initialize an `AgentServer` and configure it to use plugins for STT, LLM (language model), and TTS:

```python
server = AgentServer()

def prewarm(proc: JobProcess) -> None:
    proc.userdata["vad"] = silero.VAD.load()

server.setup_fnc = prewarm

@server.rtc_session()
async def entrypoint(ctx: JobContext) -> None:
    ctx.log_context_fields = {"room": ctx.room.name}
    session = AgentSession(
        stt=inference.STT("deepgram/nova-3", language="multi"),
        llm=inference.LLM("openai/gpt-4.1-mini"),
        tts=inference.TTS(
            "cartesia/sonic-3",
            voice="9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        ),
        vad=ctx.proc.userdata["vad"],
        turn_detection=MultilingualModel(),
        preemptive_generation=True,
    )
    await session.start(
        agent=VoiceAssistant(),
        room=ctx.room,
    )
    await ctx.connect()
```

### 3. Running the Example

You can run your assistant in console mode to interact through your terminal:

```bash
python src/agent.py console
```

Alternatively, deploy as a dev worker to connect to your LiveKit server:

```bash
python src/agent.py dev
```

## Final Thoughts

This basic setup allows you to run a real-time conversational agent using Python. The integration showcase here with LiveKit and Deepgram can be enhanced with custom logic and additional plugins for more advanced use cases.

For further extensions, consider different models available in the Deepgram and OpenAI ecosystems or explore additional plugins available in the LiveKit framework. Happy coding!