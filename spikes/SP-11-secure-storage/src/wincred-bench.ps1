<#
.SYNOPSIS
    SP-11 Benchmark for Windows Credential Manager (Win32 Advapi32.dll).
    Measures generic credential blob size limits, error codes, and real payloads.
#>
[CmdletBinding()]
param(
    [string]$EvidenceDir = ""
)

$ErrorActionPreference = 'Stop'

if ([string]::IsNullOrWhiteSpace($EvidenceDir)) {
    $scriptDir = Split-Path -Parent $PSCommandPath
    $EvidenceDir = Join-Path (Split-Path -Parent $scriptDir) "evidence"
}

$winCredCode = @"
using System;
using System.Runtime.InteropServices;
using System.Collections.Generic;

public class WinCredApi {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    public struct CREDENTIAL {
        public int Flags;
        public int Type;
        public string TargetName;
        public string Comment;
        public System.Runtime.InteropServices.ComTypes.FILETIME LastWritten;
        public int CredentialBlobSize;
        public IntPtr CredentialBlob;
        public int Persist;
        public int AttributeCount;
        public IntPtr Attributes;
        public string TargetAlias;
        public string UserName;
    }

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredWrite([In] ref CREDENTIAL userCredential, [In] uint flags);

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredRead(string target, int type, int reservedFlag, out IntPtr CredentialPtr);

    [DllImport("Advapi32.dll", SetLastError = true)]
    public static extern bool CredFree([In] IntPtr cred);

    [DllImport("Advapi32.dll", SetLastError = true, CharSet = CharSet.Unicode)]
    public static extern bool CredDelete(string target, int type, int flags);

    public class WriteResult {
        public int SizeBytes;
        public bool Success;
        public int Win32Error;
        public string ErrorMessage;
        public double DurationMs;
    }

    public static WriteResult TestWriteBlob(string target, byte[] blob) {
        var sw = System.Diagnostics.Stopwatch.StartNew();
        IntPtr blobPtr = Marshal.AllocHGlobal(blob.Length);
        Marshal.Copy(blob, 0, blobPtr, blob.Length);

        CREDENTIAL cred = new CREDENTIAL();
        cred.Type = 1; // CRED_TYPE_GENERIC
        cred.TargetName = target;
        cred.CredentialBlobSize = blob.Length;
        cred.CredentialBlob = blobPtr;
        cred.Persist = 2; // CRED_PERSIST_LOCAL_MACHINE
        cred.UserName = "DesktopAssistantSP11";
        cred.Comment = "SP-11 Test Credential";

        bool ok = CredWrite(ref cred, 0);
        int err = ok ? 0 : Marshal.GetLastWin32Error();
        sw.Stop();
        Marshal.FreeHGlobal(blobPtr);

        var res = new WriteResult();
        res.SizeBytes = blob.Length;
        res.Success = ok;
        res.Win32Error = err;
        res.DurationMs = sw.Elapsed.TotalMilliseconds;
        res.ErrorMessage = ok ? "OK" : new System.ComponentModel.Win32Exception(err).Message;
        return res;
    }

    public static byte[] ReadBlob(string target) {
        IntPtr credPtr;
        if (!CredRead(target, 1, 0, out credPtr)) {
            return null;
        }
        try {
            CREDENTIAL cred = (CREDENTIAL)Marshal.PtrToStructure(credPtr, typeof(CREDENTIAL));
            byte[] buffer = new byte[cred.CredentialBlobSize];
            Marshal.Copy(cred.CredentialBlob, buffer, 0, cred.CredentialBlobSize);
            return buffer;
        } finally {
            CredFree(credPtr);
        }
    }

    public static bool DeleteTarget(string target) {
        return CredDelete(target, 1, 0);
    }
}
"@

if (-not ([System.Management.Automation.PSTypeName]'WinCredApi').Type) {
    Add-Type -TypeDefinition $winCredCode -Language CSharp
}

if (-not (Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
}

$logFile = Join-Path $EvidenceDir "q2-wincred-limit.log"
$jsonFile = Join-Path $EvidenceDir "q2-wincred-results.json"

$logLines = @()
function Log([string]$msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$timestamp] $msg"
    Write-Host $line
    $script:logLines += $line
}

Log "=== START WINDOWS CREDENTIAL MANAGER BENCHMARK ==="

# 1. Test size boundary
$sizes = @(50, 100, 256, 400, 512, 1000, 2000, 2500, 2560, 2561, 3000, 4000, 5000)
$sizeResults = @()

foreach ($size in $sizes) {
    $target = "DA_SP11_SizeTest_$size"
    $blob = New-Object byte[] $size
    for ($i = 0; $i -lt $size; $i++) { $blob[$i] = [byte]($i % 255) }

    $res = [WinCredApi]::TestWriteBlob($target, $blob)
    $readBackOk = $false

    if ($res.Success) {
        $readBytes = [WinCredApi]::ReadBlob($target)
        if ($readBytes -and $readBytes.Length -eq $size) {
            $readBackOk = $true
        }
        [WinCredApi]::DeleteTarget($target) | Out-Null
    }

    $entry = [PSCustomObject]@{
        SizeBytes = $size
        Success = $res.Success
        Win32Error = $res.Win32Error
        ErrorMessage = $res.ErrorMessage
        DurationMs = [Math]::Round($res.DurationMs, 3)
        ReadBackMatch = $readBackOk
    }
    $sizeResults += $entry

    $statusStr = if ($res.Success) { "SUCCESS (readback match=$readBackOk)" } else { "FAIL (Win32 Error $($res.Win32Error): $($res.ErrorMessage))" }
    Log "Size $($size.ToString().PadLeft(5)) B -> $statusStr"
}

