<#
.SYNOPSIS
    Verifies mouse coordinate movement and clicking via SendInput.
#>
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$logFile = Join-Path $evidenceDir "q4-mouse-test.log"

$logLines = [System.Collections.Generic.List[string]]::new()
function Log($msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $entry = "[$timestamp] $msg"
    Write-Output $entry
    $logLines.Add($entry)
}

Log "=== STARTING Q4 MOUSE COORDINATE & CLICK TEST ==="

$sendKeysScript = Join-Path $scriptDir "sendkeys.ps1"
. $sendKeysScript -MouseMove @{ X = 0; Y = 0 } # Initialize type if needed

# Initial position
$ptInitial = [NativeInputSimulator]::GetCursorPosition()
Log "Initial cursor position: X=$($ptInitial.X), Y=$($ptInitial.Y)"

# Test 1: Move to (450, 320)
$targetX1 = 450
$targetY1 = 320
Log "Moving cursor to target coordinates ($targetX1, $targetY1)..."
& $sendKeysScript -MouseMove @{ X = $targetX1; Y = $targetY1 }
Start-Sleep -Milliseconds 200

$ptAfter1 = [NativeInputSimulator]::GetCursorPosition()
Log "Observed cursor position: X=$($ptAfter1.X), Y=$($ptAfter1.Y)"
$move1Success = ($ptAfter1.X -eq $targetX1 -and $ptAfter1.Y -eq $targetY1)
Log "Move 1 Success: $move1Success"

# Test 2: Move to (680, 510) and Left Click
$targetX2 = 680
$targetY2 = 510
Log "Moving cursor to target coordinates ($targetX2, $targetY2) and executing Left Click..."
& $sendKeysScript -MouseMove @{ X = $targetX2; Y = $targetY2 } -MouseClick 'Left'
Start-Sleep -Milliseconds 200

$ptAfter2 = [NativeInputSimulator]::GetCursorPosition()
Log "Observed cursor position: X=$($ptAfter2.X), Y=$($ptAfter2.Y)"
$move2Success = ($ptAfter2.X -eq $targetX2 -and $ptAfter2.Y -eq $targetY2)
Log "Move 2 Success: $move2Success"

# Test 3: Double click test
$targetX3 = 500
$targetY3 = 400
Log "Moving cursor to ($targetX3, $targetY3) and executing Double Click..."
& $sendKeysScript -MouseMove @{ X = $targetX3; Y = $targetY3 } -MouseClick 'Double'
Start-Sleep -Milliseconds 200

$ptAfter3 = [NativeInputSimulator]::GetCursorPosition()
$move3Success = ($ptAfter3.X -eq $targetX3 -and $ptAfter3.Y -eq $targetY3)
Log "Observed cursor position: X=$($ptAfter3.X), Y=$($ptAfter3.Y)"
Log "Move 3 Success: $move3Success"

$overallPass = $move1Success -and $move2Success -and $move3Success
Log "Q4 Verification Overall Result: $(if ($overallPass) { 'PASS' } else { 'FAIL' })"

[System.IO.File]::WriteAllLines($logFile, $logLines, [System.Text.Encoding]::UTF8)
Log "Log written to: $logFile"
