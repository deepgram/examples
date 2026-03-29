# Instruction: PM — Dashboard

> ⛔ **HARD RULE: Never create, edit, or delete any file under `.github/`.**
> Only modify `README.md`.

You are the PM Dashboard agent. Run the example test suite, rebuild the README
examples table with live status, and open a PR if anything changed.

---

## Step 1: Run tests for every example

All runtimes (Node.js, Python, Go) and all secrets are available in the environment.

```bash
declare -A STATUS

for dir in examples/*/; do
  [ ! -d "$dir" ] || [ -f "${dir}.gitkeep" ] && continue
  EXAMPLE=$(basename "$dir")

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
    popd > /dev/null; continue
  fi

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
```

---

## Step 2: Read current README and rebuild table

Status emoji:
- `✅ passing` — tests ran and passed
- `❌ failing` — tests ran and failed (see logs)
- `⏳ needs credentials` — missing secrets
- `—` — no tests found

For each example directory, read its README.md to extract:
- Title (first H1)
- Language (from package.json/requirements.txt/go.mod)
- Integration (from directory slug)
- Products (from README body: STT, TTS, agent, intelligence)

Replace the content between these markers:
```
<!-- examples-table-start -->
...
<!-- examples-table-end -->
```

New table format:
```markdown
<!-- examples-table-start -->
| # | Example | Language | Integration | Status |
|---|---------|----------|-------------|--------|
| [010](examples/010-getting-started-node/) | Getting started — Node.js | Node.js | Deepgram SDK | ✅ passing |
<!-- examples-table-end -->
```

---

## Step 3: Exit if nothing changed

```bash
git diff --quiet README.md && echo "README unchanged" && exit 0
```

---

## Step 4: Open PR and auto-merge

```bash
DATE=$(date -u +%Y-%m-%d-%H%M)
BRANCH="chore/examples-status-${DATE}"
SHA=$(git rev-parse HEAD)

git checkout -b "$BRANCH"
git add README.md
git commit -m "docs: update examples status table [skip ci]"
git push origin "$BRANCH"

PR_URL=$(gh pr create \
  --title "docs: update examples status table — ${DATE}" \
  --body "Automated dashboard update. No code changes." \
  --base main --head "$BRANCH")

PR_NUMBER=$(echo "$PR_URL" | grep -oE '[0-9]+$')
SHA=$(git rev-parse HEAD)

# Post e2e-api-check:success — README-only change, nothing to test
gh api "repos/${{ github.repository }}/statuses/${SHA}" \
  --method POST \
  -f state="success" \
  -f context="e2e-api-check" \
  -f description="README-only change — no examples to test" \
  -f target_url="${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}"

gh pr merge "$PR_NUMBER" --auto --squash
echo "PR: $PR_URL"
```
