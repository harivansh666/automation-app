const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const { spawn, exec } = require("child_process");
const fs = require("fs");

let mainWindow;

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

// **FIX: Get correct scripts directory path for both dev and production**
function getScriptsDirectory() {
  if (app.isPackaged) {
    // Production: scripts are in extraResources
    return path.join(process.resourcesPath, "scripts");
  } else {
    // Development: scripts are in project root
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

      // **FIX: Get correct scripts directory**
      const scriptsDir = getScriptsDirectory();

      // **FIX: Ensure scripts directory exists**
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
      }

      // Process each batch
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const currentBatch = batches[batchIndex];
        const isLastBatch = batchIndex === batches.length - 1;

        console.log(
          `Processing batch ${batchIndex + 1}/${batches.length} with ${
            currentBatch.length
          } tags for village: ${villageName}`
        );

        // Create the AHK script for current batch with village name
        const ahkScript = generateAHKScript(
          currentBatch,
          batchIndex,
          batches.length,
          isLastBatch,
          villageName
        );

        // **FIX: Use the correct scripts directory**
        const scriptPath = path.join(
          scriptsDir,
          `vaccination-batch-${batchIndex + 1}.ahk`
        );

        // Write the AHK script file
        fs.writeFileSync(scriptPath, ahkScript, "utf8");
        console.log(
          `AHK script created for batch ${batchIndex + 1}:`,
          scriptPath
        );

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
        villageName: villageName,
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

// NEW AHK script generator with village name parameter
function generateAHKScript(
  tagIDs,
  batchIndex,
  totalBatches,
  isLastBatch,
  villageName
) {
  // Escape any special characters in village name for AHK
  const escapedVillageName = villageName.replace(/"/g, '""');

  return `; AutoHotkey v2 Script for Vaccination Form Automation
; Batch ${batchIndex + 1} of ${totalBatches} - ${tagIDs.length} tags
; Village: ${escapedVillageName}
; Updated with Campaign selection and Village selection

; Array of Tag IDs from user input
TagIDs := [
${tagIDs.map((id) => `"${id}"`).join(",\n ")}
]

; Village name from user input
VillageName := "${escapedVillageName}"

; Main automation function
RunAutomation() {
; Show message that script is starting
result := MsgBox("Batch ${batchIndex + 1} of ${totalBatches}\\n\\nProcessing ${
    tagIDs.length
  } tags\\nVillage: " VillageName "\\n\\nScript starting in 3 seconds...\\n\\nPress OK to continue or Cancel to stop.", "Batch ${
    batchIndex + 1
  } Starting", "OKCancel T3")

    if (result = "Cancel") {
        MsgBox("Automation cancelled by user.", "Cancelled", "T2")
        ExitApp
    }

    Sleep(3000)

    ; Step 1: Click on Campaign radio button (instead of "Without Campaign")
    Click(273, 274)
    Sleep(1000)

    ; Step 3: Click on "FMD ROUND 6 JAL" and select it
    Click(690, 363)
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
        Click(1655, 599)
        Sleep(500)

     if (tagID = "${tagIDs[1]}") {
        Click(1497, 851)
        Sleep(300)
        Send("{Down 2}")
        Send("{Enter}")
        Sleep(300)
        Click(1655, 599)
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
        ToolTip("Batch ${
          batchIndex + 1
        }/${totalBatches}\\nVillage: " VillageName "\\nTag " index "/" TagIDs.Length "\\n" tagID)
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
