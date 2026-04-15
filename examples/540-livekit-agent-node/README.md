# LiveKit Agent Node.js Example

![Screenshot](./screenshot.png)

This example demonstrates integrating Deepgram with LiveKit using Node.js.

## Prerequisites
- Deepgram API Key
- LiveKit API Key and Secret

## Environment Variables
- `DEEPGRAM_API_KEY`: Your Deepgram API key
- `LIVEKIT_API_KEY`: Your LiveKit API key
- `LIVEKIT_API_SECRET`: Your LiveKit API secret

## Running the Example

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up your environment variables:
   ```bash
   export DEEPGRAM_API_KEY=your_deepgram_api_key_here
   export LIVEKIT_API_KEY=your_livekit_api_key_here
   export LIVEKIT_API_SECRET=your_livekit_api_secret_here
   ```

3. Run the application:
   ```bash
   node src/index.js
   ```

This will initialize a LiveKit session and connect to Deepgram for real-time transcription.

## Expected Output
You should see console logs for LiveKit JWT generation and Deepgram transcription response (or errors if encountered).