<#
.SYNOPSIS
    SP-7 / Q2 Click-Through Test:
    Verifies that mouse clicks pass through transparent regions of the pet window
    to the underlying window/desktop, while clicks on the pet avatar register on the pet.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[System.Net.WebRequest]::DefaultWebProxy = $null

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $srcDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$screenshotScript = Join-Path $srcDir "screenshot.ps1"
$startPetScript = Join-Path $srcDir "start-pet.ps1"

Write-Output "=========================================================="
Write-Output "SP-7 / Q2 CLICK-THROUGH TEST"
Write-Output "Transparent area -> Click-through to underlying window"
Write-Output "Pet avatar area  -> Clicks registered on pet"
Write-Output "=========================================================="

# 1. Start Electron Pet App
$petProc = & $startPetScript
Start-Sleep -Seconds 1

# 2. Position Pet at (400, 200)
$petX = 400
$petY = 200
Invoke-RestMethod -Uri "http://127.0.0.1:18923/move-pet?x=$petX&y=$petY" -Method Post | Out-Null
Invoke-RestMethod -Uri "http://127.0.0.1:18923/reset-clicks" -Method Post | Out-Null
Start-Sleep -Milliseconds 500

# 3. Open a background Notepad editor positioned behind the pet
$bgFile = Join-Path $evidenceDir "q2-notepad-bg.txt"
if (Test-Path $bgFile) { Remove-Item $bgFile -Force }
[System.IO.File]::WriteAllText($bgFile, "", [System.Text.Encoding]::UTF8)

# Clear TabState
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

$notepadProc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$bgFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
Start-Sleep -Seconds 1

$logLines = @()
$logLines += "SP-7 Q2 Click-Through Verification Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    # PART A: Click transparent region of pet window: (petX + 10, petY + 10) = (410, 210)
    # The pet window is 140x140, avatar circle is centered with 20px margin.
    # (410, 210) is inside the pet window's bounds but completely transparent.
    Write-Output "`n[Test A] Clicking transparent pixel at ($($petX + 10), $($petY + 10))..."
    & $sendkeysScript -MouseMove @{ X = ($petX + 10); Y = ($petY + 10) }
    Start-Sleep -Milliseconds 200
    & $sendkeysScript -MouseMove @{ X = ($petX + 10); Y = ($petY + 10) } -MouseClick 'Left'
    Start-Sleep -Milliseconds 200

    # Type text through the transparent region into Notepad
    & $sendkeysScript -Text "CLICKTHROUGH_SUCCESS" -DelayBetweenKeysMs 10
    Start-Sleep -Milliseconds 500

    # Save Notepad
    & $sendkeysScript -Key "Ctrl+S"
    Start-Sleep -Seconds 1

    $bgText = [System.IO.File]::ReadAllText($bgFile, [System.Text.Encoding]::UTF8).TrimStart("`r", "`n")
    $clickthroughPassed = ($bgText -match "CLICKTHROUGH_SUCCESS")

    $resA = "Part A (Transparent Click-Through): Received in background window = '$bgText' => $(if ($clickthroughPassed) { 'PASS' } else { 'FAIL' })"
    Write-Output $resA
    $logLines += $resA

    # PART B: Click pet avatar center: (petX + 70, petY + 70) = (470, 270)
    Write-Output "`n[Test B] Clicking pet avatar center at ($($petX + 70), $($petY + 70))..."
    & $sendkeysScript -MouseMove @{ X = ($petX + 70); Y = ($petY + 70) }
    Start-Sleep -Milliseconds 200
    & $sendkeysScript -MouseMove @{ X = ($petX + 70); Y = ($petY + 70) } -MouseClick 'Left'
    Start-Sleep -Milliseconds 300

    $clicks = Invoke-RestMethod -Uri "http://127.0.0.1:18923/clicks"
    $petClicked = ($clicks.petClicks -ge 1)

    $resB = "Part B (Pet Avatar Click Detection): Pet click counter = $($clicks.petClicks) => $(if ($petClicked) { 'PASS' } else { 'FAIL' })"
    Write-Output $resB
    $logLines += $resB

    # Capture screenshot of setup
    $shotPath = Join-Path $evidenceDir "q2-clickthrough.png"
    & $screenshotScript -OutputPath $shotPath -AllScreens
    Write-Output "`nScreenshot captured: $shotPath"
    $logLines += "Screenshot: $shotPath"

    $overallPass = $clickthroughPassed -and $petClicked
    $resOverall = "`nOVERALL Q2 RESULT: $(if ($overallPass) { 'PASS' } else { 'FAIL' })"
    Write-Output $resOverall
    $logLines += $resOverall

} finally {
    Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$logPath = Join-Path $evidenceDir "q2-clickthrough.log"
[System.IO.File]::WriteAllLines($logPath, $logLines, [System.Text.Encoding]::UTF8)
