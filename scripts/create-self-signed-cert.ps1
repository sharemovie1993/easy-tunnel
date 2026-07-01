# Script to create a self-signed Code Signing Certificate for local Electron-Builder packaging tests

# Pastikan folder build ada
$buildFolder = Join-Path -Path $PSScriptRoot -ChildPath "../build"
if (!(Test-Path -Path $buildFolder)) {
    New-Item -ItemType Directory -Path $buildFolder | Out-Null
}

$pfxPath = Join-Path -Path $buildFolder -ChildPath "certificate.pfx"

Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host "  Pembuatan Sertifikat Mandiri (Self-Signed) Easy Tunnel  " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Yellow
Write-Host ""

$certPassword = Read-Host -Prompt "Masukkan password untuk mengamankan file PFX"
if ([string]::IsNullOrWhiteSpace($certPassword)) {
    Write-Host "Password tidak boleh kosong!" -ForegroundColor Red
    exit 1
}

$securePassword = ConvertTo-SecureString $certPassword -AsPlainText -Force

# 1. Membuat sertifikat self-signed di store local
Write-Host "`n[1/2] Membuat sertifikat code signing di Windows store..." -ForegroundColor Cyan
try {
    $cert = New-SelfSignedCertificate -Type CodeSigningCert -Subject "CN=Easy Tunnel Development, O=Easy Tunnel, C=ID" -KeyUsage DigitalSignature -FriendlyName "Easy Tunnel Self-Signed Code Signing" -CertStoreLocation "Cert:\CurrentUser\My" -NotAfter (Get-Date).AddYears(1)
    Write-Host "Sertifikat berhasil dibuat di Personal store." -ForegroundColor Green
} catch {
    Write-Host "Gagal membuat sertifikat: $_" -ForegroundColor Red
    exit 1
}

# 2. Mengekspor sertifikat ke build/certificate.pfx
Write-Host "`n[2/2] Mengekspor sertifikat ke file PFX: $pfxPath" -ForegroundColor Cyan
try {
    Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $securePassword | Out-Null
    Write-Host "File PFX berhasil diekspor ke: build/certificate.pfx" -ForegroundColor Green
} catch {
    Write-Host "Gagal mengekspor file PFX: $_" -ForegroundColor Red
    exit 1
}

# 3. Instruksi untuk melakukan import agar tepercaya secara lokal
Write-Host "`n==========================================================" -ForegroundColor Green
Write-Host "BERHASIL DIKONFIGURASI!" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Langkah agar Windows lokal Anda mempercayai sertifikat ini (menghilangkan warning UAC 'Unknown Publisher' saat test install):" -ForegroundColor Cyan
Write-Host "1. Buka folder 'build/' dan klik ganda file 'certificate.pfx'."
Write-Host "2. Pilih Store Location: 'Local Machine' -> Klik Next."
Write-Host "3. Konfirmasi UAC prompt -> Klik Next lagi."
Write-Host "4. Masukkan password yang baru saja Anda ketik tadi -> Klik Next."
Write-Host "5. Pilih opsi: 'Place all certificates in the following store'."
Write-Host "6. Klik 'Browse...' dan pilih 'Trusted Root Certification Authorities'."
Write-Host "7. Klik OK -> Next -> Finish."
Write-Host ""
Write-Host "Terakhir, isi 'PASSWORD_SERTIFIKAT_ANDA' di file package.json pada bagian 'certificatePassword' dengan password yang Anda buat." -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Green
