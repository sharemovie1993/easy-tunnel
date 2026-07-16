const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { execSync } = require('child_process');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n=========================================');
console.log('   EASY TUNNEL - BUILD KONFIGURASI');
console.log('=========================================\n');

rl.question('Masukkan URL Server Lisensi (Kosongkan untuk default https://api.absenta.id): ', (answer) => {
  const serverUrl = answer.trim() || 'https://api.absenta.id';
  
  // Tulis ke config.json
  const configObj = {
    LICENSE_SERVER_URL: serverUrl
  };
  
  fs.writeFileSync(path.join(__dirname, '../config.json'), JSON.stringify(configObj, null, 2));
  
  console.log(`\n[+] Server URL berhasil diatur ke: ${serverUrl}`);
  
  // Lakukan pembersihan proses yang berpotensi mengunci file dist sebelum build dimulai
  console.log('[+] Membersihkan sisa-sisa proses build sebelumnya...');
  try {
    // Jalankan taskkill untuk mematikan proses secara senyap
    execSync('taskkill /F /IM "Easy Tunnel.exe" /T 2>nul || ver >nul', { shell: 'cmd.exe' });
    execSync('taskkill /F /IM signtool.exe /T 2>nul || ver >nul', { shell: 'cmd.exe' });
    execSync('taskkill /F /IM makensis.exe /T 2>nul || ver >nul', { shell: 'cmd.exe' });
    
    // Hapus folder dist secara paksa jika ada
    const distPath = path.join(__dirname, '../dist');
    if (fs.existsSync(distPath)) {
      fs.rmSync(distPath, { recursive: true, force: true });
    }
    console.log('[+] Pembersihan sukses.');
  } catch (cleanErr) {
    console.log('[!] Peringatan pembersihan:', cleanErr.message);
  }

  console.log('[+] Memulai proses build aplikasi (Tunggu beberapa menit)...\n');
  rl.close();
  
  try {
    execSync('npm run build-all && npm run rebuild-native && electron-builder --windows', {
      stdio: 'inherit',
      cwd: path.join(__dirname, '..')
    });
    console.log('\n[+] Build selesai! Aplikasi exe berada di folder "dist/"');
  } catch (err) {
    console.error('\n[-] Build gagal:', err.message);
    process.exit(1);
  }
});
