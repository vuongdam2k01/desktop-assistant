<#
.SYNOPSIS
    SP-7 / Q5 Corner Dialogue Orientation Test (E1):
    Tests pet positioning in all 4 corners of the screen (Top-Left, Top-Right,
    Bottom-Left, Bottom-Right) and verifies that the dialogue card automatically
    adapts its opening direction to fit 100% inside the display workArea without clipping.
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
Write-Output "SP-7 / Q5 4-CORNER DIALOGUE ORIENTATION TEST (E1)"
Write-Output "=========================================================="

# 1. Start Electron Pet App
$petProc = & $startPetScript
Start-Sleep -Seconds 1

$corners = @('top-left', 'top-right', 'bottom-left', 'bottom-right')
$logLines = @()
$logLines += "SP-7 Q5 4-Corner Dialogue Positioning Log - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"

$allPassed = $true

try {
    foreach ($corner in $corners) {
        Write-Output "`n[Testing Corner: $corner]"
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:18923/test-corner?corner=$corner" -Method Post
        Start-Sleep -Milliseconds 800

        $wa = $res.workArea
        $pb = $res.petBounds
        $cb = $res.cardBounds

        # Check bounds: card must be strictly within workArea
        $inBoundsX = ($cb.x -ge $wa.x) -and (($cb.x + $cb.width) -le ($wa.x + $wa.width))
        $inBoundsY = ($cb.y -ge $wa.y) -and (($cb.y + $cb.height) -le ($wa.y + $wa.height))
        $passed = $inBoundsX -and $inBoundsY

        $line = "Corner '$corner': WorkArea=($($wa.x),$($wa.y) $($wa.width)x$($wa.height)), Pet=($($pb.x),$($pb.y)), Card=($($cb.x),$($cb.y) $($cb.width)x$($cb.height)), InsideWorkArea=$passed => $(if ($passed) { 'PASS' } else { 'FAIL' })"
        Write-Output "  $line"
        $logLines += $line

        if (-not $passed) { $allPassed = $false }

        # Capture screenshot for each corner
        $shotPath = Join-Path $evidenceDir "q5-corner-$corner.png"
        & $screenshotScript -OutputPath $shotPath
        Write-Output "  Screenshot captured: $shotPath"
        $logLines += "  Screenshot: $shotPath"

        Start-Sleep -Milliseconds 400
    }

    $overall = "`nQ5 OVERALL RESULT: $(if ($allPassed) { 'PASS' } else { 'FAIL' }) (All 4 corners adapt inside workArea without clipping)"
    Write-Output $overall
    $logLines += $overall

} finally {
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$logPath = Join-Path $evidenceDir "q5-corners.log"
[System.IO.File]::WriteAllLines($logPath, $logLines, [System.Text.Encoding]::UTF8)
