$ErrorActionPreference = 'Stop'
$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$helperDll = Join-Path $srcDir "NativeLivenessHelper.dll"

Add-Type -Path $helperDll

$notepad = & $launchScript -FilePath "notepad.exe" -WindowTitleMatch "Notepad" -ForceForeground -TimeoutSeconds 5
Start-Sleep -Seconds 1
$npHwnd = [IntPtr]$notepad.MainWindowHandle

# Bring foreground explicitly
[NativeLiveness.Helper]::SetWindowPos($npHwnd, [IntPtr]::Zero, 100, 100, 400, 300, 0x0040) | Out-Null
& $sendkeysScript -Text "Hello Caret Tracking World" -TargetWindow $npHwnd -DelayBetweenKeysMs 10 | Out-Null
Start-Sleep -Milliseconds 300

$caret = [NativeLiveness.Helper]::DetectCaretPosition()
Write-Output "Targeted Caret Detection: $caret"

Stop-Process -Id $notepad.ProcessId -Force -ErrorAction SilentlyContinue
