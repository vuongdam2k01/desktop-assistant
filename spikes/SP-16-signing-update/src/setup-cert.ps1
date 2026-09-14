# setup-cert.ps1 - Tạo certificate tự ký và nạp vào Windows Trusted Store cho SP-16
param (
    [string]$CertName = "Desktop Assistant (Spike SP-16 Code Signing)",
    [string]$Password = "SpikeSP16Password123!"
)

$ErrorActionPreference = "Stop"

$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$certDir = Join-Path (Split-Path -Parent $scriptDir) "certs"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

$pfxPath = Join-Path $certDir "sp16-code-signing.pfx"
$cerPath = Join-Path $certDir "sp16-code-signing.cer"

Write-Host "=== 1. TẠO CERTIFICATE TỰ KÝ ===" -ForegroundColor Cyan

# Kiểm tra xem cert cũ có trong Store không, nếu có thì xóa trước
$oldCerts = Get-ChildItem "Cert:\CurrentUser\My" | Where-Object { $_.Subject -like "*$CertName*" }
foreach ($c in $oldCerts) {
    Write-Host "Xóa cert cũ trong CurrentUser\My: $($c.Thumbprint)"
    Remove-Item "Cert:\CurrentUser\My\$($c.Thumbprint)" -Force
}

# Tạo Code Signing Certificate mới
$cert = New-SelfSignedCertificate `
    -Type CodeSigningCert `
    -Subject "CN=$CertName" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -HashAlgorithm "SHA256" `
    -KeyLength 2048 `
    -KeyExportPolicy Exportable `
    -NotAfter (Get-Date).AddYears(1)

$thumbprint = $cert.Thumbprint
Write-Host "Đã tạo cert thành công: $thumbprint" -ForegroundColor Green

# Xuất PFX kèm private key
$securePwd = ConvertTo-SecureString -String $Password -Force -AsPlainText
Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePwd | Out-Null
Write-Host "Đã xuất PFX: $pfxPath" -ForegroundColor Green

# Xuất CER công khai
Export-Certificate -Cert $cert -FilePath $cerPath | Out-Null
Write-Host "Đã xuất CER: $cerPath" -ForegroundColor Green

Write-Host "`n=== 2. NẠP CERTIFICATE VÀO WINDOWS TRUST STORE ===" -ForegroundColor Cyan

# Nạp vào LocalMachine Root và TrustedPublisher (không bị chặn bởi modal dialog)
certutil -addstore -f Root $cerPath
certutil -addstore -f TrustedPublisher $cerPath
certutil -user -addstore -f TrustedPublisher $cerPath
Write-Host "Đã nạp thành công vào LocalMachine Root, LocalMachine TrustedPublisher, và CurrentUser TrustedPublisher" -ForegroundColor Green

# Lưu thông tin thumbprint ra file info
$info = @{
    Thumbprint = $thumbprint
    Subject = $cert.Subject
    PfxPath = $pfxPath
    CerPath = $cerPath
    Password = $Password
    CreatedAt = (Get-Date).ToString("yyyy-MM-dd HH:mm:ss")
}
$info | ConvertTo-Json | Set-Content (Join-Path $certDir "cert-info.json")

Write-Host "`n=== HOÀN TẤT THIẾT LẬP CERTIFICATE ===" -ForegroundColor Cyan
Write-Host "Thumbprint: $thumbprint"
