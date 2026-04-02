import { NextRequest, NextResponse } from "next/server";
import { deepgram } from "@ai-sdk/deepgram";
import {
  experimental_generateSpeech as generateSpeech,
} from "ai";

// POST /api/speak  { text: "Hello world" }
// Returns raw linear16 PCM audio (24 kHz, mono) as application/octet-stream.
// Uses the Vercel AI SDK's generateSpeech() with the @ai-sdk/deepgram
// provider so the same code pattern works with any AI SDK speech provider.
export async function POST(req: NextRequest) {
  const apiKey = process.env.DEEPGRAM_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "DEEPGRAM_API_KEY is not configured" },
      { status: 500 },
    );
  }

  const { text } = await req.json();
  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }

  // ← generateSpeech() is provider-agnostic; deepgram.speech() routes to Deepgram Aura TTS
  const speech = await generateSpeech({
    model: deepgram.speech("aura-2-helena-en"),
    text,
    providerOptions: {
      deepgram: {
        // linear16 is raw PCM — easier for the browser to decode via AudioContext
        encoding: "linear16",
        sample_rate: 24000,
      },
    },
  });

  return new NextResponse(Buffer.from(speech.audio.uint8Array), {
    headers: {
      "Content-Type": "application/octet-stream",
      "X-Audio-Encoding": "linear16",
      "X-Audio-Sample-Rate": "24000",
    },
  });
}
