"""
LiveKit Voice Agent with Deepgram STT and TTS.

This example demonstrates how to build a voice-based AI agent using:
- LiveKit Agents framework for real-time communication
- Deepgram for speech-to-text (STT) using Nova-3
- Deepgram for text-to-speech (TTS) using Aura-2
- OpenAI for the LLM (GPT-4o)

The agent joins a LiveKit room and can have a real-time voice conversation
with users who connect to the same room.
"""

import logging
from livekit.agents import Agent, AgentSession, JobContext, JobProcess
from livekit.agents.cli import run_app
from livekit.plugins import deepgram, openai, silero


# Configure logging
logger = logging.getLogger("voice-agent")


async def entrypoint(ctx: JobContext) -> None:
    """Main entrypoint for the agent session."""
    
    logger.info(f"Agent joining room: {ctx.room.name}")
    
    # Connect to the LiveKit room
    await ctx.connect()
    
    # Initialize the Deepgram STT (Speech-to-Text) plugin
    # Nova-3 is Deepgram's latest and most accurate model
    deepgram_stt = deepgram.STT(
        model="nova-3",
        language="en-US",
        interim_results=True,
        punctuate=True,
        filler_words=True,
        endpointing_ms=25,
    )
    
    # Initialize the Deepgram TTS (Text-to-Speech) plugin  
    # Aura-2 provides natural, conversational voice synthesis
    deepgram_tts = deepgram.TTS(
        model="aura-2-andromeda-en",
        sample_rate=24000,
    )
    
    # Initialize the OpenAI LLM
    openai_llm = openai.LLM(
        model="gpt-4o-mini",
        temperature=0.7,
    )
    
    # Initialize Voice Activity Detection (VAD) using Silero
    # This helps detect when the user starts and stops speaking
    vad = silero.VAD.load()
    
    # Create the agent with custom instructions
    agent = Agent(
        instructions="""You are a helpful voice assistant powered by Deepgram and LiveKit.
        
Your role is to:
- Have natural, friendly conversations with users
- Answer questions clearly and concisely
- Be helpful and informative
- Keep responses brief since this is a voice conversation

Remember: You're speaking, not writing. Keep your responses conversational and 
avoid overly long explanations. If you need to explain something complex, 
break it into digestible parts and check if the user wants more detail.""",
    )
    
    # Create and start the agent session
    session = AgentSession(
        stt=deepgram_stt,
        tts=deepgram_tts,
        llm=openai_llm,
        vad=vad,
    )
    
    # Start the agent in the room
    await session.start(
        room=ctx.room,
        agent=agent,
    )
    
    logger.info("Agent session started successfully")


if __name__ == "__main__":
    # Create and run the agent server
    from livekit.agents import AgentServer
    
    server = AgentServer()
    
    @server.rtc_session
    async def _entrypoint(ctx: JobContext) -> None:
        await entrypoint(ctx)
    
    run_app(server)
