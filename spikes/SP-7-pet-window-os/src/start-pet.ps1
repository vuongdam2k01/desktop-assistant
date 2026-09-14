<#
.SYNOPSIS
    Starts the SP-7 Pet Window Electron application and waits for the HTTP control server.
#>
param(
    [switch]$Background
)

$ErrorActionPreference = 'Stop'
$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $srcDir "electron-pet"
$launchScript = Join-Path $srcDir "launch.ps1"

# Locate electron.exe
$electronExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $electronExe) {
    throw "electron.exe not found in npm-cache"
}

Write-Output "Found electron.exe: $electronExe"
Write-Output "Launching SP-7 Pet Electron App: $appDir"

$proc = & $launchScript -FilePath $electronExe -ArgumentList @("`"$appDir`"") -WindowTitleMatch "SP7-Pet-Window" -TimeoutSeconds 15
Write-Output "Launched process PID=$($proc.ProcessId), hWnd=$($proc.MainWindowHandle)"

# Wait for HTTP server
$maxTries = 30
$ready = $false
for ($i = 0; $i -lt $maxTries; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:18923/health" -TimeoutSec 1 -ErrorAction Stop
        if ($res.status -eq 'ok') {
            $ready = $true
            Write-Output "HTTP Control Server is READY on port 18923 (PID: $($res.pid))."
            break
        }
    } catch {
        Start-Sleep -Milliseconds 250
    }
}

if (-not $ready) {
    throw "HTTP Control Server failed to respond within timeout."
}

return $proc
