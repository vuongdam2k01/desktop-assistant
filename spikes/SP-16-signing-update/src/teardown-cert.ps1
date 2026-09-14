# teardown-cert.ps1 - Gỡ certificate thử nghiệm khỏi Windows Trust Store
param (
    [string]$CertName = "Desktop Assistant (Spike SP-16 Code Signing)"
)

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certInfoFile = Join-Path (Split-Path -Parent $scriptDir) "certs\cert-info.json"

$thumbprint = $null
if (Test-Path $certInfoFile) {
    $info = Get-Content $certInfoFile | ConvertFrom-Json
    $thumbprint = $info.Thumbprint
}

Write-Host "=== GỠ CERTIFICATE THỬ NGHIỆM ===" -ForegroundColor Yellow

if ($thumbprint) {
    Write-Host "Thumbprint cần gỡ: $thumbprint"
    certutil -user -delstore Root $thumbprint 2>$null | Out-Null
    certutil -user -delstore TrustedPublisher $thumbprint 2>$null | Out-Null
    certutil -delstore Root $thumbprint 2>$null | Out-Null
    certutil -delstore TrustedPublisher $thumbprint 2>$null | Out-Null
    Remove-Item "Cert:\CurrentUser\My\$thumbprint" -Force -ErrorAction SilentlyContinue
    Write-Host "Đã gỡ certificate $thumbprint khỏi mọi store." -ForegroundColor Green
} else {
    Write-Host "Không tìm thấy cert-info.json. Tìm theo tên CN: $CertName"
    $certs = Get-ChildItem Cert:\CurrentUser\My | Where-Object { $_.Subject -like "*$CertName*" }
    foreach ($c in $certs) {
        $t = $c.Thumbprint
        certutil -user -delstore Root $t 2>$null | Out-Null
        certutil -user -delstore TrustedPublisher $t 2>$null | Out-Null
        certutil -delstore Root $t 2>$null | Out-Null
        certutil -delstore TrustedPublisher $t 2>$null | Out-Null
        Remove-Item "Cert:\CurrentUser\My\$t" -Force -ErrorAction SilentlyContinue
        Write-Host "Đã gỡ $t" -ForegroundColor Green
    }
}
