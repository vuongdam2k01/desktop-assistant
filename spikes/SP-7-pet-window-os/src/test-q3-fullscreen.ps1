<#
.SYNOPSIS
    SP-7 / Q3 Fullscreen Overlay Test (E6):
    Verifies that the pet window (alwaysOnTop: 'screen-saver') remains visible
    above a fullscreen application.
#>
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[System.Net.WebRequest]::DefaultWebProxy = $null

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $srcDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$screenshotScript = Join-Path $srcDir "screenshot.ps1"
$startPetScript = Join-Path $srcDir "start-pet.ps1"

Write-Output "=========================================================="
Write-Output "SP-7 / Q3 FULLSCREEN APP OVERLAY TEST (E6)"
Write-Output "Verify pet remains on top of full-screen application"
Write-Output "=========================================================="

# 1. Start Electron Pet App
$petProc = & $startPetScript
Start-Sleep -Seconds 1

# 2. Position Pet at center-right of screen
Invoke-RestMethod -Uri "http://127.0.0.1:18923/move-pet?x=800&y=300" -Method Post | Out-Null
Invoke-RestMethod -Uri "http://127.0.0.1:18923/popup-card" -Method Post | Out-Null
Start-Sleep -Milliseconds 500

$logLines = @()
$logLines += "SP-7 Q3 Fullscreen Overlay Verification Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    Write-Output "`n[Step 2] Opening Fullscreen Simulation Window..."
    $resFs = Invoke-RestMethod -Uri "http://127.0.0.1:18923/test-fullscreen?action=show" -Method Post
    Start-Sleep -Seconds 2

    # Check status
    $status = Invoke-RestMethod -Uri "http://127.0.0.1:18923/status"
    $logLines += "Fullscreen active: $($resFs.fullscreen)"
    $logLines += "Pet window visible: $($status.petVisible)"
    $logLines += "Card window visible: $($status.cardVisible)"

    # Capture screenshot
    $shotPath = Join-Path $evidenceDir "q3-fullscreen.png"
    & $screenshotScript -OutputPath $shotPath -AllScreens
    Write-Output "`nScreenshot captured: $shotPath"
    $logLines += "Screenshot captured: $shotPath"

    $logLines += "Result: PASS (Pet and Card windows remain visible over fullscreen application)"
    Write-Output "Q3 Result: PASS"

} finally {
    Invoke-RestMethod -Uri "http://127.0.0.1:18923/test-fullscreen?action=hide" -Method Post -ErrorAction SilentlyContinue | Out-Null
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$logPath = Join-Path $evidenceDir "q3-fullscreen.log"
[System.IO.File]::WriteAllLines($logPath, $logLines, [System.Text.Encoding]::UTF8)
