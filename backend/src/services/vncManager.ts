import { execSync, exec } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const WINDOWS_VNC_PATH = 'C:\\Program Files\\TightVNC\\tvnserver.exe';
const TIGHTVNC_INSTALLER_URL = 'https://www.tightvnc.com/download/2.8.63/tightvnc-2.8.63-gpl-setup-64bit.msi';

export interface VncInstallState {
  status: 'idle' | 'downloading' | 'installing' | 'success' | 'failed';
  error: string | null;
}

export interface VncStatus {
  installed: boolean;
  running: boolean;
  port: number;
  installState: VncInstallState;
}

export class VncManager {
  static installState: VncInstallState = { status: 'idle', error: null };

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

  static isVncInstalled(): boolean {
    if (this.isWindows()) {
      return fs.existsSync(WINDOWS_VNC_PATH);
    } else {
      try {
        execSync('which x11vnc || which tightvncserver', { stdio: 'pipe', windowsHide: true });
        return true;
      } catch {
        return false;
      }
    }
  }

  /** Silent install VNC server (Windows) */
  static async installVnc(): Promise<{ success: boolean; message: string }> {
    if (!this.isWindows()) {
      const errStr = 'Auto-install hanya didukung di Windows.';
      this.installState = { status: 'failed', error: errStr };
      return { success: false, message: errStr };
    }

    if (this.isVncInstalled()) {
      this.installState = { status: 'success', error: null };
      return { success: true, message: 'VNC Server sudah terpasang.' };
    }

    this.installState = { status: 'downloading', error: null };
    const tmpInstaller = path.join(os.tmpdir(), 'tightvnc-setup.msi');
    
    return new Promise((resolve) => {
      console.log('[VNC] Downloading TightVNC installer...');
      exec(
        `powershell -Command "Invoke-WebRequest -Uri '${TIGHTVNC_INSTALLER_URL}' -OutFile '${tmpInstaller}'"`,
        { timeout: 120000, windowsHide: true },
        (downloadErr) => {
          if (downloadErr) {
            const errStr = 'Gagal mendownload VNC Server: ' + downloadErr.message;
            this.installState = { status: 'failed', error: errStr };
            resolve({ success: false, message: errStr });
            return;
          }

          this.installState = { status: 'installing', error: null };
          console.log('[VNC] Running TightVNC installer (silent)...');
          
          if (!this.isAdmin()) {
            // Gunakan UAC elevation RunAs untuk memasang service
            console.log('[VNC] Requesting UAC elevation for VNC installer...');
            const psCode = `Start-Process msiexec -ArgumentList '/i', '${tmpInstaller}', '/quiet', '/norestart', 'ADDLOCAL=Server' -Verb RunAs -Wait`;
            exec(
              `powershell -NoProfile -Command "${psCode}"`,
              { timeout: 120000, windowsHide: true },
              (installErr) => {
                if (installErr) {
                  const errStr = 'Gagal memasang VNC Server (UAC ditolak/gagal): ' + installErr.message;
                  this.installState = { status: 'failed', error: errStr };
                  resolve({ success: false, message: errStr });
                  return;
                }
                
                // Pastikan file executable sekarang ada
                if (this.isVncInstalled()) {
                  this.installState = { status: 'success', error: null };
                  resolve({ success: true, message: 'VNC Server berhasil dipasang!' });
                } else {
                  const errStr = 'Instalasi selesai tapi tvnserver.exe tidak ditemukan.';
                  this.installState = { status: 'failed', error: errStr };
                  resolve({ success: false, message: errStr });
                }
              }
            );
          } else {
            // Sudah admin
            exec(
              `msiexec /i "${tmpInstaller}" /quiet /norestart ADDLOCAL=Server`,
              { timeout: 120000, windowsHide: true },
              (installErr) => {
                if (installErr) {
                  const errStr = 'Gagal memasang VNC Server: ' + installErr.message;
                  this.installState = { status: 'failed', error: errStr };
                  resolve({ success: false, message: errStr });
                  return;
                }
                this.installState = { status: 'success', error: null };
                resolve({ success: true, message: 'VNC Server berhasil dipasang!' });
              }
            );
          }
        }
      );
    });
  }

