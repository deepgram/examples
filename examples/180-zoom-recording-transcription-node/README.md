# Zoom Cloud Recording Transcription with Deepgram

Automatically transcribe Zoom cloud recordings using Deepgram's nova-3 speech-to-text model. When a Zoom meeting recording completes, this server receives the webhook, downloads the audio, and produces a formatted transcript with speaker labels.

## What you'll build

A Node.js/Express server that receives Zoom `recording.completed` webhook events, downloads the recording via Zoom's Server-to-Server OAuth, and transcribes it using Deepgram nova-3 with speaker diarization and smart formatting.

## Prerequisites

- Node.js 18 or later
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- Zoom account with a Server-to-Server OAuth app — [create one](https://developers.zoom.us/docs/internal-apps/create/)

## Environment variables

Copy `.env.example` to `.env` and fill in your credentials:

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console → API Keys](https://console.deepgram.com/) |
| `ZOOM_ACCOUNT_ID` | [Zoom Marketplace](https://marketplace.zoom.us/) → your Server-to-Server OAuth app → App Credentials |
| `ZOOM_CLIENT_ID` | Same app → App Credentials |
| `ZOOM_CLIENT_SECRET` | Same app → App Credentials |
| `ZOOM_WEBHOOK_SECRET_TOKEN` | Same app → Feature tab → Event Subscriptions → Secret Token |

## Install and run

```bash
npm install
npm start
```

The server starts on port 3000 (override with `PORT` env var). Expose it publicly with a tunnel for Zoom webhooks:

```bash
npx localtunnel --port 3000
```

## Zoom app setup

1. Go to [Zoom Marketplace](https://marketplace.zoom.us/) → Develop → Build App
2. Choose **Server-to-Server OAuth**
3. Add scopes: `cloud_recording:read:list_recording_files:admin`
4. Under **Feature** → **Event Subscriptions**, add:
   - Event subscription URL: `https://your-domain.com/webhook`
   - Event type: `recording.completed`
5. Zoom will send a validation request — the server handles it automatically

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's latest general-purpose STT model |
| `smart_format` | `true` | Adds punctuation, capitalization, number formatting |
| `diarize` | `true` | Labels speakers (Speaker 0, Speaker 1, etc.) |
| `paragraphs` | `true` | Groups transcript into readable paragraphs |

## How it works

1. A Zoom cloud recording finishes → Zoom fires a `recording.completed` webhook
2. The server validates the webhook signature using your secret token
3. It extracts the recording download URL from the payload, preferring audio-only files
4. It authenticates with Zoom's Server-to-Server OAuth to get an access token
5. It downloads the recording audio file
6. It sends the audio buffer to Deepgram's pre-recorded STT API (`transcribeFile`)
7. Deepgram returns a transcript with speaker labels and smart formatting
8. The transcript is logged (extend this to store, email, or post to Slack)

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
