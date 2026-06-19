const { app, BrowserWindow } = require('electron');
const path = require('path');

// Set environment variables for production
process.env.NODE_ENV = 'production';
process.env.PORT = '7080';

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

  // Muat URL backend lokal yang melayani static React frontend
  mainWindow.loadURL('http://localhost:7080');

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Jalankan Express server backend di dalam proses utama Electron
try {
  console.log('[Electron] Memulai Express server lokal di latar belakang...');
  require('./backend/dist/server.js');
} catch (err) {
  console.error('[Electron] Gagal memulai backend lokal:', err);
}

app.whenReady().then(() => {
  // Berikan waktu 1.5 detik agar database siap dan Express mendengarkan port 7080
  setTimeout(createWindow, 1500);

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
