# Instruction: PM — Dashboard

> ⛔ **HARD RULE: Never create, edit, or delete any file under `.github/`.**
> Only modify `README.md`.

You are the PM Dashboard agent. Rebuild the README examples table to reflect the
current set of example directories, then open a PR if anything changed.

---

## Step 1: Enumerate example directories

```bash
for dir in examples/*/; do
  [ ! -d "$dir" ] || [ -f "${dir}.gitkeep" ] && continue
  EXAMPLE=$(basename "$dir")

  LANG=""
  [ -f "${dir}package.json" ]     && LANG="Node.js"
  [ -f "${dir}requirements.txt" ] && LANG="Python"
  [ -f "${dir}go.mod" ]           && LANG="Go"
  [ -f "${dir}pubspec.yaml" ]     && LANG="Dart"
  [ -f "${dir}Cargo.toml" ]       && LANG="Rust"
  [ -f "${dir}pom.xml" ] || [ -f "${dir}build.gradle" ] && LANG="Java"
  [ -f "${dir}build.gradle.kts" ] && LANG="Kotlin"
  [ -f "${dir}Package.swift" ]    && LANG="Swift"
  [ -z "$LANG" ]                  && LANG="JavaScript"

  echo "$EXAMPLE|$LANG"
done
```

For each example directory, read its `README.md` to extract:
- Title (first H1)
- Integration (from directory slug or README body)

---

## Step 2: Rebuild the table

Replace the content between these markers in `README.md`:
```
<!-- examples-table-start -->
...
<!-- examples-table-end -->
```

New table format (no Status column):
```markdown
<!-- examples-table-start -->
| # | Example | Language | Integration |
|---|---------|----------|-------------|
| [010](examples/010-getting-started-node/) | Getting started — Node.js | Node.js | Deepgram SDK |
<!-- examples-table-end -->
```

---

## Step 3: Exit if nothing changed

```bash
git diff --quiet README.md && echo "README unchanged" && exit 0
```

---

## Step 4: Open PR (or update existing one)

Use a single persistent branch so there is never more than one open README PR.
If a PR already exists for this branch, push the update to it in place.

```bash
BRANCH="chore/examples-table-update"

git checkout -B "$BRANCH"
git add README.md
git commit -m "docs: update examples table [skip ci]"

EXISTING_PR=$(gh pr list --repo {repo} --head "$BRANCH" --state open \
  --json number --jq '.[0].number')

if [ -n "$EXISTING_PR" ]; then
  git push --force-with-lease origin "$BRANCH"
  echo "Updated existing PR #$EXISTING_PR"
else
  git push origin "$BRANCH"
  gh pr create \
    --title "docs: update examples table" \
    --body "Automated table update. No code changes." \
    --base main --head "$BRANCH"
  echo "Created new PR"
fi
```
