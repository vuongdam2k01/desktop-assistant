$srcDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$launchScript = Join-Path $srcDir "launch.ps1"
$testFile = Join-Path $srcDir "test-batch.txt"
[System.IO.File]::WriteAllText($testFile, "", [System.Text.Encoding]::UTF8)

# Start UniKey
Start-Process 'C:\Users\<user>\Downloads\unikey46RC2-230919-win64\UniKeyNT.exe' -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 500

$sendkeysScript = Join-Path $srcDir "sendkeys.ps1"
. $sendkeysScript -Text ""

$csharpBatch = @'
using System;
using System.Runtime.InteropServices;
using System.Threading;

public class BatchInputSender {
    [DllImport("user32.dll")]
    public static extern uint SendInput(uint nInputs, [MarshalAs(UnmanagedAs.LPArray), In] NativeInputSimulator.INPUT[] pInputs, int cbSize);

    [DllImport("ntdll.dll")]
    public static extern int NtSuspendProcess(IntPtr processHandle);

    [DllImport("ntdll.dll")]
    public static extern int NtResumeProcess(IntPtr processHandle);

    public static void SendAll(IntPtr targetHwnd, string text, IntPtr imeHandle) {
        try {
            IntPtr hDesk;
            NativeInputSimulator.AttachDesktopAndForeground(targetHwnd, out hDesk);

            int n = text.Length;
            NativeInputSimulator.INPUT[] inputs = new NativeInputSimulator.INPUT[n * 2];
            int cbSize = Marshal.SizeOf(typeof(NativeInputSimulator.INPUT));

            for (int i = 0; i < n; i++) {
                char c = text[i];
                inputs[i * 2] = new NativeInputSimulator.INPUT();
                inputs[i * 2].type = NativeInputSimulator.INPUT_KEYBOARD;
                inputs[i * 2].ki.wScan = (ushort)c;
                inputs[i * 2].ki.dwFlags = NativeInputSimulator.KEYEVENTF_UNICODE;

                inputs[i * 2 + 1] = new NativeInputSimulator.INPUT();
                inputs[i * 2 + 1].type = NativeInputSimulator.INPUT_KEYBOARD;
                inputs[i * 2 + 1].ki.wScan = (ushort)c;
                inputs[i * 2 + 1].ki.dwFlags = NativeInputSimulator.KEYEVENTF_UNICODE | NativeInputSimulator.KEYEVENTF_KEYUP;
            }

            SendInput((uint)(n * 2), inputs, cbSize);
            NativeInputSimulator.DetachDesktop(hDesk);
        }
    }
}
'@

if (-not ([System.Management.Automation.PSTypeName]'BatchInputSender').Type) {
    Add-Type -TypeDefinition $csharpBatch
}

# Clear tab state
Remove-Item "$env:LOCALAPPDATA\Packages\Microsoft.WindowsNotepad_8wekyb3d8bbwe\LocalState\TabState\*" -Force -Recurse -ErrorAction SilentlyContinue

$procInfo = & $launchScript -FilePath "notepad.exe" -ArgumentList @("`"$testFile`"") -WindowTitleMatch "Notepad" -ForceForeground
Start-Sleep -Seconds 1


$part1 = 'Aa1Bb2Cc3Dd4Ee5Ff6Gg7Hh8Ii9Jj0Kk1Ll2Mm3Nn4Oo5Pp6Qq7Rr8Ss9Tt0'
$part2 = '!@#$%^&*()_+~-={}|[]:;<>?,./1234567890ABC'
$part3 = 'Tram nam trong coi nguoi ta, chu tai chu menh kheo la ghet nhau. Trai qua mot cuoc be dau 200 ky tu.'
$testString200 = ($part1 + $part2 + $part3).Substring(0, 200)

$ime = Get-Process UniKeyNT -ErrorAction SilentlyContinue | Select-Object -First 1
$imeH = if ($ime) { $ime.Handle } else { [IntPtr]::Zero }

$sw = [System.Diagnostics.Stopwatch]::StartNew()
[BatchInputSender]::SendAll($procInfo.MainWindowHandle, $testString200, $imeH)
$sw.Stop()

Write-Output "Batch SendInput took: $($sw.ElapsedMilliseconds) ms"

Start-Sleep -Milliseconds 800
[NativeInputSimulator]::SendVkKey($procInfo.MainWindowHandle, [byte][char]'S', $true, $false, $false)
Start-Sleep -Seconds 1

Stop-Process -Name Notepad -Force -ErrorAction SilentlyContinue

$txt = [System.IO.File]::ReadAllText($testFile, [System.Text.Encoding]::UTF8).TrimStart("`r", "`n")
Write-Output "Result length: $($txt.Length)"
Write-Output "Match: $($txt -ceq $testString200)"
Remove-Item $testFile -Force
