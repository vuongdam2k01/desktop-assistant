<#
.SYNOPSIS
    Automated Closed-Loop Test for SPIKE SP-0:
    1. Read 200 known characters from evidence/q3-sendkeys-200chars.txt.
    2. Launch Notepad with output file evidence/q3-notepad-output.txt.
    3. Inject 200 characters via user32.dll SendInput (sendkeys.ps1).
    4. Capture screenshot of Notepad via System.Drawing (screenshot.ps1).
    5. Save Notepad content via Ctrl+S.
    6. Read back output file and verify exact character match (200/200).
#>
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeRoot "evidence"

$knownCharsFile = Join-Path $evidenceDir "q3-sendkeys-200chars.txt"
$notepadOutputFile = Join-Path $evidenceDir "q3-notepad-output.txt"
$screenshotFile = Join-Path $evidenceDir "q2-notepad-screenshot.png"
$logFile = Join-Path $evidenceDir "closed-loop-run.log"

$logLines = [System.Collections.Generic.List[string]]::new()
function Log($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $entry = "[$timestamp] $msg"
    Write-Output $entry
    $logLines.Add($entry)
}

Log "=== STARTING SP-0 CLOSED-LOOP AUTOMATED TEST ==="

if (-not (Test-Path $knownCharsFile)) {
    throw "Known characters file not found: $knownCharsFile"
}

$expectedText = [System.IO.File]::ReadAllText($knownCharsFile, [System.Text.Encoding]::UTF8)
Log "Step 1: Loaded known test string: $($expectedText.Length) characters"
Log "String preview: $expectedText"

if ($expectedText.Length -ne 200) {
    throw "Expected exactly 200 characters, got $($expectedText.Length)"
}

# Ensure output file is reset and ready
[System.IO.File]::WriteAllText($notepadOutputFile, "", [System.Text.Encoding]::UTF8)
Log "Step 2: Reset output file: $notepadOutputFile"

# Terminate any existing Notepad
Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Launch Notepad with the output file
Log "Step 3: Launching Notepad via launch.ps1..."
$launchScript = Join-Path $scriptDir "launch.ps1"
$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$notepadOutputFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Log "Notepad launched successfully: PID=$($procInfo.ProcessId), hWnd=$($procInfo.MainWindowHandle), Title='$($procInfo.WindowTitle)'"

Start-Sleep -Seconds 1

# Inject the 200 characters via sendkeys.ps1
Log "Step 4: Injecting 200 characters via sendkeys.ps1 (SendInput with Unicode)..."
$sendKeysScript = Join-Path $scriptDir "sendkeys.ps1"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
& $sendKeysScript -TargetWindow $procInfo.MainWindowHandle -Text $expectedText -DelayBetweenKeysMs 10
$sw.Stop()
Log "Injection completed in $($sw.ElapsedMilliseconds) ms"

Start-Sleep -Milliseconds 800

# Capture screenshot
Log "Step 5: Capturing screenshot via screenshot.ps1..."
$screenshotScript = Join-Path $scriptDir "screenshot.ps1"
$shotInfo = & $screenshotScript -OutputPath $screenshotFile -WindowHandle $procInfo.MainWindowHandle
Log "Screenshot captured: $($shotInfo.Path) ($($shotInfo.Width)x$($shotInfo.Height), $($shotInfo.SizeBytes) bytes)"

Start-Sleep -Milliseconds 500

# Save Notepad buffer to disk via Ctrl+S
Log "Step 6: Saving document via Ctrl+S shortcut..."
& $sendKeysScript -TargetWindow $procInfo.MainWindowHandle -Key "Ctrl+S"
Start-Sleep -Seconds 1

# Gracefully terminate Notepad
Log "Step 7: Closing Notepad..."
Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

# Read back file content and verify
Log "Step 8: Reading back saved file and verifying 200/200 characters..."
$actualRaw = [System.IO.File]::ReadAllText($notepadOutputFile, [System.Text.Encoding]::UTF8)
# Strip leading newline if present from Notepad tab template
$actualText = $actualRaw.TrimStart("`r", "`n")

Log "Expected length: $($expectedText.Length)"
Log "Actual length:   $($actualText.Length)"
Log "Length match:    $($expectedText.Length -eq $actualText.Length)"

$isExactMatch = ($expectedText -ceq $actualText)
Log "Exact content match: $isExactMatch"

if ($isExactMatch -and $actualText.Length -eq 200) {
    Log ">>> VERIFICATION RESULT: PASS (200/200 characters matched perfectly) <<<"
} else {
    Log ">>> VERIFICATION RESULT: FAIL <<<"
    Log "Expected: $expectedText"
    Log "Actual:   $actualText"
    throw "Verification failed: 200 characters did not match."
}

[System.IO.File]::WriteAllLines($logFile, $logLines, [System.Text.Encoding]::UTF8)
Log "Log saved to: $logFile"
