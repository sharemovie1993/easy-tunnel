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
