const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// Set environment variables for production
process.env.NODE_ENV = 'production';
process.env.PORT = '7080';
process.env.FRONTEND_DIST = path.join(__dirname, 'frontend/dist');

try {
  const config = require('./config.json');
  if (config.LICENSE_SERVER_URL) {
    process.env.LICENSE_SERVER_URL = config.LICENSE_SERVER_URL;
  }
} catch (e) {
  // Ignore
}

// Setup file logging to AppData
const logDir = app.getPath('userData');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}
const logFile = path.join(logDir, 'app.log');
const logStream = fs.createWriteStream(logFile, { flags: 'a' });

function log(message, ...args) {
  const time = new Date().toISOString();
  const formatted = `[${time}] ${message} ${args.join(' ')}\n`;
  logStream.write(formatted);
  // Keep original process stdout/stderr clean if run from CLI
}

// Redirect console logs to file
console.log = (...args) => log('INFO:', ...args);
console.error = (...args) => log('ERROR:', ...args);

console.log('--- Aplikasi Dimulai ---');
console.log('User Data Path:', logDir);

// Catch unhandled exceptions and rejections
process.on('uncaughtException', (err) => {
  console.error('FATAL UNCAUGHT EXCEPTION:', err.stack || err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('FATAL UNHANDLED REJECTION at:', promise, 'reason:', reason);
});

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1080,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    title: 'Easy Tunnel Gateway Manager',
    icon: path.join(__dirname, 'frontend/dist/favicon.ico'),
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  const url = 'http://localhost:7080';
  let retries = 15;

  function loadURLWithRetry() {
    console.log(`Memuat URL: ${url}`);
    mainWindow.loadURL(url).catch((err) => {
      console.error(`Gagal memuat URL ${url}:`, err.message);
      if (retries > 0) {
        retries--;
        console.log(`Mencoba kembali memuat URL dalam 1 detik... (${retries} sisa percobaan)`);
        setTimeout(loadURLWithRetry, 1000);
      } else {
        console.error(`Gagal memuat URL setelah beberapa kali percobaan.`);
        mainWindow.loadURL(`data:text/html,<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; background-color:#1e1e2e; color:#cdd6f4; text-align:center; padding-top:20%;">
          <h2 style="color:#f38ba8;">Gagal Menghubungkan ke Server Lokal</h2>
          <p>Database atau backend server gagal dimulai atau memakan waktu terlalu lama.</p>
          <p style="font-size:12px; color:#a6adc8;">Silakan periksa log aplikasi di:<br><code>${logFile}</code></p>
        </body></html>`);
      }
    });
  }

  loadURLWithRetry();

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

const { execSync } = require('child_process');

// Bersihkan sisa-sisa task lama (migrasi arsitektur) dan bebaskan port 7080
try {
  console.log('Membersihkan sisa background task versi lama...');
  execSync('schtasks /End /TN "EasyTunnelBackend"', { stdio: 'ignore', windowsHide: true });
  execSync('schtasks /Delete /TN "EasyTunnelBackend" /F', { stdio: 'ignore', windowsHide: true });
  
  // Bunuh proses apa pun yang nyangkut di port 7080
  execSync('powershell -Command "Stop-Process -Id (Get-NetTCPConnection -LocalPort 7080).OwningProcess -Force"', { stdio: 'ignore', windowsHide: true });
} catch (err) {
  // Abaikan error (artinya sudah bersih)
}

// Jalankan Express server backend di dalam proses utama Electron
try {
  console.log('Memulai Express server lokal di backend...');
  require('./backend/dist/server.js');
} catch (err) {
  console.error('Gagal memuat/menjalankan backend server:', err.stack || err);
}

app.whenReady().then(() => {
  // Berikan waktu 1 detik agar database siap
  setTimeout(createWindow, 1000);

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

