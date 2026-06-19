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
      execSync('net session', { stdio: 'pipe' });
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
        execSync('which wg-quick', { stdio: 'pipe' });
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
        { timeout: 120000 },
        (downloadErr) => {
          if (downloadErr) {
            resolve({ success: false, message: 'Gagal download installer WireGuard: ' + downloadErr.message });
            return;
          }

          console.log('[WG] Running WireGuard installer (silent)...');
          exec(`"${tmpInstaller}" /S`, { timeout: 120000 }, (installErr) => {
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
          const out = execSync(`sc query "${svcName}"`, { stdio: 'pipe' }).toString();
          const wgIp = this.readIpFromConf(confPath);
          if (out.includes('RUNNING')) return { status: 'connected', wg_ip: wgIp };
          return { status: 'disconnected', wg_ip: wgIp };
        } catch {
          return { status: 'disconnected', wg_ip: this.readIpFromConf(confPath) };
        }
      } else {
        const ifName = `et-${slug}`;
        try {
          execSync(`ip link show ${ifName}`, { stdio: 'pipe' });
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
        // Jalankan via UAC elevation
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
        execSync(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { stdio: 'pipe' });
        return { success: true, message: 'Tunnel VPN berhasil diaktifkan.' };
      }

      // Sudah admin
      try { execSync(`net stop "${svcName}"`, { stdio: 'pipe' }); } catch {}
      try { execSync(`sc delete "${svcName}"`, { stdio: 'pipe' }); } catch {}
      execSync(`"${WINDOWS_WG_PATH}" /installtunnelservice "${confPath}"`, { stdio: 'pipe' });
      execSync(`net start "${svcName}"`, { stdio: 'pipe' });
      return { success: true, message: 'Tunnel VPN berhasil diaktifkan.' };
    } else {
      execSync(`sudo wg-quick up "${confPath}"`, { stdio: 'pipe' });
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
        try {
          execSync(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { stdio: 'pipe' });
        } catch {}
        return { success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' };
      }

      try { execSync(`net stop "${svcName}"`, { stdio: 'pipe' }); } catch {}
      return { success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' };
    } else {
      const confPath = this.confPath(slug);
      try { execSync(`sudo wg-quick down "${confPath}"`, { stdio: 'pipe' }); } catch {}
      return { success: true, message: 'Tunnel VPN berhasil dinonaktifkan.' };
    }
  }

  /** Hapus tunnel secara permanen (stop + delete service + hapus conf) */
  static async removeTunnel(slug: string): Promise<{ success: boolean; message: string }> {
    if (this.isWindows()) {
      const svcName = this.serviceName(slug);
      const tunnelName = `et-${slug}`;

      if (!this.isAdmin()) {
        // Jalankan stop dan uninstall secara bersamaan dalam 1 UAC prompt saja
        const psCode = `
          Stop-Service -Name "${svcName}" -Force -ErrorAction SilentlyContinue
          Start-Sleep -Seconds 1
          Start-Process "${WINDOWS_WG_PATH}" -ArgumentList '/uninstalltunnelservice','${tunnelName}' -Wait
        `.trim();
        const codeBuffer = Buffer.from(psCode, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');
        try {
          execSync(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { stdio: 'pipe' });
        } catch (err: any) {
          console.error('[WG Remove] Gagal uninstall via UAC:', err.message);
        }
      } else {
        try {
          execSync(`net stop "${svcName}"`, { stdio: 'pipe' });
        } catch {}
        try {
          execSync(`"${WINDOWS_WG_PATH}" /uninstalltunnelservice "${tunnelName}"`, { stdio: 'pipe' });
        } catch (err: any) {
          console.error('[WG Remove] Gagal uninstall:', err.message);
        }
      }
    } else {
      const confPath = this.confPath(slug);
      try {
        execSync(`sudo wg-quick down "${confPath}"`, { stdio: 'pipe' });
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
}
