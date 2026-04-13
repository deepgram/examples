"""
agent_state.py — Symbolic layer for the engineering pipeline's build agent loop.

Implements three components of the neurosymbolic architecture:

1. WorkingMemory  — fact store, updated deterministically after each tool call.
                    The LLM never writes here; only tool dispatch does.

2. RuleEngine     — forward-chaining production rules over working memory.
                    Fires when conditions are met, injects guidance into the next
                    LLM turn. Rules are pattern-matched against tool output and
                    working memory state.

3. check_constraints — deterministic pre-AGENT_DONE gate. Verifies the
                       definition-of-done symbolically so the LLM cannot
                       self-certify completion without meeting formal criteria.
"""

from __future__ import annotations

import json
import re
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Working Memory
# ---------------------------------------------------------------------------

class WorkingMemory:
    """
    Symbolic fact store. Facts are (predicate, args) → value tuples.

    Predicates used:
      file_written(path)        — agent wrote this file
      phase(name)               — high-level phase is complete
                                  names: readme, blog, env_example, screenshot,
                                         source, tests, api_verified
      tests_passing()           — last test run exited 0
      tests_failing()           — last test run exited non-0
      last_test_output(text)    — stderr/stdout from last failing test run

    Command history is tracked separately for anti-loop detection.
    """

    def __init__(self) -> None:
        self._facts: dict[tuple, Any] = {}
        self._command_history: list[tuple[str, int]] = []  # (command, exit_code)
        self.turn: int = 0

    # ------------------------------------------------------------------
    # Fact manipulation
    # ------------------------------------------------------------------

    def assert_(self, predicate: str, *args: Any, value: Any = True) -> None:
        self._facts[(predicate, args)] = value

    def retract(self, predicate: str, *args: Any) -> None:
        self._facts.pop((predicate, args), None)

    def query(self, predicate: str, *args: Any) -> Any:
        return self._facts.get((predicate, args))

    # ------------------------------------------------------------------
    # Update from tool dispatch results
    # ------------------------------------------------------------------

    def update_from_tool_result(
        self,
        tool_name: str,
        tool_input: dict,
        result: dict,
    ) -> None:
        if tool_name == "write_file":
            self._update_from_write(tool_input.get("path", ""))
        elif tool_name == "run_command":
            self._update_from_run(
                tool_input.get("command", ""),
                result.get("exit_code", -1),
                result.get("stdout", ""),
                result.get("stderr", ""),
            )

    def _update_from_write(self, path: str) -> None:
        self.assert_("file_written", path)
        name = path.split("/")[-1]
        if name == "README.md":
            self.assert_("phase", "readme")
        elif name == "BLOG.md":
            self.assert_("phase", "blog")
        elif name == ".env.example":
            self.assert_("phase", "env_example")
        elif name == "screenshot.png":
            self.assert_("phase", "screenshot")
        if path.startswith("src/"):
            self.assert_("phase", "source")
        if path.startswith("tests/"):
            self.assert_("phase", "tests")

    def _update_from_run(
        self, cmd: str, exit_code: int, stdout: str, stderr: str
    ) -> None:
        self._command_history.append((cmd.strip(), exit_code))

        combined = (stdout + "\n" + stderr).lower()

        # Test runner detection
        test_runners = [
            "pytest", "npm test", "npm run test", "jest", "vitest",
            "cargo test", "go test", "dotnet test", "mvn test",
            "gradle test",
        ]
        if any(runner in cmd for runner in test_runners):
            if exit_code == 0:
                self.assert_("tests_passing")
                self.retract("tests_failing")
                self.retract("last_test_output")
            else:
                self.assert_("tests_failing")
                self.retract("tests_passing")
                self.assert_("last_test_output", (stderr or stdout)[:1000])

        # API connectivity
        if ("deepgram" in cmd.lower() or cmd.startswith("dg ")) and exit_code == 0:
            self.assert_("phase", "api_verified")

        # Screenshot captured via Playwright
        if "screenshot" in cmd.lower() and "playwright" in cmd.lower() and exit_code == 0:
            self.assert_("phase", "screenshot")

    # ------------------------------------------------------------------
    # Anti-loop detection
    # ------------------------------------------------------------------

    def repeated_command(self, window: int = 7, threshold: int = 3) -> Optional[str]:
        """
        Return the most-repeated command if it appears `threshold`+ times
        in the last `window` commands, else None.
        """
        if len(self._command_history) < threshold:
            return None
        recent = self._command_history[-window:]
        counts = Counter(cmd for cmd, _ in recent)
        cmd, count = counts.most_common(1)[0]
        return cmd if count >= threshold else None

    # ------------------------------------------------------------------
    # Summary for logging
    # ------------------------------------------------------------------

    def summary(self) -> str:
        phases = [args[0] for (pred, args) in self._facts if pred == "phase"]
        tests = "passing" if self.query("tests_passing") else (
                "failing" if self.query("tests_failing") else "not yet run")
        return (
            f"turn={self.turn} "
            f"phases={sorted(phases)} "
            f"tests={tests} "
            f"history_len={len(self._command_history)}"
        )


