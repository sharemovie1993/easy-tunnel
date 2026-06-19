# Easy Tunnel — Windows Setup Wizard
# Jalankan sekali untuk setup awal
# Run di PowerShell sebagai Administrator

Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║        Easy Tunnel — Setup Wizard            ║" -ForegroundColor Cyan  
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$ProjectRoot = $PSScriptRoot

# 1. Cek Node.js
Write-Host "1. Mengecek Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version 2>&1
    Write-Host "   ✅ Node.js $nodeVersion sudah terinstall." -ForegroundColor Green
} catch {
    Write-Host "   ❌ Node.js tidak ditemukan. Silakan install dari https://nodejs.org" -ForegroundColor Red
    Write-Host "   Setelah install Node.js, jalankan script ini lagi." -ForegroundColor Red
    Start-Process "https://nodejs.org"
    exit 1
}

# 2. Cek WireGuard
Write-Host "2. Mengecek WireGuard..." -ForegroundColor Yellow
$wgPath = "C:\Program Files\WireGuard\wireguard.exe"
if (Test-Path $wgPath) {
    Write-Host "   ✅ WireGuard sudah terinstall." -ForegroundColor Green
} else {
    Write-Host "   ⚠️  WireGuard belum terinstall. Anda bisa install dari aplikasi setelah startup." -ForegroundColor Yellow
    Write-Host "      Atau download manual: https://download.wireguard.com/windows-client/wireguard-installer.exe" -ForegroundColor Yellow
}

# 3. Install dependencies backend
Write-Host "3. Menginstall dependencies backend..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\backend"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ npm install backend gagal" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ Backend dependencies OK" -ForegroundColor Green

# 4. Build backend TypeScript
Write-Host "4. Build backend TypeScript..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ TypeScript build gagal" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ Backend build OK" -ForegroundColor Green

# 5. Install dependencies frontend
Write-Host "5. Menginstall dependencies frontend..." -ForegroundColor Yellow
Set-Location "$ProjectRoot\frontend"
npm install --silent
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ npm install frontend gagal" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ Frontend dependencies OK" -ForegroundColor Green

# 6. Build frontend
Write-Host "6. Build frontend (React + Vite)..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) { Write-Host "   ❌ Frontend build gagal" -ForegroundColor Red; exit 1 }
Write-Host "   ✅ Frontend build OK" -ForegroundColor Green

# 7. Cek PM2
Set-Location $ProjectRoot
Write-Host "7. Mengecek PM2..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version 2>&1
    Write-Host "   ✅ PM2 $pm2Version sudah terinstall." -ForegroundColor Green
} catch {
    Write-Host "   ⏳ Menginstall PM2..." -ForegroundColor Yellow
    npm install -g pm2 --silent
    Write-Host "   ✅ PM2 berhasil diinstall." -ForegroundColor Green
}

# 8. Start dengan PM2
Write-Host "8. Menjalankan Easy Tunnel dengan PM2..." -ForegroundColor Yellow
pm2 delete easy-tunnel-backend 2>$null
pm2 start ecosystem.config.js
pm2 save
Write-Host "   ✅ Easy Tunnel berjalan di http://localhost:7080" -ForegroundColor Green

# 9. Buka browser
Write-Host ""
Write-Host "╔══════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║      🎉 Easy Tunnel Berhasil Dijalankan!     ║" -ForegroundColor Green
Write-Host "╚══════════════════════════════════════════════╝" -ForegroundColor Green
Write-Host ""
Write-Host "Membuka browser..." -ForegroundColor Cyan
Start-Sleep -Seconds 2
Start-Process "http://localhost:7080"
