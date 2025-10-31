document.addEventListener("DOMContentLoaded", function () {
  // Form elements
  const tagIdsTextarea = document.getElementById("tagIds");
  const villageInput = document.getElementById("villageInput");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loadSampleBtn = document.getElementById("loadSampleBtn");
  const generateNewScriptBtn = document.getElementById("generateNewScriptBtn");
  const statusDiv = document.getElementById("status");
  const checkScriptButton = document.querySelector(".checkScriptButton");

  // Modal elements
  const scriptModal = document.getElementById("scriptModal");
  const scriptEditor = document.getElementById("scriptEditor");
  const currentBatchInfo = document.getElementById("currentBatchInfo");
  const scriptStatus = document.getElementById("scriptStatus");
  const reloadScriptBtn = document.getElementById("reloadScriptBtn");
  const saveScriptBtn = document.getElementById("saveScriptBtn");
  const closeScriptBtn = document.getElementById("closeScriptBtn");
  const closeModalBtn = document.querySelector(".close-modal");

  // Submission dialog elements
  const submissionDialog = document.getElementById("submissionDialog");
  const submissionInfo = document.getElementById("submissionInfo");
  const submissionCompleteBtn = document.getElementById(
    "submissionCompleteBtn"
  );
  const cancelBatchBtn = document.getElementById("cancelBatchBtn");

  // Batch progress elements
  const batchProgress = document.createElement("div");
  batchProgress.className = "batch-progress";
  document.querySelector(".status-section").appendChild(batchProgress);

  // Current batch for script editing
  let currentBatchNumber = 1;
  let isScriptModified = false;
  let currentScriptType = "default";

  // Load and show existing scripts on startup
  async function loadExistingScripts() {
    try {
      const result = await window.electronAPI.getExistingScripts();
      if (result.success && result.scripts.length > 0) {
        const modifiedScripts = result.scripts.filter((s) => s.isModified);
        const defaultScripts = result.scripts.filter((s) => !s.isModified);

        let scriptInfo = "";

        if (modifiedScripts.length > 0) {
          scriptInfo += `Modified: ${modifiedScripts
            .map((s) => `Batch ${s.batchNumber}`)
            .join(", ")}`;
        }

        if (defaultScripts.length > 0) {
          if (scriptInfo) scriptInfo += " | ";
          scriptInfo += `Default: ${defaultScripts
            .map((s) => `Batch ${s.batchNumber}`)
            .join(", ")}`;
        }

        updateStatus(
          `📂 Found ${result.scripts.length} saved script(s): ${scriptInfo}`,
          "info"
        );

        console.log("Existing scripts:", result.scripts);
      }
    } catch (error) {
      console.error("Error loading existing scripts:", error);
    }
  }

  // Load sample data
  loadSampleBtn.addEventListener("click", function () {
    const sampleData = Array.from(
      { length: 50 },
      (_, i) => `10229470${8797 + i}`
    ).join("\n");

    tagIdsTextarea.value = sampleData;
    villageInput.value = "tehang";
    updateStatus(
      `Loaded 50 sample tags for village 'tehang'. Will be processed in 2 batches of 25.`,
      "info"
    );
  });

  // Clear textarea
  clearBtn.addEventListener("click", function () {
    tagIdsTextarea.value = "";
    villageInput.value = "";
    updateStatus("Text area cleared.", "info");
    hideBatchProgress();
  });

  // Generate New Script Template Button
  generateNewScriptBtn.addEventListener("click", async function () {
    const batchNumber = parseInt(
      prompt("Enter batch number to generate new script template:", "1")
    );

    if (isNaN(batchNumber) || batchNumber < 1) {
      updateStatus("Invalid batch number", "error");
      return;
    }

    try {
      updateStatus(
        `Generating new script template for batch ${batchNumber}...`,
        "info"
      );

      const result = await window.electronAPI.generateNewScriptTemplate(
        batchNumber
      );

      if (result.success) {
        updateStatus(
          `✅ New DEFAULT script template generated for batch ${batchNumber}`,
          "success"
        );

        // Open the script editor to show the new template
        setTimeout(() => {
          openScriptEditor(batchNumber);
        }, 1000);
      } else {
        updateStatus(`❌ Error generating template: ${result.error}`, "error");
      }
    } catch (error) {
      updateStatus(`❌ Error: ${error.message}`, "error");
    }
  });

  // Check Script Button - Open Script Editor
  checkScriptButton.addEventListener("click", async function () {
    await openScriptEditor();
  });

  // Script Editor Functions
  async function openScriptEditor(batchNumber = 1) {
    try {
      currentBatchNumber = batchNumber;
      showScriptModal();

      // Reset modified status
      isScriptModified = false;
      updateScriptStatus("Loading script...", "info");

      const result = await window.electronAPI.getAutoHotkeyScript(batchNumber);

      if (result.success) {
        scriptEditor.value = result.scriptContent;
        currentBatchInfo.textContent = batchNumber;
        currentScriptType = result.scriptType || "default";
        isScriptModified = result.isModified || false;

        // Update UI based on script type
        updateScriptUIForType(isScriptModified);
      } else {
        scriptEditor.value = `Error: ${result.error}`;
        updateScriptStatus("Failed to load script", "error");
      }
    } catch (error) {
      scriptEditor.value = `Error: ${error.message}`;
      updateScriptStatus("Error loading script", "error");
    }
  }

  // Update script UI based on type (modified/default)
  function updateScriptUIForType(isModified) {
    if (isModified) {
      updateScriptStatus(
        "📝 MODIFIED SCRIPT - This script will be used for all future runs",
        "warning"
      );
      saveScriptBtn.textContent = "Update Modified Script";
      saveScriptBtn.classList.add("btn-warning");
      scriptEditor.classList.add("modified-script");
    } else {
      updateScriptStatus(
        "📄 DEFAULT SCRIPT - Edit and save to create modified version that will be used permanently",
        "info"
      );
      saveScriptBtn.textContent = "Save as Modified Script";
      saveScriptBtn.classList.remove("btn-warning");
      scriptEditor.classList.remove("modified-script");
    }
  }

  function showScriptModal() {
    scriptModal.classList.remove("hidden");
  }

  function hideScriptModal() {
    scriptModal.classList.add("hidden");
  }

  function updateScriptStatus(message, type = "info") {
    scriptStatus.textContent = message;
    scriptStatus.className = `script-status ${type}`;
  }

  // Script Editor Event Listeners
  closeModalBtn.addEventListener("click", hideScriptModal);
  closeScriptBtn.addEventListener("click", hideScriptModal);

  scriptModal.addEventListener("click", function (e) {
    if (e.target === scriptModal) {
      hideScriptModal();
    }
  });

  reloadScriptBtn.addEventListener("click", async function () {
    await openScriptEditor(currentBatchNumber);
  });

  saveScriptBtn.addEventListener("click", async function () {
    const scriptContent = scriptEditor.value;

    try {
      updateScriptStatus("Saving as MODIFIED SCRIPT...", "warning");

      const result = await window.electronAPI.saveAutoHotkeyScript(
        currentBatchNumber,
        scriptContent
      );

      if (result.success) {
        isScriptModified = true;
        currentScriptType = "modified";

        updateScriptStatus(
          "✅ MODIFIED SCRIPT SAVED! This version will be used for all future runs",
          "success"
        );

        // Update UI for modified script
        updateScriptUIForType(true);

        updateStatus(
          `✅ Batch ${currentBatchNumber} saved as MODIFIED SCRIPT - Will be used permanently`,
          "success"
        );

        // Show confirmation for 3 seconds
        setTimeout(() => {
          if (isScriptModified) {
            updateScriptStatus(
              "✅ MODIFIED SCRIPT - Will be used for all future runs",
              "success"
            );
          }
        }, 3000);
      } else {
        updateScriptStatus(`❌ Save failed: ${result.error}`, "error");
      }
    } catch (error) {
      updateScriptStatus(`❌ Error saving script: ${error.message}`, "error");
    }
  });

  // Clear all scripts button
  const clearScriptsBtn = document.getElementById("clearScriptsBtn");
  if (clearScriptsBtn) {
    clearScriptsBtn.addEventListener("click", async function () {
      const confirmed = confirm(
        "⚠️ This will delete ALL saved script files.\n\n" +
          "Modified scripts will be lost!\n" +
          "New default scripts will be generated on next run.\n\n" +
          "Continue?"
      );

      if (confirmed) {
        try {
          const result = await window.electronAPI.clearAllScripts();
          if (result.success) {
            updateStatus(
              `✅ Cleared ${result.deletedCount} script file(s). New scripts will be generated on next run.`,
              "success"
            );

            // Reset modified status
            isScriptModified = false;
            currentScriptType = "default";

            // Reload existing scripts display
            setTimeout(() => loadExistingScripts(), 500);
          } else {
            updateStatus(`❌ Error clearing scripts: ${result.error}`, "error");
          }
        } catch (error) {
          updateStatus(`❌ Error: ${error.message}`, "error");
        }
      }
    });
  }

  // Run script
  runBtn.addEventListener("click", async function () {
    const tagIdsText = tagIdsTextarea.value.trim();
    const villageName = villageInput.value.trim();

    console.log("Village name:", villageName);

    // Validate village name
    if (!villageName) {
      updateStatus("Please enter a village name.", "error");
      return;
    }

    if (!tagIdsText) {
      updateStatus("Please enter at least one Tag ID.", "error");
      return;
    }

    const tagIDs = tagIdsText
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (tagIDs.length === 0) {
      updateStatus("No valid Tag IDs found.", "error");
      return;
    }

    // Calculate batches
    const batchSize = 25;
    const totalBatches = Math.ceil(tagIDs.length / batchSize);

    updateStatus(
      `Starting automation for ${tagIDs.length} tags (${totalBatches} batches) for village: ${villageName}...`,
      "info"
    );
    runBtn.disabled = true;
    stopBtn.disabled = false;
    clearBtn.disabled = true;
    checkScriptButton.disabled = true;
    generateNewScriptBtn.disabled = true;

    // Show batch progress
    showBatchProgress(totalBatches, tagIDs.length);

    try {
      console.log("Calling runAutohotkeyScript with:", {
        tagIDs: tagIDs.length,
        villageName: villageName,
      });

      const result = await window.electronAPI.runAutohotkeyScript(
        tagIDs,
        villageName
      );

      updateStatus(
        `✅ Script completed! Processed ${result.totalTags} tags in ${result.totalBatches} batches for village: ${result.villageName}.`,
        "success"
      );

      // Show modified scripts info if any
      if (result.modifiedScripts && result.modifiedScripts.length > 0) {
        updateStatus(
          `📝 ${
            result.modifiedScripts.length
          } modified script(s) were used (Batch ${result.modifiedScripts.join(
            ", "
          )})`,
          "info"
        );
      }
    } catch (error) {
      updateStatus(`❌ Error: ${error.message}`, "error");
      console.error("Script execution error:", error);
    } finally {
      runBtn.disabled = false;
      stopBtn.disabled = true;
      clearBtn.disabled = false;
      checkScriptButton.disabled = false;
      generateNewScriptBtn.disabled = false;
      hideSubmissionDialog();
      hideBatchProgress();
    }
  });

  // Stop script
  stopBtn.addEventListener("click", async function () {
    try {
      const result = await window.electronAPI.stopAutohotkeyScript();
      updateStatus("Script stopped by user.", "warning");
      stopBtn.disabled = true;
      runBtn.disabled = false;
      clearBtn.disabled = false;
      checkScriptButton.disabled = false;
      generateNewScriptBtn.disabled = false;
      hideSubmissionDialog();
      hideBatchProgress();
    } catch (error) {
      updateStatus(`Error stopping script: ${error.message}`, "error");
    }
  });

  // IPC event listeners
  window.electronAPI.onBatchProgress((event, data) => {
    updateBatchProgress(data);
  });

  window.electronAPI.onManualSubmissionRequired((event, data) => {
    showSubmissionDialog(data);
  });

  // Listen for using existing script notification
  window.electronAPI.onUsingExistingScript((event, data) => {
    updateStatus(`📂 Using saved script for Batch ${data.batchNumber}`, "info");
  });

  // Listen for using modified script notification
  window.electronAPI.onUsingModifiedScript((event, data) => {
    if (data.isModified) {
      updateStatus(
        `📝 Using MODIFIED script for Batch ${data.batchNumber} (This version will be used permanently)`,
        "warning"
      );
    }
  });

  // Update status function
  function updateStatus(message, type = "info") {
    statusDiv.textContent = message;
    statusDiv.className = "status";

    switch (type) {
      case "success":
        statusDiv.style.borderLeftColor = "#27ae60";
        statusDiv.style.background = "#d5f4e6";
        break;
      case "error":
        statusDiv.style.borderLeftColor = "#e74c3c";
        statusDiv.style.background = "#fadbd8";
        break;
      case "warning":
        statusDiv.style.borderLeftColor = "#f39c12";
        statusDiv.style.background = "#fdebd0";
        break;
      default:
        statusDiv.style.borderLeftColor = "#3498db";
        statusDiv.style.background = "#d6eaf8";
    }
  }

  // Batch progress functions
  function showBatchProgress(totalBatches, totalTags) {
    batchProgress.innerHTML = `
      <div class="batch-header">
        <h4>Batch Progress</h4>
        <span id="batchCount">0/${totalBatches}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" id="batchProgressFill"></div>
      </div>
      <div class="batch-details" id="batchDetails">
        Total: ${totalTags} tags in ${totalBatches} batches
      </div>
    `;
    batchProgress.style.display = "block";
  }

  function updateBatchProgress(data) {
    const progressFill = document.getElementById("batchProgressFill");
    const batchCount = document.getElementById("batchCount");
    const batchDetails = document.getElementById("batchDetails");

    if (progressFill && batchCount && batchDetails) {
      const percentage = (data.completed / data.total) * 100;
      progressFill.style.width = `${percentage}%`;
      batchCount.textContent = `${data.completed}/${data.total}`;
      batchDetails.textContent = `Batch ${data.currentBatch}: ${data.tagsInCurrentBatch} tags | Completed: ${data.completed}/${data.total} batches`;
    }
  }

  function hideBatchProgress() {
    batchProgress.style.display = "none";
  }

  // Submission dialog functions
  function showSubmissionDialog(data) {
    submissionInfo.innerHTML = `
      <p><strong>Batch ${data.batchNumber} of ${data.totalBatches} completed!</strong></p>
      <p>✅ Processed ${data.completedTags} of ${data.totalTags} total tags</p>
      <p>🏠 Village: ${villageInput.value}</p>
      <p>📝 Next batch: ${data.nextBatchSize} tags waiting</p>
      <div class="important-note">
        <strong>Important:</strong> You must manually submit the current 25 tags on the website before continuing.
      </div>
    `;
    submissionDialog.classList.remove("hidden");

    // Update status to show manual submission required
    updateStatus(
      `⏳ Batch ${data.batchNumber} completed for village '${villageInput.value}'. Waiting for manual submission...`,
      "warning"
    );
  }

  function hideSubmissionDialog() {
    submissionDialog.classList.add("hidden");
  }

  // Submission dialog button handlers
  submissionCompleteBtn.addEventListener("click", async function () {
    hideSubmissionDialog();
    await window.electronAPI.manualSubmissionComplete();
  });

  cancelBatchBtn.addEventListener("click", async function () {
    hideSubmissionDialog();
    await window.electronAPI.stopAutohotkeyScript();
    updateStatus("Processing stopped by user.", "warning");
  });

  // Initialize
  stopBtn.disabled = true;
  updateStatus(
    'Ready. Enter Village name and Tag IDs, then click "Run Script".',
    "info"
  );

  // Check AutoHotkey on startup
  window.electronAPI
    .checkAutoHotkey()
    .then((result) => {
      if (result.success) {
        updateStatus(`✅ AutoHotkey detected: ${result.path}`, "success");
        // Load existing scripts after AutoHotkey check
        setTimeout(() => loadExistingScripts(), 500);
      } else {
        updateStatus(`❌ ${result.error}`, "error");
        runBtn.disabled = true;
        checkScriptButton.disabled = true;
        generateNewScriptBtn.disabled = true;
      }
    })
    .catch((error) => {
      updateStatus("Error checking AutoHotkey installation", "error");
      runBtn.disabled = true;
      checkScriptButton.disabled = true;
      generateNewScriptBtn.disabled = true;
    });
});
