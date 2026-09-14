<#
.SYNOPSIS
    Starts a GUI process on the interactive Windows desktop (WinSta0\Default),
    waits for its main window to appear, brings it to the foreground,
    and returns process information with window handle.
.PARAMETER FilePath
    Path to executable or command name (e.g. 'notepad.exe', 'node.exe', 'electron.exe').
.PARAMETER ArgumentList
    Optional arguments to pass to the process.
.PARAMETER WorkingDirectory
    Optional working directory.
.PARAMETER TimeoutSeconds
    Maximum time to wait for the main window (default 10s).
.PARAMETER ForceForeground
    If true, forces foreground activation via SetForegroundWindow.
.PARAMETER Desktop
    Target desktop. Default is 'WinSta0\Default'.
.PARAMETER WindowTitleMatch
    Optional title substring to match window.
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$FilePath,

    [Parameter(Position = 1)]
    [string[]]$ArgumentList = @(),

    [Parameter()]
    [string]$WorkingDirectory = $null,

    [Parameter()]
    [int]$TimeoutSeconds = 10,

    [Parameter()]
    [switch]$ForceForeground,

    [Parameter()]
    [string]$Desktop = 'WinSta0\Default',

    [Parameter()]
    [string]$WindowTitleMatch = ''
)

$ErrorActionPreference = 'Stop'

$win32LauncherCode = @"
using System;
using System.Runtime.InteropServices;
using System.Text;
using System.Threading;

public class NativeGuiLauncher {
    [DllImport("kernel32.dll", SetLastError = true, CharSet = CharSet.Auto)]
    public static extern bool CreateProcess(
        string lpApplicationName,
        string lpCommandLine,
        IntPtr lpProcessAttributes,
        IntPtr lpThreadAttributes,
        bool bInheritHandles,
        uint dwCreationFlags,
        IntPtr lpEnvironment,
        string lpCurrentDirectory,
        [In] ref STARTUPINFO lpStartupInfo,
        out PROCESS_INFORMATION lpProcessInformation);

    [DllImport("user32.dll")]
    public static extern IntPtr OpenInputDesktop(uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll")]
    public static extern IntPtr OpenDesktop(string lpszDesktop, uint dwFlags, bool fInherit, uint dwDesiredAccess);

    [DllImport("user32.dll", SetLastError = true)]
    public static extern bool CloseDesktop(IntPtr hDesktop);

    [DllImport("user32.dll")]
    public static extern bool EnumDesktopWindows(IntPtr hDesktop, EnumWindowsProc lpfn, IntPtr lParam);

    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);

