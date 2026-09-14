$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$testFile = Join-Path $srcDir "test-sp0-check.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

$expected = "[SP0-START]Windows11-Native: Tiếng Việt có dấu: Trăm năm trong cõi người ta, chữ tài chữ mệnh khéo là ghét nhau! Symbols: !@#$%^&*()_+~-={}|[]:;<>?,./ PADDING:01234567890123456789012345678901[SP0-END]"

# Clear tab state
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Start-Sleep -Seconds 1

$sw = [System.Diagnostics.Stopwatch]::StartNew()
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Text $expected -DelayBetweenKeysMs 10
$sw.Stop()

Start-Sleep -Milliseconds 800
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Key "Ctrl+S"
Start-Sleep -Seconds 1

Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$actual = [System.IO.File]::ReadAllText($testFile, [System.Text.Encoding]::UTF8).TrimStart("`r", "`n")
Write-Output "Duration: $($sw.ElapsedMilliseconds) ms"
Write-Output "Expected: $($expected.Length)"
Write-Output "Actual:   $($actual.Length)"
Write-Output "Match:    $($actual -ceq $expected)"
if ($actual -cne $expected) {
    Write-Output "Got: '$actual'"
}
Remove-Item $testFile -Force
