$np = Start-Process notepad -PassThru
Start-Sleep -Seconds 1
$np.Refresh()
Write-Output "Notepad PID=$($np.Id), hWnd=$($np.MainWindowHandle)"
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$sendkeys = Join-Path $srcDir "sendkeys.ps1"
& $sendkeys -TargetWindow $np.MainWindowHandle -Text "Hello"
$sw.Stop()
Write-Output "Sendkeys with TargetWindow took: $($sw.ElapsedMilliseconds) ms"
Stop-Process -Id $np.Id -Force
