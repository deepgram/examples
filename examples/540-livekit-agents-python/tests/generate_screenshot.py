#!/usr/bin/env python3
"""
Generate a screenshot for the LiveKit Agents + Deepgram example.

Creates an HTML page showing the terminal output when the agent starts,
then uses Playwright to capture it at 1240x760.
"""

import asyncio
from playwright.async_api import async_playwright


HTML_CONTENT = """
<!DOCTYPE html>
<html>
<head>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Mono', 'Droid Sans Mono', monospace;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            min-height: 100vh;
            padding: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .terminal {
            background: #0d1117;
            border-radius: 12px;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
            width: 100%;
            max-width: 1160px;
            overflow: hidden;
        }
        .terminal-header {
            background: #161b22;
            padding: 12px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .terminal-dot {
            width: 12px;
            height: 12px;
            border-radius: 50%;
        }
        .terminal-dot.red { background: #ff5f56; }
        .terminal-dot.yellow { background: #ffbd2e; }
        .terminal-dot.green { background: #27c93f; }
        .terminal-title {
            color: #8b949e;
            font-size: 13px;
            margin-left: auto;
            margin-right: auto;
        }
        .terminal-content {
            padding: 24px;
            color: #c9d1d9;
            font-size: 14px;
            line-height: 1.6;
            min-height: 450px;
        }
        .prompt {
            color: #58a6ff;
        }
        .command {
            color: #f0f6fc;
        }
        .info {
            color: #8b949e;
        }
        .success {
            color: #3fb950;
        }
        .warning {
            color: #d29922;
        }
        .deepgram {
            color: #a855f7;
        }
        .livekit {
            color: #22d3ee;
        }
        .highlight {
            color: #ff7b72;
        }
        .header-box {
            border: 1px solid #30363d;
            border-radius: 6px;
            padding: 16px;
            margin-bottom: 20px;
            background: #161b22;
        }
        .header-title {
            font-size: 18px;
            color: #f0f6fc;
            margin-bottom: 8px;
        }
        .header-subtitle {
            color: #8b949e;
            font-size: 13px;
        }
        .divider {
            border-bottom: 1px solid #21262d;
            margin: 16px 0;
        }
        .log-line {
            margin: 4px 0;
        }
        .timestamp {
            color: #6e7681;
        }
        .level-info {
            color: #58a6ff;
        }
        .level-debug {
            color: #8b949e;
        }
        .badge {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 500;
            margin-left: 8px;
        }
        .badge-deepgram {
            background: rgba(168, 85, 247, 0.2);
            color: #a855f7;
        }
        .badge-livekit {
            background: rgba(34, 211, 238, 0.2);
            color: #22d3ee;
        }
        .badge-openai {
            background: rgba(16, 163, 127, 0.2);
            color: #10a37f;
        }
    </style>
</head>
<body>
    <div class="terminal">
        <div class="terminal-header">
            <div class="terminal-dot red"></div>
            <div class="terminal-dot yellow"></div>
            <div class="terminal-dot green"></div>
            <div class="terminal-title">python src/agent.py dev — LiveKit Voice Agent</div>
        </div>
        <div class="terminal-content">
            <div class="header-box">
                <div class="header-title">🎙️ LiveKit Voice Agent with Deepgram</div>
                <div class="header-subtitle">
                    Real-time voice AI using 
                    <span class="deepgram">Deepgram Nova-3</span> STT + 
                    <span class="deepgram">Aura</span> TTS
                </div>
            </div>
            
            <div class="log-line">
                <span class="prompt">$</span> <span class="command">python src/agent.py dev</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:01</span>
                <span class="level-info">[INFO]</span>
                <span class="info">Starting agent worker in development mode</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:01</span>
                <span class="level-info">[INFO]</span>
                <span class="info">Initializing plugins:</span>
            </div>
            
            <div class="log-line" style="margin-left: 20px;">
                <span class="success">✓</span> <span class="deepgram">Deepgram STT</span>
                <span class="badge badge-deepgram">nova-3</span>
            </div>
            
            <div class="log-line" style="margin-left: 20px;">
                <span class="success">✓</span> <span class="deepgram">Deepgram TTS</span>
                <span class="badge badge-deepgram">aura-2-andromeda-en</span>
            </div>
            
            <div class="log-line" style="margin-left: 20px;">
                <span class="success">✓</span> <span style="color: #10a37f;">OpenAI LLM</span>
                <span class="badge badge-openai">gpt-4o-mini</span>
            </div>
            
            <div class="divider"></div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:02</span>
                <span class="level-info">[INFO]</span>
                <span class="info">Connected to LiveKit server</span>
                <span class="badge badge-livekit">wss://app.livekit.cloud</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:02</span>
                <span class="level-info">[INFO]</span>
                <span class="info">Agent starting for room:</span>
                <span class="livekit">dev-room-abc123</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:03</span>
                <span class="level-info">[INFO]</span>
                <span class="info">Waiting for participant to join...</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:15</span>
                <span class="level-info">[INFO]</span>
                <span class="success">Participant joined:</span>
                <span class="highlight">user-john</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:15</span>
                <span class="level-info">[INFO]</span>
                <span class="deepgram">Speaking:</span>
                <span class="info">"Hello! I'm your voice assistant powered by Deepgram..."</span>
            </div>
            
            <div class="log-line">
                <span class="timestamp">2024-01-15 14:32:16</span>
                <span class="level-info">[INFO]</span>
                <span class="success">Agent is now listening and ready to respond</span> 🎤
            </div>
            
            <div class="divider"></div>
            
            <div class="log-line" style="opacity: 0.7;">
                <span class="info">Press Ctrl+C to stop the agent</span>
            </div>
        </div>
    </div>
</body>
</html>
"""


async def generate_screenshot():
    """Generate screenshot using Playwright."""
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page(viewport={"width": 1240, "height": 760})
        
        await page.set_content(HTML_CONTENT)
        await page.wait_for_timeout(500)  # Let styles render
        
        await page.screenshot(path="screenshot.png")
        print("✓ Screenshot saved to screenshot.png")
        
        await browser.close()


if __name__ == "__main__":
    asyncio.run(generate_screenshot())
