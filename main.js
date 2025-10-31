const { app, BrowserWindow, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 900,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  mainWindow.loadFile("index.html");

  if (process.argv.includes("--dev")) {
    mainWindow.webContents.openDevTools();
  }
}

app.whenReady().then(createWindow);

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Get correct scripts directory path for both dev and production
function getScriptsDirectory() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, "scripts");
  } else {
    return path.join(__dirname, "scripts");
  }
}

// Function to find AutoHotkey executable
async function findAutoHotkey() {
  return new Promise((resolve, reject) => {
    const possiblePaths = [
      "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe",
      "C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey.exe",
      "C:\\Program Files\\AutoHotkey\\AutoHotkey64.exe",
      "C:\\Program Files\\AutoHotkey\\AutoHotkey.exe",
      "AutoHotkey64.exe",
      "AutoHotkey.exe",
    ];

    for (const ahkPath of possiblePaths) {
      if (ahkPath.includes("\\")) {
        if (fs.existsSync(ahkPath)) {
          console.log("Found AutoHotkey at:", ahkPath);
          resolve(ahkPath);
          return;
        }
      } else {
        try {
          const { execSync } = require("child_process");
          execSync(`where ${ahkPath}`, { stdio: "pipe" });
          console.log("Found AutoHotkey in PATH:", ahkPath);
          resolve(ahkPath);
          return;
        } catch (e) {}
      }
    }
    reject(
      new Error(
        "AutoHotkey not found. Please ensure AutoHotkey v2 is installed and in PATH."
      )
    );
  });
}

// Function to split tags into batches
function splitTagsIntoBatches(tagIDs, batchSize = 25) {
  const batches = [];
  for (let i = 0; i < tagIDs.length; i += batchSize) {
    batches.push(tagIDs.slice(i, i + batchSize));
  }
  return batches;
}

// Store pending resolve functions for manual submission
let manualSubmissionResolvers = [];

// Track modified scripts
const modifiedScripts = new Set();

// Check if modified script exists for a batch
function hasModifiedScript(batchNumber) {
  const scriptsDir = getScriptsDirectory();
  const modifiedScriptPath = path.join(
    scriptsDir,
    `modifiedScript-batch-${batchNumber}.ahk`
  );
  return fs.existsSync(modifiedScriptPath);
}

// Get modified script content
function getModifiedScript(batchNumber) {
  const scriptsDir = getScriptsDirectory();
  const modifiedScriptPath = path.join(
    scriptsDir,
    `modifiedScript-batch-${batchNumber}.ahk`
  );

  if (fs.existsSync(modifiedScriptPath)) {
    return fs.readFileSync(modifiedScriptPath, "utf8");
  }
  return null;
}

// Generate New Script Template
ipcMain.handle(
  "generate-new-script-template",
  async (event, batchNumber = 1) => {
    try {
      const scriptsDir = getScriptsDirectory();

      // Ensure scripts directory exists
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Generate sample data for the template
      const sampleTags = Array.from(
        { length: 25 },
        (_, i) => `10229470${8797 + i}`
      );
      const sampleVillage = "tehang";

      // Generate the default script template
      const defaultScript = generateAHKScript(
        sampleTags,
        batchNumber - 1,
        1,
        true,
        sampleVillage
      );

      const scriptPath = path.join(
        scriptsDir,
        `vaccination-batch-${batchNumber}.ahk`
      );

      // Write the default template
      fs.writeFileSync(scriptPath, defaultScript, "utf8");

      // Remove from modified scripts if it was previously modified
      if (modifiedScripts.has(batchNumber)) {
        modifiedScripts.delete(batchNumber);
      }

      console.log(
        `✅ Generated NEW script template for batch ${batchNumber}:`,
        scriptPath
      );

      return {
        success: true,
        message: "New script template generated successfully",
        scriptPath: scriptPath,
        scriptContent: defaultScript,
        isModified: false,
      };
    } catch (error) {
      console.error("Error generating new script template:", error);
      return { success: false, error: error.message };
    }
  }
);

