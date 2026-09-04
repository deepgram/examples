# Tauri desktop live transcription

Build a Tauri 2 desktop application that transcribes a running application,
all system audio, or a microphone with Deepgram Nova-3. PocketStation captures
audio in Rust on macOS, Windows, and Linux. The TypeScript frontend selects the
source and displays interim and final transcripts with speaker labels.

The application does not open a microphone unless you select **Default
microphone**.

## Prerequisites

- The current stable [Rust toolchain](https://www.rust-lang.org/tools/install)
- [Node.js](https://nodejs.org/) 18 or later
- The [Tauri 2 prerequisites](https://v2.tauri.app/start/prerequisites/) for your operating system
- A [Deepgram API key](https://console.deepgram.com/)

## Run the application

Set your Deepgram API key in the shell that will start Tauri:

```bash
export DEEPGRAM_API_KEY="your_api_key"
```

Install the frontend packages and start Tauri:

```bash
cd src
pnpm install
pnpm tauri dev
```

Choose one source in the application:

- **Running application** captures the application name or identifier you
  enter, such as `Zoom`.
- **All system audio** captures the complete desktop mix.
- **Default microphone** asks for microphone access and captures the current
  default input device.

Start the application you want to capture before clicking **Start**. If more
than one application matches the value you entered, PocketStation reports the
ambiguity instead of choosing one silently.

Use **Pause** to stop sending audio to Deepgram while keeping the selected
native source open. **Resume** continues with new audio; audio produced while
paused is intentionally not transcribed.

## Permissions

macOS asks separately for microphone access and for Screen & System Audio
Recording. Grant only the permission required by the source you selected, then
restart the example if macOS requests it.

Windows uses native process-loopback or system-loopback capture. Linux uses
PipeWire and may display a desktop portal depending on the compositor.

## How audio reaches Deepgram

```text
selected native source
        ↓
PocketStation 10 ms frames at 48 kHz
        ↓
mono downmix and linear16 conversion in a PocketStation Connector
        ↓
Deepgram streaming transcription
        ↓
interim and final transcript events in Tauri
```

Audio stays in the Rust process. Only source selections and transcript events
cross Tauri IPC. PocketStation continues native capture while the Deepgram
worker sends frames over the network, and it reports delivery failure if the
network worker cannot keep up.

The Deepgram request uses these settings:

| Setting | Value |
|---|---|
| Model | `nova-3` |
| Encoding | `linear16` |
| Sample rate | `48000` |
| Channels | `1` |
| Frame duration | `10 ms` |
| Interim results | Enabled |
| Speaker diarization | Enabled |
| Smart formatting | Enabled |
| Utterance end | `1500 ms` |

## Verify the example

Run the source checks:

```bash
DEEPGRAM_API_KEY=test python tests/test_example.py
```

Build both halves of the application:

```bash
cd src
pnpm build
cargo test --manifest-path src-tauri/Cargo.toml --locked
```

For the real service check, run the application with a valid Deepgram API key,
play speech in the selected source, and confirm that interim and final text
appears before stopping the session.

## Starter templates

See the [Deepgram starter repositories](https://github.com/orgs/deepgram-starters/repositories)
for additional application templates.
