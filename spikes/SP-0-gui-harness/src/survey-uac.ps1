<#
.SYNOPSIS
    Comprehensive Survey of UAC requirements and Elevation boundaries for Q6.
#>
$ErrorActionPreference = 'Continue'

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$spikeRoot = Split-Path -Parent $scriptDir
$evidenceDir = Join-Path $spikeRoot "evidence"
$logFile = Join-Path $evidenceDir "q6-uac-survey.log"

$lines = [System.Collections.Generic.List[string]]::new()
function Log($msg) {
    Write-Output $msg
    $lines.Add($msg)
}

Log "=== SP-0 Q6: UAC & PRIVILEGE ELEVATION SURVEY (WINDOWS) ==="
Log "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss K')"
Log ""

# 1. Current Process Elevation Status
Log "--- 1. Current Session & Process Token Status ---"
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object System.Security.Principal.WindowsPrincipal($identity)
$isAdmin = $principal.IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)

Log "Current User: $($identity.Name)"
Log "User SID: $($identity.User.Value)"
Log "Is Elevated (Administrator): $isAdmin"

# Token Elevation Type Check
$elevationTypeCheck = @"
using System;
using System.Runtime.InteropServices;

public class UacTokenInspector {
    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool OpenProcessToken(IntPtr ProcessHandle, uint DesiredAccess, out IntPtr TokenHandle);

    [DllImport("advapi32.dll", SetLastError = true)]
    public static extern bool GetTokenInformation(IntPtr TokenHandle, int TokenInformationClass, IntPtr TokenInformation, uint TokenInformationLength, out uint ReturnLength);

    [DllImport("kernel32.dll", SetLastError = true)]
    public static extern bool CloseHandle(IntPtr hObject);

    public const int TokenElevationType = 18;

    public static string GetElevationType() {
        IntPtr hToken;
        if (!OpenProcessToken(System.Diagnostics.Process.GetCurrentProcess().Handle, 0x0008, out hToken)) {
            return "Error opening token";
        }
        try {
            int elevType = 0;
            uint retLen = 0;
            IntPtr pElev = Marshal.AllocHGlobal(4);
            if (GetTokenInformation(hToken, TokenElevationType, pElev, 4, out retLen)) {
                elevType = Marshal.ReadInt32(pElev);
                Marshal.FreeHGlobal(pElev);
                switch (elevType) {
                    case 1: return "TokenElevationTypeDefault (UAC disabled or standard user account without split token)";
                    case 2: return "TokenElevationTypeFull (Process is currently running elevated as Administrator)";
                    case 3: return "TokenElevationTypeLimited (Process is filtered standard token; Administrator elevation is available via UAC)";
                    default: return "Unknown (" + elevType + ")";
                }
            }
            Marshal.FreeHGlobal(pElev);
            return "Error querying TokenElevationType";
        } finally {
            CloseHandle(hToken);
        }
    }
}
"@

Add-Type -TypeDefinition $elevationTypeCheck -ErrorAction SilentlyContinue
$tokenElevDesc = [UacTokenInspector]::GetElevationType()
Log "Token Elevation Type: $tokenElevDesc"
Log ""

# 2. Windows UAC System Policies
Log "--- 2. Windows UAC System Policies (Registry) ---"
$uacRegPath = "HKLM:\SOFTWARE\Microsoft\Windows\CurrentVersion\Policies\System"
if (Test-Path $uacRegPath) {
    $enableLua = (Get-ItemProperty $uacRegPath -Name "EnableLUA" -ErrorAction SilentlyContinue).EnableLUA
    $promptAdmin = (Get-ItemProperty $uacRegPath -Name "ConsentPromptBehaviorAdmin" -ErrorAction SilentlyContinue).ConsentPromptBehaviorAdmin
    $promptUser = (Get-ItemProperty $uacRegPath -Name "ConsentPromptBehaviorUser" -ErrorAction SilentlyContinue).ConsentPromptBehaviorUser
    $secureDesktop = (Get-ItemProperty $uacRegPath -Name "PromptOnSecureDesktop" -ErrorAction SilentlyContinue).PromptOnSecureDesktop

    Log "EnableLUA (UAC Enabled): $(if ($enableLua -eq 1) { '1 (Enabled)' } else { "$enableLua (Disabled)" })"
    Log "ConsentPromptBehaviorAdmin: $promptAdmin (0=Elevate without prompting, 5=Prompt for consent on secure desktop)"
    Log "ConsentPromptBehaviorUser: $promptUser (0=Automatically deny, 1=Prompt for credentials on secure desktop, 3=Prompt for credentials)"
    Log "PromptOnSecureDesktop: $(if ($secureDesktop -eq 1) { '1 (Enabled - dims desktop and blocks SendInput/screenshots)' } else { "$secureDesktop (Disabled)" })"
} else {
    Log "UAC Registry key not readable from current non-elevated user context."
}
Log ""

# 3. Operations requiring UAC vs Non-UAC audit across Roadmap spikes
Log "--- 3. Audit of Operations: Requiring UAC vs Non-UAC ---"
Log ""
Log "[OPERATIONS REQUIRING ELEVATION (ADMINISTRATOR)]:"
Log "  1. Installing Visual Studio Build Tools / MSVC C++ compiler (for SP-12/Q1 better-sqlite3 rebuild)."
Log "  2. Machine-wide software installation (winget system installs, msi packages affecting %ProgramFiles%)."
Log "  3. Code signing root certificate installation into LocalMachine root store (SP-16)."
Log "  4. Firewall rule creation (netsh advfirewall) if external incoming port binding is required."
Log "  5. Low-level keyboard hook injection into elevated processes (UIPI blocks SendInput to elevated windows)."
Log ""
Log "[OPERATIONS NOT REQUIRING ELEVATION (STANDARD USER)]:"
Log "  1. All GUI automation within user session: launch GUI apps (Notepad, Electron), capture screenshot, SendInput, mouse move/click (SP-0, SP-3, SP-7)."
Log "  2. Transparent, frameless, always-on-top window rendering (SP-7)."
Log "  3. Local loopback HTTP server (http://localhost:port) for Google BYO OAuth redirect (SP-13)."
Log "  4. Windows Credential Manager storage and DPAPI (Data Protection API) for secure token storage (SP-11)."
Log "  5. Local SQLite file operations and in-memory ledger (SP-12)."
Log "  6. User-scope software installations (winget install ... --scope user)."
Log "  7. Python user install or portable/embeddable Python zip."
Log ""
Log "[CRITICAL CONCLUSION & STRATEGY FOR AGENT AUTOMATION]:"
Log "  - The Agent CANNOT click the Windows UAC consent prompt because UAC runs on the 'Consent.exe' isolated Secure Desktop (WinSta0\\Winlogon or isolated secure desktop), which explicitly isolates SendInput and screen capture for security."
Log "  - Therefore, for spikes that require machine-wide installations (SP-12/Q1 Build Tools, SP-16 root cert):"
Log "    THE USER MUST LAUNCH THE CLAUDE CODE / AGENT TERMINAL IN 'RUN AS ADMINISTRATOR' MODE PRIOR TO RUNNING THOSE SPIKES."
Log "  - For normal day-to-day spikes (SP-0, SP-3, SP-7, SP-11, SP-13), standard user privileges are 100% sufficient."

[System.IO.File]::WriteAllLines($logFile, $lines, [System.Text.Encoding]::UTF8)
Log ""
Log "UAC Survey written to: $logFile"