// Get list of existing scripts with metadata
ipcMain.handle("get-existing-scripts", async (event) => {
  try {
    const scriptsDir = getScriptsDirectory();

    if (!fs.existsSync(scriptsDir)) {
      return { success: true, scripts: [] };
    }

    const files = fs.readdirSync(scriptsDir);
    const scripts = [];

    for (const file of files) {
      if (
        (file.startsWith("vaccination-batch-") ||
          file.startsWith("modifiedScript-batch-")) &&
        file.endsWith(".ahk")
      ) {
        const scriptPath = path.join(scriptsDir, file);
        const stats = fs.statSync(scriptPath);
        const content = fs.readFileSync(scriptPath, "utf8");

        // Extract batch number from filename
        const batchMatch = file.match(
          /(?:vaccination-batch-|modifiedScript-batch-)(\d+)\.ahk/
        );
        const batchNumber = batchMatch ? parseInt(batchMatch[1]) : 0;

        // Extract village name and tag count from script content
        const villageMatch = content.match(/; Village: (.+)/);
        const tagsMatch = content.match(/; Batch \d+ of \d+ - (\d+) tags/);

        // Check if script is modified
        const isModified = file.startsWith("modifiedScript-");

        scripts.push({
          filename: file,
          batchNumber: batchNumber,
          village: villageMatch ? villageMatch[1] : "Unknown",
          tagCount: tagsMatch ? parseInt(tagsMatch[1]) : 0,
          modified: stats.mtime.toLocaleString(),
          size: stats.size,
          isModified: isModified,
        });
      }
    }

    // Sort by batch number
    scripts.sort((a, b) => a.batchNumber - b.batchNumber);

    return { success: true, scripts };
  } catch (error) {
    console.error("Error getting existing scripts:", error);
    return { success: false, error: error.message };
  }
});

// IPC handlers for AutoHotkey operations
ipcMain.handle("run-autohotkey-script", async (event, tagIDs, villageName) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Validate village name
      if (!villageName || villageName.trim() === "") {
        reject(new Error("Village name is required"));
        return;
      }

      // Split tags into batches of 25
      const batches = splitTagsIntoBatches(tagIDs, 25);
      console.log(`Split ${tagIDs.length} tags into ${batches.length} batches`);
      console.log(`Village name: ${villageName}`);

      // Find AutoHotkey executable
      const ahkExecutable = await findAutoHotkey();

      let completedBatches = 0;
      let totalBatches = batches.length;

      // Get correct scripts directory
      const scriptsDir = getScriptsDirectory();

      // Ensure scripts directory exists
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Track which batches use modified scripts
      const usedModifiedScripts = [];

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const currentBatch = batches[batchIndex];
        const isLastBatch = batchIndex === batches.length - 1;
        const batchNumber = batchIndex + 1;

        console.log(
          `Processing batch ${batchNumber}/${batches.length} with ${currentBatch.length} tags for village: ${villageName}`
        );

        // Check if modified script exists for this batch
        const modifiedScriptPath = path.join(
          scriptsDir,
          `modifiedScript-batch-${batchNumber}.ahk`
        );

        const defaultScriptPath = path.join(
          scriptsDir,
          `vaccination-batch-${batchNumber}.ahk`
        );

        let scriptToUse = defaultScriptPath;
        let isUsingModifiedScript = false;

        // ⭐ CRITICAL: Always use modified script if it exists
        if (fs.existsSync(modifiedScriptPath)) {
          scriptToUse = modifiedScriptPath;
          isUsingModifiedScript = true;
          usedModifiedScripts.push(batchNumber);
          console.log(
            `✅ USING MODIFIED SCRIPT for batch ${batchNumber}:`,
            scriptToUse
          );

          // Update the modified script with current village and tags
          await updateModifiedScriptWithCurrentData(
            batchNumber,
            currentBatch,
            batchIndex,
            batches.length,
            isLastBatch,
            villageName
          );
        } else {
          // Generate new default script with current data
          const ahkScript = generateAHKScript(
            currentBatch,
            batchIndex,
            batches.length,
            isLastBatch,
            villageName
          );
          fs.writeFileSync(defaultScriptPath, ahkScript, "utf8");
          scriptToUse = defaultScriptPath;
          console.log(
            `✅ USING DEFAULT script for batch ${batchNumber}:`,
            scriptToUse
          );
        }

        // Send notification to UI about script type
        if (mainWindow && !mainWindow.isDestroyed()) {
          if (isUsingModifiedScript) {
            mainWindow.webContents.send("using-modified-script", {
              batchNumber: batchNumber,
              scriptPath: scriptToUse,
              isModified: true,
            });
          } else {
            mainWindow.webContents.send("using-existing-script", {
              batchNumber: batchNumber,
              scriptPath: scriptToUse,
            });
          }
        }

        // Run the AHK script and wait for it to complete
        await runAHKScript(ahkExecutable, scriptToUse, batchNumber);

        completedBatches++;

        // Send progress update to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("batch-progress", {
            completed: completedBatches,
            total: totalBatches,
            currentBatch: batchNumber,
            tagsInCurrentBatch: currentBatch.length,
          });
        }

        // If this is not the last batch, wait for user to manually submit and continue
        if (!isLastBatch) {
          console.log(
            `Batch ${batchNumber} completed. Waiting for user to manually submit...`
          );

          // Send message to renderer to show manual submission dialog
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("manual-submission-required", {
              batchNumber: batchNumber,
              totalBatches: batches.length,
              completedTags: (batchIndex + 1) * 25,
              totalTags: tagIDs.length,
              nextBatchSize: batches[batchIndex + 1].length,
            });
          }

          // Wait for user to confirm they've manually submitted
          await new Promise((submitResolve) => {
            manualSubmissionResolvers.push(submitResolve);
          });

          console.log(`User confirmed submission. Continuing to next batch...`);
        }
      }

      resolve({
        success: true,
        totalBatches: batches.length,
        totalTags: tagIDs.length,
        villageName: villageName,
        modifiedScripts: usedModifiedScripts,
      });
    } catch (error) {
      console.error("Error in run-autohotkey-script:", error);
      reject(error);
    }
  });
});

