$ErrorActionPreference = 'Stop'
[System.Net.WebRequest]::DefaultWebProxy = $null

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $srcDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$startScript = Join-Path $srcDir "start-liveness.ps1"
$screenshotScript = Join-Path $srcDir "screenshot.ps1"
$helperDll = Join-Path $srcDir "NativeLivenessHelper.dll"

Add-Type -Path $helperDll

Write-Output "=========================================================="
Write-Output "SP-18 BENCHMARK: Q0 ARCHITECTURE A VS B & Q1 60FPS MOTION"
Write-Output "=========================================================="

function RunArchBench([string]$modeName) {
    Write-Output "`n>>> Starting Benchmark for $modeName..."
    $proc = & $startScript -Mode $modeName
    Start-Sleep -Seconds 2

    $pidNum = $proc.ProcessId

    # 1. Idle baseline (5s)
    Write-Output "[$modeName] Measuring Idle Baseline (5s)..."
    Start-Sleep -Seconds 5
    $idleStatsJson = [NativeLiveness.Helper]::GetProcessStats($pidNum)
    $idleStats = $idleStatsJson | ConvertFrom-Json
    $idleMetrics = Invoke-RestMethod -Uri "http://127.0.0.1:18928/metrics"

    # 2. Linear Motion @ 60fps, 0% CPU load (10s)
    Write-Output "[$modeName] Starting 60fps Motion @ 0% CPU load (10s)..."
    $motionBody = @{
        type = 'linear'
        speed = 8
        startX = 150
        endX = 950
        startY = 350
        endY = 350
    } | ConvertTo-Json

    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18928/set-motion" -Body $motionBody -ContentType "application/json" | Out-Null
    Start-Sleep -Seconds 3

    # Burst Screenshots to check for tearing/flickering
    Write-Output "[$modeName] Capturing burst screenshots during motion..."
    & $screenshotScript -OutputPath (Join-Path $evidenceDir "q1-motion-$modeName-frame1.png") | Out-Null
    Start-Sleep -Milliseconds 250
    & $screenshotScript -OutputPath (Join-Path $evidenceDir "q1-motion-$modeName-frame2.png") | Out-Null
    Start-Sleep -Milliseconds 250
    & $screenshotScript -OutputPath (Join-Path $evidenceDir "q1-motion-$modeName-frame3.png") | Out-Null

    Start-Sleep -Seconds 4
    $motion0StatsJson = [NativeLiveness.Helper]::GetProcessStats($pidNum)
    $motion0Stats = $motion0StatsJson | ConvertFrom-Json
    $motion0Metrics = Invoke-RestMethod -Uri "http://127.0.0.1:18928/metrics"

    # 3. Motion @ 70% CPU load (10s)
    Write-Output "[$modeName] Starting 70% CPU stress during motion (10s)..."
    $cpuJob = Start-Process node -ArgumentList @("`"$srcDir\cpu-load.js`"", "10", "70") -PassThru
    Start-Sleep -Seconds 5
    & $screenshotScript -OutputPath (Join-Path $evidenceDir "q1-motion-$modeName-stressed.png") | Out-Null
    Wait-Process -Id $cpuJob.Id -Timeout 15 -ErrorAction SilentlyContinue

    $motion70StatsJson = [NativeLiveness.Helper]::GetProcessStats($pidNum)
    $motion70Stats = $motion70StatsJson | ConvertFrom-Json
    $motion70Metrics = Invoke-RestMethod -Uri "http://127.0.0.1:18928/metrics"

    # 4. Stop Motion & Quit App
    Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18928/quit" | Out-Null
    Start-Sleep -Seconds 1
    Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue

    return [PSCustomObject]@{
        Mode = $modeName
        Idle = [PSCustomObject]@{
            FPS = $idleMetrics.metrics.fps
            WorkingSetMb = $idleStats.workingSetMb
            PrivateMb = $idleStats.privateMb
            GdiHandles = $idleStats.gdi
            UserHandles = $idleStats.user
            CpuSec = $idleStats.cpuSec
        }
        Motion0Pct = [PSCustomObject]@{
            FPS = $motion0Metrics.metrics.fps
            AvgFPS = $motion0Metrics.metrics.avgFps
            MinFPS = $motion0Metrics.metrics.minFps
            MaxFPS = $motion0Metrics.metrics.maxFps
            P95FPS = $motion0Metrics.metrics.p95Fps
            WorkingSetMb = $motion0Stats.workingSetMb
            PrivateMb = $motion0Stats.privateMb
            GdiHandles = $motion0Stats.gdi
            UserHandles = $motion0Stats.user
            CpuSec = $motion0Stats.cpuSec
        }
        Motion70Pct = [PSCustomObject]@{
            FPS = $motion70Metrics.metrics.fps
            AvgFPS = $motion70Metrics.metrics.avgFps
            MinFPS = $motion70Metrics.metrics.minFps
            MaxFPS = $motion70Metrics.metrics.maxFps
            P95FPS = $motion70Metrics.metrics.p95Fps
            WorkingSetMb = $motion70Stats.workingSetMb
            PrivateMb = $motion70Stats.privateMb
            GdiHandles = $motion70Stats.gdi
            UserHandles = $motion70Stats.user
            CpuSec = $motion70Stats.cpuSec
        }
    }
}

$resultA = RunArchBench "arch-a"
$resultB = RunArchBench "arch-b"

$comparison = [PSCustomObject]@{
    Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    ArchitectureA = $resultA
    ArchitectureB = $resultB
}

$jsonOutput = $comparison | ConvertTo-Json -Depth 5
[System.IO.File]::WriteAllText((Join-Path $evidenceDir "q0-architecture-comparison.json"), $jsonOutput, [System.Text.Encoding]::UTF8)

Write-Output "`n================ COMPARISON SUMMARY ================"
Write-Output "Architecture A (Small Moving Window):"
Write-Output "  Idle:    WS=$($resultA.Idle.WorkingSetMb)MB, Priv=$($resultA.Idle.PrivateMb)MB, FPS=$($resultA.Idle.FPS)"
Write-Output "  Motion:  FPS=$($resultA.Motion0Pct.AvgFPS) (Min=$($resultA.Motion0Pct.MinFPS)), WS=$($resultA.Motion0Pct.WorkingSetMb)MB"
Write-Output "  Stress:  FPS=$($resultA.Motion70Pct.AvgFPS) (Min=$($resultA.Motion70Pct.MinFPS)) under 70% CPU load"
Write-Output "Architecture B (Fullscreen Transparent Overlay):"
Write-Output "  Idle:    WS=$($resultB.Idle.WorkingSetMb)MB, Priv=$($resultB.Idle.PrivateMb)MB, FPS=$($resultB.Idle.FPS)"
Write-Output "  Motion:  FPS=$($resultB.Motion0Pct.AvgFPS) (Min=$($resultB.Motion0Pct.MinFPS)), WS=$($resultB.Motion0Pct.WorkingSetMb)MB"
Write-Output "  Stress:  FPS=$($resultB.Motion70Pct.AvgFPS) (Min=$($resultB.Motion70Pct.MinFPS)) under 70% CPU load"
Write-Output "===================================================="