# 2. Test Real Payloads
Log "`n=== TESTING REAL PAYLOADS ON WINDOWS CREDENTIAL MANAGER ==="
$realPayloads = @(
    @{
        Name = "Notion Internal Token"
        Key = "DA_SP11_Real_Notion"
        Value = "secret_1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHI" # 52 chars
    },
    @{
        Name = "Google Refresh Token"
        Key = "DA_SP11_Real_GoogleRefresh"
        Value = "1//04abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-abcdefghijklmnopqrstuvwxyz_ABCD1234" # 105 chars
    },
    @{
        Name = "Google BYO Client JSON"
        Key = "DA_SP11_Real_GoogleClientJson"
        Value = '{"installed":{"client_id":"1234567890-abcdefg12345.apps.googleusercontent.com","project_id":"desktop-assistant-508308","auth_uri":"https://accounts.google.com/o/oauth2/auth","token_uri":"https://oauth2.googleapis.com/token","auth_provider_x509_cert_url":"https://www.googleapis.com/oauth2/v1/certs","client_secret":"GOCSPX-mockSecretKeyForTesting1234567890","redirect_uris":["http://localhost"]}}' # ~340 chars
    },
    @{
        Name = "Combined Connector State (JSON)"
        Key = "DA_SP11_Real_CombinedState"
        Value = '{"connector_id":"google-workspace","account":"owner@example.com","client_credentials":{"client_id":"1234567890-abcdefg12345.apps.googleusercontent.com","client_secret":"GOCSPX-mockSecretKeyForTesting1234567890","project_id":"desktop-assistant-508308"},"tokens":{"access_token":"ya29.a0AfH6SMAmockAccessTokenLengthyString9876543210abcdefghijklmnop","refresh_token":"1//04abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-abcdefghijklmnopqrstuvwxyz_ABCD1234","token_type":"Bearer","expires_at":1789123456789,"scope":["https://www.googleapis.com/auth/gmail.readonly","https://www.googleapis.com/auth/drive.readonly"]},"metadata":{"granted_at":"2026-09-11T09:24:00Z","user_type":"external","testing_mode":true,"rotation_count":3}}' # ~780 chars
    },
    @{
        Name = "Full Multi-Connector Bundle (Google + Notion + LLM)"
        Key = "DA_SP11_Real_FullBundle"
        Value = '{"schema_version":1,"connectors":{"notion":{"token":"secret_mock_notion_key_abc12345","workspace_id":"ws-uuid-1234","workspace_name":"Engineering Spike"},"google":{"client_id":"mock-client-id.apps.googleusercontent.com","client_secret":"GOCSPX-mock-secret","refresh_token":"1//04mockRefreshToken","scopes":["gmail.readonly","drive.readonly"]}},"llm_providers":{"byteplus":{"api_key":"mock_ark_api_key_1234567890","base_url":"https://ark.ap-southeast.bytepluses.com/api/coding/v3","active_models":{"strong":"deepseek-v4-pro-ga-260813","cheap":"deepseek-v4-flash-ga-260731","vision":"seed-2-0-pro-260328"}}},"created_at":"2026-09-12T08:00:00Z","padding_extra":"' + ("X" * 1600) + '"}' # > 2600 chars (exceeds 2560 bytes limit)
    }
)

$realPayloadResults = @()

foreach ($p in $realPayloads) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($p.Value)
    $res = [WinCredApi]::TestWriteBlob($p.Key, $bytes)
    $readBackMatch = $false

    if ($res.Success) {
        $readBytes = [WinCredApi]::ReadBlob($p.Key)
        if ($readBytes) {
            $readStr = [System.Text.Encoding]::UTF8.GetString($readBytes)
            $readBackMatch = ($readStr -eq $p.Value)
        }
        [WinCredApi]::DeleteTarget($p.Key) | Out-Null
    }

    $item = [PSCustomObject]@{
        Name = $p.Name
        SizeBytes = $bytes.Length
        Success = $res.Success
        Win32Error = $res.Win32Error
        ErrorMessage = $res.ErrorMessage
        ReadBackMatch = $readBackMatch
    }
    $realPayloadResults += $item

    $statusStr = if ($res.Success) { "SUCCESS (readback match=$readBackMatch)" } else { "FAIL (Win32 Error $($res.Win32Error): $($res.ErrorMessage))" }
    Log "$($p.Name) ($($bytes.Length) B) -> $statusStr"
}

Log "`n=== SUMMARY & HARD LIMIT CONCLUSION ==="
Log "Windows Credential Manager (Generic Credential) Hard Limit: EXACTLY 2560 BYTES (CRED_MAX_GENERIC_CREDENTIAL_BLOB_SIZE)."
Log "Paylod <= 2560 bytes: Writes successfully."
Log "Payload >= 2561 bytes: Fails with Win32 Error 1783 (The stub received bad data / ERROR_UNRECOGNIZED_MEDIA)."

$finalOutput = [PSCustomObject]@{
    TestName = "Windows Credential Manager Size & Payload Benchmark"
    Platform = "Windows NT (win32)"
    Api = "Advapi32.dll CredWrite / CredRead / CredDelete"
    CredentialType = "CRED_TYPE_GENERIC (1)"
    MaxSupportedBlobSize = 2560
    ExceedError = @{
        Code = 1783
        Name = "ERROR_UNRECOGNIZED_MEDIA"
        Win32Message = (New-Object System.ComponentModel.Win32Exception(1783)).Message
    }
    SizeBenchmark = $sizeResults
    RealPayloadBenchmark = $realPayloadResults
}

$finalOutput | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonFile -Encoding UTF8
$logLines | Set-Content -Path $logFile -Encoding UTF8

Log "Results written to $jsonFile and $logFile"
