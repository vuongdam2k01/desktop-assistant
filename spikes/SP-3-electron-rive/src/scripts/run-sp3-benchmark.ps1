<#
.SYNOPSIS
    Master test runner for SPIKE SP-3:
    - Q1: FPS under ~70% CPU load (NFR-PF-04)
    - Q2: 5-state transitions & latency (FR-PET-02) + screenshots
    - Q3: Transparent edge pixel analysis (reading RGBA border values)
    - Q4: Idle CPU and RAM usage (NFR-PF-01)
#>
[CmdletBinding()]
param(
    [int]$Port = 3838
)

$ErrorActionPreference = 'Stop'
$scriptsDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeDir = (Resolve-Path (Join-Path $scriptsDir "..\..")).Path
$evidenceDir = Join-Path $spikeDir "evidence"
$appDir = Join-Path $spikeDir "src\electron-rive"

if (-not (Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Path $evidenceDir -Force | Out-Null
}

Write-Host "=========================================================="
Write-Host " STARTING SPIKE SP-3 AUTOMATED BENCHMARK SUITE"
Write-Host "=========================================================="

# 0. Clean up any existing instance
Write-Host "`n[Step 0] Cleaning up any existing instance..."
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/close" -Method Post -TimeoutSec 1 -ErrorAction SilentlyContinue | Out-Null
    Start-Sleep -Milliseconds 500
} catch {}

# 1. Launch Pet App on WinSta0\Default
Write-Host "`n[Step 1] Launching Electron Rive Pet App..."
$launchScript = Join-Path $scriptsDir "launch-pet.ps1"
$launchResult = & $launchScript -Port $Port -TimeoutSeconds 15
$appPid = $launchResult.pid
Write-Host "Pet App is online (PID: $appPid)"

Start-Sleep -Seconds 2
$bounds = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/bounds"
Write-Host "Window bounds: X=$($bounds.x), Y=$($bounds.y), W=$($bounds.width), H=$($bounds.height), HWND=$($bounds.hwnd)"

# 2. Phase 1: Baseline FPS (10s under normal load)
Write-Host "`n[Step 2] Measuring Baseline FPS (10 seconds, idle system)..."
Invoke-RestMethod -Uri "http://127.0.0.1:$Port/reset-metrics" -Method Post | Out-Null

$baselineSamples = @()
for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    $m = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/metrics"
    $baselineSamples += $m.currentFps
    Write-Host "  [Baseline] Second $($i+1)/10 - Current FPS: $($m.currentFps)"
}
$baselineMetrics = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/metrics"
$baselineJsonPath = Join-Path $evidenceDir "q1-fps-baseline.json"
$baselineMetrics | ConvertTo-Json -Depth 5 | Set-Content -Path $baselineJsonPath -Encoding UTF8
Write-Host "Baseline FPS: Avg=$($baselineMetrics.avgFps), Min=$($baselineMetrics.minFps), Max=$($baselineMetrics.maxFps), P95=$($baselineMetrics.p95Fps)"

