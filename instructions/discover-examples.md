# Instruction: Discover New Example Opportunities

You are an agent working in the `dx-examples` repository for Deepgram. Your task is to find platforms, frameworks, and ecosystems that would benefit from a Deepgram integration example — and raise a PR for each new one you decide to build, or create queue issues for ideas you want to defer.

## Context

Deepgram provides:
- **Speech-to-text (STT)** — real-time and batch transcription
- **Text-to-speech (TTS)** — voice synthesis
- **Voice agents** — full conversational AI voice experiences
- **Audio intelligence** — summarization, sentiment, topic detection, etc.

A good example demonstrates a real integration pattern that a developer would actually use. It should be minimal but complete — not a toy, not overengineered.

## Slugification convention

```bash
slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed 's/[^a-z0-9]/-/g' \
    | sed 's/-\+/-/g' \
    | sed 's/^-//;s/-$//'
}
```

## Step 1 — Read current state

1. List existing examples:
   ```bash
   ls examples/ | sort
   ```

2. Collect rejected example slugs from closed-but-unmerged PRs:
   ```bash
   gh pr list --state closed --label "type:example" \
     --json number,title,body,mergedAt --limit 200 \
     | jq '[.[] | select(.mergedAt == null)]'
   ```
   Parse `<!-- metadata ... -->` blocks in each body to extract `slug:` values. These are rejections — do not re-propose them.

3. Collect in-progress example slugs from open PRs:
   ```bash
   gh pr list --state open --label "type:example" --json title,body --limit 100
   ```

4. Collect queued example slugs from open issues:
   ```bash
   gh issue list --label "queue:new-example" --state open --json title,body --limit 100
   ```

## Step 2 — Research new integration opportunities

Search across these categories. For each, assess: does Deepgram have an existing example? Is this a real integration pattern developers need?

### Partner platforms (communications / telephony)
- Twilio Voice, Media Streams, Flex
- Vonage / Nexmo Voice API
- Bandwidth voice API
- Zoom Phone / Video SDK
- Daily.co real-time audio
- Agora voice SDK

### Voice / agent infrastructure (uses Deepgram as provider — not competitors)
- LiveKit agents (uses Deepgram STT/TTS)
- Pipecat voice pipeline (uses Deepgram STT/TTS)
- Bolna voice agent framework
- Vapi.ai (uses Deepgram as STT provider)

### AI frameworks / toolkits
- LangChain (Python and JS) — STT as a tool
- LlamaIndex — audio processing nodes
- Vercel AI SDK — speech streaming
- TanStack AI
- Semantic Kernel (C#)
- Haystack
- AutoGen / CrewAI — voice-enabled agents

### Frontend frameworks
- React + Web Audio API
- Next.js server-sent events for live transcription
- Vue 3 composables for STT
- SvelteKit
- Nuxt
- Remix

### Backend frameworks
- Express.js + WebSocket live transcription
- Fastify
- FastAPI (Python) + streaming
- Flask
- Django Channels
- Go net/http + WebSocket
- Gin
- Echo

### Cloud / serverless
- AWS Lambda transcription pipeline
- AWS Transcribe replacement demo
- Google Cloud Functions
- Azure Functions
- Cloudflare Workers
- Vercel Edge Functions

### Workflow / automation
- n8n community node (competitors have this)
- Make.com (Integromat)
- Zapier integration

### Mobile (if SDK exists or REST is usable)
- React Native
- Flutter / Dart

### Miscellaneous
- Slack Bolt — transcribe audio messages
- Discord bot — transcribe voice channels
- Electron desktop app — live meeting notes
- CLI tool using Node.js / Python SDK

Use web search and WebFetch to verify that an integration is real and useful:
```bash
# Check npm / PyPI for relevant packages
# Check GitHub for existing examples or community projects
# Check Deepgram docs for existing guides
```

## Step 3 — Decide what to build

For each candidate integration:

1. Check it's not already in `examples/`, open PRs, open issues, or rejections
2. Assess priority (1–10):
   - 8–10: Major platform, many developers, no existing Deepgram example
   - 5–7: Useful but niche, or partial coverage exists
   - Below 5: Skip
3. Pick the top 3–5 to act on this run

## Step 4 — Find the next example number

```bash
LAST=$(ls examples/ | grep -E '^[0-9]' | sort -n | tail -1 | grep -oE '^[0-9]+')
NEXT=$(( ${LAST:-0} + 10 ))
printf "%03d" $NEXT
```

## Step 5 — For each chosen integration, create an example

Read and follow `instructions/create-example.md` for each integration.

Pass it the following context:
- Integration name and slug
- Language to use (pick the most natural language for this integration)
- Products to demonstrate (stt, tts, agent, intelligence)
- Next available example number

## Step 6 — For ideas you want to defer, create queue issues

For integrations you found but don't want to build right now (priority 5–7):

```bash
gh issue create \
  --title "Queue: {Integration} example ({language})" \
  --label "queue:new-example" \
  --body "$(cat <<'EOF'
## Integration: {Integration Name}

<!-- metadata
type: queue
slug: {slug}
language: {language}
products: {products}
priority: {score}/10
-->

### Why this is valuable
{2-3 sentences}

### Suggested approach
{Brief description of what the example should show}

### Reference
{Link to integration's documentation or SDK}

---
*Queued by discover-examples agent on {date}*
EOF
)"
```

## Rules

- Do not re-propose integrations that already exist, are in open PRs, or were rejected (closed without merge)
- Do not build examples for direct Deepgram competitors (AssemblyAI, ElevenLabs standalone, etc.)
- DO build examples for infrastructure that uses Deepgram as a provider (LiveKit, Pipecat, Vapi)
- One example per PR
- If you find 0 new opportunities, that is fine — do not raise empty PRs
- Do not modify existing examples
