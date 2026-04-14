# CLAUDE.md — .github/

Context for Claude Code working on the engineering pipeline automation in this directory.

## What this does

`workflows/engineering.yml` triggers when a `type:suggestion` label is added to an issue (build job), or when a Deepgram org member `@claude`s in any issue or PR (engineering job). The build job:

1. Extracts secret *names* (not values) from the Actions secrets context
2. Runs a cheap planning call (`scripts/plan_agent.py`) to determine runtime, Docker image, slug, and which secrets the example actually needs
3. Builds a minimal env file with only the required secrets (`scripts/filter_secrets.py`)
4. Spins up a Docker container with that env file
5. Runs a full agentic build loop (`scripts/run_agent.py`) — Claude writes code, runs tests, fixes failures, repeats until tests pass or MAX_TURNS is hit
6. Commits the output to a branch and opens a PR with the full build log

## File map

```
.github/
  workflows/
    engineering.yml         # Unified pipeline: build job + engineering (@claude) job.
  scripts/
    plan_agent.py           # Planning phase. Haiku call. Outputs runtime/slug/required_secrets JSON.
    filter_secrets.py       # Filters full secrets blob to only required keys. Writes env file.
    next_example_number.py  # Reads examples/ dir, returns next available NNN slot.
    run_agent.py            # Main agentic loop. Tool-use with Docker sandbox. Runs until AGENT_DONE.
    system_prompt.md        # The agent's contract — conventions, priorities, definition of done.
```

## Key design decisions (don't relitigate these)

**Single workflow, no role-based agents.** Previous design split PM/lead/engineer into separate workflows. Replaced with one workflow, one agent, no handoffs.

**Secret names to LLM, not values.** `toJSON(secrets)` gives all secret names. The planner sees only the names and picks what it needs. `filter_secrets.py` then injects only those values into Docker. The agent never sees secrets it doesn't need, and the names aren't logged anywhere visible.

**`ANTHROPIC_API_KEY` is the one hardwired secret.** It has to be — you can't ask the LLM to select its own API key. Everything else flows through the plan → filter pipeline.

**Docker for the sandbox, not the raw runner.** The runner stays clean. Each language gets its own image. The agent runs `docker exec` for all commands. Network is `bridge` (outbound OK, no inbound).

**MAX_TURNS defaults to 75.** High enough for a complex multi-service build. Low enough to fail loudly rather than burn indefinitely. Override via `MAX_TURNS` env var in the workflow if needed. When hit, exits 1 and writes `AGENT_TURN_LIMIT_EXCEEDED` to the build log.

**Mock the upstream, never Deepgram.** Deepgram is always real (real API key, real calls). Things that genuinely can't run in CI (phone number provisioning, inbound webhooks, OAuth browser flows) get a local mock server standing in for the upstream. Documented in the README.

**Implementation priority is strict.** Partner library with Deepgram built in > official Deepgram SDK > nothing else. No raw HTTP to the Deepgram API. No third-party wrappers. The system prompt enforces this.

## What the agent has available inside the container

- `deepgram` CLI — installed during bootstrap, authenticated with `DEEPGRAM_API_KEY`
- `context7` — invoked via `npx`, used for SDK/API doc lookup before writing code
- Playwright — installed during bootstrap, Chromium included
- Full shell access via `run_command` tool
- File read/write via `write_file` / `read_file` / `list_files` tools

## Definition of done (what the agent checks before AGENT_DONE)

- Unit tests pass (exit 0)
- Integration tests pass (exit 0, real Deepgram calls)
- Browser/Playwright tests pass if the example has UI
- Example demonstrates the integration end to end — nothing skipped, nothing mocked that could be real
- README is accurate: what it does, prerequisites, all env vars, how to run, what to expect, what's mocked and why. Screenshot embedded if one was taken.
- `BLOG.md` is a complete, publishable developer walkthrough of building the example from scratch — written by the agent as part of the build
- `screenshot.png` present in the example root if the example has any UI or meaningful visual output (1240×760, taken with Playwright by the agent)
- `.env.example` lists every required variable
- No hardcoded secrets

## Repo conventions the agent follows

- `examples/{NNN}-{slug}/` — zero-padded 3-digit number, kebab-case slug
- New platform = next multiple of 10. Second example on same platform = subslot (021 after 020)
- `src/` for code, `tests/` for tests
- Tests: exit 0 pass, exit 1 fail, exit 2 missing credentials (skip, not fail)

## Secrets that must exist in the repo before this workflow can run

| Secret | Purpose |
|--------|---------|
| `ANTHROPIC_API_KEY` | Powers the planning call and the agent loop |
| `DEEPGRAM_API_KEY` | Used by the agent inside the sandbox for all Deepgram calls |
| Any partner secrets | Passed to the sandbox only if the planner selects them |

`GITHUB_TOKEN` is auto-provided by Actions and is explicitly excluded from the secrets passed to Docker.

## Things to be careful about

- `toJSON(secrets)` output is masked in logs but the JSON blob is in memory. Never log `ALL_SECRETS` directly.
- The env file at `/tmp/sandbox.env` contains real secret values. It lives only for the duration of the run.
- `plan_agent.py` uses Haiku (fast/cheap). `run_agent.py` uses Opus (capable). Don't swap these without thinking about the cost/quality tradeoff.
- Bootstrap (deepgram CLI + Playwright) runs on every container start. If builds are slow, bake a custom base image.
- The build job uses `concurrency: group: build-{issue_number}` and the engineering job uses `concurrency: group: engineering-{number}` — both with `cancel-in-progress: false`, so they queue rather than cancel.

## Neurosymbolic architecture

`run_agent.py` uses a hybrid neural + symbolic design. The three symbolic components live in `scripts/agent_state.py`:

**WorkingMemory** — a deterministic fact store updated after every tool dispatch. Records which files have been written, which phases are complete (readme, blog, env_example, screenshot, source, tests), whether tests are passing, and a command history for loop detection. The LLM never writes to working memory — only tool results do.

**RuleEngine** — forward-chaining production rules evaluated every turn. Rules fire when conditions match (e.g. `ModuleNotFoundError` in stderr → R1 fires, injecting the missing module name). High-priority rules are injected as a text block after tool results in the next user turn. One-shot rules (`R2`, `R4`, `R7`, etc.) fire at most once per session.

**check_constraints** — deterministic pre-`AGENT_DONE` gate. When the LLM outputs `AGENT_DONE`, the constraint checker verifies: required files exist (`README.md`, `BLOG.md`, `.env.example`), `src/` and `tests/` are non-empty, and no source files contain hardcoded Deepgram API key patterns. If any constraint fails, `AGENT_DONE` is rejected and violations are injected as a new user turn. The LLM cannot self-certify completion.

Current rules: R1 (missing module), R2 (API auth failure), R3 (port conflict), R4 (anti-loop), R5 (tests passing/readme missing), R6 (readme done/blog missing), R7 (turn budget 80%), R8 (permission denied), R9 (network error), R10 (syntax error).

## TODOs / known rough edges

- `next_example_number.py` subslot detection is heuristic — the agent should verify and can override
- Bootstrap failures are non-fatal warnings — if deepgram CLI or Playwright fail to install, the agent will discover this when it tries to use them
