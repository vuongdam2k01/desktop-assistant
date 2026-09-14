$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeys = Join-Path $srcDir "sendkeys.ps1"
$tempFile = Join-Path $srcDir "test-temp.txt"
[System.IO.File]::WriteAllText($tempFile, "", [System.Text.Encoding]::UTF8)

$proc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$tempFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground

$part1 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0'
$part2 = '!@#$%^&*()_+~-={}|[]:;<>?,./1234567890ABC'
$part3 = 'Tram nam trong coi nguoi ta, chu tai chu menh kheo la ghet nhau. Trai qua mot cuoc be dau 200 ky tu.'
$testString200 = ($part1 + $part2 + $part3).Substring(0, 200)

$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
& $sendkeys -TargetWindow $proc.MainWindowHandle -Text $testString200 -DelayBetweenKeysMs 5
$sw1.Stop()
Write-Output "Sendkeys 200 chars took: $($sw1.ElapsedMilliseconds) ms"

Stop-Process -Name notepad -Force
Remove-Item $tempFile -Force
