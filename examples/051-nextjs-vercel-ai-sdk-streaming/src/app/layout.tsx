import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deepgram Streaming STT + TTS — Next.js",
  description:
    "Real-time speech-to-text and text-to-speech with Deepgram via the Vercel AI SDK",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: "2rem" }}>
        {children}
      </body>
    </html>
  );
}