  /** Mendapatkan status layanan VNC */
  static getStatus(): VncStatus {
    const installed = this.isVncInstalled();
    let running = false;

    if (installed) {
      try {
        if (this.isWindows()) {
          const out = execSync('sc query "tvnserver"', { stdio: 'pipe', windowsHide: true }).toString();
          running = out.includes('RUNNING');
        } else {
          const out = execSync('pgrep x11vnc || pgrep Xvnc', { stdio: 'pipe', windowsHide: true }).toString();
          running = out.trim().length > 0;
        }
      } catch {
        running = false;
      }
    }

    // Sync status pasang jika file exe sudah ada tapi status masih idle/failed
    if (installed && this.installState.status !== 'success') {
      this.installState = { status: 'success', error: null };
    }

    return {
      installed,
      running,
      port: 5900,
      installState: this.installState
    };
  }

  /** Menjalankan VNC Server dan mengatur sandi */
  static async startVnc(password: string): Promise<{ success: boolean; message: string }> {
    if (!this.isVncInstalled()) {
      throw new Error('VNC Server belum dipasang.');
    }

    if (password.length < 4 || password.length > 8) {
      throw new Error('Kata sandi VNC harus antara 4 sampai 8 karakter (standar TightVNC).');
    }

    if (this.isWindows()) {
      const errorLogPath = path.join(os.tmpdir(), 'vnc_error.txt');
      
      // Clean up previous error log if any
      if (fs.existsSync(errorLogPath)) {
        try { fs.unlinkSync(errorLogPath); } catch {}
      }

      const psRegistryCode = `
        try {
            $password = "${password}"
            $magicKey = [byte[]]@(0xE8, 0x4A, 0xD6, 0x60, 0xC4, 0x72, 0x1A, 0xE0)
            $passBytes = [System.Text.Encoding]::ASCII.GetBytes($password.PadRight(8, "\`0").Substring(0, 8))
            for ($i = 0; $i -lt 8; $i++) {
                $b = $passBytes[$i]
                $r = 0
                if (($b -band 0x01) -ne 0) { $r = $r -bor 0x80 }
                if (($b -band 0x02) -ne 0) { $r = $r -bor 0x40 }
                if (($b -band 0x04) -ne 0) { $r = $r -bor 0x20 }
                if (($b -band 0x08) -ne 0) { $r = $r -bor 0x10 }
                if (($b -band 0x10) -ne 0) { $r = $r -bor 0x08 }
                if (($b -band 0x20) -ne 0) { $r = $r -bor 0x04 }
                if (($b -band 0x40) -ne 0) { $r = $r -bor 0x02 }
                if (($b -band 0x80) -ne 0) { $r = $r -bor 0x01 }
                $passBytes[$i] = $r
            }
            $des = [System.Security.Cryptography.DES]::Create()
            $des.Mode = [System.Security.Cryptography.CipherMode]::ECB
            $des.Padding = [System.Security.Cryptography.PaddingMode]::None
            $des.Key = $magicKey
            $encryptor = $des.CreateEncryptor()
            $encrypted = $encryptor.TransformFinalBlock($passBytes, 0, 8)
            
            $regPath = "HKLM:\\SOFTWARE\\TightVNC\\Server"
            if (!(Test-Path $regPath)) { New-Item -Path $regPath -Force | Out-Null }
            Set-ItemProperty -Path $regPath -Name "Password" -Value $encrypted -Type Binary | Out-Null
            Set-ItemProperty -Path $regPath -Name "ControlPassword" -Value $encrypted -Type Binary | Out-Null
            Set-ItemProperty -Path $regPath -Name "UseVncAuthentication" -Value 1 -Type DWord | Out-Null
            Set-ItemProperty -Path $regPath -Name "UseControlAuthentication" -Value 1 -Type DWord | Out-Null
        } catch {
            $errStr = $_.Exception.ToString() + "\`n" + $_.ScriptStackTrace
            [System.IO.File]::WriteAllText("${errorLogPath.replace(/\\/g, '\\\\')}", $errStr)
            exit 1
        }
      `.trim();

      const psCode = `
        Stop-Service -Name "tvnserver" -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 1
        ${psRegistryCode}
        Start-Sleep -Seconds 1
        try {
            Start-Service -Name "tvnserver" -ErrorAction Stop
        } catch {
            $errStr = "Gagal restart layanan tvnserver: " + $_.Exception.Message
            [System.IO.File]::WriteAllText("${errorLogPath.replace(/\\/g, '\\\\')}", $errStr)
            exit 1
        }

        # Tambahkan aturan firewall agar VNC dapat diakses melalui tunnel WireGuard
        try {
            if (Get-Command New-NetFirewallRule -ErrorAction SilentlyContinue) {
                $rulePort = Get-NetFirewallRule -Name "EasyTunnelVNC_Port" -ErrorAction SilentlyContinue
                if (!$rulePort) {
                    New-NetFirewallRule -Name "EasyTunnelVNC_Port" -DisplayName "Easy Tunnel VNC Port" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 5900,5800 -Enabled True -Profile Any -ErrorAction Stop | Out-Null
                }
                $ruleApp = Get-NetFirewallRule -Name "EasyTunnelVNC_App" -ErrorAction SilentlyContinue
                if (!$ruleApp) {
                    New-NetFirewallRule -Name "EasyTunnelVNC_App" -DisplayName "Easy Tunnel VNC App" -Direction Inbound -Action Allow -Program "C:\\Program Files\\TightVNC\\tvnserver.exe" -Enabled True -Profile Any -ErrorAction Stop | Out-Null
                }
            } else {
                netsh advfirewall firewall add rule name="Easy Tunnel VNC Port" dir=in action=allow protocol=TCP localport=5900,5800 profile=any | Out-Null
                netsh advfirewall firewall add rule name="Easy Tunnel VNC App" dir=in action=allow program="C:\\Program Files\\TightVNC\\tvnserver.exe" profile=any | Out-Null
            }
        } catch {
            $errStr = "Gagal menambah firewall rule: " + $_.Exception.Message
            [System.IO.File]::AppendAllText("${errorLogPath.replace(/\\/g, '\\\\')}", "\`n" + $errStr)
        }
      `.trim();

      const tempScriptPath = path.join(os.tmpdir(), 'vnc_setup.ps1');
      try {
        fs.writeFileSync(tempScriptPath, psCode, 'utf8');
      } catch (wErr: any) {
        throw new Error('Gagal menulis berkas temporer script VNC: ' + wErr.message);
      }

      if (!this.isAdmin()) {
        // Tidak admin — gunakan Start-Process -Verb RunAs untuk elevasi UAC
        const outerCode = `$p = Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -File \`"${tempScriptPath}\`"" -Verb RunAs -Wait -PassThru; exit $p.ExitCode`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');

        return new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, (err) => {
            // Hapus berkas temporer script
            try { fs.unlinkSync(tempScriptPath); } catch {}

            if (err) {
              if (fs.existsSync(errorLogPath)) {
                try {
                  const errorContent = fs.readFileSync(errorLogPath, 'utf8');
                  reject(new Error('Gagal mengaktifkan Remote VNC: ' + errorContent));
                  return;
                } catch {}
              }
              reject(new Error('Gagal mengaktifkan Remote VNC: UAC ditolak atau dibatalkan. Coba jalankan aplikasi sebagai Administrator.'));
            } else {
              resolve({ success: true, message: 'Remote VNC berhasil diaktifkan dengan kata sandi baru.' });
            }
          });
        });
      }

      // Sudah admin — jalankan script langsung tanpa Start-Process RunAs (tidak perlu UAC)
      const directBuffer = Buffer.from(`& "${tempScriptPath}"`, 'utf16le');
      const directBase64 = directBuffer.toString('base64');
      try {
        try {
          execSync(`powershell -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${directBase64}`, {
            windowsHide: true,
            stdio: 'pipe'
          });
        } finally {
          // Hapus berkas temporer script
          try { fs.unlinkSync(tempScriptPath); } catch {}
        }
        return { success: true, message: 'Remote VNC berhasil diaktifkan.' };
      } catch (err: any) {
        if (fs.existsSync(errorLogPath)) {
          try {
            const errorContent = fs.readFileSync(errorLogPath, 'utf8');
            throw new Error('Gagal menulis konfigurasi registry VNC: ' + errorContent);
          } catch (e2: any) {
            if (e2.message.startsWith('Gagal menulis')) throw e2;
          }
        }
        const msg = err.stderr ? err.stderr.toString().trim() : err.message;
        throw new Error('Gagal menulis konfigurasi registry VNC: ' + msg);
      }
    } else {
      // Linux: Buat file sandi dan jalankan x11vnc
      try {
        const homeDir = os.homedir();
        const vncPassDir = path.join(homeDir, '.vnc');
        if (!fs.existsSync(vncPassDir)) {
          fs.mkdirSync(vncPassDir, { recursive: true });
        }
        const passFile = path.join(vncPassDir, 'passwd');
        execSync(`x11vnc -storepasswd "${password}" "${passFile}"`, { stdio: 'pipe', windowsHide: true });
        execSync('pkill x11vnc', { stdio: 'pipe', windowsHide: true });
        
        // Buka firewall untuk Linux (ufw/iptables)
        try { execSync('sudo ufw allow 5900/tcp', { stdio: 'ignore' }); } catch {}
        try { execSync('sudo iptables -A INPUT -p tcp --dport 5900 -j ACCEPT', { stdio: 'ignore' }); } catch {}
      } catch {}
      exec(`x11vnc -rfbauth ~/.vnc/passwd -forever -shared -bg`, { windowsHide: true });
      return { success: true, message: 'Remote VNC berhasil diaktifkan.' };
    }
  }

  /** Mematikan layanan VNC Server */
  static async stopVnc(): Promise<{ success: boolean; message: string }> {
    if (this.isWindows()) {
      if (!this.isAdmin()) {
        const psCode = 'Stop-Service -Name "tvnserver" -Force';
        const codeBuffer = Buffer.from(psCode, 'utf16le');
        const codeBase64 = codeBuffer.toString('base64');
        const outerCode = `Start-Process powershell -ArgumentList "-NoProfile -WindowStyle Hidden -EncodedCommand ${codeBase64}" -Verb RunAs -Wait`;
        const outerBuffer = Buffer.from(outerCode, 'utf16le');
        const outerBase64 = outerBuffer.toString('base64');

        return new Promise((resolve, reject) => {
          exec(`powershell -NoProfile -EncodedCommand ${outerBase64}`, { windowsHide: true }, (err) => {
            if (err) {
              reject(new Error('Gagal menonaktifkan Remote VNC: UAC ditolak.'));
            } else {
              resolve({ success: true, message: 'Remote VNC berhasil dinonaktifkan.' });
            }
          });
        });
      }

      try { execSync('net stop "tvnserver"', { stdio: 'pipe', windowsHide: true }); } catch {}
      return { success: true, message: 'Remote VNC berhasil dinonaktifkan.' };
    } else {
      try { execSync('pkill x11vnc', { stdio: 'pipe', windowsHide: true }); } catch {}
      return { success: true, message: 'Remote VNC berhasil dinonaktifkan.' };
    }
  }
}
