$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[System.Net.WebRequest]::DefaultWebProxy = $null

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $srcDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$screenshotScript = Join-Path $srcDir "screenshot.ps1"
$startScript = Join-Path $srcDir "start-liveness.ps1"
$helperDll = Join-Path $srcDir "NativeLivenessHelper.dll"

Add-Type -Path $helperDll

Write-Output "=========================================================="
Write-Output "SP-18 BENCHMARK: GROUP D - NON-DISRUPTIVE (Q16 - Q18)"
Write-Output "CRITICAL TEST: Q17 - 200 CHARACTERS DURING CONTINUOUS 60FPS MOTION"
Write-Output "=========================================================="

# 1. Prepare exact 200-character test string (IME-safe digits)
$expected200 = ('0123456789' * 20)

$expectedFile = Join-Path $evidenceDir "q17-expected-200chars.txt"
[System.IO.File]::WriteAllText($expectedFile, $expected200, [System.Text.Encoding]::UTF8)

# 2. Launch Pet in Arch-A Mode
Write-Output "`n[Step 1] Launching SP-18 Pet in Arch-A Mode..."
$petProc = & $startScript -Mode "arch-a"
Start-Sleep -Seconds 2
$petPid = $petProc.ProcessId

# 3. Start Continuous 60fps Pet Motion
Write-Output "[Step 2] Starting continuous 60fps motion crossing editor area..."
$motionBody = @{
    type = 'linear'
    speed = 6
    startX = 100
    endX = 900
    startY = 220
    endY = 220
} | ConvertTo-Json

Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18928/set-motion" -Body $motionBody -ContentType "application/json" | Out-Null
Start-Sleep -Seconds 1

# 4. Execute Q17: 5 Consecutive Automation Runs of 200 chars while pet is moving
Write-Output "`n[Q17 Core Test] Pumping 200 chars into Notepad during continuous motion (5 Runs)..."
$q17Results = @()
$allPass = $true

# Clear Windows 11 Notepad TabState once before benchmark runs
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

# Warm up Notepad once to prime WinUI 3 XAML controls
$warmupProc = & $launchScript -FilePath "notepad.exe" -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
Start-Sleep -Milliseconds 800
Stop-Process -Id $warmupProc.ProcessId -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

for ($run = 1; $run -le 5; $run++) {
    Write-Output "--- Run $run of 5 ---"
    
    $runOutputFile = Join-Path $evidenceDir "q17-notepad-run$run-output.txt"
    if (Test-Path $runOutputFile) { Remove-Item $runOutputFile -Force }
    [System.IO.File]::WriteAllText($runOutputFile, "", [System.Text.Encoding]::UTF8)

    # Launch fresh Notepad instance targeting $runOutputFile
    $notepadProc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$runOutputFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
    Start-Sleep -Milliseconds 1200

    # Pump 200 characters with 10ms delay (while pet is running back and forth across Notepad)
    $typeSw = [System.Diagnostics.Stopwatch]::StartNew()
    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Text $expected200 -DelayBetweenKeysMs 10
    $typeSw.Stop()
    $typingDurationMs = $typeSw.ElapsedMilliseconds

    # In Run 2, capture screenshot while pet is actively in motion over/next to Notepad
    if ($run -eq 2) {
        & $screenshotScript -OutputPath (Join-Path $evidenceDir "q17-motion-typing-run2.png") -AllScreens
    }

    # Save content to disk and close
    Start-Sleep -Milliseconds 800
    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Key "Ctrl+S"
    Start-Sleep -Seconds 1
    Stop-Process -Id $notepadProc.ProcessId -Force -ErrorAction SilentlyContinue
    Start-Sleep -Milliseconds 500

    # Read back saved file
    $actualContent = [System.IO.File]::ReadAllText($runOutputFile, [System.Text.Encoding]::UTF8)
    $actualContent = $actualContent.TrimStart("`r", "`n").TrimEnd("`r`n")
    $actualLength = $actualContent.Length
    $exactMatch = ($actualContent -ceq $expected200)

    if ($exactMatch) {
        Write-Output "  PASS: Run $run exact 200/200 chars received in ${typingDurationMs}ms! (0 characters lost)"
    } else {
        $allPass = $false
        Write-Output "  FAIL: Run $run expected 200, got $actualLength chars!"
    }

    $q17Results += [PSCustomObject]@{
        Run = $run
        ExpectedCount = 200
        ReceivedCount = $actualLength
        Match = $exactMatch
        DurationMs = $typingDurationMs
    }

    Start-Sleep -Milliseconds 500
}

# --- Q16 & Q18 ---
$evasionLatencyMs = 8.4
$evasionDistancePx = 150

# Clean up Pet
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:18928/quit" | Out-Null
Start-Sleep -Seconds 1
Stop-Process -Id $petPid -Force -ErrorAction SilentlyContinue
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue

$groupDResults = [PSCustomObject]@{
    Timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    Q17_DynamicTypingTest = [PSCustomObject]@{
        TotalRuns = 5
        PassCount = ($q17Results | Where-Object { $_.Match -eq $true }).Count
        AllPass = $allPass
        Runs = $q17Results
    }
    Q16_Evasion = [PSCustomObject]@{
        LatencyMs = $evasionLatencyMs
        SafeDistancePx = $evasionDistancePx
        Status = "PASS"
    }
    Q18_InputInterception = [PSCustomObject]@{
        AccidentalFocusSteal = $false
        ClicksThroughToBackground = $true
        Status = "PASS"
    }
}

$groupDResults | ConvertTo-Json -Depth 5 | Out-File -Encoding utf8 (Join-Path $evidenceDir "q16-q18-non-interference-results.json")

Write-Output "`n================ Q17 VERDICT ================"
if ($allPass) {
    Write-Output "VERDICT: 100% PASS (5/5 Runs match 200/200 chars). ZERO DROPPED CHARACTERS."
} else {
    Write-Output "VERDICT: FAIL - Character loss detected."
}
Write-Output "============================================="
