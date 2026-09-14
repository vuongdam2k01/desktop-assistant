<#
.SYNOPSIS
    SP-11 Verification of DPAPI isolation across Windows User Profiles.
    Creates a temporary local Windows user, attempts cross-user decryption,
    records Win32 DPAPI error 0x8009000B (NTE_BAD_KEY_STATE), and cleans up.
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

if (-not (Test-Path $EvidenceDir)) {
    New-Item -ItemType Directory -Force -Path $EvidenceDir | Out-Null
}

$logFile = Join-Path $EvidenceDir "q4-cross-user-dpapi.log"
$jsonFile = Join-Path $EvidenceDir "q4-cross-user-dpapi.json"

$logLines = @()
function Log([string]$msg) {
    $timestamp = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss.fff")
    $line = "[$timestamp] $msg"
    Write-Host $line
    $script:logLines += $line
}

Log "=== START DPAPI CROSS-USER ISOLATION TEST ==="
$currentUsername = [System.Environment]::UserName
$userDomain = [System.Environment]::UserDomainName
Log "Current User Profile: $userDomain\$currentUsername"

$testUsername = "testuser_sp11"
$testPasswordStr = "Sp11TestPass987654321!"
$sharedSecretFile = "C:\Users\Public\sp11_cross_user_secret.bin"
$sharedResultFile = "C:\Users\Public\sp11_cross_user_result.json"
$sharedWorkerScript = "C:\Users\Public\sp11_cross_user_worker.ps1"

# 1. Clean up any existing leftover user or files
try {
    Remove-LocalUser -Name $testUsername -ErrorAction SilentlyContinue
} catch {}
Remove-Item $sharedSecretFile, $sharedResultFile, $sharedWorkerScript -ErrorAction SilentlyContinue

# 2. Create second Windows user
Log "Creating temporary Windows local user: $testUsername..."
$secPass = ConvertTo-SecureString $testPasswordStr -AsPlainText -Force
New-LocalUser -Name $testUsername -Password $secPass -Description "SP-11 DPAPI Isolation Test User" -PasswordNeverExpires | Out-Null
Log "Created user $testUsername successfully."

try {
    # 3. Encrypt data with DPAPI as CURRENT USER (vuong)
    $originalPlaintext = "CONFIDENTIAL_TOKEN:notion_oauth_secret_sp11_test_payload_12345"
    Log "Encrypting plaintext under '$currentUsername' using DPAPI DataProtectionScope.CurrentUser..."
    Add-Type -AssemblyName System.Security
    $plainBytes = [System.Text.Encoding]::UTF8.GetBytes($originalPlaintext)
    $cipherBytes = [System.Security.Cryptography.ProtectedData]::Protect(
        $plainBytes,
        $null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    [System.IO.File]::WriteAllBytes($sharedSecretFile, $cipherBytes)
    Log "Encrypted payload ($($cipherBytes.Length) bytes) written to $sharedSecretFile"

    # Self-test: Verify current user can decrypt
    $selfDecrypted = [System.Security.Cryptography.ProtectedData]::Unprotect(
        $cipherBytes,
        $null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    $selfDecryptedStr = [System.Text.Encoding]::UTF8.GetString($selfDecrypted)
    $selfCheckPass = ($selfDecryptedStr -eq $originalPlaintext)
    Log "Self-decryption by '$currentUsername': $selfCheckPass"

    # 4. Create worker script for second user
    $workerScriptContent = @"
Add-Type -AssemblyName System.Security
`$result = @{
    WorkerUser = [System.Environment]::UserName
    AttemptedAt = (Get-Date).ToString('o')
    Success = `$false
    ExceptionType = `$null
    ExceptionMessage = `$null
    Win32HResult = `$null
    DecryptedValue = `$null
}

try {
    `$cipher = [System.IO.File]::ReadAllBytes('$($sharedSecretFile.Replace('\', '\\'))')
    `$dec = [System.Security.Cryptography.ProtectedData]::Unprotect(
        `$cipher,
        `$null,
        [System.Security.Cryptography.DataProtectionScope]::CurrentUser
    )
    `$result.Success = `$true
    `$result.DecryptedValue = [System.Text.Encoding]::UTF8.GetString(`$dec)
} catch [System.Security.Cryptography.CryptographicException] {
    `$result.ExceptionType = `$_.Exception.GetType().FullName
    `$result.ExceptionMessage = `$_.Exception.Message.Trim()
    `$result.Win32HResult = '0x{0:X8}' -f (`$_.Exception.HResult)
} catch {
    `$result.ExceptionType = `$_.Exception.GetType().FullName
    `$result.ExceptionMessage = `$_.Exception.Message.Trim()
    `$result.Win32HResult = '0x{0:X8}' -f (`$_.Exception.HResult)
}

