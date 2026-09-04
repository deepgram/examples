"""Test the Tauri desktop live transcription example.

These tests inspect the Rust backend, Tauri configuration, and TypeScript
frontend without starting a desktop window. Run the application for the real
Deepgram and native capture check described in the README.
"""

import json
import os
import sys
from pathlib import Path

env_example = Path(__file__).parent.parent / ".env.example"
required = [
    line.split("=")[0].strip()
    for line in env_example.read_text().splitlines()
    if line and not line.startswith("#") and "=" in line and line[0].isupper()
]
missing = [key for key in required if not os.environ.get(key)]
if missing:
    print(f"MISSING_CREDENTIALS: {','.join(missing)}", file=sys.stderr)
    sys.exit(2)

ROOT = Path(__file__).parent.parent


def test_file_structure():
    """Verify all required project files exist."""
    required_files = [
        ".env.example",
        "README.md",
        "src/src-tauri/src/main.rs",
        "src/src-tauri/Cargo.toml",
        "src/src-tauri/Info.plist",
        "src/src-tauri/tauri.conf.json",
        "src/src/main.ts",
        "src/index.html",
        "src/package.json",
    ]
    for relative_path in required_files:
        assert (ROOT / relative_path).exists(), f"Missing required file: {relative_path}"


def test_rust_owns_capture_and_deepgram():
    """Verify Rust owns native capture and the Deepgram connection."""
    main_rs = (ROOT / "src" / "src-tauri" / "src" / "main.rs").read_text()

    assert "deepgram::Deepgram" in main_rs or "use deepgram" in main_rs
    assert "deepgram-examples" in main_rs
    assert "Model::Nova3" in main_rs
    assert ".diarize(true)" in main_rs
    assert "DEEPGRAM_API_KEY" in main_rs
    assert "start_transcription" in main_rs
    assert "pocketstation" in main_rs
    assert "Source::application" in main_rs
    assert "Source::system_audio" in main_rs
    assert "Source::microphone_default" in main_rs
    assert "Connector::from_audio_fn" in main_rs


def test_cargo_dependencies_are_pinned():
    """Verify the example uses released Deepgram and PocketStation crates."""
    cargo_toml = (ROOT / "src" / "src-tauri" / "Cargo.toml").read_text()

    assert 'deepgram = "=0.9.2"' in cargo_toml
    assert 'pocketstation = "=1.1.9"' in cargo_toml
    assert "tauri" in cargo_toml


def test_tauri_configuration():
    """Verify the desktop window and application identity."""
    conf = json.loads((ROOT / "src" / "src-tauri" / "tauri.conf.json").read_text())
    product_name = conf.get("productName", "")
    identifier = conf.get("identifier", "")
    windows = conf.get("app", {}).get("windows", [])

    assert "deepgram" in product_name.lower() or "transcription" in product_name.lower()
    assert "deepgram" in identifier.lower()
    assert windows
    assert windows[0].get("width", 0) > 0
    assert windows[0].get("height", 0) > 0


def test_frontend_selects_native_capture():
    """Verify the frontend requests one explicit native source."""
    main_ts = (ROOT / "src" / "src" / "main.ts").read_text()
    index_html = (ROOT / "src" / "index.html").read_text()

    assert 'from "@tauri-apps/api/core"' in main_ts
    assert "start_transcription" in main_ts
    assert "stop_transcription" in main_ts
    assert "getUserMedia" not in main_ts
    assert "send_audio" not in main_ts
    assert "capture-source" in main_ts
    assert 'value="application"' in index_html
    assert 'value="system_audio"' in index_html
    assert 'value="microphone"' in index_html
    assert 'id="application"' in index_html
    assert 'id="btn-copy"' in index_html


def test_macos_permission_descriptions():
    """Verify packaged macOS builds explain both permission requests."""
    info_plist = (ROOT / "src" / "src-tauri" / "Info.plist").read_text()

    assert "NSMicrophoneUsageDescription" in info_plist
    assert "NSScreenCaptureUsageDescription" in info_plist


if __name__ == "__main__":
    test_file_structure()
    test_rust_owns_capture_and_deepgram()
    test_cargo_dependencies_are_pinned()
    test_tauri_configuration()
    test_frontend_selects_native_capture()
    test_macos_permission_descriptions()
    print("All tests passed")
