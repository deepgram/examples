# LlamaIndex Audio Document Loader — Transcribe Audio into RAG Pipelines

Use Deepgram speech-to-text and Audio Intelligence to turn audio files into LlamaIndex Documents. Load podcasts, meetings, or lectures into a vector index and query them with natural language — all in a few lines of Python.

## What you'll build

A custom LlamaIndex `BaseReader` that transcribes audio URLs via Deepgram nova-3, enriches each Document with Audio Intelligence metadata (summary, topics, sentiment, entities), and feeds everything into a `VectorStoreIndex` for RAG-powered Q&A.

## Prerequisites

- Python 3.10+
- Deepgram account — [get a free API key](https://console.deepgram.com/)
- OpenAI account (for query mode) — [get an API key](https://platform.openai.com/api-keys)

## Environment variables

| Variable | Where to find it | Required for |
|----------|-----------------|-------------|
| `DEEPGRAM_API_KEY` | [Deepgram console](https://console.deepgram.com/) | Both modes |
| `OPENAI_API_KEY` | [OpenAI dashboard](https://platform.openai.com/api-keys) | Query mode only |

Copy `.env.example` to `.env` and fill in your values.

## Install and run

```bash
pip install -r requirements.txt

# Load audio into Documents — prints transcript and metadata
python src/audio_loader.py https://dpgr.am/spacewalk.wav

# Query mode — ask a question about the audio content
python src/audio_loader.py --query "What was the main topic discussed?" https://dpgr.am/spacewalk.wav
```

## Key parameters

| Parameter | Value | Description |
|-----------|-------|-------------|
| `model` | `nova-3` | Deepgram's latest and most accurate STT model |
| `smart_format` | `True` | Adds punctuation, capitalisation, and number formatting |
| `summarize` | `"v2"` | Generates a short summary of the audio content |
| `topics` | `True` | Detects topics discussed in the audio |
| `sentiment` | `True` | Analyses overall sentiment of the content |
| `detect_entities` | `True` | Extracts named entities (people, places, orgs) |

## How it works

1. `DeepgramAudioReader` implements LlamaIndex's `BaseReader` interface with a `load_data()` method
2. For each audio URL, it calls Deepgram's pre-recorded API (`transcribe_url`) with Audio Intelligence features enabled — Deepgram fetches the audio server-side
3. The transcript becomes `Document.text`; intelligence results (summary, topics, sentiment, entities) become `Document.metadata`
4. In query mode, the Documents are embedded via OpenAI and stored in a `VectorStoreIndex` for similarity search and LLM-powered answers

## Extending this example

- **Multiple audio files** — pass several URLs to build an index across many recordings
- **Custom metadata filters** — use LlamaIndex metadata filters to query only documents with specific topics or sentiment
- **Swap the vector store** — replace the in-memory default with Chroma, Pinecone, or Weaviate
- **Speaker diarization** — add `diarize=True` to split transcripts by speaker

## Related

- [Deepgram pre-recorded STT docs](https://developers.deepgram.com/docs/pre-recorded-audio)
- [Deepgram Audio Intelligence docs](https://developers.deepgram.com/docs/audio-intelligence)
- [Deepgram Python SDK](https://github.com/deepgram/deepgram-python-sdk)
- [LlamaIndex custom data loaders](https://docs.llamaindex.ai/en/stable/module_guides/loading/connector/)
- [LlamaIndex VectorStoreIndex](https://docs.llamaindex.ai/en/stable/module_guides/indexing/vector_store_index/)

## Starter templates

If you want a ready-to-run base for your own project, check the [deepgram-starters](https://github.com/orgs/deepgram-starters/repositories) org — there are starter repos for every language and every Deepgram product.
