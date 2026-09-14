$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeys = Join-Path $srcDir "sendkeys.ps1"
$tempFile = Join-Path $srcDir "test-temp.txt"
[System.IO.File]::WriteAllText($tempFile, "", [System.Text.Encoding]::UTF8)

$sw0 = [System.Diagnostics.Stopwatch]::StartNew()
$proc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$tempFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
$sw0.Stop()
Write-Output "Launch took: $($sw0.ElapsedMilliseconds) ms, hWnd=$($proc.MainWindowHandle)"

$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
& $sendkeys -TargetWindow $proc.MainWindowHandle -Text "Testing 123"
$sw1.Stop()
Write-Output "Sendkeys took: $($sw1.ElapsedMilliseconds) ms"

Stop-Process -Name notepad -Force
Remove-Item $tempFile -Force
