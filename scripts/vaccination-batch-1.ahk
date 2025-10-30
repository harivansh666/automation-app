; AutoHotkey v2 Script for Vaccination Form Automation
; Batch 1 of 2 - 25 tags
; Village: mandi
; Updated with Campaign selection and Village selection

; Array of Tag IDs from user input
TagIDs := [
"102294708797",
 "102294708798",
 "102294708799",
 "102294708800",
 "102294708801",
 "102294708802",
 "102294708803",
 "102294708804",
 "102294708805",
 "102294708806",
 "102294708807",
 "102294708808",
 "102294708809",
 "102294708810",
 "102294708811",
 "102294708812",
 "102294708813",
 "102294708814",
 "102294708815",
 "102294708816",
 "102294708817",
 "102294708818",
 "102294708819",
 "102294708820",
 "102294708821"
]

; Village name from user input
VillageName := "mandi"

; Main automation function
RunAutomation() {
; Show message that script is starting
result := MsgBox("Batch 1 of 2\n\nProcessing 25 tags\nVillage: " VillageName "\n\nScript starting in 3 seconds...\n\nPress OK to continue or Cancel to stop.", "Batch 1 Starting", "OKCancel T3")

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

     if (tagID = "102294708798") {
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
        ToolTip("Batch 1/2\nVillage: " VillageName "\nTag " index "/" TagIDs.Length "\n" tagID)
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