    [DllImport("user32.dll")]
    public static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint lpdwProcessId);

    [DllImport("user32.dll")]
    public static extern bool IsWindowVisible(IntPtr hWnd);

    [DllImport("user32.dll", CharSet = CharSet.Auto)]
    public static extern int GetWindowText(IntPtr hWnd, StringBuilder lpString, int nMaxCount);

    [DllImport("user32.dll")]
    public static extern bool SetForegroundWindow(IntPtr hWnd);

    [DllImport("user32.dll")]
    public static extern bool ShowWindow(IntPtr hWnd, int nCmdShow);

    public const int SW_RESTORE = 9;
    public const uint DESKTOP_ALL = 0x01FF;

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    public struct STARTUPINFO {
        public int cb;
        public string lpReserved;
        public string lpDesktop;
        public string lpTitle;
        public int dwX;
        public int dwY;
        public int dwXSize;
        public int dwYSize;
        public int dwXCountChars;
        public int dwYCountChars;
        public int dwFillAttribute;
        public int dwFlags;
        public short wShowWindow;
        public short cbReserved2;
        public IntPtr lpReserved2;
        public IntPtr hStdInput;
        public IntPtr hStdOutput;
        public IntPtr hStdError;
    }

    [StructLayout(LayoutKind.Sequential)]
    public struct PROCESS_INFORMATION {
        public IntPtr hProcess;
        public IntPtr hThread;
        public uint dwProcessId;
        public uint dwThreadId;
    }

    public static uint StartProcessOnDesktop(string appName, string cmdLine, string workDir, string desktop) {
        STARTUPINFO si = new STARTUPINFO();
        si.cb = Marshal.SizeOf(si);
        si.lpDesktop = desktop;
        PROCESS_INFORMATION pi;

        string a = string.IsNullOrEmpty(appName) ? null : appName;
        string wd = string.IsNullOrEmpty(workDir) ? null : workDir;
        bool success = CreateProcess(a, cmdLine, IntPtr.Zero, IntPtr.Zero, false, 0, IntPtr.Zero, wd, ref si, out pi);
        if (!success) {
            throw new InvalidOperationException("CreateProcess failed with Win32 error: " + Marshal.GetLastWin32Error() + " for cmd: " + cmdLine);
        }
        return pi.dwProcessId;
    }

    public static IntPtr FindWindow(string desktopName, uint pid, string titleMatch, out string foundTitle) {
        IntPtr result = IntPtr.Zero;
        string t = "";

        Thread th = new Thread(() => {
            IntPtr hDesk = OpenDesktop(desktopName, 0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) hDesk = OpenInputDesktop(0, false, DESKTOP_ALL);
            if (hDesk == IntPtr.Zero) return;

            EnumDesktopWindows(hDesk, (hWnd, lParam) => {
                if (IsWindowVisible(hWnd)) {
                    uint wPid;
                    GetWindowThreadProcessId(hWnd, out wPid);
                    StringBuilder sb = new StringBuilder(512);
                    GetWindowText(hWnd, sb, 512);
                    string curTitle = sb.ToString();

                    bool match = false;
                    if (pid != 0 && wPid == pid) {
                        match = true;
                    } else if (!string.IsNullOrEmpty(titleMatch) && curTitle.IndexOf(titleMatch, StringComparison.OrdinalIgnoreCase) >= 0) {
                        match = true;
                    }

                    if (match && curTitle.Length > 0) {
                        result = hWnd;
                        t = curTitle;
                        return false; // Stop search
                    }
                }
                return true;
            }, IntPtr.Zero);

            CloseDesktop(hDesk);
        });

        th.SetApartmentState(ApartmentState.STA);
        th.Start();
        th.Join();

        foundTitle = t;
        return result;
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'NativeGuiLauncher').Type) {
    Add-Type -TypeDefinition $win32LauncherCode
}

$cmdStr = if ($FilePath -match '\s' -and -not ($FilePath.StartsWith('"') -and $FilePath.EndsWith('"'))) { "`"$FilePath`"" } else { $FilePath }
$fullCmd = $cmdStr
if ($ArgumentList -and $ArgumentList.Count -gt 0) {
    $fullCmd = "$cmdStr " + ($ArgumentList -join ' ')
}

Write-Verbose "Launching: $fullCmd on desktop: $Desktop"
$launchedPid = [NativeGuiLauncher]::StartProcessOnDesktop($null, $fullCmd, $WorkingDirectory, $Desktop)

# Wait for window
$sw = [System.Diagnostics.Stopwatch]::StartNew()
$hWnd = [IntPtr]::Zero
$windowTitle = ""
$timeoutMs = $TimeoutSeconds * 1000

$desktopShort = if ($Desktop -match '\\(.+)$') { $Matches[1] } else { $Desktop }

while ($sw.ElapsedMilliseconds -lt $timeoutMs) {
    Start-Sleep -Milliseconds 300
    
    $outTitle = ""
    $hWnd = [NativeGuiLauncher]::FindWindow($desktopShort, $launchedPid, $WindowTitleMatch, [ref]$outTitle)
    if ($hWnd -ne [IntPtr]::Zero) {
        $windowTitle = $outTitle
        break
    }
    # Fallback: check if process is a launcher stub that spawned a child with matching title
    if ($WindowTitleMatch) {
        $hWnd = [NativeGuiLauncher]::FindWindow($desktopShort, 0, $WindowTitleMatch, [ref]$outTitle)
        if ($hWnd -ne [IntPtr]::Zero) {
            $windowTitle = $outTitle
            break
        }
    }
}

if ($hWnd -ne [IntPtr]::Zero -and $ForceForeground) {
    [NativeGuiLauncher]::ShowWindow($hWnd, [NativeGuiLauncher]::SW_RESTORE) | Out-Null
    [NativeGuiLauncher]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 200
}

$proc = $null
try {
    $proc = [System.Diagnostics.Process]::GetProcessById($launchedPid)
} catch {}

return [PSCustomObject]@{
    Process          = $proc
    ProcessId        = $launchedPid
    MainWindowHandle = $hWnd
    WindowTitle      = $windowTitle
    ElapsedMs        = $sw.ElapsedMilliseconds
    Desktop          = $Desktop
}
