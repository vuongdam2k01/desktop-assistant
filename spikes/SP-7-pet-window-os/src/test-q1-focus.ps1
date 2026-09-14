<#
.SYNOPSIS
    SP-7 / Q1 Focus Test:
    Pumps a known 200-character string into an active editor (Notepad)
    while the pet window automatically pops up a dialogue card midway.
    Validates whether even 1 character is lost across 10 consecutive runs.
#>
param(
    [int]$TotalRuns = 10
)

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

# Prepare 200-character test string (exact 200 chars, IME-safe)
$testString200 = ('0123456789' * 20)

$testStringFile = Join-Path $evidenceDir "q1-expected-200chars.txt"
[System.IO.File]::WriteAllText($testStringFile, $testString200, [System.Text.Encoding]::UTF8)

Write-Output "=========================================================="
Write-Output "SP-7 / Q1 FOCUS TEST - 10 RUNS CONSECUTIVE AUTOMATION"
Write-Output "Target: 200 characters pumped into Notepad via SendInput"
Write-Output "Event: Pet window pops up dialogue card MID-STREAM"
Write-Output "Pass Criteria: 200/200 chars received in every run (0 lost)"
Write-Output "=========================================================="

# 1. Start Electron Pet App
Write-Output "`n[Step 1] Starting SP-7 Pet Electron App..."
$petProc = & $startPetScript
Start-Sleep -Seconds 1

$summaryFile = Join-Path $evidenceDir "q1-focus-summary.log"
$logLines = @()
$logLines += "SP-7 Q1 Focus Test Summary - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$logLines += "Expected character count: 200"
$logLines += "----------------------------------------------------------"

$passCount = 0
$failCount = 0

# Clear TabState once before benchmark runs
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

# Warm up Notepad once to prime XAML
$warmup = & $launchScript -FilePath "notepad.exe" -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
Start-Sleep -Milliseconds 800
Stop-Process -Id $warmup.ProcessId -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

try {
    for ($run = 1; $run -le $TotalRuns; $run++) {
        Write-Output "`n--- Starting Run $run of $TotalRuns ---"
        
        # Ensure card is hidden before run
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/hide-card" -Method Post | Out-Null
        
        # Fresh output file for this run
        $runOutputFile = Join-Path $evidenceDir "q1-notepad-run$run-output.txt"
        if (Test-Path $runOutputFile) { Remove-Item $runOutputFile -Force }
        [System.IO.File]::WriteAllText($runOutputFile, "", [System.Text.Encoding]::UTF8)

        # Launch fresh Notepad instance
        $notepadProc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$runOutputFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
        Start-Sleep -Milliseconds 1200

        # Schedule async pop-up trigger via Node.js at ~2500ms (midway through typing)
        Start-Process node -ArgumentList "-e `"setTimeout(() => { const r = require('http').request({host:'127.0.0.1',port:18923,path:'/popup-card',method:'POST'}); r.end(); }, 2500)`"" -WindowStyle Hidden

        # Pump 200 characters into Notepad (25ms delay ensures stable XAML message pump)
        $typeStartTime = [System.Diagnostics.Stopwatch]::StartNew()
        & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Text $testString200 -DelayBetweenKeysMs 25
        $typeStartTime.Stop()
        $typingDurationMs = $typeStartTime.ElapsedMilliseconds

        # In Run 1, capture screenshot with dialogue card visibly popped up next to Notepad
        if ($run -eq 1) {
            $shotPath = Join-Path $evidenceDir "q1-focus-editor-during-popup.png"
            & $screenshotScript -OutputPath $shotPath -AllScreens
            Write-Output "  Screenshot captured at run 1: $shotPath"
        }

        # Check card window status via HTTP
        $status = Invoke-RestMethod -Uri "http://127.0.0.1:18923/status"
        $cardWasVisible = $status.cardVisible
        $cardStoleFocus = $status.cardFocused

        # Save Notepad content to disk and close
        Start-Sleep -Milliseconds 800
        & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Key "Ctrl+S"
        Start-Sleep -Seconds 1
        Stop-Process -Id $notepadProc.ProcessId -Force -ErrorAction SilentlyContinue
        Start-Sleep -Milliseconds 500

        # Read back saved file
        $actualContent = [System.IO.File]::ReadAllText($runOutputFile, [System.Text.Encoding]::UTF8)
        $actualContent = $actualContent.TrimStart("`r", "`n").TrimEnd("`r`n")
        $actualLength = $actualContent.Length
        $exactMatch = ($actualContent -ceq $testString200)

        # Evaluate: Pass requires exact 200 chars, exact content match, card was visible, card did NOT steal focus
        $isPass = ($actualLength -eq 200) -and ($exactMatch) -and (-not $cardStoleFocus) -and ($cardWasVisible)
        
        $runResultLine = "Run $run`: Expected=200, Actual=$actualLength, Match=$exactMatch, CardVisible=$cardWasVisible, CardFocused=$cardStoleFocus, Duration=${typingDurationMs}ms => " + $(if ($isPass) { "PASS" } else { "FAIL" })
        Write-Output "  $runResultLine"
        $logLines += $runResultLine

        # Save individual run log
        $runLogFile = Join-Path $evidenceDir "q1-focus-run-$run.log"
        $runLogContent = @"
Run: $run
ExpectedLength: 200
ActualLength: $actualLength
ExactMatch: $exactMatch
CardVisible: $cardWasVisible
CardStoleFocus: $cardStoleFocus
TypingDurationMs: $typingDurationMs
Result: $(if ($isPass) { "PASS" } else { "FAIL" })
ReceivedContent:
$actualContent
"@
        [System.IO.File]::WriteAllText($runLogFile, $runLogContent, [System.Text.Encoding]::UTF8)

        if ($isPass) {
            $passCount++
        } else {
            $failCount++
        }

        Start-Sleep -Milliseconds 300
    }
} finally {
    # Cleanup processes
    Write-Output "`n[Cleanup] Closing Notepad and Pet app..."
    Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
    try {
        Invoke-RestMethod -Uri "http://127.0.0.1:18923/quit" -Method Post -TimeoutSec 1 | Out-Null
    } catch {}
    Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
}

$pct = [math]::Round($passCount / $TotalRuns * 100, 1)
$summaryHeader = "`n=========================================================="
$summaryResult = "FINAL RESULT Q1: $passCount/$TotalRuns PASS ($pct%), $failCount FAIL"
Write-Output $summaryHeader
Write-Output $summaryResult
Write-Output "=========================================================="

$logLines += "----------------------------------------------------------"
$logLines += $summaryResult
[System.IO.File]::WriteAllLines($summaryFile, $logLines, [System.Text.Encoding]::UTF8)

if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}
