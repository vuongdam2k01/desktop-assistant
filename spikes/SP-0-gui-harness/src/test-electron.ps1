<#
.SYNOPSIS
    Launches the minimal Electron app (transparent, frameless, always-on-top),
    captures its screenshot, and closes it.
#>
$ErrorActionPreference = 'Stop'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$screenshotPath = Join-Path $evidenceDir "q2-electron-screenshot.png"
$electronAppDir = Join-Path $scriptDir "electron-minimal"

Write-Output "=== Launching Minimal Electron Window ==="
$launchScript = Join-Path $scriptDir "launch.ps1"
$screenshotScript = Join-Path $scriptDir "screenshot.ps1"

# Locate direct electron.exe
$electronItem = Get-ChildItem -Path "$env:LOCALAPPDATA\npm-cache\_npx" -Filter 'electron.exe' -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
if ($electronItem) {
    $electronExe = $electronItem.FullName
} else {
    $electronExe = "npx.cmd"
}

Write-Output "Using Electron binary: $electronExe"
if ($electronExe.EndsWith("electron.exe")) {
    $proc = & $launchScript -FilePath $electronExe -ArgumentList @("`"$electronAppDir`"") -WindowTitleMatch "SP-0-Electron-Minimal" -TimeoutSeconds 15 -ForceForeground
} else {
    $proc = & $launchScript -FilePath "cmd.exe" -ArgumentList @("/c", "`"`"$electronExe`" electron `"$electronAppDir`"`"") -WindowTitleMatch "SP-0-Electron-Minimal" -TimeoutSeconds 15 -ForceForeground
}
Write-Output "Electron launch returned: PID=$($proc.ProcessId), hWnd=$($proc.MainWindowHandle), Title='$($proc.WindowTitle)'"

Start-Sleep -Seconds 3

Write-Output "Capturing screenshot of Electron window..."
if ($proc.MainWindowHandle -ne [IntPtr]::Zero) {
    $shot = & $screenshotScript -OutputPath $screenshotPath -WindowHandle $proc.MainWindowHandle
} else {
    $shot = & $screenshotScript -OutputPath $screenshotPath
}
Write-Output "Electron screenshot captured: $($shot.Path) ($($shot.Width)x$($shot.Height), $($shot.SizeBytes) bytes)"

Start-Sleep -Seconds 1
Write-Output "Terminating Electron process..."
Stop-Process -Name electron -Force -ErrorAction SilentlyContinue
Stop-Process -Id $proc.ProcessId -Force -ErrorAction SilentlyContinue
Write-Output "Done."