# ---------------------------------------------------------------------------
# Rule Engine — forward-chaining production rules
# ---------------------------------------------------------------------------

@dataclass
class RuleFiring:
    rule_id: str
    message: str
    priority: int = 0    # higher = injected first


class RuleEngine:
    """
    Forward-chaining rule engine. Evaluates rules against the current
    working memory state and the latest batch of tool results.

    One-shot rules (marked with `once=True`) fire at most once per session.
    Repeating rules (once=False) may fire every turn they're triggered.
    """

    def __init__(self, wm: WorkingMemory, max_turns: int) -> None:
        self.wm = wm
        self.max_turns = max_turns
        self._fired_once: set[str] = set()

    def evaluate(self, turn_results: list[dict]) -> list[RuleFiring]:
        """
        Evaluate all rules. `turn_results` is the list of raw result dicts
        from tool dispatch this turn (one per tool call).

        Returns firings sorted by priority (highest first), capped at 3
        so we don't overwhelm the context window.
        """
        wm = self.wm
        firings: list[RuleFiring] = []

        # Aggregate outputs across all tool calls this turn
        combined_stderr = "\n".join(r.get("stderr", "") for r in turn_results)
        combined_stdout = "\n".join(r.get("stdout", "") for r in turn_results)
        combined_output = (combined_stderr + "\n" + combined_stdout).lower()
        any_nonzero = any(r.get("exit_code", 0) != 0 for r in turn_results)

        # ------------------------------------------------------------------
        # R1 — Missing Python module
        # ------------------------------------------------------------------
        m = re.search(
            r"(?:ModuleNotFoundError|ImportError)[^\n]*No module named '([^']+)'",
            combined_stderr,
        )
        if m:
            firings.append(RuleFiring("R1",
                f"🔧 [RULE:missing-module] Missing module `{m.group(1)}`. "
                f"Install it (e.g. `pip install {m.group(1).split('.')[0]}`) "
                f"before retrying.", priority=10))

        # ------------------------------------------------------------------
        # R2 — API authentication failure (one-shot per session)
        # ------------------------------------------------------------------
        auth_signals = ["unauthorized", "invalid api key", "401", "403",
                        "authentication failed", "unauthenticated"]
        if any_nonzero and any(s in combined_output for s in auth_signals):
            if "R2" not in self._fired_once:
                self._fired_once.add("R2")
                firings.append(RuleFiring("R2",
                    "🔧 [RULE:auth-failure] API authentication failed. "
                    "Verify DEEPGRAM_API_KEY is set: `echo $DEEPGRAM_API_KEY | cut -c1-8`. "
                    "Keys start with `Token ` prefix in HTTP headers, not bare.", priority=9))

        # ------------------------------------------------------------------
        # R3 — Port already in use
        # ------------------------------------------------------------------
        if "address already in use" in combined_output or "eaddrinuse" in combined_output:
            firings.append(RuleFiring("R3",
                "🔧 [RULE:port-conflict] Port already in use. "
                "Kill the occupying process: `fuser -k <port>/tcp` or "
                "`pkill -f <process_name>`.", priority=8))

        # ------------------------------------------------------------------
        # R4 — Anti-loop: same command repeated N times (one-shot)
        # ------------------------------------------------------------------
        repeated = wm.repeated_command()
        if repeated and "R4" not in self._fired_once:
            self._fired_once.add("R4")
            firings.append(RuleFiring("R4",
                f"🔧 [RULE:anti-loop] Command `{repeated[:80]}` has been run 3+ "
                f"times with the same result. This approach is not converging — "
                f"step back and try a fundamentally different implementation strategy.",
                priority=10))

        # ------------------------------------------------------------------
        # R5 — Tests passing but README not yet written (one-shot)
        # ------------------------------------------------------------------
        if wm.query("tests_passing") and not wm.query("phase", "readme"):
            if "R5" not in self._fired_once:
                self._fired_once.add("R5")
                firings.append(RuleFiring("R5",
                    "📋 [RULE:missing-readme] Tests are passing but README.md "
                    "has not been written yet. Write the quickstart README next.",
                    priority=5))

        # ------------------------------------------------------------------
        # R6 — README done but BLOG.md not yet written (one-shot)
        # ------------------------------------------------------------------
        if (wm.query("tests_passing") and wm.query("phase", "readme")
                and not wm.query("phase", "blog")):
            if "R6" not in self._fired_once:
                self._fired_once.add("R6")
                firings.append(RuleFiring("R6",
                    "📋 [RULE:missing-blog] README is written but BLOG.md has not "
                    "been written. Write the developer blog post next.", priority=5))

        # ------------------------------------------------------------------
        # R7 — Turn budget at 80% (one-shot)
        # ------------------------------------------------------------------
        if wm.turn >= int(self.max_turns * 0.80) and "R7" not in self._fired_once:
            self._fired_once.add("R7")
            firings.append(RuleFiring("R7",
                f"⚠️ [RULE:turn-budget] {wm.turn}/{self.max_turns} turns used "
                f"({int(wm.turn / self.max_turns * 100)}%). Prioritise ruthlessly: "
                "passing tests first, then README, then BLOG.md. "
                "Do not start new features.", priority=7))

        # ------------------------------------------------------------------
        # R8 — Permission denied
        # ------------------------------------------------------------------
        if "permission denied" in combined_output and any_nonzero:
            firings.append(RuleFiring("R8",
                "🔧 [RULE:permission] Permission denied. "
                "Use `chmod +x <file>` or check whether you need sudo.", priority=6))

        # ------------------------------------------------------------------
        # R9 — Network / connection errors (one-shot)
        # ------------------------------------------------------------------
        net_signals = ["connection refused", "connection timed out",
                       "name or service not known", "network unreachable",
                       "no route to host"]
        if any_nonzero and any(s in combined_output for s in net_signals):
            if "R9" not in self._fired_once:
                self._fired_once.add("R9")
                firings.append(RuleFiring("R9",
                    "🔧 [RULE:network] Network error detected. The container has "
                    "bridge networking (outbound-only). Verify the target URL is "
                    "reachable from outside the container; local services must be "
                    "started inside the container first.", priority=6))

        # ------------------------------------------------------------------
        # R10 — Syntax / compilation error nudge (repeating)
        # ------------------------------------------------------------------
        syntax_signals = ["syntaxerror", "unexpected token", "parse error",
                          "cannot find symbol", "undeclared identifier",
                          "error[e"]  # Rust error codes
        if any_nonzero and any(s in combined_output for s in syntax_signals):
            firings.append(RuleFiring("R10",
                "🔧 [RULE:syntax] Syntax or compilation error detected. "
                "Read the file you just wrote with `read_file` before editing — "
                "the actual content may differ from what you intended.", priority=7))

        # Sort by priority descending, cap at 3 to protect context budget
        return sorted(firings, key=lambda f: -f.priority)[:3]


