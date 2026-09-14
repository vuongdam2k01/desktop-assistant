$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$testFile = Join-Path $srcDir "test-delay-check.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

# Clear TabState
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Start-Sleep -Seconds 1

$part1 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0'
$part2 = '!@#$%^&*()_+~-={}|[]:;<>?,./1234567890ABC'
$part3 = 'Tram nam trong coi nguoi ta, chu tai chu menh kheo la ghet nhau. Trai qua mot cuoc be dau 200 ky tu.'
$testString200 = ($part1 + $part2 + $part3).Substring(0, 200)

$sw = [System.Diagnostics.Stopwatch]::StartNew()
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Text $testString200 -DelayBetweenKeysMs 25
$sw.Stop()

Start-Sleep -Seconds 1
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Key "Ctrl+S"
Start-Sleep -Seconds 1

Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue

$actual = [System.IO.File]::ReadAllText($testFile, [System.Text.Encoding]::UTF8).TrimStart("`r", "`n")
Write-Output "Duration: $($sw.ElapsedMilliseconds) ms"
Write-Output "Expected: $($testString200.Length)"
Write-Output "Actual:   $($actual.Length)"
Write-Output "Match:    $($actual -ceq $testString200)"
if ($actual -cne $testString200) {
    Write-Output "Got: '$actual'"
}
Remove-Item $testFile -Force
