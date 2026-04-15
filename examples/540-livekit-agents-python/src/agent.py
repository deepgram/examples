"""
LiveKit Voice Agent with Deepgram STT/TTS

This example demonstrates a conversational voice AI agent using:
- LiveKit Agents framework for real-time communication
- Deepgram Nova-3 for speech-to-text (STT)
- Deepgram Aura for text-to-speech (TTS)
- OpenAI GPT-4o-mini for the LLM backbone
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


def main():
    """Main entry point for the LiveKit agent worker."""
    # Check for critical API keys - LiveKit credentials are validated by the CLI
    critical_vars = ["DEEPGRAM_API_KEY", "OPENAI_API_KEY"]
    missing = [var for var in critical_vars if not os.getenv(var)]
    
    if missing:
        print(f"Error: Missing required environment variables: {', '.join(missing)}")
        print("\nPlease set the following in your .env file:")
        for var in missing:
            print(f"  {var}=your_key_here")
        print("\nAlso ensure LiveKit credentials are set:")
        print("  LIVEKIT_URL=wss://your-app.livekit.cloud")
        print("  LIVEKIT_API_KEY=your_api_key")
        print("  LIVEKIT_API_SECRET=your_api_secret")
        return

    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )


if __name__ == "__main__":
    main()
