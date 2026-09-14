$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$testFile = Join-Path $srcDir "test-clear.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

# Make sure UniKey is stopped
Stop-Process -Name 'UniKeyNT', 'EVKey64', 'EVKey32', 'OpenKey' -Force -ErrorAction SilentlyContinue

$notepadProc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground
Start-Sleep -Seconds 1

for ($i = 1; $i -le 3; $i++) {
    Write-Output "--- Loop $i ---"
    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Key "Ctrl+A"
    Start-Sleep -Milliseconds 100
    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Key "Delete"
    Start-Sleep -Milliseconds 100

    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Text "Loop-$i-1234567890ABCDEF" -DelayBetweenKeysMs 5
    $sw.Stop()

    & $sendkeysScript -TargetWindow $notepadProc.MainWindowHandle -Key "Ctrl+S"
    Start-Sleep -Milliseconds 200

    $txt = [System.IO.File]::ReadAllText($testFile, [System.Text.Encoding]::UTF8).TrimEnd("`r`n")
    Write-Output "Loop $i Content: '$txt' (Length: $($txt.Length), Took: $($sw.ElapsedMilliseconds)ms)"
}

Stop-Process -Name notepad -Force
Remove-Item $testFile -Force
