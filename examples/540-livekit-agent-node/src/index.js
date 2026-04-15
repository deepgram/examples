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