const { Deepgram } = require('@deepgram/sdk');
const { connect } = require('livekit-server-sdk');
require('dotenv').config();

function testEnvironmentVariables() {
  if (!process.env.DEEPGRAM_API_KEY || !process.env.LIVEKIT_API_KEY || !process.env.LIVEKIT_HOST) {
    console.error('MISSING_CREDENTIALS: Please provide the necessary environment variables in the .env file.');
    process.exit(2);
  }
}

async function testDeepgramAPI() {
  try {
    const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
    const result = await deepgram.transcription.preRecorded({
      url: 'https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav'
    });
    if (result) {
      console.log('Deepgram API test passed.');
    } else {
      throw new Error('Failed to get transcription result.');
    }
  } catch (error) {
    console.error('Deepgram API test failed:', error);
    process.exit(1);
  }
}

async function testLivekitConnection() {
  try {
    const room = await connect(process.env.LIVEKIT_HOST, process.env.LIVEKIT_API_KEY);
    if (room) {
      console.log('Livekit connection test passed.');
    } else {
      throw new Error('Failed to connect to Livekit host.');
    }
  } catch (error) {
    console.error('Livekit connection test failed:', error);
    process.exit(1);
  }
}

testEnvironmentVariables();
testDeepgramAPI();
testLivekitConnection();