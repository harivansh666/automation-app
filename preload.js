const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  // Script execution and management
  runAutohotkeyScript: (tagIDs, villageName) =>
    ipcRenderer.invoke("run-autohotkey-script", tagIDs, villageName),
  stopAutohotkeyScript: () => ipcRenderer.invoke("stop-autohotkey-script"),
  checkAutoHotkey: () => ipcRenderer.invoke("check-autohotkey"),
  manualSubmissionComplete: () =>
    ipcRenderer.invoke("manual-submission-complete"),

  // Script editing and management
  getAutoHotkeyScript: (batchNumber) =>
    ipcRenderer.invoke("get-autohotkey-script", batchNumber),
  saveAutoHotkeyScript: (batchNumber, scriptContent) =>
    ipcRenderer.invoke("save-autohotkey-script", batchNumber, scriptContent),
  generateNewScriptTemplate: (batchNumber) =>
    ipcRenderer.invoke("generate-new-script-template", batchNumber),
  clearAllScripts: () => ipcRenderer.invoke("clear-all-scripts"),
  getExistingScripts: () => ipcRenderer.invoke("get-existing-scripts"),
  deleteScript: (batchNumber) =>
    ipcRenderer.invoke("delete-script", batchNumber),

  // Listeners for main process events
  onBatchProgress: (callback) => ipcRenderer.on("batch-progress", callback),
  onManualSubmissionRequired: (callback) =>
    ipcRenderer.on("manual-submission-required", callback),
  onUsingExistingScript: (callback) =>
    ipcRenderer.on("using-existing-script", callback),
  onUsingModifiedScript: (callback) =>
    ipcRenderer.on("using-modified-script", callback),

  // Utility
  removeAllListeners: (channel) => ipcRenderer.removeAllListeners(channel),
});