// Update modified script with current village and tags
async function updateModifiedScriptWithCurrentData(
  batchNumber,
  currentBatch,
  batchIndex,
  totalBatches,
  isLastBatch,
  villageName
) {
  try {
    const scriptsDir = getScriptsDirectory();
    const modifiedScriptPath = path.join(
      scriptsDir,
      `modifiedScript-batch-${batchNumber}.ahk`
    );

    if (fs.existsSync(modifiedScriptPath)) {
      let scriptContent = fs.readFileSync(modifiedScriptPath, "utf8");

      // Update village name in the script
      scriptContent = scriptContent.replace(
        /; Village: .+/,
        `; Village: ${villageName}`
      );

      // Update batch information
      scriptContent = scriptContent.replace(
        /; Batch \d+ of \d+ - \d+ tags/,
        `; Batch ${batchIndex + 1} of ${totalBatches} - ${
          currentBatch.length
        } tags`
      );

      // Update the TagIDs array with current batch tags
      const tagIDsSection = `TagIDs := [\n${currentBatch
        .map((id) => `"${id}"`)
        .join(",\n ")}\n]`;
      scriptContent = scriptContent.replace(
        /TagIDs := \[[\s\S]*?\]/,
        tagIDsSection
      );

      // Update VillageName variable
      scriptContent = scriptContent.replace(
        /VillageName := ".*?"/,
        `VillageName := "${villageName}"`
      );

      // Write the updated modified script
      fs.writeFileSync(modifiedScriptPath, scriptContent, "utf8");
      console.log(
        `✅ Updated modified script for batch ${batchNumber} with current data`
      );
    }
  } catch (error) {
    console.error("Error updating modified script:", error);
  }
}

