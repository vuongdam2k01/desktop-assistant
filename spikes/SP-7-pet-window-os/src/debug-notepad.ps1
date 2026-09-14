$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$screenshotScript = Join-Path $srcDir "screenshot.ps1"
$testFile = Join-Path $srcDir "test-debug.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Start-Sleep -Seconds 1

& $screenshotScript -OutputPath (Join-Path $srcDir "notepad-debug.png") -WindowHandle $procInfo.MainWindowHandle
Write-Output "Captured notepad-debug.png. hWnd=$($procInfo.MainWindowHandle)"
Stop-Process -Name notepad -Force -ErrorAction SilentlyContinue
