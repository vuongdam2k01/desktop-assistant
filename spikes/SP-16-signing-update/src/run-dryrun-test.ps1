# run-dryrun-test.ps1 - Kich ban chay va kiem chung tu dong dry-run auto-update
$ErrorActionPreference = "Stop"

$spikeDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$evidenceDir = Join-Path (Split-Path -Parent $spikeDir) "evidence"
$buildsDir = Join-Path (Split-Path -Parent $spikeDir) "builds"
$installedExe = "$env:LOCALAPPDATA\Programs\sp16-desktop-assistant\DesktopAssistantSpike.exe"
$screenshotScript = "d:\projects\desktop-assistant\spikes\SP-0-gui-harness\src\screenshot.ps1"

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "  SP-16: BAT DAU KIEM CHUNG DRY-RUN AUTO-UPDATE (WINDOWS)  " -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# 1. Don dep tien trinh cu neu co
Write-Host "`n[Buoc 1] Don dep tien trinh DesktopAssistantSpike cu..." -ForegroundColor Yellow
Stop-Process -Name "DesktopAssistantSpike" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

# 2. Cai dat ban v1.0.0
$installerV100 = Join-Path $buildsDir "v1.0.0\DesktopAssistantSpike Setup 1.0.0.exe"
Write-Host "`n[Buoc 2] Cai dat phien ban v1.0.0 tu: $installerV100" -ForegroundColor Yellow
if (-not (Test-Path $installerV100)) {
    throw "Khong tim thay file installer v1.0.0 tai $installerV100"
}

# Chay installer o che do silent /S
$proc = Start-Process -FilePath $installerV100 -ArgumentList "/S" -PassThru
Wait-Process -Id $proc.Id -Timeout 45 -ErrorAction SilentlyContinue
Write-Host "Cai dat v1.0.0 hoan tat." -ForegroundColor Green

Start-Sleep -Seconds 2

# Kiem tra file exe da duoc cai dat
if (-not (Test-Path $installedExe)) {
    throw "Khong tim thay file exe sau khi cai dat: $installedExe"
}

$verInfo = (Get-Item $installedExe).VersionInfo
Write-Host "File thuc thi: $installedExe"
Write-Host "Phien ban file da cai dat ban dau: $($verInfo.ProductVersion)" -ForegroundColor Green

# 3. Khoi chay v1.0.0 neu chua chay
Write-Host "`n[Buoc 3] Kiem tra hoac khoi chay ung dung v1.0.0..." -ForegroundColor Yellow
$existingProcs = Get-Process -Name "DesktopAssistantSpike" -ErrorAction SilentlyContinue
if ($existingProcs) {
    $initialPid = $existingProcs[0].Id
    Write-Host "Ung dung v1.0.0 da duoc khoi chay tu dong sau khi cai dat voi PID: $initialPid" -ForegroundColor Green
} else {
    $appProc = Start-Process -FilePath $installedExe -PassThru
    $initialPid = $appProc.Id
    Write-Host "Ung dung v1.0.0 duoc khoi chay thu cong voi PID: $initialPid" -ForegroundColor Green
}

Start-Sleep -Seconds 3

# Chup man hinh v1.0.0 dang chay
$shotV100 = Join-Path $evidenceDir "screenshot-v1.0.0-running.png"
if (Test-Path $screenshotScript) {
    & $screenshotScript -OutputPath $shotV100 | Out-Null
    Write-Host "Da chup man hinh v1.0.0: $shotV100" -ForegroundColor Green
}

# 4. Cho auto-update tu dong phat hien, tai va cai dat v1.0.1
Write-Host "`n[Buoc 4] Theo doi qua trinh tu dong cap nhat len v1.0.1..." -ForegroundColor Yellow
Write-Host "Cho ung dung lien he HTTP server (8089), tai goi v1.0.1 va tu khoi dong lai..."

$maxWaitSeconds = 120
$elapsed = 0
$updated = $false
$newPid = $null

while ($elapsed -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 3
    $elapsed += 3

    # Kiem tra xem tien trinh cu con song khong
    $oldRunning = Get-Process -Id $initialPid -ErrorAction SilentlyContinue

    # Tim tien trinh DesktopAssistantSpike moi (neu co PID khac)
    $allProcs = Get-Process -Name "DesktopAssistantSpike" -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $initialPid }

    $currentVer = "unknown"
    if (Test-Path $installedExe) {
        try {
            $currentVer = (Get-Item $installedExe -ErrorAction SilentlyContinue).VersionInfo.ProductVersion
        } catch {
            $currentVer = "locking..."
        }
    }

    $oldStatus = if ($oldRunning) { "Running" } else { "Exited" }
    $newStatus = if ($allProcs) { ($allProcs.Id -join ", ") } else { "None" }

    Write-Host "[$elapsed s] Phien ban tren dia: $currentVer | Tien trinh cu PID $($initialPid): $oldStatus | Tien trinh moi: $newStatus"

    if ($currentVer -like "1.0.1*" -and $allProcs) {
        $updated = $true
        $newPid = $allProcs[0].Id
        break
    }
}

if (-not $updated) {
    Start-Sleep -Seconds 5
    if (Test-Path $installedExe) {
        $currentVer = (Get-Item $installedExe -ErrorAction SilentlyContinue).VersionInfo.ProductVersion
        $allProcs = Get-Process -Name "DesktopAssistantSpike" -ErrorAction SilentlyContinue
        if ($currentVer -like "1.0.1*") {
            $updated = $true
            if ($allProcs) { $newPid = $allProcs[0].Id }
        }
    }
}

Write-Host "`n[Buoc 5] DANH GIA KET QUA CAP NHAT:" -ForegroundColor Cyan
if ($updated) {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "  THANH CONG: UNG DUNG DA DUOC TU DONG CAP NHAT LEN v1.0.1!  " -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "Phien ban moi tren dia: $currentVer"
    Write-Host "Tien trinh moi PID: $newPid"

    Start-Sleep -Seconds 4
    # Chup man hinh v1.0.1
    $shotV101 = Join-Path $evidenceDir "screenshot-v1.0.1-updated.png"
    if (Test-Path $screenshotScript) {
        & $screenshotScript -OutputPath $shotV101 | Out-Null
        Write-Host "Da chup man hinh v1.0.1: $shotV101" -ForegroundColor Green
    }
} else {
    Write-Host "==========================================================" -ForegroundColor Red
    Write-Host "  THAT BAI: UNG DUNG CHUA HOAN TAT CAP NHAT SAU $maxWaitSeconds GIAY  " -ForegroundColor Red
    Write-Host "==========================================================" -ForegroundColor Red
}

# 6. Thu thap log
Write-Host "`n[Buoc 6] Thu thap file log..." -ForegroundColor Yellow
$appLogLocal = "$env:LOCALAPPDATA\Programs\sp16-desktop-assistant\evidence\updater-app.log"
$appLog = Join-Path $evidenceDir "updater-app.log"

if (Test-Path $appLogLocal) {
    Copy-Item $appLogLocal $appLog -Force
}
$serverLog = Join-Path $evidenceDir "server-requests.log"

if (Test-Path $appLog) {
    Write-Host "--- NOI DUNG APP LOG (CUOI) ---" -ForegroundColor Gray
    Get-Content $appLog -Tail 25
}

# Dung app thu nghiem
Stop-Process -Name "DesktopAssistantSpike" -Force -ErrorAction SilentlyContinue
Write-Host "`nHoan tat test dry-run SP-16." -ForegroundColor Cyan
