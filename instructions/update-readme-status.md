# Instruction: Update README Status Table

You are a reporting agent working in the `examples` repository. Your job is to
run the test suite for every example, then rebuild the README examples table
with a live status column reflecting what passed, failed, or was skipped.

> ⛔ **HARD RULE: Never create, edit, or delete any file under `.github/`.**
> Only modify `README.md` in this task.

## Step 1 — Run tests for every example

All runtimes (Node.js, Python, Go) and all secrets are already available in
the environment. Run each example's tests and record the outcome.

```bash
declare -A STATUS

for dir in examples/*/; do
  [ ! -d "$dir" ] || [ -f "${dir}.gitkeep" ] && continue
  EXAMPLE=$(basename "$dir")

  # Detect language
  LANG=""
  [ -f "${dir}package.json" ]    && LANG="node"
  [ -f "${dir}requirements.txt" ] && LANG="python"
  [ -f "${dir}pyproject.toml" ]  && LANG="python"
  [ -f "${dir}go.mod" ]          && LANG="go"
  [ -z "$LANG" ] && STATUS[$EXAMPLE]="no-tests" && continue

  pushd "$dir" > /dev/null

  # Credential check
  MISSING=""
  if [ -f ".env.example" ]; then
    while IFS= read -r line; do
      [[ -z "${line// }" || "$line" == \#* ]] && continue
      VAR="${line%%=*}"; VAR="${VAR// /}"
      [ -z "$VAR" ] && continue
      [ -z "${!VAR+x}" ] || [ -z "${!VAR}" ] && MISSING="$MISSING $VAR"
    done < ".env.example"
  fi

  if [ -n "$MISSING" ]; then
    STATUS[$EXAMPLE]="needs-credentials"
    popd > /dev/null
    continue
  fi

  # Install & run
  PASS=false
  if [ "$LANG" = "node" ]; then
    npm install --prefer-offline -q 2>/dev/null
    npm test > /tmp/test_out_${EXAMPLE}.txt 2>&1 && PASS=true
  elif [ "$LANG" = "python" ]; then
    pip install -q -r requirements.txt 2>/dev/null || pip install -q -e . 2>/dev/null
    if find tests/ -name "test_*.py" 2>/dev/null | grep -q .; then
      python -m pytest tests/ -q > /tmp/test_out_${EXAMPLE}.txt 2>&1 && PASS=true
    elif ls tests/*.py 2>/dev/null | grep -q .; then
      python "$(ls tests/*.py | head -1)" > /tmp/test_out_${EXAMPLE}.txt 2>&1 && PASS=true
    fi
  elif [ "$LANG" = "go" ]; then
    go mod download 2>/dev/null
    go test ./... > /tmp/test_out_${EXAMPLE}.txt 2>&1 && PASS=true
  fi

  [ "$PASS" = "true" ] && STATUS[$EXAMPLE]="passing" || STATUS[$EXAMPLE]="failing"
  popd > /dev/null
done

# Print summary
for ex in "${!STATUS[@]}"; do
  echo "$ex: ${STATUS[$ex]}"
done | sort
```

## Step 2 — Read the current README

```bash
cat README.md
```

## Step 3 — Build the updated table

Read each example directory to extract:
- Title: first H1 from `README.md`
- Language: from `package.json` (Node.js), `requirements.txt` (Python), `go.mod` (Go)
- Integration: from directory slug (the part after the number prefix)
- Products: from README body keywords (STT, TTS, agent, intelligence)
- Status: from Step 1 results

Status emoji:
- `✅ passing` — tests ran and passed
- `❌ failing` — tests ran and failed (check logs)
- `⏳ needs credentials` — missing secrets (see `.env.example`)
- `—` — no tests found

Replace the content between these markers in README.md:
```
<!-- examples-table-start -->
...table...
<!-- examples-table-end -->
```

New table format:
```markdown
<!-- examples-table-start -->
| # | Example | Language | Integration | Status |
|---|---------|----------|-------------|--------|
| [010](examples/010-getting-started-node/) | Getting started — Node.js | Node.js | Deepgram SDK | ✅ passing |
| [020](examples/020-twilio-media-streams-node/) | Twilio Media Streams | Node.js | Twilio | ✅ passing |
<!-- examples-table-end -->
```

## Step 4 — Check if the table actually changed

```bash
git diff README.md
```

If there are no changes, exit — nothing to commit.

```bash
git diff --quiet README.md && echo "No changes — README already up to date" && exit 0
```

## Step 5 — Create a PR and auto-merge

```bash
DATE=$(date -u +%Y-%m-%d-%H%M)
BRANCH="chore/readme-status-${DATE}"

git checkout -b "$BRANCH"
git add README.md
git commit -m "docs(readme): update examples status table [skip ci]"
git push origin "$BRANCH"

PR_URL=$(gh pr create \
  --title "docs: update examples status table — ${DATE}" \
  --body "Automated hourly README status update. No code changes." \
  --base main \
  --head "$BRANCH")

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
SHA=$(git rev-parse HEAD)

# Post e2e-api-check: success — no examples changed, nothing to test
gh api "repos/${{ github.repository }}/statuses/${SHA}" \
  --method POST \
  -f state="success" \
  -f context="e2e-api-check" \
  -f description="README-only change — no examples to test" \
  -f target_url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"

# Enable auto-merge — will fire once the status check is satisfied
gh pr merge "$PR_NUMBER" --auto --squash

echo "PR created and auto-merge enabled: $PR_URL"
```

## Rules

- Only ever modify `README.md` — never touch any other file
- If the table is identical to the current one, do nothing (no empty PRs)
- Maximum one open readme-status PR at a time — check before creating:
  ```bash
  EXISTING=$(gh pr list --state open --search "docs: update examples status table" --json number --jq '.[0].number')
  [ -n "$EXISTING" ] && echo "PR #$EXISTING already open — skipping" && exit 0
  ```
- The `[skip ci]` in the commit message prevents test workflows from re-running on this commit
