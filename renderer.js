document.addEventListener("DOMContentLoaded", function () {
  const tagIdsTextarea = document.getElementById("tagIds");
  const runBtn = document.getElementById("runBtn");
  const stopBtn = document.getElementById("stopBtn");
  const clearBtn = document.getElementById("clearBtn");
  const loadSampleBtn = document.getElementById("loadSampleBtn");
  const statusDiv = document.getElementById("status");
  const progressDiv = document.getElementById("progress");

  // Batch progress elements
  const batchProgress = document.createElement("div");
  batchProgress.className = "batch-progress";
  document.querySelector(".status-section").appendChild(batchProgress);

  // Manual Submission Dialog
  const submissionDialog = document.createElement("div");
  submissionDialog.className = "submission-dialog hidden";
  submissionDialog.innerHTML = `
        <div class="dialog-content">
            <div class="dialog-icon">⚠️</div>
            <h3>Manual Submission Required</h3>
            <div class="submission-info" id="submissionInfo"></div>
            <div class="instructions">
                <p><strong>Please follow these steps:</strong></p>
                <ol>
                    <li>Go to the vaccination form website</li>
                    <li>Review the 25 tags that were just processed</li>
                    <li>Click the <strong>SUBMIT</strong> or <strong>SAVE</strong> button</li>
                    <li>Wait for confirmation that submission was successful</li>
                    <li>Return to this application</li>
                </ol>
            </div>
            <p class="ready-text">Ready to process the next batch?</p>
            <div class="dialog-buttons">
                <button id="submissionCompleteBtn" class="btn btn-primary">Yes, I Submitted - Continue Next Batch</button>
                <button id="cancelBatchBtn" class="btn btn-danger">Stop Processing</button>
            </div>
        </div>
    `;
  document.body.appendChild(submissionDialog);

  // Load sample data
  loadSampleBtn.addEventListener("click", function () {
    const sampleData = Array.from(
      { length: 50 },
      (_, i) => `10229470${8797 + i}`
    ).join("\n");

    tagIdsTextarea.value = sampleData;
    updateStatus(
      `Loaded 50 sample tags. Will be processed in 2 batches of 25.`,
      "info"
    );
  });

  // Clear textarea
  clearBtn.addEventListener("click", function () {
    tagIdsTextarea.value = "";
    updateStatus("Text area cleared.", "info");
    hideBatchProgress();
  });

  // Run script
  runBtn.addEventListener("click", async function () {
    const tagIdsText = tagIdsTextarea.value.trim();

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
      `Starting automation for ${tagIDs.length} tags (${totalBatches} batches)...`,
      "info"
    );
    runBtn.disabled = true;
    stopBtn.disabled = false;
    clearBtn.disabled = true;

    // Show batch progress
    showBatchProgress(totalBatches, tagIDs.length);

    try {
      const result = await window.electronAPI.runAutohotkeyScript(tagIDs);
      updateStatus(
        `✅ Script completed! Processed ${result.totalTags} tags in ${result.totalBatches} batches.`,
        "success"
      );
    } catch (error) {
      updateStatus(`❌ Error: ${error.message}`, "error");
      console.error("Script execution error:", error);
    } finally {
      runBtn.disabled = false;
      stopBtn.disabled = true;
      clearBtn.disabled = false;
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

  // Submission dialog events
  document.addEventListener("click", function (e) {
    if (e.target.id === "submissionCompleteBtn") {
      window.electronAPI.manualSubmissionComplete();
      hideSubmissionDialog();
      updateStatus("Continuing with next batch...", "info");
    } else if (e.target.id === "cancelBatchBtn") {
      stopBtn.click();
      hideSubmissionDialog();
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
    const submissionInfo = document.getElementById("submissionInfo");
    submissionInfo.innerHTML = `
            <p><strong>Batch ${data.batchNumber} of ${data.totalBatches} completed!</strong></p>
            <p>✅ Processed ${data.completedTags} of ${data.totalTags} total tags</p>
            <p>📝 Next batch: ${data.nextBatchSize} tags waiting</p>
            <div class="important-note">
                <strong>Important:</strong> You must manually submit the current 25 tags on the website before continuing.
            </div>
        `;
    submissionDialog.classList.remove("hidden");

    // Update status to show manual submission required
    updateStatus(
      `⏳ Batch ${data.batchNumber} completed. Waiting for manual submission...`,
      "warning"
    );
  }

  function hideSubmissionDialog() {
    submissionDialog.classList.add("hidden");
  }

  // Initialize
  stopBtn.disabled = true;
  updateStatus('Ready. Enter Tag IDs and click "Run Script".', "info");

  // Check AutoHotkey on startup
  window.electronAPI
    .checkAutoHotkey()
    .then((result) => {
      if (result.success) {
        updateStatus(`✅ AutoHotkey detected: ${result.path}`, "success");
      } else {
        updateStatus(`❌ ${result.error}`, "error");
        runBtn.disabled = true;
      }
    })
    .catch((error) => {
      updateStatus("Error checking AutoHotkey installation", "error");
      runBtn.disabled = true;
    });
});
