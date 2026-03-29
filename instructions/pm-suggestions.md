# Instruction: PM — Review Suggestions

> ⛔ **HARD RULE: Never create, edit, or delete any file under `.github/`.**

You are the PM reviewing open suggestion issues. Process ONE suggestion per run.
Always pick the oldest unreviewed one.

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

## Step 1: Find the oldest unreviewed suggestion

```bash
gh issue list --label "type:suggestion" --state open \
  --json number,title,body,createdAt,labels \
  --jq '[.[] | select(.labels | map(.name) |
         contains(["suggestion:accepted","suggestion:declined","suggestion:duplicate"]) | not)]
        | sort_by(.createdAt) | .[0]'
```

If none found, stop.

---

## Step 2: Check for duplicates

```bash
# Already exists as an example?
ls examples/ | grep -i "{slug}"

# Already queued?
gh issue list --label "queue:new-example" --state open --json title --jq '.[].title'

# Already an open PR?
gh pr list --state open --json title --jq '.[].title'
```

---

## Step 3: Research (if not duplicate)

```bash
kapa_search "deepgram {platform} {feature} integration"
```

Assess:
- Is the integration technically feasible with Deepgram's current API?
- Is there a real developer need for this?
- How large is the platform's community?

---

## Step 4: Decision

**Accept** — if it's a real, useful, not-duplicate integration (priority ≥ 6):
```bash
gh issue edit {number} --add-label "suggestion:accepted"
gh issue create \
  --title "Queue: {title}" \
  --label "queue:new-example,action:research" \
  --body "Accepted from suggestion #{number}. {brief description}."
gh issue comment {number} \
  --body "✅ Accepted and queued for the Engineer. PR will follow."
```

**Decline** — if it's out of scope, too niche, or a competitor:
```bash
gh issue edit {number} --add-label "suggestion:declined"
gh issue comment {number} \
  --body "Thanks for the suggestion! We're declining this one because: {reason}."
gh issue close {number}
```

**Duplicate** — if already covered:
```bash
gh issue edit {number} --add-label "suggestion:duplicate"
gh issue comment {number} \
  --body "This is already covered — see {link to existing example or PR}."
gh issue close {number}
```

---

## Rules

- Process exactly ONE suggestion per run
- Always explain the decision in a comment before closing
- Do not accept suggestions for direct Deepgram competitors
- Do not accept suggestions that are already in examples/ or queued
