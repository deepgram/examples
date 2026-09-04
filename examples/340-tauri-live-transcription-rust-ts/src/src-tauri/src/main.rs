#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use deepgram::common::options::{Encoding, Model, Options};
use deepgram::common::stream_response::StreamResponse;
use deepgram::Deepgram;
use pocketstation::connector::{
    Connector, ConnectorError, ConnectorErrorCode, ConnectorErrorStage, ConnectorRetryability,
};
use pocketstation::{AudioFrameDuration, Session, SessionEventKind, SessionEventReceive, Source};
use serde::Deserialize;
use std::env;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::sync::{mpsc, oneshot, Mutex};

struct AppState {
    active_stop: Mutex<Option<Arc<AtomicBool>>>,
}

#[derive(Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
enum CaptureSource {
    Application,
    SystemAudio,
    Microphone,
}

#[derive(Clone, Deserialize)]
struct CaptureRequest {
    source: CaptureSource,
    application: Option<String>,
}

impl CaptureRequest {
    fn source(&self) -> Result<Source, String> {
        match self.source {
            CaptureSource::Application => {
                let application = self
                    .application
                    .as_deref()
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .ok_or_else(|| "Enter a running application name or identifier".to_string())?;
                Ok(Source::application(application))
            }
            CaptureSource::SystemAudio => Ok(Source::system_audio()),
            CaptureSource::Microphone => Ok(Source::microphone_default()),
        }
    }

    fn label(&self) -> &'static str {
        match self.source {
            CaptureSource::Application => "application",
            CaptureSource::SystemAudio => "system audio",
            CaptureSource::Microphone => "microphone",
        }
    }
}

fn pcm16(samples: &[f32]) -> Vec<u8> {
    let mut output = Vec::with_capacity(samples.len() * 2);
    for sample in samples {
        let sample = sample.clamp(-1.0, 1.0);
        let value = if sample < 0.0 {
            (sample * 32_768.0) as i16
        } else {
            (sample * 32_767.0) as i16
        };
        output.extend_from_slice(&value.to_le_bytes());
    }
    output
}

fn delivery_error(message: impl Into<String>) -> ConnectorError {
    ConnectorError::new(
        ConnectorErrorCode::new("deepgram.audio_queue_unavailable")
            .expect("the example error code is valid"),
        ConnectorErrorStage::Delivery,
        ConnectorRetryability::Retryable,
        message,
    )
    .expect("the example error message is valid")
}

fn run_capture(
    app: AppHandle,
    request: CaptureRequest,
    audio_tx: mpsc::Sender<Vec<u8>>,
    stop: Arc<AtomicBool>,
) -> Result<(), String> {
    let session = Session::builder()
        .audio_frame_duration(AudioFrameDuration::Ms10)
        .build();
    let destination = session
        .destination(
            Connector::from_audio_fn(move |frame| {
                audio_tx
                    .try_send(pcm16(frame.samples()))
                    .map_err(|error| delivery_error(error.to_string()))
            })
            .map_err(|error| error.to_string())?,
        )
        .map_err(|error| error.to_string())?;
    session
        .capture(request.source()?)
        .map_err(|error| error.to_string())?
        .send(destination)
        .map_err(|error| error.to_string())?;

    let mut running = session.start().map_err(|error| error.to_string())?;
    let _ = app.emit("capture-status", format!("capturing {}", request.label()));
    let mut runtime_error = None;
    while !stop.load(Ordering::Acquire) {
        if let SessionEventReceive::Event(event) = running.try_recv_event() {
            match event.kind() {
                SessionEventKind::Source(_)
                | SessionEventKind::Endpoint(_)
                | SessionEventKind::Rollback(_)
                | SessionEventKind::Finalization(_) => {
                    runtime_error = Some(format!(
                        "PocketStation reported {kind:?}",
                        kind = event.kind()
                    ));
                    break;
                }
                SessionEventKind::Lifecycle(_) | SessionEventKind::Terminal(_) => {}
            }
        }
        std::thread::sleep(Duration::from_millis(20));
    }

    let outcome = running.stop();
    if let Some(error) = runtime_error {
        Err(error)
    } else if !outcome.is_success() {
        Err(format!("PocketStation did not stop cleanly: {outcome:?}"))
    } else {
        Ok(())
    }
}

