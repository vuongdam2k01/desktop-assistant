$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$tempFile = Join-Path $srcDir "test-temp-nosuspend.txt"
[System.IO.File]::WriteAllText($tempFile, "", [System.Text.Encoding]::UTF8)

$proc = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$tempFile`"") -WindowTitleMatch "Notepad" -TimeoutSeconds 10 -ForceForeground

$part1 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0'
$part2 = '!@#$%^&*()_+~-={}|[]:;<>?,./1234567890ABC'
$part3 = 'Tram nam trong coi nguoi ta, chu tai chu menh kheo la ghet nhau. Trai qua mot cuoc be dau 200 ky tu.'
$testString200 = ($part1 + $part2 + $part3).Substring(0, 200)

$sw1 = [System.Diagnostics.Stopwatch]::StartNew()
[NativeInputSimulator]::SendUnicodeString($proc.MainWindowHandle, $testString200, 5)
$sw1.Stop()
Write-Output "SendUnicodeString (without IME suspend) took: $($sw1.ElapsedMilliseconds) ms"

$procNotepad = Get-Process -Name notepad -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 200
[NativeInputSimulator]::SendVkKey($proc.MainWindowHandle, [NativeInputSimulator]::VK_CONTROL, $false, $false, $false)
# Save Ctrl+S
[NativeInputSimulator]::SendVkKey($proc.MainWindowHandle, [byte][char]'S', $true, $false, $false)
Start-Sleep -Milliseconds 300
Stop-Process -Name notepad -Force

$content = [System.IO.File]::ReadAllText($tempFile, [System.Text.Encoding]::UTF8).TrimEnd("`r`n")
Write-Output "Length: $($content.Length)"
Write-Output "Match: $($content -eq $testString200)"
Remove-Item $tempFile -Force
