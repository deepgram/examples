#!/usr/bin/env python3
"""
Test runner that runs all tests and reports results.

Exit codes:
- 0: All tests passed
- 1: Some tests failed
- 2: Missing credentials (tests skipped)
"""

import asyncio
import os
import subprocess
import sys
from pathlib import Path


def run_test(test_file: str) -> int:
    """Run a single test file and return exit code."""
    print(f"\n{'='*60}")
    print(f"Running: {test_file}")
    print('='*60 + "\n")
    
    result = subprocess.run(
        [sys.executable, test_file],
        cwd=Path(__file__).parent,
        env=os.environ.copy(),
    )
    
    return result.returncode


def main() -> int:
    """Run all tests."""
    test_dir = Path(__file__).parent
    
    # List of test files to run
    test_files = [
        "test_deepgram_connection.py",
        "test_livekit_connection.py", 
        "test_integration.py",
    ]
    
    results = {}
    has_failure = False
    all_skipped = True
    
    for test_file in test_files:
        test_path = test_dir / test_file
        if test_path.exists():
            exit_code = run_test(str(test_path))
            results[test_file] = exit_code
            
            if exit_code == 1:
                has_failure = True
            if exit_code != 2:
                all_skipped = False
    
    # Summary
    print("\n" + "="*60)
    print("TEST SUMMARY")
    print("="*60)
    
    for test_file, code in results.items():
        status = {0: "PASS ✓", 1: "FAIL ✗", 2: "SKIP ⊘"}.get(code, f"UNKNOWN ({code})")
        print(f"  {test_file}: {status}")
    
    print()
    
    if has_failure:
        print("Some tests failed!")
        return 1
    elif all_skipped:
        print("All tests skipped due to missing credentials")
        return 2
    else:
        print("All tests passed!")
        return 0


if __name__ == "__main__":
    sys.exit(main())