async fn run_session(
    app: AppHandle,
    api_key: String,
    request: CaptureRequest,
    stop: Arc<AtomicBool>,
) {
    let dg = match Deepgram::new(&api_key) {
        Ok(deepgram) => deepgram,
        Err(error) => {
            let _ = app.emit("dg-error", error.to_string());
            return;
        }
    };

    let options = Options::builder()
        .model(Model::Nova3)
        .smart_format(true)
        .punctuate(true)
        .diarize(true)
        .tag(["deepgram-examples"])
        .build();

    let mut handle = match dg
        .transcription()
        .stream_request_with_options(options)
        .encoding(Encoding::Linear16)
        .sample_rate(48000)
        .channels(1)
        .interim_results(true)
        .utterance_end_ms(1500)
        .keep_alive()
        .handle()
        .await
    {
        Ok(handle) => handle,
        Err(error) => {
            let _ = app.emit("dg-error", error.to_string());
            return;
        }
    };

    let (audio_tx, mut audio_rx) = mpsc::channel::<Vec<u8>>(32);
    let (capture_done_tx, mut capture_done_rx) = oneshot::channel();
    let capture_app = app.clone();
    let capture_stop = Arc::clone(&stop);
    tokio::task::spawn_blocking(move || {
        let result = run_capture(capture_app, request, audio_tx, capture_stop);
        let _ = capture_done_tx.send(result);
    });

    let _ = app.emit("dg-status", "connected");
    let mut capture_finished = false;

    loop {
        tokio::select! {
            biased;

            capture = &mut capture_done_rx => {
                capture_finished = true;
                match capture {
                    Ok(Ok(())) => {
                        let _ = handle.close_stream().await;
                    }
                    Ok(Err(error)) => {
                        let _ = app.emit("dg-error", error);
                    }
                    Err(error) => {
                        let _ = app.emit("dg-error", error.to_string());
                    }
                }
                break;
            }

            audio = audio_rx.recv() => {
                match audio {
                    Some(data) => {
                        if let Err(error) = handle.send_data(data).await {
                            let _ = app.emit("dg-error", error.to_string());
                            break;
                        }
                    }
                    None => {
                        let _ = handle.close_stream().await;
                        break;
                    }
                }
            }

            response = handle.receive() => {
                match response {
                    Some(Ok(StreamResponse::TranscriptResponse {
                        channel,
                        is_final,
                        speech_final,
                        ..
                    })) => {
                        if let Some(alternative) = channel.alternatives.first() {
                            if !alternative.transcript.is_empty() {
                                let _ = app.emit(
                                    "transcript",
                                    serde_json::json!({
                                        "text": alternative.transcript,
                                        "is_final": is_final,
                                        "speech_final": speech_final,
                                        "confidence": alternative.confidence,
                                        "speaker": alternative.words.first().and_then(|word| word.speaker),
                                    }),
                                );
                            }
                        }
                    }
                    Some(Ok(StreamResponse::TerminalResponse { .. })) => {
                        let _ = app.emit("dg-status", "closed");
                        break;
                    }
                    Some(Ok(StreamResponse::UtteranceEndResponse { .. })) => {
                        let _ = app.emit("utterance-end", "");
                    }
                    Some(Ok(_)) => {}
                    Some(Err(error)) => {
                        let _ = app.emit("dg-error", error.to_string());
                        break;
                    }
                    None => {
                        let _ = app.emit("dg-status", "closed");
                        break;
                    }
                }
            }
        }
    }

    stop.store(true, Ordering::Release);
    if !capture_finished {
        if let Ok(Err(error)) = capture_done_rx.await {
            let _ = app.emit("dg-error", error);
        }
    }
    let _ = app.emit("dg-status", "disconnected");
}

#[tauri::command]
async fn start_transcription(
    app: AppHandle,
    state: State<'_, AppState>,
    request: CaptureRequest,
) -> Result<(), String> {
    let api_key =
        env::var("DEEPGRAM_API_KEY").map_err(|_| "DEEPGRAM_API_KEY is not set".to_string())?;

    let stop = Arc::new(AtomicBool::new(false));
    {
        let mut active = state.active_stop.lock().await;
        if let Some(previous) = active.replace(Arc::clone(&stop)) {
            previous.store(true, Ordering::Release);
        }
    }

    tokio::spawn(run_session(app, api_key, request, stop));
    Ok(())
}

#[tauri::command]
async fn stop_transcription(state: State<'_, AppState>) -> Result<(), String> {
    if let Some(stop) = state.active_stop.lock().await.take() {
        stop.store(true, Ordering::Release);
    }
    Ok(())
}

fn main() {
    dotenvy::dotenv().ok();

    tauri::Builder::default()
        .manage(AppState {
            active_stop: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            start_transcription,
            stop_transcription,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pcm_conversion_clamps_and_encodes_little_endian_samples() {
        assert_eq!(
            pcm16(&[-2.0, -1.0, 0.0, 1.0, 2.0]),
            vec![0, 128, 0, 128, 0, 0, 255, 127, 255, 127]
        );
    }

    #[test]
    fn application_capture_requires_a_name() {
        let request = CaptureRequest {
            source: CaptureSource::Application,
            application: Some("  ".to_string()),
        };
        assert!(request.source().is_err());
    }
}
