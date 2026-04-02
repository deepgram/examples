# n8n Community Nodes for Deepgram

An n8n community node package that exposes Deepgram's core speech AI APIs — transcription (pre-recorded), text-to-speech, and audio intelligence — as drag-and-drop nodes in n8n workflow automations.

## What you'll build

A reusable n8n community node package (`n8n-nodes-deepgram`) that adds a **Deepgram** node to n8n with three resources: **Transcription** (speech-to-text via pre-recorded audio URL or file upload), **Text-to-Speech** (Aura 2 voice synthesis), and **Audio Intelligence** (summarization, topic detection, sentiment analysis). An example workflow is included that chains all three: transcribe audio → analyze it → speak the summary.

## Prerequisites

- Node.js 18+
- n8n installed locally or self-hosted — [install guide](https://docs.n8n.io/hosting/installation/)
- Deepgram account — [get a free API key](https://console.deepgram.com/)

## Environment variables

| Variable | Where to find it |
|----------|-----------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) → Settings → API Keys |

## Install and run

```bash
# Clone and enter the example directory
cd examples/230-n8n-deepgram-community-node-typescript

# Install dependencies
npm install

# Build the TypeScript source
npm run build

# Link the package into your local n8n installation
cd ~/.n8n
mkdir -p custom
cd custom
npm init -y
npm install /path/to/examples/230-n8n-deepgram-community-node-typescript

# Start n8n — the Deepgram node will appear in the node list
n8n start
```

### Import the example workflow

1. Open n8n in your browser (default: `http://localhost:5678`)
2. Go to **Workflows → Import from File**
3. Select `src/example-workflow.json`
4. Add your Deepgram API key in **Credentials → Deepgram API**
5. Click **Execute Workflow**

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram transcription model — best accuracy and speed |
| `smart_format` | `true` | Adds punctuation, capitalization, and number formatting |
| `diarize` | `false` | Speaker identification for multi-speaker audio |
| `voice` | `aura-2-thalia-en` | TTS voice model for speech synthesis |
| `summarize` | `v2` | Audio intelligence summarization engine |
| `topics` | `true` | Topic detection across the transcript |
| `sentiment` | `true` | Sentiment analysis per utterance |
| `tag` | `deepgram-examples` | Tags all API calls for console tracking |

## How it works

1. **Credential setup** — The Deepgram API credential type stores your API key and authenticates every request via `Authorization: Token <key>`. A built-in test call to `GET /v1/projects` validates the key on save.

2. **Transcription resource** — Accepts an audio URL or binary file input. Sends a `POST /v1/listen` request with configurable model, formatting, diarization, and language options. Returns the full Deepgram response including transcript, word timings, confidence scores, and metadata.

3. **Text-to-Speech resource** — Accepts text input and a voice model selection. Sends a `POST /v1/speak` request and returns the synthesized audio as binary data (MP3), ready to be saved or passed to downstream nodes.

4. **Audio Intelligence resource** — Sends audio to `POST /v1/listen` with intelligence features enabled (summarize, topics, sentiment, intents). Returns the transcript plus structured intelligence results.

5. **Example workflow** — Chains Transcription → Audio Intelligence → TTS: transcribe a NASA spacewalk recording, generate a summary with topic detection, then speak the summary aloud.

## Starter templates

[deepgram-starters](https://github.com/orgs/deepgram-starters/repositories)
