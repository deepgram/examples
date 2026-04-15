# Building a LiveKit Agent with Deepgram in Node.js

Integrating Deepgram with LiveKit in Node.js allows for real-time transcription capabilities during live sessions or calls. In this tutorial, we'll walk through the steps to set up and run a basic LiveKit session with Deepgram integration.

## Prerequisites

- Node.js installed on your machine
- Valid Deepgram API key
- Valid LiveKit API key and secret

## Step 1: Project Setup

Initialize a new Node.js project:

```bash
npm init -y
```

Install the necessary SDKs:

```bash
npm install @deepgram/sdk livekit-server-sdk
```

## Step 2: Implement the Integration

Create a new file `index.js` in the `src` folder and add:

```javascript
const { Deepgram } = require('@deepgram/sdk');
const { AccessToken } = require('livekit-server-sdk');

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const deepgram = new Deepgram(DEEPGRAM_API_KEY);

const main = async () => {
  console.log('Initializing LiveKit Agent with Deepgram...');
  // Here you would add logic for interacting with LiveKit, potentially creating rooms, starting sessions, etc.
  // Using deepgram for STT during a live call or session
  try {
    const response = await deepgram.transcription.live({
      // Placeholder audio socket connection
      url: 'wss://livekit.example.com/socket',
    });
    console.log('Deepgram Response:', response);
  } catch (err) {
    console.error('There was an error with Deepgram:', err);
  }

  // LiveKit JWT generation logic
  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity: 'user-id',
  });
  console.log('Generated LiveKit Access Token:', token.toJwt());
};

main();
```

## Step 3: Running the Example

Ensure your environment variables are set:

```bash
export DEEPGRAM_API_KEY=your_deepgram_api_key_here
export LIVEKIT_API_KEY=your_livekit_api_key_here
export LIVEKIT_API_SECRET=your_livekit_api_secret_here
```

Run the application:

```bash
node src/index.js
```

## Conclusion

This example provides a foundational approach to integrating Deepgram with LiveKit in Node.js. Extend this by handling audio from live calls for transcription or further processing.

### What's Next?
- Add error handling for network issues.
- Implement user interactions and real audio stream handling.
- Explore additional features offered by the Deepgram and LiveKit APIs.