# ---------------------------------------------------------------------------
# Symbolic constraint checker — pre-AGENT_DONE gate
# ---------------------------------------------------------------------------

# Deepgram API key pattern: starts with optional prefix then long alphanumeric
_DG_KEY_PATTERN = re.compile(r'["\']dg[_.]?[a-zA-Z0-9]{30,}["\']', re.IGNORECASE)

# Source file extensions to scan for secrets
_SOURCE_EXTENSIONS = {
    ".py", ".js", ".ts", ".mjs", ".cjs",
    ".go", ".rs", ".java", ".cs", ".rb",
    ".sh", ".bash", ".yaml", ".yml", ".toml",
}


def check_constraints(workspace: Path) -> list[str]:
    """
    Deterministic verification of the definition of done.

    Does NOT call the LLM. Returns a list of human-readable violation
    strings. Empty list means all constraints are satisfied.

    Checks:
      1. Required files exist (README.md, BLOG.md, .env.example)
      2. Required directories exist and are non-empty (src/, tests/)
      3. No hardcoded Deepgram API keys in source files
    """
    violations: list[str] = []

    # 1. Required files
    for required in ["README.md", "BLOG.md", ".env.example"]:
        if not (workspace / required).exists():
            violations.append(f"`{required}` is missing from the example directory")

    # 2. Required directories — must exist and contain at least one file
    for required_dir in ["src", "tests"]:
        d = workspace / required_dir
        if not d.exists():
            violations.append(f"`{required_dir}/` directory is missing")
        elif not any(d.iterdir()):
            violations.append(f"`{required_dir}/` directory is empty")

    # 3. Secret scan — Deepgram API key pattern in source files
    for src_file in sorted(workspace.rglob("*")):
        if not src_file.is_file():
            continue
        if src_file.suffix not in _SOURCE_EXTENSIONS:
            continue
        # Skip the .env.example — it's supposed to mention keys by name
        if src_file.name == ".env.example":
            continue
        try:
            content = src_file.read_text(errors="ignore")
        except OSError:
            continue
        if _DG_KEY_PATTERN.search(content):
            rel = src_file.relative_to(workspace)
            violations.append(
                f"Possible hardcoded Deepgram API key detected in `{rel}` — "
                f"use environment variables instead"
            )

    return violations
