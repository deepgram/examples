#!/usr/bin/env python3
"""
Main test runner for the LiveKit Agents + Deepgram example.

Exit codes:
- 0: All tests passed
- 1: Tests failed
- 2: Missing credentials (skipped)
"""

import os
import sys
import subprocess


def check_credentials():
    """Check if required credentials are available."""
    deepgram_key = os.getenv("DEEPGRAM_API_KEY")
    
    if not deepgram_key:
        print("⚠️  DEEPGRAM_API_KEY not set")
        print("   Skipping tests that require API credentials")
        return False
    
    print("✓ DEEPGRAM_API_KEY is set")
    return True


def run_unit_tests():
    """Run unit tests for tools."""
    print("\n" + "=" * 60)
    print("Running Unit Tests")
    print("=" * 60 + "\n")
    
    result = subprocess.run(
        [sys.executable, "tests/test_tools.py"],
        capture_output=False
    )
    return result.returncode == 0


def run_integration_tests():
    """Run integration tests for Deepgram."""
    print("\n" + "=" * 60)
    print("Running Integration Tests")
    print("=" * 60 + "\n")
    
    result = subprocess.run(
        [sys.executable, "tests/test_deepgram_integration.py"],
        capture_output=False
    )
    return result.returncode == 0


def main():
    """Main test runner."""
    print("=" * 60)
    print("LiveKit Agents + Deepgram Example Test Suite")
    print("=" * 60)
    
    has_credentials = check_credentials()
    
    # Run unit tests (don't need credentials)
    unit_passed = run_unit_tests()
    if not unit_passed:
        print("\n❌ Unit tests failed")
        sys.exit(1)
    
    # Run integration tests if we have credentials
    if has_credentials:
        integration_passed = run_integration_tests()
        if not integration_passed:
            print("\n❌ Integration tests failed")
            sys.exit(1)
    else:
        print("\n⚠️  Skipping integration tests (no credentials)")
        sys.exit(2)
    
    print("\n" + "=" * 60)
    print("✓ All tests passed!")
    print("=" * 60)
    sys.exit(0)


if __name__ == "__main__":
    main()