# 3. Phase 2: Stressed FPS under ~70% CPU load (NFR-PF-04)
Write-Host "`n[Step 3] Measuring Stressed FPS under ~70% CPU Load (12 seconds)..."
$jsWorker = Join-Path $scriptsDir "cpu-load.js"
$cpuWorkerProc = Start-Process -FilePath "node" -ArgumentList "`"$jsWorker`" 68 12" -PassThru

# Give worker 1 second to ramp up CPU load
Start-Sleep -Seconds 1
Invoke-RestMethod -Uri "http://127.0.0.1:$Port/reset-metrics" -Method Post | Out-Null

$cpuSamples = @()
$stressedFpsSamples = @()

for ($i = 0; $i -lt 10; $i++) {
    Start-Sleep -Seconds 1
    $cpuVal = 0
    try {
        $cpuVal = [Math]::Round((Get-Counter '\Processor(_Total)\% Processor Time' -ErrorAction SilentlyContinue).CounterSamples[0].CookedValue, 1)
        $cpuSamples += $cpuVal
    } catch {}
    
    $m = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/metrics"
    $stressedFpsSamples += $m.currentFps
    Write-Host "  [Stress Load] Second $($i+1)/10 - System CPU: ${cpuVal}% | Pet FPS: $($m.currentFps)"
}

if (-not $cpuWorkerProc.HasExited) {
    $cpuWorkerProc.WaitForExit(3000) | Out-Null
}

$stressedMetrics = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/metrics"
$avgCpuLoad = if ($cpuSamples.Count -gt 0) { [Math]::Round(($cpuSamples | Measure-Object -Average).Average, 1) } else { 0 }
$stressedResult = [PSCustomObject]@{
    TargetCpuPercent     = 70
    ActualAverageCpu     = $avgCpuLoad
    CpuSamples           = $cpuSamples
    StressedMetrics      = $stressedMetrics
    PassNfrPf04          = ($stressedMetrics.minFps -ge 30 -and $stressedMetrics.avgFps -ge 30)
    Criterion            = "NFR-PF-04 requires >= 30fps without stutter under ~70% CPU load"
}
$stressedJsonPath = Join-Path $evidenceDir "q1-fps-70pct-load.json"
$stressedResult | ConvertTo-Json -Depth 5 | Set-Content -Path $stressedJsonPath -Encoding UTF8

$summaryLog = @"
=== SP-3 Q1: FPS PERFORMANCE BENCHMARK REPORT ===
Timestamp: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
Platform: Windows (Logical Cores: $([Environment]::ProcessorCount))

1. BASELINE (Normal Load):
   - Average FPS: $($baselineMetrics.avgFps)
   - Min FPS:     $($baselineMetrics.minFps)
   - Max FPS:     $($baselineMetrics.maxFps)
   - P95 FPS:     $($baselineMetrics.p95Fps)

2. STRESSED LOAD (~70% CPU):
   - Actual System CPU Load: ${avgCpuLoad}%
   - Stressed Average FPS:   $($stressedMetrics.avgFps)
   - Stressed Min FPS:       $($stressedMetrics.minFps)
   - Stressed Max FPS:       $($stressedMetrics.maxFps)
   - Stressed P95 FPS:       $($stressedMetrics.p95Fps)

3. VERDICT:
   - NFR-PF-04 Requirement: >= 30 fps under ~70% CPU load
   - Result: $(if ($stressedResult.PassNfrPf04) { 'PASS (>= 30 FPS ACHIEVED)' } else { 'FAIL (< 30 FPS)' })
"@
$summaryLogPath = Join-Path $evidenceDir "q1-fps-summary.log"
Set-Content -Path $summaryLogPath -Value $summaryLog -Encoding UTF8
Write-Host "`n$summaryLog"

# 4. Phase 3: State Machine 5-State Transitions & Screenshots (FR-PET-02)
Write-Host "`n[Step 4] Testing 5-State Machine Transitions & Capturing Evidence (FR-PET-02)..."
$states = @(
    'idle',
    'receiving_order',
    'working',
    'waiting_approval',
    'has_result'
)

$transitionResults = @()
$screenshotScript = Join-Path $scriptsDir "screenshot.ps1"

foreach ($s in $states) {
    Write-Host "  -> Transitioning to state: '$s'..."
    $resp = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/state" -Method Post -Body (@{state=$s} | ConvertTo-Json) -ContentType "application/json"
    $latencyMs = $resp.latencyMs
    Write-Host "     State activated in ${latencyMs}ms (FR-PET-02 target: < 2000ms)"

    Start-Sleep -Milliseconds 600

    # 1. Capture 32-bit RGBA directly from Chromium renderer
    $rgbaPng = Join-Path $evidenceDir "q2-state-$s-rgba.png"
    $escapedPath = [System.Uri]::EscapeDataString($rgbaPng)
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/capture-page?path=$escapedPath" | Out-Null


    # 2. Capture desktop screen bounds via GDI BitBlt
    $desktopPng = Join-Path $evidenceDir "q2-state-$s.png"
    & $screenshotScript -OutputPath $desktopPng -Bounds @{X=$bounds.x; Y=$bounds.y; Width=$bounds.width; Height=$bounds.height} | Out-Null

    $transitionResults += [PSCustomObject]@{
        State          = $s
        LatencyMs      = $latencyMs
        PassLatency    = ($latencyMs -lt 2000)
        Screenshot     = "evidence/q2-state-$s.png"
        RgbaScreenshot = "evidence/q2-state-$s-rgba.png"
    }
}

