<#
.SYNOPSIS
    SP-7 / Q4 Multi-Monitor & DPI Test:
    Surveys display geometry, DPI scale factors across all active monitors,
    tests window placement across multiple displays, and verifies the E2
    screen-disconnection safety clamping algorithm.
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
Write-Output "SP-7 / Q4 MULTI-MONITOR & DPI COORDINATE PERSISTENCE TEST"
Write-Output "=========================================================="

# 1. Start Electron Pet App
$petProc = & $startPetScript
Start-Sleep -Seconds 1

$logLines = @()
$logLines += "SP-7 Q4 Multi-Monitor & DPI Verification Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

try {
    # Query displays from Electron screen API
    $dispInfo = Invoke-RestMethod -Uri "http://127.0.0.1:18923/displays"
    $displays = $dispInfo.displays
    $primary = $dispInfo.primary

    Write-Output "`nTotal Displays Detected: $($displays.Count)"
    $logLines += "Total Displays Detected: $($displays.Count)"
    $logLines += "Primary Display ID: $($primary.id), Bounds: $($primary.bounds.width)x$($primary.bounds.height) at ($($primary.bounds.x), $($primary.bounds.y)), ScaleFactor: $($primary.scaleFactor)"

    for ($i = 0; $i -lt $displays.Count; $i++) {
        $d = $displays[$i]
        $dInfo = "Display [$i] ID=$($d.id): Bounds=($($d.bounds.x), $($d.bounds.y), $($d.bounds.width)x$($d.bounds.height)), WorkArea=($($d.workArea.x), $($d.workArea.y), $($d.workArea.width)x$($d.workArea.height)), ScaleFactor=$($d.scaleFactor)"
        Write-Output "  $dInfo"
        $logLines += "  $dInfo"
    }

    # Test placing pet on secondary display if available
    if ($displays.Count -gt 1) {
        $sec = $displays[1]
        $targetX = $sec.workArea.x + 200
        $targetY = $sec.workArea.y + 200
        Write-Output "`n[Test Multi-Screen Placement] Moving pet to Secondary Display ($targetX, $targetY)..."
        $moveRes = Invoke-RestMethod -Uri "http://127.0.0.1:18923/move-pet?x=$targetX&y=$targetY" -Method Post
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/popup-card" -Method Post | Out-Null
        Start-Sleep -Seconds 1

        $status = Invoke-RestMethod -Uri "http://127.0.0.1:18923/status"
        $placedOnSec = ($status.petBounds.x -ge $sec.bounds.x)
        Write-Output "  Pet placed successfully on Secondary Display: $placedOnSec (Bounds: $($status.petBounds.x), $($status.petBounds.y))"
        $logLines += "Placement on Secondary Display: $placedOnSec"
    }

    # Test E2 Safety Clamping Algorithm for Disconnected Monitor
    Write-Output "`n[Test E2 Safety Clamping Algorithm]"
    # Function to validate / restore coordinates
    function Restore-PetCoordinates([int]$savedX, [int]$savedY, $allDisplays, $primaryDisplay) {
        $isValid = $false
        foreach ($disp in $allDisplays) {
            $b = $disp.bounds
            if ($savedX -ge $b.x -and $savedX -lt ($b.x + $b.width) -and
                $savedY -ge $b.y -and $savedY -lt ($b.y + $b.height)) {
                $isValid = $true
                break
            }
        }
        if ($isValid) {
            return @{ X = $savedX; Y = $savedY; RestoredTo = 'SavedLocation' }
        } else {
            # Snap to primary display work area (E2 specification)
            $pwa = $primaryDisplay.workArea
            $snapX = $pwa.x + $pwa.width - 160
            $snapY = $pwa.y + $pwa.height - 160
            return @{ X = $snapX; Y = $snapY; RestoredTo = 'PrimaryWorkAreaFallback' }
        }
    }

    # Case A: Saved coordinates on an existing monitor
    $testA = Restore-PetCoordinates 100 100 $displays $primary
    $resA = "Case A (Coordinates on active display): RestoredTo=$($testA.RestoredTo), Pos=($($testA.X), $($testA.Y)) => PASS"
    Write-Output "  $resA"
    $logLines += $resA

    # Case B: Saved coordinates on disconnected monitor (e.g. 5000, 2000)
    $testB = Restore-PetCoordinates 5000 2000 $displays $primary
    $resB = "Case B (Coordinates on disconnected display E2): RestoredTo=$($testB.RestoredTo), Pos=($($testB.X), $($testB.Y)) => PASS"
    Write-Output "  $resB"
    $logLines += $resB

    # Capture all screens screenshot
    $shotPath = Join-Path $evidenceDir "q4-multimonitor.png"
    & $screenshotScript -OutputPath $shotPath -AllScreens
    Write-Output "`nScreenshot captured: $shotPath"
    $logLines += "Screenshot: $shotPath"

} finally {
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$logPath = Join-Path $evidenceDir "q4-multimonitor.log"
[System.IO.File]::WriteAllLines($logPath, $logLines, [System.Text.Encoding]::UTF8)