// Function to run AHK script and wait for completion
function runAHKScript(ahkExecutable, scriptPath, batchNumber) {
  return new Promise((resolve, reject) => {
    console.log(`Starting AHK script for batch ${batchNumber}`);

    let ahkProcess = spawn(ahkExecutable, [scriptPath]);

    ahkProcess.stdout.on("data", (data) => {
      console.log(`AHK Batch ${batchNumber} stdout: ${data}`);
    });

    ahkProcess.stderr.on("data", (data) => {
      console.error(`AHK Batch ${batchNumber} stderr: ${data}`);
    });

    ahkProcess.on("close", (code) => {
      console.log(`AHK Batch ${batchNumber} process exited with code ${code}`);
      if (code === 0) {
        resolve({ success: true, code });
      } else {
        reject(new Error(`AHK script exited with code ${code}`));
      }
    });

    ahkProcess.on("error", (error) => {
      console.error(`Failed to start AHK Batch ${batchNumber} process:`, error);
      reject(error);
    });

    // Store process reference for potential termination
    mainWindow.ahkProcess = ahkProcess;
  });
}

// Handle user confirmation that manual submission is complete
ipcMain.handle("manual-submission-complete", async (event) => {
  console.log("Manual submission complete signal received");

  // Resolve the waiting promise to continue with next batch
  if (manualSubmissionResolvers.length > 0) {
    const resolver = manualSubmissionResolvers.shift();
    resolver();
  }

  return { success: true };
});

ipcMain.handle("stop-autohotkey-script", async (event) => {
  // Clear any pending resolvers
  manualSubmissionResolvers = [];

  if (mainWindow.ahkProcess) {
    mainWindow.ahkProcess.kill();
    return { success: true };
  }
  return { success: false, message: "No running process found" };
});

