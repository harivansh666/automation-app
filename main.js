const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const fs = require("fs");

let mainWindow;

// Add this function to handle paths correctly in both dev and production
function getAppPath() {
  if (app.isPackaged) {
    // In production, use resources path
    return path.dirname(app.getPath("exe"));
  } else {
    // In development, use current directory
    return __dirname;
  }
}

function getScriptsPath() {
  const appPath = getAppPath();
  if (app.isPackaged) {
    return path.join(appPath, "resources", "scripts");
  } else {
    return path.join(__dirname, "scripts");
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, "preload.js"),
    },
  });

  // Load the correct HTML file based on environment
  if (app.isPackaged) {
    mainWindow.loadFile(
      path.join(getAppPath(), "resources", "app.asar", "index.html")
    );
  } else {
    mainWindow.loadFile("index.html");
  }

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

// IPC handlers for AutoHotkey operations
ipcMain.handle("run-autohotkey-script", async (event, tagIDs) => {
  return new Promise(async (resolve, reject) => {
    try {
      // Split tags into batches of 25
      const batches = splitTagsIntoBatches(tagIDs, 25);
      console.log(`Split ${tagIDs.length} tags into ${batches.length} batches`);

      // Find AutoHotkey executable
      const ahkExecutable = await findAutoHotkey();

      let completedBatches = 0;
      let totalBatches = batches.length;

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const currentBatch = batches[batchIndex];
        const isLastBatch = batchIndex === batches.length - 1;

        console.log(
          `Processing batch ${batchIndex + 1}/${batches.length} with ${
            currentBatch.length
          } tags`
        );

        // Create the AHK script for current batch
        const ahkScript = generateAHKScript(
          currentBatch,
          batchIndex,
          batches.length,
          isLastBatch
        );

        // Use the corrected scripts path
        const scriptsDir = getScriptsPath();
        const scriptPath = path.join(
          scriptsDir,
          `vaccination-batch-${batchIndex + 1}.ahk`
        );

        // Ensure scripts directory exists
        if (!fs.existsSync(scriptsDir)) {
          fs.mkdirSync(scriptsDir, { recursive: true });
        }

        // Write the AHK script file
        fs.writeFileSync(scriptPath, ahkScript, "utf8");
        console.log(
          `AHK script created for batch ${batchIndex + 1}:`,
          scriptPath
        );

        // Verify file was created
        if (!fs.existsSync(scriptPath)) {
          throw new Error(`Script file was not created: ${scriptPath}`);
        }

        // Run the AHK script and wait for it to complete
        await runAHKScript(ahkExecutable, scriptPath, batchIndex + 1);

        completedBatches++;

        // Send progress update to renderer
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("batch-progress", {
            completed: completedBatches,
            total: totalBatches,
            currentBatch: batchIndex + 1,
            tagsInCurrentBatch: currentBatch.length,
          });
        }

        // If this is not the last batch, wait for user to manually submit and continue
        if (!isLastBatch) {
          console.log(
            `Batch ${
              batchIndex + 1
            } completed. Waiting for user to manually submit...`
          );

          // Send message to renderer to show manual submission dialog
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.send("manual-submission-required", {
              batchNumber: batchIndex + 1,
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
      });
    } catch (error) {
      console.error("Error in run-autohotkey-script:", error);
      reject(error);
    }
  });
});

// Function to run AHK script and wait for completion
function runAHKScript(ahkExecutable, scriptPath, batchNumber) {
  return new Promise((resolve, reject) => {
    console.log(`Starting AHK script for batch ${batchNumber}`);
    console.log(`Script path: ${scriptPath}`);
    console.log(`File exists: ${fs.existsSync(scriptPath)}`);

    // Verify the script file exists before running
    if (!fs.existsSync(scriptPath)) {
      reject(new Error(`Script file not found: ${scriptPath}`));
      return;
    }

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

// NEW AHK script generator based on your working script
function generateAHKScript(tagIDs, batchIndex, totalBatches, isLastBatch) {
  return `; AutoHotkey v2 Script for Vaccination Form Automation
; Batch ${batchIndex + 1} of ${totalBatches} - ${tagIDs.length} tags
; Updated with Campaign selection and Village selection

; Array of Tag IDs from user input
TagIDs := [
${tagIDs.map((id) => `"${id}"`).join(",\n ")}
]

; Main automation function
RunAutomation() {
; Show message that script is starting
result := MsgBox("Batch ${
    batchIndex + 1
  } of ${totalBatches}\\\\n\\\\nProcessing ${
    tagIDs.length
  } tags\\\\n\\\\nScript starting in 3 seconds...\\\\n\\\\nPress OK to continue or Cancel to stop.", "Batch ${
    batchIndex + 1
  } Starting", "OKCancel T3")

    if (result = "Cancel") {
        MsgBox("Automation cancelled by user.", "Cancelled", "T2")
        ExitApp
    }

    Sleep(3000)

    ; Step 1: Click on Campaign radio button (instead of "Without Campaign")
    Click(245, 288)
    Sleep(1000)

    ; Step 3: Click on "FMD ROUND 6 JAL" and select it
    Click(578, 334)
    Sleep(500)
    Send("{Tab 1}")

    ; Step 4: Click on "Select Village" and type "tehang"
    Sleep(500)
    Send("tehang")
    Sleep(500)
    Send("{Enter}")
    Sleep(2000)

    Send("{Tab 3}")
    Sleep(500)

    ; Step 5: Process all Tag IDs one by one
    for index, tagID in TagIDs {
        ; Double-click at specified coordinates to focus on tag field
        Click(1200, 542)
        Sleep(500)

     if (tagID = "${tagIDs[1]}") {
        Click(1238, 775)
        Sleep(300)
        Send("{Down 2}")
        Send("{Enter}")
        Sleep(300)
        Click(1200, 542)
        Sleep(500)
    }

        ; Clear the field
        Send("^a")
        Sleep(200)
        Send("{Del}")
        Sleep(300)

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
        ToolTip("Batch ${
          batchIndex + 1
        }/${totalBatches}\\\\nTag " index "/" TagIDs.Length "\\\\n" tagID)
        Sleep(500)
        ToolTip()
    }

    ; After finishing all tags - Press Tab 3 times then Space
    Send("{Tab 2}")
    Sleep(800)
    Send("{Space}")
    Sleep(400)

    ; Repeat Tab + Space for the same number of tags in the array
    loop TagIDs.Length - 2 {
        Send("{Tab}")
        Sleep(200)
        Send("{Space}")
        Sleep(200)

        ; Show progress for the Tab+Space sequence
        ToolTip("Tab+Space sequence: " A_Index "/" (TagIDs.Length - 2))
        Sleep(100)
    }
    Send("{Tab 2}")
    Send("{Enter}")

    ; Auto-exit after completion
    ExitApp

}

; AUTO-START: Run automation immediately when script loads
RunAutomation()

; Hotkey alternatives
F1::
{
RunAutomation()
return
}

; Emergency stop hotkey
F2::
{
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
