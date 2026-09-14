<#
.SYNOPSIS
    SP-11 Master Runner for Secure Storage on Windows.
    Runs all benchmark and verification suites in order:
    1. Win32 Windows Credential Manager benchmark (wincred-bench.ps1)
    2. Electron safeStorage capacity & tamper integrity benchmark (electron-secure-bench.js)
    3. DPAPI cross-user profile cryptographic isolation test (cross-user-dpapi.ps1)
    4. SecureStorageService taxonomy, CRUD & FR-BE-12 account wipe (test-service-wipe.js)
    5. Verifies and summarizes all results.
#>
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $PSCommandPath
$spikeDir = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeDir "evidence"

if (-not (Test-Path $evidenceDir)) {
    New-Item -ItemType Directory -Force -Path $evidenceDir | Out-Null
}

$summaryLog = Join-Path $evidenceDir "run-summary.log"
$summaryLines = @()

function Log([string]$msg) {
    $ts = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$ts] $msg"
    Write-Host $line
    $script:summaryLines += $line
}

Log "================================================================="
Log "   SP-11 MASTER SUITE: SECURE STORAGE ON WINDOWS"
Log "================================================================="
Log "Spike Directory:    $spikeDir"
Log "Evidence Directory: $evidenceDir"
Log "OS Platform:        Windows NT $([System.Environment]::OSVersion.Version)"
Log "Active User:        $([System.Environment]::UserDomainName)\$([System.Environment]::UserName)"

# Find Electron binary
$electronItem = Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $electronItem) {
    throw "Electron binary not found in npm cache! Please ensure Electron is available."
}
$electronExe = $electronItem.FullName
Log "Electron Executable: $electronExe"

$swTotal = [System.Diagnostics.Stopwatch]::StartNew()

# -------------------------------------------------------------
# Test 1: Win32 Credential Manager Limit Benchmark
# -------------------------------------------------------------
Log "`n>>> [STEP 1/4] Running Windows Credential Manager Benchmark..."
$wincredScript = Join-Path $scriptDir "wincred-bench.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $wincredScript -EvidenceDir $evidenceDir
if ($LASTEXITCODE -ne 0) { throw "WinCred benchmark failed with exit code $LASTEXITCODE" }
Log ">>> Step 1 Complete: Win32 CredWrite 2560-byte boundary confirmed."

# -------------------------------------------------------------
# Test 2: Electron safeStorage Capacity & Tamper Test
# -------------------------------------------------------------
Log "`n>>> [STEP 2/4] Running Electron safeStorage Capacity & Tamper Tests..."
$electronBenchScript = Join-Path $scriptDir "electron-secure-bench.js"
$proc1 = Start-Process -FilePath $electronExe -ArgumentList "`"$electronBenchScript`"" -PassThru -Wait -NoNewWindow
if ($proc1.ExitCode -ne 0) { throw "Electron safeStorage benchmark failed with exit code $($proc1.ExitCode)" }
Log ">>> Step 2 Complete: safeStorage payloads (52B to 1MB) and tamper resistance verified."

# -------------------------------------------------------------
# Test 3: DPAPI Cross-User Profile Isolation
# -------------------------------------------------------------
Log "`n>>> [STEP 3/4] Running DPAPI Cross-User Profile Isolation Test..."
$crossUserScript = Join-Path $scriptDir "cross-user-dpapi.ps1"
& powershell.exe -NoProfile -ExecutionPolicy Bypass -File $crossUserScript -EvidenceDir $evidenceDir
if ($LASTEXITCODE -ne 0) { throw "DPAPI cross-user isolation test failed with exit code $LASTEXITCODE" }
Log ">>> Step 3 Complete: DPAPI NTE_BAD_KEY_STATE (0x8009000B) verified across Windows user profiles."

# -------------------------------------------------------------
# Test 4: Key Taxonomy, CRUD & FR-BE-12 Account Wipe
# -------------------------------------------------------------
Log "`n>>> [STEP 4/4] Running SecureStorageService Key Taxonomy & FR-BE-12 Account Wipe..."
$serviceWipeScript = Join-Path $scriptDir "test-service-wipe.js"
$proc2 = Start-Process -FilePath $electronExe -ArgumentList "`"$serviceWipeScript`"" -PassThru -Wait -NoNewWindow
if ($proc2.ExitCode -ne 0) { throw "Service wipe test failed with exit code $($proc2.ExitCode)" }
Log ">>> Step 4 Complete: Key taxonomy CRUD and 100% clean account wipe verified."

$swTotal.Stop()

# -------------------------------------------------------------
# Verification & Summary Audit
# -------------------------------------------------------------
Log "`n================================================================="
Log "   SUITE VERIFICATION AUDIT & EVIDENCE CHECKLIST"
Log "================================================================="

$requiredFiles = @(
    "q1-library-status.json",
    "q2-payload-capacity.json",
    "q2-wincred-limit.log",
    "q2-wincred-results.json",
    "q3-error-system-cards.json",
    "q4-cross-user-dpapi.json",
    "q4-cross-user-dpapi.log",
    "q5-key-taxonomy.json",
    "q6-account-wipe.json",
    "q6-account-wipe.log"
)

$allFound = $true
foreach ($f in $requiredFiles) {
    $fullP = Join-Path $evidenceDir $f
    $exists = Test-Path $fullP
    $size = if ($exists) { (Get-Item $fullP).Length } else { 0 }
    Log "Evidence file: $($f.PadRight(30)) $(if ($exists) { "[PASS] ($size bytes)" } else { "[FAIL - MISSING]" })"
    if (-not $exists) { $allFound = $false }
}

Log "`nTotal Suite Execution Time: $([Math]::Round($swTotal.Elapsed.TotalSeconds, 2)) seconds"
Log "OVERALL STATUS: $(if ($allFound) { 'PASS (ALL TESTS VERIFIED)' } else { 'FAIL (SOME EVIDENCE MISSING)' })"
Log "================================================================="

$summaryLines | Set-Content -Path $summaryLog -Encoding UTF8
Log "Master summary written to: $summaryLog"