$transitionsJsonPath = Join-Path $evidenceDir "q2-transitions.json"
$transitionResults | ConvertTo-Json -Depth 5 | Set-Content -Path $transitionsJsonPath -Encoding UTF8
Write-Host "State machine transitions recorded to: $transitionsJsonPath"

# 5. Phase 4: Transparent Edge Pixel Analysis (Q3)
Write-Host "`n[Step 5] Analyzing Edge Pixels for Anti-aliasing & Halo Fringing (Q3)..."
$measurePixelsScript = Join-Path $scriptsDir "measure-pixels.ps1"
$idleRgbaPng = Join-Path $evidenceDir "q2-state-idle-rgba.png"
$pixelAnalysisJson = Join-Path $evidenceDir "q3-edge-alpha-analysis.json"

$pixelAnalysis = & $measurePixelsScript -ImagePath $idleRgbaPng -OutputPath $pixelAnalysisJson
Write-Host "Pixel Analysis Complete. Verdict: $($pixelAnalysis.Verdict)"

# 6. Phase 5: Resource Usage when Pet is Idle (Q4 / NFR-PF-01)
Write-Host "`n[Step 6] Measuring Idle Resource Usage (CPU and RAM)..."
# Switch back to idle
Invoke-RestMethod -Uri "http://127.0.0.1:$Port/state" -Method Post -Body (@{state='idle'} | ConvertTo-Json) -ContentType "application/json" | Out-Null
Start-Sleep -Seconds 3

# Collect all Electron processes belonging to this app
$allProcs = Get-CimInstance Win32_Process
$appPids = @($appPid)
$children = $allProcs | Where-Object { $_.ParentProcessId -eq $appPid }
foreach ($c in $children) { $appPids += $c.ProcessId }

$electronProcs = @()
foreach ($id in $appPids) {
    try {
        $p = Get-Process -Id $id -ErrorAction SilentlyContinue
        if ($p) { $electronProcs += $p }
    } catch {}
}


$procSnapshots = @()
foreach ($p in $electronProcs) {
    $procSnapshots += [PSCustomObject]@{
        Id                  = $p.Id
        ProcessName         = $p.ProcessName
        WorkingSetMb        = [Math]::Round($p.WorkingSet64 / 1MB, 2)
        PrivateMemoryMb     = [Math]::Round($p.PrivateMemorySize64 / 1MB, 2)
        TotalProcessorTimeSec = [Math]::Round($p.TotalProcessorTime.TotalSeconds, 2)
    }
}

$totalWsMb = ($procSnapshots | Measure-Object -Property WorkingSetMb -Sum).Sum
$totalPrivateMb = ($procSnapshots | Measure-Object -Property PrivateMemoryMb -Sum).Sum

$idleResourceResult = [PSCustomObject]@{
    Timestamp           = (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
    ProcessCount        = $procSnapshots.Count
    TotalWorkingSetMb   = [Math]::Round($totalWsMb, 2)
    TotalPrivateMemoryMb= [Math]::Round($totalPrivateMb, 2)
    Processes           = $procSnapshots
    Note                = "NFR-PF-01 is a soft target for resource tracking, not a gating criterion."
}

$idleResourceJson = Join-Path $evidenceDir "q4-idle-resources.json"
$idleResourceResult | ConvertTo-Json -Depth 5 | Set-Content -Path $idleResourceJson -Encoding UTF8
Write-Host "Idle Resource Usage: Total Working Set: $($idleResourceResult.TotalWorkingSetMb) MB, Private: $($idleResourceResult.TotalPrivateMemoryMb) MB across $($procSnapshots.Count) processes"

# 7. Clean up
Write-Host "`n[Step 7] Shutting down Pet App..."
try {
    Invoke-RestMethod -Uri "http://127.0.0.1:$Port/close" -Method Post -TimeoutSec 2 | Out-Null
} catch {}

Write-Host "`n=========================================================="
Write-Host " SP-3 BENCHMARK SUITE COMPLETED SUCCESSFULLY!"
Write-Host " All evidence saved to: $evidenceDir"
Write-Host "=========================================================="
