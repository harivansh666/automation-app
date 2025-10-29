const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  runAutohotkeyScript: (tagIDs) =>
    ipcRenderer.invoke("run-autohotkey-script", tagIDs),
  stopAutohotkeyScript: () => ipcRenderer.invoke("stop-autohotkey-script"),
  checkAutoHotkey: () => ipcRenderer.invoke("check-autohotkey"),
  manualSubmissionComplete: () =>
    ipcRenderer.invoke("manual-submission-complete"),

  // Listeners for main process events
  onBatchProgress: (callback) => ipcRenderer.on("batch-progress", callback),
  onManualSubmissionRequired: (callback) =>
    ipcRenderer.on("manual-submission-required", callback),
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
