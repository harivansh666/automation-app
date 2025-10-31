; AutoHotkey v2 Script for Vaccination Form Automation
; Batch 1 of 1 - 6 tags
; MODIFIED SCRIPT - This script will be used for all future runs
; Village: banga
; Updated with Campaign selection and Village selection

; Single instance - prevent multiple runs
#SingleInstance Force

; Global flag to track if automation is running
IsRunning := false

; Array of Tag IDs from user input
TagIDs := [
"102294708841",
 "102294708842",
 "102294708843",
 "102294708844",
 "102294708845",
 "102294708846"
]

; Village name from user input
VillageName := "banga"

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
    result := MsgBox("Batch 1 of 2\\n\\nProcessing 25 tags\\nVillage: " VillageName "\\n\\nScript starting in 3 seconds...\\n\\nPress OK to continue or Cancel to stop.", "Batch 1 Starting", "OKCancel T3")

    if (result = "Cancel") {
        MsgBox("Automation cancelled by user.", "Cancelled", "T2")
        IsRunning := false
        ExitApp
    }

    Sleep(2000)

    ; Step 1: Click on Campaign radio button (instead of "Without Campaign")
    Click(218, 239)
    Sleep(1000)

    ; Step 3: Click on "FMD ROUND 6 JAL" and select it
    Click(580, 307)
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

     if (tagID = "102294708798") {
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
        ToolTip("Batch 1/2\\nVillage: " VillageName "\\nTag " index "/" TagIDs.Length "\\n" tagID)
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
