<#
.SYNOPSIS
    Comprehensive Survey of Native Build Toolchain on Windows for Q5
    (Node Windows, Visual Studio Build Tools, Python for better-sqlite3 rebuild).
#>
$ErrorActionPreference = 'Continue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$logFile = Join-Path $evidenceDir "q5-toolchain-survey.log"

$lines = [System.Collections.Generic.List[string]]::new()
function Log($msg) {
    Write-Output $msg
    $lines.Add($msg)
}

Log "=== SP-0 Q5: NATIVE BUILD TOOLCHAIN SURVEY (WINDOWS) ==="
Log "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
Log "OS Version: $([System.Environment]::OSVersion.VersionString)"
Log "OS Architecture: $(if ([System.Environment]::Is64BitOperatingSystem) { '64-bit' } else { '32-bit' })"
Log ""

# 1. Node.js & npm
Log "--- 1. Node.js & npm ---"
$nodeCmd = Get-Command node -ErrorAction SilentlyContinue
if ($nodeCmd) {
    Log "Node Path: $($nodeCmd.Source)"
    Log "Node Version: $(node -v)"
    Log "Node Platform: $(node -p "process.platform")"
    Log "Node Arch: $(node -p "process.arch")"
} else {
    Log "Node: NOT FOUND"
}

$npmCmd = Get-Command npm -ErrorAction SilentlyContinue
if ($npmCmd) {
    Log "npm Path: $($npmCmd.Source)"
    Log "npm Version: $(npm -v)"
} else {
    Log "npm: NOT FOUND"
}
Log ""

# 2. Python
Log "--- 2. Python ---"
$pythonFound = $false
$pyCmds = @('python.exe', 'py.exe', 'python3.exe')
foreach ($cmd in $pyCmds) {
    $c = Get-Command $cmd -ErrorAction SilentlyContinue
    if ($c) {
        $out = & $cmd --version 2>&1
        Log "Command '$cmd' found at: $($c.Source) -> Output: $out"
        if ($out -match 'Python \d+\.\d+') {
            $pythonFound = $true
        }
    }
}

# Check Registry for Python
$pyRegKeys = @(
    "HKCU:\Software\Python\PythonCore",
    "HKLM:\Software\Python\PythonCore",
    "HKLM:\Software\Wow6432Node\Python\PythonCore"
)
foreach ($reg in $pyRegKeys) {
    if (Test-Path $reg) {
        $sub = Get-ChildItem $reg -ErrorAction SilentlyContinue
        foreach ($s in $sub) {
            Log "Registry found Python: $($s.PSChildName) at $reg"
            $installPath = (Get-ItemProperty "$($s.PSPath)\InstallPath" -ErrorAction SilentlyContinue)."(default)"
            if ($installPath) {
                Log "  InstallPath: $installPath"
                $pythonFound = $true
            }
        }
    }
}
Log "Python Installed & Functional: $(if ($pythonFound) { 'YES' } else { 'NO (Only WindowsApps redirection stub or missing)' })"
Log ""

# 3. Visual Studio / C++ Build Tools / MSBuild
Log "--- 3. Visual Studio C++ Build Tools & MSBuild ---"
$vswherePath = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vsFound = $false
if (Test-Path $vswherePath) {
    Log "vswhere.exe found: $vswherePath"
    $vsInfo = & $vswherePath -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -format json | ConvertFrom-Json
    if ($vsInfo) {
        Log "VS Instance: $($vsInfo.displayName) ($($vsInfo.installationVersion))"
        Log "VS Install Path: $($vsInfo.installationPath)"
        $vsFound = $true
    } else {
        Log "vswhere: No Visual Studio installation found with C++ Build Tools component."
    }
} else {
    Log "vswhere.exe: NOT FOUND at default location."
}

$clCmd = Get-Command cl.exe -ErrorAction SilentlyContinue
Log "cl.exe (MSVC Compiler): $(if ($clCmd) { $clCmd.Source } else { 'NOT FOUND in PATH' })"

$msbuildCmd = Get-Command msbuild.exe -ErrorAction SilentlyContinue
Log "msbuild.exe: $(if ($msbuildCmd) { $msbuildCmd.Source } else { 'NOT FOUND in PATH' })"

Log "Visual Studio Build Tools Ready: $(if ($vsFound -or $clCmd) { 'YES' } else { 'NO' })"
Log ""

# 4. node-gyp
Log "--- 4. node-gyp ---"
$nodeGypVersion = npx --yes node-gyp --version 2>&1
Log "node-gyp version via npx: $nodeGypVersion"
Log ""

# 5. Conclusion for Q5
Log "--- 5. Conclusion for SP-12/Q1 Native Rebuild (better-sqlite3) ---"
$ready = ($nodeCmd -ne $null) -and $pythonFound -and ($vsFound -or $clCmd)
if ($ready) {
    Log "STATUS: READY - All required components are installed."
} else {
    Log "STATUS: NOT READY - Missing components:"
    if (-not $pythonFound) {
        Log "  [MISSING] Python: Install Python 3.11+ via winget (winget install Python.Python.3.11) or python.org"
    }
    if (-not ($vsFound -or $clCmd)) {
        Log "  [MISSING] Visual Studio Build Tools: Install via winget (winget install Microsoft.VisualStudio.2022.BuildTools --override `"--passive --add Microsoft.VisualStudio.Workload.VCTools --includeRecommended`")"
    }
}

[System.IO.File]::WriteAllLines($logFile, $lines, [System.Text.Encoding]::UTF8)
Log "Survey log saved to: $logFile"
