import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

const transcriptEl = document.getElementById("transcript")!;
const btnStart = document.getElementById("btn-start") as HTMLButtonElement;
const btnStop = document.getElementById("btn-stop") as HTMLButtonElement;
const btnPause = document.getElementById("btn-pause") as HTMLButtonElement;
const btnCopy = document.getElementById("btn-copy") as HTMLButtonElement;
const statusEl = document.getElementById("status")!;
const sourceEl = document.getElementById("capture-source") as HTMLSelectElement;
const applicationRow = document.getElementById("application-row")!;
const applicationEl = document.getElementById("application") as HTMLInputElement;

const MAX_LINES = 6;
const finalLines: string[] = [];
let currentInterim = "";
let paused = false;

function appendLine(text: string, className?: string) {
  const line = document.createElement("span");
  line.textContent = text;
  if (className) line.className = className;
  if (transcriptEl.childNodes.length > 0) {
    transcriptEl.append(document.createElement("br"));
  }
  transcriptEl.append(line);
}

function renderTranscript() {
  transcriptEl.replaceChildren();
  for (const line of finalLines.slice(-MAX_LINES)) appendLine(line);
  if (currentInterim) appendLine(currentInterim, "interim");
  if (transcriptEl.childNodes.length === 0) transcriptEl.textContent = "Listening...";
}

function updateApplicationInput() {
  const capturesApplication = sourceEl.value === "application";
  applicationRow.hidden = !capturesApplication;
  applicationEl.required = capturesApplication;
}

function resetControls() {
  btnStart.disabled = false;
  btnStop.disabled = true;
  btnPause.disabled = true;
  btnPause.textContent = "Pause";
  btnPause.classList.remove("active");
  paused = false;
  btnStart.classList.remove("active");
  btnStop.classList.remove("active");
  sourceEl.disabled = false;
  applicationEl.disabled = false;
}

function displayText(text: string, speaker: number | null) {
  return speaker === null ? text : `Speaker ${speaker + 1}: ${text}`;
}

sourceEl.addEventListener("change", updateApplicationInput);
updateApplicationInput();

btnStart.addEventListener("click", async () => {
  if (sourceEl.value === "application" && !applicationEl.value.trim()) {
    applicationEl.focus();
    applicationEl.reportValidity();
    return;
  }

  btnStart.disabled = true;
  btnStop.disabled = false;
  btnPause.disabled = false;
  btnStart.classList.add("active");
  sourceEl.disabled = true;
  applicationEl.disabled = true;
  finalLines.length = 0;
  currentInterim = "";
  transcriptEl.textContent = "Connecting...";

  try {
    await invoke("start_transcription", {
      request: {
        source: sourceEl.value,
        application: applicationEl.value.trim() || null,
      },
    });
  } catch (error) {
    statusEl.textContent = `error: ${String(error)}`;
    statusEl.className = "status error";
    resetControls();
  }
});

btnStop.addEventListener("click", async () => {
  btnStop.disabled = true;
  btnPause.disabled = true;
  await invoke("stop_transcription");
  resetControls();
  statusEl.textContent = "disconnected";
  statusEl.className = "status";
});

btnPause.addEventListener("click", async () => {
  const nextPaused = !paused;
  try {
    await invoke("set_transcription_paused", { paused: nextPaused });
    paused = nextPaused;
    btnPause.textContent = paused ? "Resume" : "Pause";
    btnPause.classList.toggle("active", paused);
    statusEl.textContent = paused ? "paused" : "connected";
    statusEl.className = paused ? "status" : "status connected";
  } catch (error) {
    statusEl.textContent = `error: ${String(error)}`;
    statusEl.className = "status error";
  }
});

btnCopy.addEventListener("click", async () => {
  const transcript = finalLines.join("\n");
  if (transcript) await navigator.clipboard.writeText(transcript);
});

listen<{
  text: string;
  is_final: boolean;
  speech_final: boolean;
  confidence: number;
  speaker: number | null;
}>(
  "transcript",
  (event) => {
    if (event.payload.is_final) {
      finalLines.push(displayText(event.payload.text, event.payload.speaker));
      currentInterim = "";
    } else {
      currentInterim = displayText(event.payload.text, event.payload.speaker);
    }
    renderTranscript();
  },
);

listen<string>("capture-status", (event) => {
  statusEl.textContent = event.payload;
  statusEl.className = "status connected";
});

listen<string>("dg-status", (event) => {
  statusEl.textContent = event.payload;
  statusEl.className = `status ${event.payload}`;
  if (event.payload === "disconnected") resetControls();
});

listen<string>("dg-error", (event) => {
  statusEl.textContent = `error: ${event.payload}`;
  statusEl.className = "status error";
  resetControls();
});

listen("utterance-end", () => {
  if (currentInterim) {
    finalLines.push(currentInterim);
    currentInterim = "";
    renderTranscript();
  }
});
