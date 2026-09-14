[CmdletBinding()]
param(
    [int]$Port = 3838,
    [int]$TimeoutSeconds = 15
)

$ErrorActionPreference = 'Stop'

$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $srcDir "..\electron-rive"
$appDir = (Resolve-Path $appDir).Path
$launchScript = Join-Path $srcDir "launch.ps1"

# Check if already running
try {
    $res = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ping" -TimeoutSec 1 -ErrorAction SilentlyContinue
    if ($res.status -eq 'ok') {
        Write-Host "SP-3 Pet App is already running (PID: $($res.pid))."
        return $res
    }
} catch {}

$electronExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $electronExe) {
    throw "electron.exe not found in npm-cache"
}

Write-Host "Starting Electron Rive app on port $Port using launch.ps1 on WinSta0\Default..."
$env:PET_PORT = "$Port"
$proc = & $launchScript -FilePath $electronExe -ArgumentList @("`"$appDir`"") -WindowTitleMatch "SP3" -TimeoutSeconds $TimeoutSeconds
Write-Host "Launched process PID=$($proc.ProcessId), hWnd=$($proc.MainWindowHandle)"

# Wait for HTTP server
$deadline = (Get-Date).AddSeconds($TimeoutSeconds)
while ((Get-Date) -lt $deadline) {
    Start-Sleep -Milliseconds 250
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/ping" -TimeoutSec 1 -ErrorAction SilentlyContinue
        if ($res.status -eq 'ok') {
            Write-Host "SP-3 Pet App started successfully (PID: $($proc.ProcessId), HTTP PID: $($res.pid))"
            return $res
        }
    } catch {}
}

throw "Timed out waiting for SP-3 Pet App HTTP server on port $Port."
