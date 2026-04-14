#!/usr/bin/env python3
"""
find_unhandled_issue.py

Reads newline-separated issue numbers from stdin and prints the oldest one
that still needs a response from the issue handler.

An issue is considered already handled if:
  - It has the 'type:example' or 'automated' label (build already done), OR
  - Its last comment contains '<!-- claude-reply -->' (already replied)

Additional filter --org-members-only: when set, also checks that the issue
author is a member of the given GitHub org. Issues by non-members without
the type:suggestion label are skipped.

Prints nothing (empty) if no eligible issue is found.

Usage:
  gh issue list --state open --limit 50 --json number --jq '.[].number' \
    | python3 .github/scripts/find_unhandled_issue.py --repo OWNER/REPO [--org ORG]
"""

import argparse
import json
import subprocess
import sys


def is_org_member(login: str, org: str) -> bool:
    r = subprocess.run(
        ["gh", "api", f"orgs/{org}/members/{login}", "-i"],
        capture_output=True, text=True,
    )
    return "204" in r.stdout.split("\n")[0]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo", required=True, help="GitHub repo in OWNER/REPO format")
    parser.add_argument("--org", default=None, help="Org to check membership against")
    args = parser.parse_args()

    numbers = [int(l.strip()) for l in sys.stdin if l.strip()]
    numbers.reverse()  # oldest first

    for num in numbers:
        result = subprocess.run(
            ["gh", "issue", "view", str(num), "--repo", args.repo,
             "--json", "author,comments,labels"],
            capture_output=True, text=True,
        )
        data = json.loads(result.stdout)

        label_names = {l["name"] for l in data.get("labels", [])}

        # Skip already-built issues
        if {"type:example", "automated"}.intersection(label_names):
            continue

        # If org filter set: skip non-member issues that aren't explicitly approved
        if args.org:
            author = data.get("author", {}).get("login", "")
            is_bot = "[bot]" in author
            has_suggestion = "type:suggestion" in label_names
            if not is_bot and not has_suggestion and not is_org_member(author, args.org):
                continue

        comments = data.get("comments", [])
        if not comments:
            print(num)
            return
        if "<!-- claude-reply -->" not in comments[-1].get("body", ""):
            print(num)
            return


if __name__ == "__main__":
    main()
