"""
LiveKit Voice Agent with Deepgram STT/TTS and Function Tools

This example demonstrates a conversational voice AI agent with custom tools using:
- LiveKit Agents framework for real-time communication
- Deepgram Nova-3 for speech-to-text (STT)
- Deepgram Aura for text-to-speech (TTS)
- OpenAI GPT-4o-mini for the LLM backbone
- Custom function tools for extended capabilities
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

# Load environment variables
load_dotenv()

# Configure logging
logger = logging.getLogger("deepgram-livekit-agent-tools")


# Define custom tools using the function_tool decorator
@llm.function_tool
def get_current_time(
    tz: Annotated[str, "The timezone to get the time for, e.g., 'UTC', 'EST', 'PST'"] = "UTC"
) -> str:
    """Get the current time in a specified timezone."""
    # For simplicity, we'll just return UTC time
    # In a real app, you'd use pytz or similar for proper timezone handling
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
    # Mock weather data - in a real app, you'd call a weather API
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
            tools=[get_current_time, calculate, get_weather],
        )


async def entrypoint(ctx: JobContext):
    """Entry point for the LiveKit agent job."""
    logger.info(f"Agent with tools starting for room: {ctx.room.name}")

    # Connect to the LiveKit room
    await ctx.connect()

    # Create an agent session
    session = AgentSession()

    # Create our voice assistant with tools
    assistant = VoiceAssistantWithTools()

    # Start the agent session
    await session.start(
        agent=assistant,
        room=ctx.room,
    )

    # Wait for a participant to join
    participant = await ctx.wait_for_participant()
    logger.info(f"Participant joined: {participant.identity}")

    # Greet the user
    await session.say(
        "Hello! I'm your voice assistant powered by Deepgram. "
        "I can help you with the time, weather, or math calculations. "
        "What would you like to know?"
    )

    logger.info("Agent with tools is now listening and ready to respond")


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
