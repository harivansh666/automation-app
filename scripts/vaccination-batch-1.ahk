; AutoHotkey v2 Script for Vaccination Form Automation
; Batch 1 of 2 - 25 tags
; Updated with Campaign selection and Village selection

; Array of Tag IDs from user input
TagIDs := [
    "102294697891",
    "102294697971",
    "102294697526",
    "102294698393",
    "102294697685",
    "102294697641",
    "102294697878",
    "102294697721",
    "102294698371",
    "102294697481",
    "102294697982",
    "102294697880",
    "130011303644",
    "130011303622",
    "130011303677",
    "130011303688",
    "130011303633",
    "130011303666",
    "130011303030",
    "130011303655",
    "102294699272",
    "102294699294",
    "102294709040",
    "102294698883",
    "102294699226"
]

; Main automation function
RunAutomation() {
    ; Show message that script is starting
    result := MsgBox(
        "Batch 1 of 2\n\nProcessing 25 tags\n\nScript starting in 3 seconds...\n\nPress OK to continue or Cancel to stop.",
        "Batch 1 Starting", "OKCancel T3")

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

        if (tagID = "102294697971") {
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
        ToolTip("Batch 1/2\nTag " index "/" TagIDs.Length "\n" tagID)
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
