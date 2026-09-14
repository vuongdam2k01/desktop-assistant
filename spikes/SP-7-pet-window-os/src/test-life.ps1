$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
$testFile = Join-Path $srcDir "test-life.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

# Terminate any existing Notepad
Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Start-Sleep -Seconds 1

$part1 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0'
$part2 = '!@#$%^&*()_+~-={}|[]:;<>?,./1234567890ABC'
$part3 = 'Tram nam trong coi nguoi ta, chu tai chu menh kheo la ghet nhau. Trai qua mot cuoc be dau 200 ky tu.'
$testString200 = ($part1 + $part2 + $part3).Substring(0, 200)

$sw = [System.Diagnostics.Stopwatch]::StartNew()
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Text $testString200 -DelayBetweenKeysMs 10
$sw.Stop()

Start-Sleep -Milliseconds 800
& $sendkeysScript -TargetWindow $procInfo.MainWindowHandle -Key "Ctrl+S"
Start-Sleep -Seconds 1

Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$txt = [System.IO.File]::ReadAllText($testFile, [System.Text.Encoding]::UTF8).TrimStart("`r", "`n")
Write-Output "Result length: $($txt.Length)"
Write-Output "Match: $($txt -ceq $testString200)"
Write-Output "Actual content: '$txt'"
for ($k = 0; $k -lt [math]::Min($txt.Length, $testString200.Length); $k++) {
    if ($txt[$k] -cne $testString200[$k]) {
        Write-Output "First mismatch at index ${k}: Expected '$($testString200[$k])', Got '$($txt[$k])'"

        break
    }
}

