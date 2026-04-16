#!/usr/bin/env python3
"""
build_pr_body.py

Generates a clean PR body for an auto-built example:
  - Result-oriented status summary
  - Literal output from the latest observed test run
  - Hidden extra context for restart laps
  - Hidden agent state for continuation
  - Prints "needs-credentials" to stdout if any test checks for missing
    credentials (i.e. has an exit-2 path), so the workflow can apply the label

Writes the PR body to /tmp/pr-body.md.
Prints "needs-credentials" to stdout if the label should be applied,
otherwise prints nothing.

Usage:
  python3 .github/scripts/build_pr_body.py \\
    --workspace WORKSPACE_DIR \\
    --issue ISSUE_NUMBER \\
    --issue-body "..." \\
    --action new|modify \\
    --runtime python \\
    --example 540-livekit-voice-agent-python \\
    --build-log /tmp/build-log.md
"""

import argparse
import json
import re
from pathlib import Path


TEST_RUNNER_SIGNALS = (
    "pytest",
    "npm test",
    "npm run test",
    "pnpm test",
    "pnpm run test",
    "vitest",
    "jest",
    "go test",
    "cargo test",
    "dotnet test",
    "mvn test",
    "gradle test",
)


def load_agent_state(state_path: Path | None) -> dict:
    if not state_path or not state_path.exists():
        return {}
    try:
        return json.loads(state_path.read_text())
    except json.JSONDecodeError:
        return {}


def collect_test_files(workspace: Path) -> list[tuple[str, str]]:
    """Return (relative_path, content) for each file in tests/."""
    tests_dir = workspace / "tests"
    if not tests_dir.exists():
        return []
    results = []
    for f in sorted(tests_dir.rglob("*")):
        if f.is_file() and f.suffix in (".py", ".sh", ".ts", ".js", ".go", ".rs"):
            rel = str(f.relative_to(workspace))
            results.append((rel, f.read_text(errors="ignore")))
    return results


def needs_credentials(test_files: list[tuple[str, str]]) -> bool:
    """Return True if any test has an exit-2 / missing-credentials path."""
    for _, content in test_files:
        if re.search(r"exit\s*\(?2\)?|sys\.exit\(2\)|exit 2", content):
            return True
    return False


def extract_last_test_run_from_log(build_log: Path) -> dict[str, str | int]:
    if not build_log.exists():
        return {}

    text = build_log.read_text(errors="ignore")
    pattern = re.compile(
        r"^### `run_command`: `(.*?)`\n\*\*exit\*\*: `(\d+)`\n(.*?)(?=^### `run_command`: `|\Z)",
        re.DOTALL | re.MULTILINE,
    )

    last_match: dict[str, str | int] = {}
    for match in pattern.finditer(text):
        command = match.group(1)
        if not any(signal in command.lower() for signal in TEST_RUNNER_SIGNALS):
            continue

        body = match.group(3)
        blocks = re.findall(r"```\n(.*?)\n```", body, re.DOTALL)
        stderr_blocks = re.findall(r"\*\*stderr\*\*:\n```\n(.*?)\n```", body, re.DOTALL)
        combined: list[str] = []
        if blocks:
            combined.append(blocks[0].strip())
        if stderr_blocks:
            combined.append("\n\n".join(block.strip() for block in stderr_blocks if block.strip()))

        last_match = {
            "command": command.strip(),
            "exit_code": int(match.group(2)),
            "output": "\n\n".join(part for part in combined if part).strip(),
        }

    return last_match


def build_test_snapshot(state: dict, build_log: Path) -> tuple[str, str, str]:
    command = str(state.get("last_test_command", "") or "").strip()
    exit_code = state.get("last_test_exit_code")
    output = str(state.get("last_test_output", "") or "").strip()

    if command:
        return command, "" if exit_code is None else str(exit_code), output

    fallback = extract_last_test_run_from_log(build_log)
    if fallback:
        return (
            str(fallback.get("command", "")),
            str(fallback.get("exit_code", "")),
            str(fallback.get("output", "")),
        )

    return "", "", ""


