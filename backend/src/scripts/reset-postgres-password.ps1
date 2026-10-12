# Reset PostgreSQL Password Script
# Melakukan reset password user postgres lokal menjadi 'postgres'
$ErrorActionPreference = "Stop"

$hbaFile = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf"
$hbaBak = "C:\Program Files\PostgreSQL\18\data\pg_hba.conf.bak"
$psql = "C:\Program Files\PostgreSQL\18\bin\psql.exe"

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host " RESET PASSWORD POSTGRESQL (LOCAL DEV)" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan

try {
    # 1. Simpan backup konfigurasi jika belum ada
    if (!(Test-Path $hbaBak)) {
        Copy-Item $hbaFile $hbaBak
    }

    Write-Host "[1/5] Mengatur mode auth sementara ke 'trust'..." -ForegroundColor Yellow
    $content = Get-Content $hbaFile -Raw
    $trustContent = $content -replace "scram-sha-256", "trust"
    Set-Content $hbaFile $trustContent

    Write-Host "[2/5] Me-restart service PostgreSQL..." -ForegroundColor Yellow
    Restart-Service postgresql-x64-18

    Write-Host "[3/5] Mengubah password user postgres menjadi 'postgres'..." -ForegroundColor Yellow
    & $psql -U postgres -h 127.0.0.1 -d postgres -c "ALTER USER postgres WITH PASSWORD 'postgres';"

    Write-Host "[4/5] Mengembalikan keamanan autentikasi asli..." -ForegroundColor Yellow
    Copy-Item $hbaBak $hbaFile -Force

    Write-Host "[5/5] Me-restart kembali service PostgreSQL..." -ForegroundColor Yellow
    Restart-Service postgresql-x64-18

    Write-Host "`n✅ SUKSES! Password PostgreSQL kamu sekarang adalah: postgres" -ForegroundColor Green
    Write-Host "Username default: postgres" -ForegroundColor Green
    Write-Host "DATABASE_URL di backend/.env sudah cocok: postgresql://postgres:postgres@localhost:5432/meeting_room_display?schema=public`n" -ForegroundColor Green
} catch {
    Write-Host "`n❌ Terjadi kesalahan: $_" -ForegroundColor Red
    # Pastikan file asli dikembalikan jika error
    if (Test-Path $hbaBak) {
        Copy-Item $hbaBak $hbaFile -Force
    }
}

Write-Host "Tekan sembarang tombol untuk menutup..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")

