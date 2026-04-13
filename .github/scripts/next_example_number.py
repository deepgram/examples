#!/usr/bin/env python3
"""
next_example_number.py

Reads the examples/ directory and determines the next available example number.
Prints a zero-padded 3-digit number to stdout.

Optionally accepts --platform to check for subslots (e.g. if 020 exists,
returns 021 for a second example on the same platform).

Usage:
  python next_example_number.py [--platform PLATFORM_SLUG]
"""

import argparse
import os
import re
import sys
from pathlib import Path


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--examples-dir",
        default=os.environ.get("EXAMPLES_DIR", "examples"),
        help="Path to the examples/ directory",
    )
    parser.add_argument(
        "--platform",
        default=None,
        help="Optional platform slug to check for subslots",
    )
    args = parser.parse_args()

    examples_dir = Path(args.examples_dir)
    if not examples_dir.exists():
        # Fresh repo — start at 010
        print("010")
        return

    existing = []
    for entry in examples_dir.iterdir():
        if not entry.is_dir():
            continue
        m = re.match(r"^(\d{3})", entry.name)
        if m:
            existing.append(int(m.group(1)))

    if not existing:
        print("010")
        return

    existing.sort()
    max_num = max(existing)

    # Find the next multiple of 10 above the current max
    next_base = ((max_num // 10) + 1) * 10

    # If a platform was specified, check whether next_base - 10 is taken
    # and we should use a subslot instead
    if args.platform:
        # Subslot logic: if the base slot (e.g. 020) exists and is the same platform,
        # use 021, 022, etc. This is a best-effort heuristic — the agent/workflow
        # can override via the issue body if needed.
        candidate_base = next_base - 10
        subslot_candidates = [n for n in existing if candidate_base <= n < next_base]
        if subslot_candidates:
            next_subslot = max(subslot_candidates) + 1
            if next_subslot < next_base:
                print(f"{next_subslot:03d}")
                return

    print(f"{next_base:03d}")


if __name__ == "__main__":
    main()
