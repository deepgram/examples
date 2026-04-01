'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('deepgramBridge', {
  sendAudio: (buffer) => ipcRenderer.send('audio-data', buffer),
  startTranscription: () => ipcRenderer.send('start-transcription'),
  stopTranscription: () => ipcRenderer.send('stop-transcription'),
  setIgnoreMouse: (ignore) => ipcRenderer.send('set-ignore-mouse', ignore),
  onTranscript: (callback) => ipcRenderer.on('transcript', (_e, data) => callback(data)),
  onStatus: (callback) => ipcRenderer.on('dg-status', (_e, status) => callback(status)),
});
