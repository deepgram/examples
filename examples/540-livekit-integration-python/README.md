# LiveKit and Deepgram Integration Example

![Screenshot](./screenshot.png)

This example demonstrates the integration of LiveKit with Deepgram for real-time audio transcription using Python.

## Prerequisites

- Python 3.x and pip installed
- Deepgram API Key
- Access to a LiveKit server

## Environment Variables

- `DEEPGRAM_API_KEY`: Your Deepgram API key
- `LIVEKIT_WS_URL`: WebSocket URL for your LiveKit server

## How to Run the Example

1. Install dependencies: `pip install -r requirements.txt`
2. Set the environment variables
3. Run the script: `python3 src/main.py`

## Expected Output
The console will print real-time transcripts received from Deepgram.

## Note
Ensure your LiveKit server is running and accessible via WebSocket at the specified URL.