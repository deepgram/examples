# Contributing

This repo is primarily maintained by autonomous agents, but humans can direct and override agent decisions at any time.

## Requesting a new example

Use the **Queue: New Example** issue template. The agent picks this up on its next daily run and builds the example.

Alternatively, build it yourself using the [manual contribution](#manual-contribution) process below.

## Reviewing open PRs

The agent raises several PR types. Here's how to evaluate each:

### `type:example` — New example app

**Merge if:** The example is working, well-documented, and demonstrates a real use case.

**Close (reject) if:** The integration is a direct Deepgram competitor (not a partner), the example is trivially simple with no instructional value, or it duplicates an existing example.

**What happens after merge:** The `update-readme` workflow rebuilds the examples table in the root README automatically.

### `type:fix` — Bug fix to existing example

**Merge if:** The fix resolves the reported failure without breaking anything else.

**Close if:** The fix introduces new issues or the original example should be removed instead.

## Rejecting a PR

Close any PR without merging to reject it. Closed-unmerged PRs act as the agent's rejection memory — it will not re-propose the same integration.

To reverse a rejection, reopen the PR or create the example manually.

## Manual contribution

To add an example yourself:

1. Find the next available number:
   ```bash
   ls examples/ | sort -n | tail -1
   # Use that number + 10
   ```

2. Create the directory following the naming convention:
   ```bash
   mkdir -p examples/{NNN}-{slug}/{src,tests}
   ```

3. Required files:
   - `README.md` — description, prerequisites, env vars, how to run
   - `.env.example` — every required env var (no values, just `VAR_NAME=`)
   - Source code in `src/`
   - Tests in `tests/` that exit 0 on success, 1 on failure, 2 on missing credentials

4. Branch and PR:
   ```bash
   git checkout -b example/{slug}
   git add examples/{NNN}-{slug}/
   git commit -m "feat(examples): add {description}"
   git push origin example/{slug}
   gh pr create --title "[Example] {description}" \
     --label "type:example" \
     --body "..."
   ```

5. The PR body **must** include a metadata block so agents can parse it:
   ```html
   <!-- metadata
   type: example
   number: {NNN}
   slug: {slug}
   language: {node|python|go|rust|dotnet}
   products: {stt,tts,agent,intelligence}
   integrations: {platform or ecosystem slug}
   -->
   ```

## Credential handling

If an example requires external service credentials:

1. List all required env vars in `.env.example` (one per line, format: `VAR_NAME=`)
2. Tests should check for missing vars and exit with code `2` — this signals "missing credentials" to CI, not a real test failure
3. CI will post a comment tagging `@deepgram-devrel` with the list of needed secrets
4. The PR stays open until the secrets are added and tests pass

## What can agents build examples for?

**Yes:**
- Partners with a developer API (Twilio, Vonage, Zoom, etc.)
- AI frameworks and toolkits (LangChain, LlamaIndex, Vercel AI SDK, etc.)
- Frontend frameworks (React, Vue, Svelte, Next.js, Nuxt, etc.)
- Voice/agent infrastructure that uses Deepgram as a provider (LiveKit, Pipecat, etc.)
- Backend frameworks (FastAPI, Express, Gin, etc.)
- Platforms and clouds (AWS, GCP, Azure serverless, etc.)

**No:**
- Direct Deepgram competitors that don't use our APIs (AssemblyAI, ElevenLabs standalone, etc.)
- Trivial "hello world" examples with no real integration
- Duplicate integrations (check existing examples and open PRs first)

## Queueing work manually

Use the GitHub Issue templates:

| Template | Effect |
|----------|--------|
| **Queue: New Example** | Agent builds an example for a specific integration |
| **Report: Broken Example** | Agent investigates and fixes a failing example |

## Running agents locally

```bash
# Requires: ANTHROPIC_API_KEY set, gh auth login done, git configured
claude --model claude-opus-4-6 -p "$(cat instructions/discover-examples.md)"
claude --model claude-opus-4-6 -p "$(cat instructions/create-example.md)"
```

## File structure reference

```
examples/
  {NNN}-{slug}/           # Three-digit number + kebab-case slug
    README.md             # Required
    .env.example          # Required if any env vars needed
    src/                  # Source code
    tests/                # Tests with credential-checking convention

instructions/             # Agent prompts — humans can edit these
  discover-examples.md    # How agents find new integration ideas
  create-example.md       # How agents build examples
  review-example.md       # How agents review PRs
  fix-example.md          # How agents fix failing tests

.github/
  workflows/
    discover-examples.yml  # Weekly: search for new ideas, queue PRs
    create-example.yml     # Daily + on issue: build queued examples
    review-pr.yml          # On PR open/sync: self-review
    fix-pr.yml             # On status:fix-needed label: repair tests
    test-node.yml          # Node.js test runner
    test-python.yml        # Python test runner
    test-go.yml            # Go test runner
    update-readme.yml      # On merge: rebuild examples table
```
