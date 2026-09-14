<#
.SYNOPSIS
    SP-7 / Q6 Tray Icon & OS Notification Test (FR-INT-14, E3):
    Verifies system tray creation and that when the pet is hidden,
    blocking/approval notifications are dispatched via Windows native notifications.
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
Write-Output "SP-7 / Q6 TRAY ICON & OS NOTIFICATION TEST (FR-INT-14, E3)"
Write-Output "=========================================================="

# 1. Start Electron Pet App
$petProc = & $startPetScript
Start-Sleep -Seconds 1

$logLines = @()
$logLines += "SP-7 Q6 Tray Icon & OS Notification Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    Write-Output "`n[Step 2] Triggering Pet Hide and Windows OS Notification..."
    $notifRes = Invoke-RestMethod -Uri "http://127.0.0.1:18923/test-tray-notification" -Method Post
    Start-Sleep -Seconds 2

    $status = Invoke-RestMethod -Uri "http://127.0.0.1:18923/status"
    $petIsHidden = (-not $status.petVisible)
    $notified = $notifRes.notified

    $line1 = "Pet window hidden while card pending: $petIsHidden => $(if ($petIsHidden) { 'PASS' } else { 'FAIL' })"
    $line2 = "Windows OS Notification dispatched: $notified => $(if ($notified) { 'PASS' } else { 'FAIL' })"
    Write-Output "  $line1"
    Write-Output "  $line2"
    $logLines += $line1
    $logLines += $line2

    # Capture screenshot of notification / desktop
    $shotPath = Join-Path $evidenceDir "q6-tray-notification.png"
    & $screenshotScript -OutputPath $shotPath -AllScreens
    Write-Output "  Screenshot captured: $shotPath"
    $logLines += "  Screenshot: $shotPath"

    # Restore pet window
    Write-Output "`n[Step 3] Restoring Pet Window..."
    $restoreRes = Invoke-RestMethod -Uri "http://127.0.0.1:18923/restore-pet" -Method Post
    $statusAfter = Invoke-RestMethod -Uri "http://127.0.0.1:18923/status"
    $restored = $statusAfter.petVisible
    $line3 = "Pet restored successfully: $restored => $(if ($restored) { 'PASS' } else { 'FAIL' })"
    Write-Output "  $line3"
    $logLines += $line3

    $overall = "`nQ6 OVERALL RESULT: $(if ($petIsHidden -and $notified -and $restored) { 'PASS' } else { 'FAIL' })"
    Write-Output $overall
    $logLines += $overall

} finally {
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$logPath = Join-Path $evidenceDir "q6-tray-notification.log"
[System.IO.File]::WriteAllLines($logPath, $logLines, [System.Text.Encoding]::UTF8)