def build_visible_status(args: argparse.Namespace, state: dict) -> list[str]:
    if args.bootstrap:
        pipeline_state = "draft created, engineering run starting"
    elif args.incomplete:
        pipeline_state = "partial progress saved, awaiting continuation or review"
    else:
        pipeline_state = "engineering loop completed, awaiting human review"

    tests_status = "not yet run"
    if state.get("tests_passing"):
        tests_status = "passing"
    elif state.get("tests_failing"):
        tests_status = "failing"

    turns = state.get("turns_used", "0" if args.bootstrap else "unknown")

    lines = [
        f"Relates to #{args.issue}",
        "",
        "## Status",
        f"- Pipeline state: {pipeline_state}",
        f"- Action: {args.action.capitalize()}",
        f"- Runtime: `{args.runtime}`",
        f"- Example: `{args.example}`",
        f"- Turns used: `{turns}`",
        f"- Tests: {tests_status}",
    ]

    if args.bootstrap:
        lines.extend([
            "",
            "This PR stays draft while the engineering loop implements, tests, and fixes the example.",
        ])
    elif args.incomplete:
        lines.extend([
            "",
            "This draft PR was left intentionally resumable. Comment `@deepgram-robot continue` with follow-up instructions to start another lap.",
        ])
    else:
        lines.extend([
            "",
            "The engineering loop finished its implementation and test/fix passes. This PR stays draft for human review.",
        ])

    return lines


def build_hidden_context(args: argparse.Namespace, state: dict) -> list[str]:
    compact_state = json.dumps(state, separators=(",", ":")) if state else "{}"
    lines = [
        "<!-- extra context goes here",
        f"originating_issue: #{args.issue}",
        f"action: {args.action}",
        f"runtime: {args.runtime}",
        f"example: {args.example}",
        "original_issue_body:",
        args.issue_body.strip(),
        "-->",
        f"<!-- agent-state: {compact_state} -->",
    ]
    return lines


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--issue", required=True)
    parser.add_argument("--issue-body", required=True,
                        help="Full body of the originating issue")
    parser.add_argument("--action", required=True)
    parser.add_argument("--runtime", required=True)
    parser.add_argument("--example", required=True)
    parser.add_argument("--build-log", default="/tmp/build-log.md")
    parser.add_argument("--agent-state", default="/tmp/agent-state.json")
    parser.add_argument("--bootstrap", action="store_true",
                        help="Generate the initial draft PR body before the loop starts")
    parser.add_argument("--incomplete", action="store_true",
                        help="Mark PR as WIP / turn limit reached")
    args = parser.parse_args()

    workspace = Path(args.workspace)
    build_log = Path(args.build_log)
    state_path = Path(args.agent_state) if args.agent_state else None

    state = load_agent_state(state_path)
    test_files = collect_test_files(workspace)
    apply_needs_credentials = needs_credentials(test_files)
    test_command, test_exit_code, test_output = build_test_snapshot(state, build_log)

    lines = build_visible_status(args, state)
    lines.extend([
        "",
        "## Test Results",
    ])

    if test_command:
        lines.append(f"- Command: `{test_command}`")
    if test_exit_code:
        lines.append(f"- Exit code: `{test_exit_code}`")

    if test_output:
        lines.extend([
            "",
            "```text",
            test_output,
            "```",
        ])
    else:
        lines.extend([
            "",
            "_No literal test runner output has been captured yet._",
        ])

    if apply_needs_credentials:
        lines.append(
            "> **needs-credentials** — one or more tests exit 2 when credentials "
            "are missing. Add the required secrets to the repository to enable "
            "end-to-end testing.\n"
        )

    lines.extend(["", *build_hidden_context(args, state)])

    body = "\n".join(lines)
    Path("/tmp/pr-body.md").write_text(body)

    if apply_needs_credentials:
        print("needs-credentials")


if __name__ == "__main__":
    main()
