param(
    [string]$Mode = 'arch-a'
)

$ErrorActionPreference = 'Stop'
[System.Net.WebRequest]::DefaultWebProxy = $null
$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$appDir = Join-Path $srcDir "electron-liveness"
$launchScript = Join-Path $srcDir "launch.ps1"

$electronExe = (Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1).FullName
if (-not $electronExe) {
    throw "electron.exe not found in npm-cache"
}

Write-Output "Found electron: $electronExe"
Write-Output "Launching SP-18 Liveness App in mode $Mode..."

$argsList = @("`"$appDir`"", "--mode=$Mode")
$titleMatch = if ($Mode -eq 'arch-b') { "SP18-Pet-ArchB" } else { "SP18-Pet-ArchA" }

$proc = & $launchScript -FilePath $electronExe -ArgumentList $argsList -WindowTitleMatch $titleMatch -TimeoutSeconds 15
Write-Output "Launched process PID=$($proc.ProcessId), hWnd=$($proc.MainWindowHandle)"

# Wait for HTTP server
$maxTries = 30
$ready = $false
for ($i = 0; $i -lt $maxTries; $i++) {
    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:18928/health" -TimeoutSec 1 -ErrorAction Stop
        if ($res.status -eq 'ok') {
            $ready = $true
            Write-Output "HTTP Server READY on port 18928 (PID: $($res.pid), Mode: $($res.mode))."
            break
        }
    } catch {
        Start-Sleep -Milliseconds 250
    }
}

if (-not $ready) {
    throw "HTTP Server failed to respond on port 18928"
}

return $proc
