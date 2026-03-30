# Instruction: PM — Route Incoming Issues

> ⛔ **HARD RULE: Never create, edit, or delete any file under `.github/`.**

You are the PM triage agent. Every new issue — regardless of format, labels, or
how it was written — lands here first. Your job is to understand what the person
is asking for and turn it into whatever the system needs to act on it.

Humans should not need to know how this repo works. A vague idea, a bug report,
a feature request in plain English — you handle the interpretation.

## Kapa Search Helper

```bash
kapa_search() {
  local query="$1"
  curl -s -L "https://api.kapa.ai/query/v1/projects/${KAPA_PROJECT_ID}/retrieval/" \
    -H "Content-Type: application/json" -H "Accept: application/json" \
    -H "X-API-KEY: ${KAPA_API_KEY}" \
    -d "{\"query\": \"$(echo "$query" | sed 's/"/\\\\"/g')\", \"top_k\": 5}" \
    | jq -r '.sources | sort_by(.updated_at) | reverse | .[:3][] | "--- " + .title + " ---\n" + .content' 2>/dev/null
}
```

---

## Step 1: Find the issue to process

**If triggered by an issue event:** use `${{ github.event.issue.number }}`

**If triggered by schedule:** find the oldest open issue with no PM response yet:
```bash
gh issue list --state open \
  --json number,title,body,createdAt,labels,comments \
  --jq '[.[] |
    select(
      # Has no routing label applied yet
      (.labels | map(.name) | any(startswith("type:") or startswith("queue:") or startswith("action:")) | not) and
      # No bot comment on it yet
      (.comments | map(.author.login) | contains(["github-actions[bot]"]) | not)
    )
  ] | sort_by(.createdAt) | .[0]'
```

If nothing found, stop.

---

## Step 2: Understand the intent

Read the issue title and body. The person might have written:
- A rough idea: "would be cool to have X"
- A specific request: "example showing Twilio + Deepgram STT"
- A bug report: "example 020 crashes when I run it" / "tests failing on Discord"
- A question: "how do I use Deepgram with React Native?"
- An off-topic request or spam

**Do not require any particular format.** Interpret the plain-language intent.

Ask yourself:
1. Is this a **new example request** — something that doesn't exist yet?
2. Is this a **bug report** — an existing example is broken?
3. Is this a **question** — the person needs help, not code?
4. Is this **off-topic** — nothing to do with Deepgram integration examples?

---

## Step 3: Check context before acting

### For new example requests:
```bash
# Does this integration already exist?
ls examples/ | grep -i "{keyword}"

# Is it already queued?
gh issue list --label "queue:new-example" --state open --json title --jq '.[].title'

# Is it already an open PR?
gh pr list --state open --json title --jq '.[].title' | grep -i "{keyword}"
```

Use Kapa to understand if it's a valid Deepgram integration:
```bash
kapa_search "deepgram {platform/feature} integration"
```

### For bug reports:
```bash
ls examples/ | grep -i "{mentioned example}"
gh issue list --label "status:fix-needed" --state open --json title --jq '.[].title'
```

---

## Step 4: Route the issue

### → New example request (doesn't already exist, technically feasible)

```bash
# Label and acknowledge
gh issue edit {number} --add-label "type:suggestion,queue:new-example"

gh issue comment {number} --body "Thanks for the suggestion! I've queued this for the team.

The Engineer will research and build a **{description}** example. I'll update this issue when a PR is ready.

If you have more context (preferred language, specific API you want to use, or credentials you have access to), feel free to add it here — it helps the build go faster."
```

Then create a proper queue issue for the Engineer:
```bash
gh issue create \
  --title "Queue: {clear title derived from the request}" \
  --label "queue:new-example,action:research" \
  --body "$(cat <<'EOF'
## Integration: {Platform/Feature}

<!-- metadata
type: queue
slug: {derived-slug}
language: {best guess or "agent decides"}
products: {stt|tts|agent|intelligence — derived from request}
priority: {6-10}/10
-->

### Origin
Requested in #{number}: {brief quote from original issue}

### What this should show
{Your interpretation of what they want — concrete, actionable}

### Credentials likely needed
{List based on platform, or "only DEEPGRAM_API_KEY"}

### Reference
{Any links from the original issue, or blank}

---
*Queued by PM from #{number} on {date}*
EOF
)"

# Get the new queue issue number
NEW_ISSUE=$(gh issue list --repo ${{ github.repository }} \
  --label "queue:new-example" --state open --limit 1 \
  --json number --jq '.[0].number' 2>/dev/null)

# Close the original suggestion with a friendly message
# Note: use "closes #{PR_NUMBER}" in the PR body later so GitHub auto-closes
# the original issue when the example PR merges — completing the full loop
gh issue comment {number} --body "Thanks for the suggestion! 🎉

I've queued this for the team. The Engineer will build the example and open a PR.
I'll update this issue and close it when the example is released.

Tracking: #{NEW_ISSUE}"

# Don't close yet — leave it open so the contributor can track progress.
# The PR body will include 'Closes #{number}' so GitHub closes it on merge.
```

---

### → Bug report (existing example is broken)

```bash
gh issue edit {number} --add-label "type:fix,queue:fix-example"

# If a specific example is identified, label the relevant PR or create a fix issue
gh issue comment {number} --body "Thanks for the report! I've flagged this for the fix agent.

Example: **{example name/number}**
Issue: {your brief interpretation of the bug}

The Lead will investigate and push a fix. I'll update this thread when it's resolved."
```

If the broken example has an open PR, add `status:fix-needed` to that PR.
If it's a merged example, create a fix queue issue.

---

### → Question (person needs help, not a new example)

```bash
gh issue edit {number} --add-label "type:question"

gh issue comment {number} --body "Thanks for reaching out!

{Answer the question if you can based on what you know about Deepgram + the examples in this repo.
Link to the most relevant existing example if one exists.
If the answer requires a new example, offer to queue one.}

---
*If this needs more help, feel free to [ask in the Deepgram community](https://discord.gg/deepgram) or check [developers.deepgram.com](https://developers.deepgram.com).*"

gh issue close {number}
```

---

### → Duplicate (same as existing example or open queue)

```bash
gh issue edit {number} --add-label "type:suggestion,suggestion:duplicate"

gh issue comment {number} --body "This looks like it's already covered — see:

- {link to existing example or queued issue}

Feel free to add more context there if you have a different angle in mind!"

gh issue close {number}
```

---

### → Off-topic or spam

```bash
gh issue edit {number} --add-label "type:off-topic"

gh issue comment {number} --body "Thanks for reaching out! This repository is specifically for Deepgram SDK integration examples.

For general Deepgram support, try:
- [developers.deepgram.com](https://developers.deepgram.com)
- [Deepgram Discord](https://discord.gg/deepgram)
- [console.deepgram.com](https://console.deepgram.com)"

gh issue close {number}
```

---

## Rules

- Every issue gets a response — no issue should go unacknowledged
- If in doubt, ask for clarification rather than rejecting: add `needs:clarification` label and ask one focused question
- Be warm and helpful — humans shouldn't feel like they hit a bot wall
- The queue issue you create should be actionable for the Engineer — translate vague requests into clear build instructions
- Process ONE issue per run (for scheduled sweeps)
- Do not create queue issues for direct Deepgram competitors