ipcMain.handle("check-autohotkey", async (event) => {
  try {
    const ahkPath = await findAutoHotkey();
    return { success: true, path: ahkPath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle getting AutoHotkey script
ipcMain.handle("get-autohotkey-script", async (event, batchNumber = 1) => {
  try {
    const scriptsDir = getScriptsDirectory();

    // First check for modified script
    const modifiedScriptPath = path.join(
      scriptsDir,
      `modifiedScript-batch-${batchNumber}.ahk`
    );

    if (fs.existsSync(modifiedScriptPath)) {
      const scriptContent = fs.readFileSync(modifiedScriptPath, "utf8");
      return {
        success: true,
        scriptContent,
        isModified: true,
        scriptType: "modified",
      };
    }

    // If no modified script, check for default script
    const defaultScriptPath = path.join(
      scriptsDir,
      `vaccination-batch-${batchNumber}.ahk`
    );

    if (!fs.existsSync(defaultScriptPath)) {
      // If script doesn't exist, generate a sample one
      const sampleScript = generateAHKScript(
        Array.from({ length: 25 }, (_, i) => `10229470${8797 + i}`),
        0,
        1,
        true,
        "tehang"
      );
      fs.writeFileSync(defaultScriptPath, sampleScript, "utf8");
    }

    const scriptContent = fs.readFileSync(defaultScriptPath, "utf8");
    return {
      success: true,
      scriptContent,
      isModified: false,
      scriptType: "default",
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle saving modified AutoHotkey script
ipcMain.handle(
  "save-autohotkey-script",
  async (event, batchNumber, scriptContent) => {
    try {
      const scriptsDir = getScriptsDirectory();

      // Ensure scripts directory exists
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Always save as modifiedScript-batch-{number}.ahk
      const modifiedScriptPath = path.join(
        scriptsDir,
        `modifiedScript-batch-${batchNumber}.ahk`
      );

      // Add modification marker if not present
      let finalScriptContent = scriptContent;
      if (!scriptContent.includes("; MODIFIED")) {
        // Add MODIFIED marker at the top
        const lines = scriptContent.split("\n");
        if (lines.length > 2) {
          lines.splice(
            2,
            0,
            "; MODIFIED SCRIPT - This script will be used for all future runs"
          );
          finalScriptContent = lines.join("\n");
        }
      }

      // Write the modified script content to file
      fs.writeFileSync(modifiedScriptPath, finalScriptContent, "utf8");

      // Mark this script as modified
      modifiedScripts.add(batchNumber);

      console.log(
        `✅ Script for batch ${batchNumber} saved as MODIFIED SCRIPT: ${modifiedScriptPath}`
      );
      console.log(
        `📁 Modified script will be used permanently for batch ${batchNumber}`
      );

      return {
        success: true,
        message:
          "Modified script saved successfully and will be used permanently",
        path: modifiedScriptPath,
        isModified: true,
        scriptType: "modified",
      };
    } catch (error) {
      console.error("Error saving script:", error);
      return { success: false, error: error.message };
    }
  }
);

// Delete a specific script
ipcMain.handle("delete-script", async (event, batchNumber) => {
  try {
    const scriptsDir = getScriptsDirectory();

    // Delete both default and modified scripts
    const defaultScriptPath = path.join(
      scriptsDir,
      `vaccination-batch-${batchNumber}.ahk`
    );

    const modifiedScriptPath = path.join(
      scriptsDir,
      `modifiedScript-batch-${batchNumber}.ahk`
    );

    let deletedCount = 0;

    if (fs.existsSync(defaultScriptPath)) {
      fs.unlinkSync(defaultScriptPath);
      deletedCount++;
    }

    if (fs.existsSync(modifiedScriptPath)) {
      fs.unlinkSync(modifiedScriptPath);
      deletedCount++;

      // Remove from modified scripts
      if (modifiedScripts.has(batchNumber)) {
        modifiedScripts.delete(batchNumber);
      }
    }

    console.log(`Deleted ${deletedCount} script(s) for batch ${batchNumber}`);
    return {
      success: true,
      message: "Script(s) deleted successfully",
      deletedCount,
    };
  } catch (error) {
    console.error("Error deleting script:", error);
    return { success: false, error: error.message };
  }
});

// Handle clearing all scripts
ipcMain.handle("clear-all-scripts", async (event) => {
  try {
    const scriptsDir = getScriptsDirectory();

    if (fs.existsSync(scriptsDir)) {
      const files = fs.readdirSync(scriptsDir);
      let deletedCount = 0;

      files.forEach((file) => {
        if (
          (file.startsWith("vaccination-batch-") ||
            file.startsWith("modifiedScript-batch-")) &&
          file.endsWith(".ahk")
        ) {
          fs.unlinkSync(path.join(scriptsDir, file));
          deletedCount++;
        }
      });

      // Clear all modified scripts tracking
      modifiedScripts.clear();

      console.log(`Cleared ${deletedCount} script files`);
      return { success: true, deletedCount };
    }

    return { success: true, deletedCount: 0 };
  } catch (error) {
    console.error("Error clearing scripts:", error);
    return { success: false, error: error.message };
  }
});

// AHK script generator with village name parameter
function generateAHKScript(
  tagIDs,
  batchIndex,
  totalBatches,
  isLastBatch,
  villageName
) {
  // Escape any special characters in village name for AHK
  const escapedVillageName = villageName.replace(/"/g, '""');
  const currentBatch = batchIndex + 1;

  return `; AutoHotkey v2 Script for Vaccination Form Automation
; Batch ${currentBatch} of ${totalBatches} - ${tagIDs.length} tags
; Village: ${escapedVillageName}
; Updated with Campaign selection and Village selection

; Single instance - prevent multiple runs
#SingleInstance Force

; Global flag to track if automation is running
IsRunning := false

; Array of Tag IDs from user input
TagIDs := [
${tagIDs.map((id) => `    "${id}"`).join(",\n")}
]

; Village name from user input
VillageName := "${escapedVillageName}"

; Main automation function
RunAutomation() {
    global IsRunning
    
    ; Prevent multiple runs
    if (IsRunning) {
        MsgBox("Automation is already running! Please wait for current process to complete.", "Already Running", "T2")
        return
    }
    
    IsRunning := true
    
    ; Show message that script is starting
    result := MsgBox("Batch ${currentBatch} of ${totalBatches}\\\\n\\\\nProcessing ${
    tagIDs.length
  } tags\\\\nVillage: " VillageName "\\\\n\\\\nScript starting in 3 seconds...\\\\n\\\\nPress OK to continue or Cancel to stop.", "Batch ${currentBatch} Starting", "OKCancel T3")

    if (result = "Cancel") {
        MsgBox("Automation cancelled by user.", "Cancelled", "T2")
        IsRunning := false
        ExitApp
    }

    Sleep(2000)

    ; Step 1: Click on Campaign radio button (instead of "Without Campaign")
    Click(245, 254)
    Sleep(1000)

    ; Step 3: Click on "FMD ROUND 6 JAL" and select it
    Click(585, 337)
    Sleep(500)
    Send("{Tab 1}")

    ; Step 4: Click on "Select Village" and type the village name
    Sleep(500)
    Send(VillageName)
    Sleep(500)
    Send("{Enter}")
    Sleep(2000)

    Send("{Tab 3}")
    Sleep(500)

    ; Step 5: Process all Tag IDs one by one
    for index, tagID in TagIDs {
        ; Double-click at specified coordinates to focus on tag field
        Click(1294, 547)
        Sleep(500)

     if (tagID = "${tagIDs[1]}") {
        Click(1227, 774)
        Sleep(300)
        Send("{Down 2}")
        Send("{Enter}")
        Sleep(300)
        Click(1294, 547)
        Sleep(500)
    }

        ; Clear the field
        Send("^a")
        Sleep(200)
        
        ; Enter current tag ID
        Send(tagID)
        Sleep(300)

        ; Navigate to search button
        Send("{Tab 1}")
        Sleep(500)

        ; Click search
        Send("{Enter}")
        Sleep(800)

        ; Show progress
        ToolTip("Batch ${currentBatch}/${totalBatches}\\\\nVillage: " VillageName "\\\\nTag " index "/" TagIDs.Length "\\\\n" tagID)
        Sleep(500)
        ToolTip()
    }

    ; After finishing all tags - Press Tab 3 times then Space
    Send("{Tab 2}")
    Sleep(300)
    Send("{Space}")
    Sleep(200)

    ; Repeat Tab + Space for the same number of tags in the array
    loop TagIDs.Length - 2 {
        Send("{Tab}")
        Sleep(100)
        Send("{Space}")
        Sleep(100)

        ; Show progress for the Tab+Space sequence
        ToolTip("Tab+Space sequence: " A_Index "/" (TagIDs.Length - 2))
        Sleep(100)
    }
    Send("{Tab 2}")
    Send("{Enter}")

    ; Reset running flag
    IsRunning := false
    
    ; Auto-exit after completion
    ExitApp
}

; AUTO-START: Run automation immediately when script loads
RunAutomation()

; Hotkey alternatives - WITH SAFETY CHECK
F1::
{
    if (IsRunning) {
        MsgBox("Automation is already running! Please wait.", "Already Running", "T2")
        return
    }
    RunAutomation()
    return
}

; Emergency stop hotkey
F2::
{
    IsRunning := false
    MsgBox("Stopping automation...", "Emergency Stop", "T1")
    ExitApp
    return
}

; Emergency pause hotkey
F3::
{
    Pause -1
    return
}

; Press F6 to process a single specific tag ID (for testing)
F6::
{
    ; Get tag ID from user input
    tagInput := InputBox("Enter Tag ID:", "Single Tag Processing")
    if (tagInput.Result = "OK" && tagInput.Value != "") {
        ; Double-click at specified coordinates to focus
        Click(1649, 632, 2)
        Sleep(500)

        ; Clear the field
        Send("^a")
        Sleep(200)
        Send("{Del}")
        Sleep(300)

        ; Enter tag ID
        Send(tagInput.Value)
        Sleep(500)

        ; Navigate to search button
        Send("{Tab 1}")
        Sleep(500)

        ; Click search
        Send("{Enter}")
        Sleep(2000)

        ; Double-click again at specified coordinates
        Click(1649, 632, 2)
        Sleep(500)

        MsgBox("Tag " tagInput.Value " processed!", "Complete")
    }
    return
}
`;
}