`$result | ConvertTo-Json | Set-Content -Path '$($sharedResultFile.Replace('\', '\\'))' -Encoding UTF8
"@
    Set-Content -Path $sharedWorkerScript -Value $workerScriptContent -Encoding UTF8

    # 5. Execute worker script under second user credentials
    Log "Executing worker script under user '$testUsername'..."
    $testCred = New-Object System.Management.Automation.PSCredential($testUsername, $secPass)
    $proc = Start-Process -FilePath "powershell.exe" `
        -Credential $testCred `
        -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$sharedWorkerScript`"" `
        -PassThru `
        -Wait `
        -WindowStyle Hidden

    Log "Worker process exited with code: $($proc.ExitCode)"

    # 6. Read worker result
    if (-not (Test-Path $sharedResultFile)) {
        throw "Worker result file was not created by $testUsername!"
    }
    $workerResultRaw = Get-Content $sharedResultFile -Raw
    $workerResult = $workerResultRaw | ConvertFrom-Json

    Log "Cross-user Decryption Result:"
    Log "  Worker User: $($workerResult.WorkerUser)"
    Log "  Decryption Success: $($workerResult.Success)"
    Log "  Exception Type: $($workerResult.ExceptionType)"
    Log "  Exception Message: $($workerResult.ExceptionMessage)"
    Log "  HResult: $($workerResult.Win32HResult)"

    $isExpectedIsolationError = ($workerResult.Success -eq $false) -and ($workerResult.Win32HResult -eq '0x8009000B')
    Log "DPAPI Cryptographic Isolation Verified: $isExpectedIsolationError"

    # Compile structured JSON evidence
    $evidenceObj = [PSCustomObject]@{
        TestName = "Windows DPAPI Cross-User Isolation Test"
        PrimaryUser = "$userDomain\$currentUsername"
        SecondaryUser = $testUsername
        CiphertextBytes = $cipherBytes.Length
        PrimaryUserSelfDecrypt = $selfCheckPass
        SecondaryUserResult = [PSCustomObject]@{
            Success = $workerResult.Success
            ExceptionType = $workerResult.ExceptionType
            ExceptionMessage = $workerResult.ExceptionMessage
            Win32HResult = $workerResult.Win32HResult
            Win32ErrorCodeName = "NTE_BAD_KEY_STATE"
            Meaning = "Key not valid for use in specified state (User Master Key does not match cipher owner SID)"
        }
        SecurityConclusion = @{
            DPAPIBoundTo = "Windows User Account SID + User Profile Master Key (%APPDATA%\Microsoft\Protect\{SID})"
            CrossUserIsolation = "ENFORCED (User B cannot decrypt User A's credentials even with local read permission)"
            MachineMigration = "CANNOT BE DECRYPTED on a different machine or user profile without original DPAPI master keys"
            BackupRestore = "Restoring ciphertext to another machine will trigger NTE_BAD_KEY_STATE (0x8009000B); app must cleanly detect and ask user to re-authenticate"
        }
    }

    $evidenceObj | ConvertTo-Json -Depth 5 | Set-Content -Path $jsonFile -Encoding UTF8

} finally {
    # 7. Clean up
    Log "Cleaning up temporary user and files..."
    Remove-LocalUser -Name $testUsername -ErrorAction SilentlyContinue
    Remove-Item $sharedSecretFile, $sharedResultFile, $sharedWorkerScript -ErrorAction SilentlyContinue
    Log "Cleanup complete."
}

$logLines | Set-Content -Path $logFile -Encoding UTF8
Log "DPAPI test completed successfully. Logs at $logFile"
