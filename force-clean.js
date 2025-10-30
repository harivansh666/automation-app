const { execSync, spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

console.log("🚀 Starting FORCE cleanup...");

// Function to kill processes with retry
function killProcesses() {
  const processes = [
    "electron.exe",
    "AutoHotkey64.exe",
    "AutoHotkey.exe",
    "node.exe",
  ];

  processes.forEach((processName) => {
    console.log(`🛑 Killing ${processName}...`);
    try {
      // Use wmic for more reliable process termination
      execSync(`wmic process where "name='${processName}'" delete`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (e) {
      // Process might not be running, which is fine
    }

    // Also try taskkill
    try {
      execSync(`taskkill /f /im ${processName} /t`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (e) {
      // Ignore errors
    }
  });
}

// Function to delete directory with retry
function forceDeleteDir(dirPath) {
  if (!fs.existsSync(dirPath)) return;

  console.log(`🗑️  Deleting ${dirPath}...`);

  // Try multiple methods
  try {
    fs.rmSync(dirPath, { recursive: true, force: true, maxRetries: 5 });
    console.log(`✅ Successfully deleted ${dirPath}`);
  } catch (error) {
    console.log(`❌ Failed to delete ${dirPath}: ${error.message}`);
    console.log("🔄 Trying alternative method...");

    // Try using command line
    try {
      execSync(`rmdir /s /q "${dirPath}"`, {
        stdio: "ignore",
        windowsHide: true,
      });
    } catch (cmdError) {
      console.log(`⚠️  Could not delete ${dirPath}, will try again later`);
    }
  }
}

// Main cleanup process
function main() {
  console.log("🔪 Force killing processes...");
  killProcesses();

  // Wait a bit
  console.log("⏳ Waiting for processes to terminate...");
  setTimeout(() => {
    // Kill again to be sure
    killProcesses();

    setTimeout(() => {
      console.log("🧹 Cleaning directories...");

      const dirsToClean = ["dist", "build", "node_modules/.cache"];

      dirsToClean.forEach((dir) => {
        forceDeleteDir(dir);
      });

      // Special handling for problematic files
      const problematicFiles = ["dist/win-unpacked/resources/app.asar"];

      problematicFiles.forEach((file) => {
        if (fs.existsSync(file)) {
          try {
            fs.unlinkSync(file);
            console.log(`✅ Deleted ${file}`);
          } catch (e) {
            console.log(`❌ Could not delete ${file}`);
          }
        }
      });

      console.log("🎉 Force cleanup complete!");
      console.log("💡 Now run: npm install && npm run build-win");
    }, 2000);
  }, 2000);
}

main();
