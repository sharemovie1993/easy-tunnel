import { execSync, exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

let TUNNELS_DIR = path.join(__dirname, '../../tunnels');

try {
  if (process.versions && process.versions.electron) {
    const { app } = require('electron');
    const userDataPath = app.getPath('userData');
    TUNNELS_DIR = path.join(userDataPath, 'tunnels');
  }
} catch (e) {}

const WINDOWS_WG_PATH = 'C:\\Program Files\\WireGuard\\wireguard.exe';
const WIREGUARD_INSTALLER_URL = 'https://download.wireguard.com/windows-client/wireguard-installer.exe';

export interface TunnelStatus {
  status: 'connected' | 'disconnected' | 'not_configured' | 'error';
  wg_ip?: string;
  message?: string;
}

export class WireguardManager {
  static isWindows(): boolean {
    return os.platform() === 'win32';
  }

  static isAdmin(): boolean {
    try {
      execSync('net session', { stdio: 'pipe', windowsHide: true });
      return true;
    } catch {
      return false;
    }
  }

  static ensureTunnelsDir(): void {
    if (!fs.existsSync(TUNNELS_DIR)) {
      fs.mkdirSync(TUNNELS_DIR, { recursive: true });
    }
  }

  static isWireGuardInstalled(): boolean {
    if (this.isWindows()) {
      return fs.existsSync(WINDOWS_WG_PATH);
    } else {
      try {
        execSync('which wg-quick', { stdio: 'pipe', windowsHide: true });
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Auto-install WireGuard jika belum ada (Windows) */
  static async installWireGuard(): Promise<{ success: boolean; message: string }> {
    if (!this.isWindows()) {
      return { success: false, message: 'Auto-install hanya tersedia di Windows. Install manual: sudo apt install wireguard' };
    }

    if (this.isWireGuardInstalled()) {
      return { success: true, message: 'WireGuard sudah terinstall.' };
    }

    const tmpInstaller = path.join(os.tmpdir(), 'wireguard-installer.exe');
    return new Promise((resolve) => {
      console.log('[WG] Downloading WireGuard installer...');
      exec(
        `powershell -Command "Invoke-WebRequest -Uri '${WIREGUARD_INSTALLER_URL}' -OutFile '${tmpInstaller}'"`,
        { timeout: 120000, windowsHide: true },
        (downloadErr) => {
          if (downloadErr) {
            resolve({ success: false, message: 'Gagal download installer WireGuard: ' + downloadErr.message });
            return;
          }

          console.log('[WG] Running WireGuard installer (silent)...');
          exec(`"${tmpInstaller}" /S`, { timeout: 120000, windowsHide: true }, (installErr) => {
            if (installErr) {
              resolve({ success: false, message: 'Gagal install WireGuard: ' + installErr.message });
              return;
            }
            resolve({ success: true, message: 'WireGuard berhasil diinstall!' });
          });
        }
      );
    });
  }

  /** Dapatkan nama service dari slug */
  static serviceName(slug: string): string {
    return `WireGuardTunnel$et-${slug}`;
  }

  /** Dapatkan path .conf dari slug */
  static confPath(slug: string): string {
    this.ensureTunnelsDir();
    return path.join(TUNNELS_DIR, `et-${slug}.conf`);
  }

  /** Tulis file konfigurasi WireGuard ke disk */
  static writeConfig(slug: string, configContent: string): string {
    this.ensureTunnelsDir();
    const confPath = this.confPath(slug);
    fs.writeFileSync(confPath, configContent, 'utf8');
    console.log(`[WG] Config written: ${confPath}`);
    return confPath;
  }

  /** Hapus file konfigurasi */
  static deleteConfig(slug: string): void {
    const confPath = this.confPath(slug);
    if (fs.existsSync(confPath)) {
      fs.unlinkSync(confPath);
    }
  }

  /** Cek status tunnel spesifik */
  static getStatus(slug: string): TunnelStatus {
    const confPath = this.confPath(slug);

    if (!fs.existsSync(confPath)) {
      return { status: 'not_configured', message: 'File konfigurasi belum ada.' };
    }

    try {
      if (this.isWindows()) {
        const svcName = this.serviceName(slug);
        try {
          const out = execSync(`sc query "${svcName}"`, { stdio: 'pipe', windowsHide: true }).toString();
          const wgIp = this.readIpFromConf(confPath);
          if (out.includes('RUNNING')) return { status: 'connected', wg_ip: wgIp };
          return { status: 'disconnected', wg_ip: wgIp };
        } catch {
          return { status: 'disconnected', wg_ip: this.readIpFromConf(confPath) };
        }
      } else {
        const ifName = `et-${slug}`;
        try {
          execSync(`ip link show ${ifName}`, { stdio: 'pipe', windowsHide: true });
          return { status: 'connected', wg_ip: this.readIpFromConf(confPath) };
        } catch {
          return { status: 'disconnected', wg_ip: this.readIpFromConf(confPath) };
        }
      }
    } catch (err: any) {
      return { status: 'error', message: err.message };
    }
  }

  /** Baca IP client dari file .conf */
  static readIpFromConf(confPath: string): string {
    try {
      const content = fs.readFileSync(confPath, 'utf8');
      const match = content.match(/Address\s*=\s*([0-9.]+)/i);
      return match ? match[1] : '';
    } catch {
      return '';
    }
  }

  /** Aktifkan tunnel */
  static async startTunnel(slug: string): Promise<{ success: boolean; message: string }> {
    const confPath = this.confPath(slug);

    if (!fs.existsSync(confPath)) {
      throw new Error('File konfigurasi VPN tidak ditemukan. Silakan setup tunnel terlebih dahulu.');
    }

    if (!this.isWireGuardInstalled()) {
      throw new Error('WireGuard belum terinstall. Gunakan tombol "Install WireGuard" terlebih dahulu.');
    }

    if (this.isWindows()) {
      const svcName = this.serviceName(slug);

      if (!this.isAdmin()) {
        // Jalankan via UAC elevation secara asynchronous agar tidak memblokir Express event loop
        const psCode = `
          Stop-Service -Name "${svcName}" -Force -ErrorAction SilentlyContinue
          sc.exe delete "${svcName}" 2>$null
          Start-Sleep -Seconds 1
          Start-Process "${WINDOWS_WG_PATH}" -ArgumentList '/installtunnelservice','${confPath}' -Wait
          net start '${svcName}'
        `.trim();
        const codeBuffer = Buffer.from(psCode, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');
        return new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, (err) => {
            if (err) {
              reject(new Error('Gagal mengaktifkan Tunnel VPN: UAC ditolak atau dibatalkan.'));
            } else {
              resolve({ success: true, message: 'Tunnel VPN berhasil diaktifkan.' });
            }
          });
        });
      }

      // Sudah admin
      try { execSync(`net stop "${svcName}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
      try { execSync(`sc delete "${svcName}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
      execSync(`"${WINDOWS_WG_PATH}" /installtunnelservice "${confPath}"`, { stdio: 'pipe', windowsHide: true });
      
      // Tunggu dan coba jalankan service (retry loop jika service belum selesai terdaftar di OS)
      let started = false;
      let lastErr: any = null;
      for (let i = 0; i < 5; i++) {
        try {
          execSync('powershell -Command "Start-Sleep -Milliseconds 500"', { stdio: 'pipe', windowsHide: true });
          execSync(`net start "${svcName}"`, { stdio: 'pipe', windowsHide: true });
          started = true;
          break;
        } catch (err: any) {
          lastErr = err;
        }
      }
      if (!started) {
        const errMsg = lastErr && lastErr.stderr ? lastErr.stderr.toString().trim() : (lastErr ? lastErr.message : 'Unknown error');
        throw new Error('Gagal menjalankan layanan WireGuard: ' + errMsg);
      }
      return { success: true, message: 'Tunnel VPN berhasil diaktifkan.' };
    } else {
      execSync(`sudo wg-quick up "${confPath}"`, { stdio: 'pipe', windowsHide: true });
      return { success: true, message: 'Tunnel VPN berhasil diaktifkan.' };
    }
  }

  /** Nonaktifkan tunnel */
  static async stopTunnel(slug: string): Promise<{ success: boolean; message: string }> {
    if (this.isWindows()) {
      const svcName = this.serviceName(slug);

      if (!this.isAdmin()) {
        const psCode = `net stop '${svcName}'`;
        const codeBuffer = Buffer.from(psCode, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');
        return new Promise((resolve) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, () => {
            resolve({ success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' });
          });
        });
      }

      try { execSync(`net stop "${svcName}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
      return { success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' };
    } else {
      const confPath = this.confPath(slug);
      try { execSync(`sudo wg-quick down "${confPath}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
      return { success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' };
    }
  }

  /** Hapus tunnel secara permanen (stop + delete service + hapus conf) */
  static async removeTunnel(slug: string): Promise<{ success: boolean; message: string }> {
    if (this.isWindows()) {
      const svcName = this.serviceName(slug);
      const tunnelName = `et-${slug}`;

      if (!this.isAdmin()) {
        // Jalankan uninstall secara langsung (otomatis menghentikan layanan)
        const psCode = `
          Start-Process "${WINDOWS_WG_PATH}" -ArgumentList '/uninstalltunnelservice','${tunnelName}' -Wait
        `.trim();
        const codeBuffer = Buffer.from(psCode, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');
        return new Promise((resolve) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, (err) => {
            if (err) {
              console.error('[WG Remove] Gagal uninstall via UAC:', err.message);
            }
            resolve({ success: true, message: 'Tunnel berhasil dihapus.' });
          });
        });
      } else {
        try {
          execSync(`"${WINDOWS_WG_PATH}" /uninstalltunnelservice "${tunnelName}"`, { stdio: 'pipe', windowsHide: true });
        } catch (err: any) {
          console.error('[WG Remove] Gagal uninstall:', err.message);
        }
      }
    } else {
      const confPath = this.confPath(slug);
      try {
        execSync(`sudo wg-quick down "${confPath}"`, { stdio: 'pipe', windowsHide: true });
      } catch {}
    }

    this.deleteConfig(slug);
    return { success: true, message: 'Tunnel berhasil dihapus.' };
  }

  /** Dapatkan status semua tunnel */
  static getAllStatus(slugs: string[]): Record<string, TunnelStatus> {
    const result: Record<string, TunnelStatus> = {};
    for (const slug of slugs) {
      result[slug] = this.getStatus(slug);
    }
    return result;
  }

  /** Diagnosa Koneksi Tunnel */
  static async diagnoseTunnel(slug: string): Promise<{ success: boolean; message: string; details: string[] }> {
    const details: string[] = [];
    const status = this.getStatus(slug);
    
    details.push(`Status Layanan VPN: ${status.status}`);
    if (status.wg_ip) {
      details.push(`IP VPN Lokal: ${status.wg_ip}`);
    }

    if (status.status !== 'connected') {
      return { 
        success: false, 
        message: 'Tunnel sedang tidak terhubung. Silakan aktifkan tunnel terlebih dahulu untuk diagnosa.',
        details 
      };
    }

    // Ping test (Internet Connectivity Test)
    try {
      details.push('Mengecek konektivitas internet (Ping 8.8.8.8)...');
      if (this.isWindows()) {
        const pingOut = execSync('ping -n 2 8.8.8.8', { stdio: 'pipe', windowsHide: true }).toString();
        if (pingOut.includes('TTL=')) {
          details.push('✅ Ping ke 8.8.8.8 berhasil (Koneksi internet lancar).');
        } else {
          details.push('❌ Ping ke 8.8.8.8 gagal atau RTO.');
        }
      } else {
        const pingOut = execSync('ping -c 2 8.8.8.8', { stdio: 'pipe', windowsHide: true }).toString();
        if (pingOut.includes('ttl=')) {
          details.push('✅ Ping ke 8.8.8.8 berhasil (Koneksi internet lancar).');
        } else {
          details.push('❌ Ping ke 8.8.8.8 gagal atau RTO.');
        }
      }
    } catch (err: any) {
      details.push('❌ Gagal melakukan ping: ' + err.message);
    }

    // Try to get wg show info if wg.exe is available (Windows)
    if (this.isWindows()) {
      const wgExe = 'C:\\Program Files\\WireGuard\\wg.exe';
      if (fs.existsSync(wgExe)) {
        try {
          details.push('Mengambil info handshake WireGuard...');
          const wgOut = execSync(`"${wgExe}" show`, { stdio: 'pipe', windowsHide: true }).toString();
          const lines = wgOut.split('\\n');
          const latestHandshake = lines.find(l => l.includes('latest handshake'));
          const transfer = lines.find(l => l.includes('transfer'));
          
          if (latestHandshake) details.push('✅ ' + latestHandshake.trim());
          if (transfer) details.push('✅ ' + transfer.trim());
          
          if (!latestHandshake) {
             details.push('⚠️ Belum ada handshake. VPN mungkin diblokir oleh provider internet atau VPS mati.');
          }
        } catch {
           details.push('⚠️ Gagal mengambil info handshake.');
        }
      }
    } else {
      try {
          details.push('Mengambil info handshake WireGuard...');
          const wgOut = execSync('sudo wg show', { stdio: 'pipe', windowsHide: true }).toString();
          const lines = wgOut.split('\\n');
          const latestHandshake = lines.find(l => l.includes('latest handshake'));
          const transfer = lines.find(l => l.includes('transfer'));
          
          if (latestHandshake) details.push('✅ ' + latestHandshake.trim());
          if (transfer) details.push('✅ ' + transfer.trim());
          
          if (!latestHandshake) {
             details.push('⚠️ Belum ada handshake. VPN mungkin diblokir oleh provider internet atau VPS mati.');
          }
      } catch {
         details.push('⚠️ Gagal mengambil info handshake.');
      }
    }

    return {
      success: true,
      message: 'Diagnosa selesai dilakukan.',
      details
    };
  }

  /** Mendapatkan daftar semua service WireGuard yang terpasang */
  static listInstalledServices(): { name: string; display: string; status: string }[] {
    if (!this.isWindows()) {
      try {
        const out = execSync("ip link show | grep -o 'et-[a-zA-Z0-9-]*'", { stdio: 'pipe', windowsHide: true }).toString();
        const interfaces = [...new Set(out.split('\n').map(i => i.trim()).filter(Boolean))];
        return interfaces.map(ifName => ({
          name: ifName,
          display: `WireGuard Interface: ${ifName}`,
          status: 'RUNNING'
        }));
      } catch {
        return [];
      }
    }

    try {
      const psCmd = `Get-Service | Where-Object Name -like 'WireGuardTunnel$et-*' | Select-Object Name, DisplayName, Status | ConvertTo-Json`;
      const out = execSync(`powershell -NoProfile -Command "${psCmd}"`, { stdio: 'pipe', windowsHide: true }).toString();
      if (!out.trim()) return [];
      const parsed = JSON.parse(out.trim());
      const rawServices = Array.isArray(parsed) ? parsed : [parsed];
      return rawServices.map((s: any) => ({
        name: s.Name,
        display: s.DisplayName,
        status: s.Status === 4 ? 'RUNNING' : (s.Status === 1 ? 'STOPPED' : 'UNKNOWN')
      }));
    } catch (e) {
      console.error('[WG List] Gagal list service:', e);
      return [];
    }
  }

  /** Menghapus service-service WireGuard yang dipilih */
  static async cleanServices(serviceNames: string[]): Promise<{ success: boolean; message: string }> {
    if (serviceNames.length === 0) {
      return { success: true, message: 'Tidak ada service yang dipilih.' };
    }

    if (this.isWindows()) {
      const psCommands = serviceNames.map(svcName => {
        const tunnelName = svcName.includes('$') ? svcName.split('$')[1] : svcName;
        return `
          Start-Process "${WINDOWS_WG_PATH}" -ArgumentList '/uninstalltunnelservice','${tunnelName}' -Wait
        `.trim();
      }).join('\n');

      if (!this.isAdmin()) {
        const codeBuffer = Buffer.from(psCommands, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');
        return new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, (err) => {
            if (err) {
              reject(new Error('Gagal membersihkan service: UAC ditolak atau dibatalkan.'));
            } else {
              resolve({ success: true, message: 'Layanan VPN terpilih berhasil dibersihkan.' });
            }
          });
        });
      }

      for (const svcName of serviceNames) {
        const tunnelName = svcName.includes('$') ? svcName.split('$')[1] : svcName;
        try { execSync(`"${WINDOWS_WG_PATH}" /uninstalltunnelservice "${tunnelName}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
      }
      return { success: true, message: 'Layanan VPN terpilih berhasil dibersihkan.' };
    } else {
      for (const ifName of serviceNames) {
        const confPath = path.join(__dirname, `../../tunnels/${ifName}.conf`);
        try { execSync(`sudo wg-quick down "${ifName}"`, { stdio: 'pipe', windowsHide: true }); } catch {}
        if (fs.existsSync(confPath)) {
          fs.unlinkSync(confPath);
        }
      }
      return { success: true, message: 'Interface VPN terpilih berhasil dibersihkan.' };
    }
  }
}
