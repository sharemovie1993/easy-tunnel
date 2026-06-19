import { useEffect, useState } from 'react';
import { systemApi, SystemInfo } from '../services/api';

export default function SettingsPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [wgInstalled, setWgInstalled] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  useEffect(() => {
    systemApi.info().then(res => {
      setInfo(res.data);
      setWgInstalled(res.data.wireguard_installed);
    }).catch(() => {});
  }, []);

  async function handleInstallWireGuard() {
    setInstalling(true);
    setInstallMsg(null);
    try {
      const res = await systemApi.installWireGuard();
      setInstallMsg(res.message);
      if (res.installing) {
        // Poll status install setiap 3 detik
        setPolling(true);
        const interval = setInterval(async () => {
          try {
            const status = await systemApi.wireGuardStatus();
            if (status.installed) {
              setWgInstalled(true);
              setInstallMsg('✅ WireGuard berhasil diinstall!');
              clearInterval(interval);
              setPolling(false);
            }
          } catch {}
        }, 3000);
      } else if (res.success) {
        setWgInstalled(true);
      }
    } catch (err: any) {
      setInstallMsg('❌ ' + err.message);
    } finally {
      setInstalling(false);
    }
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <div className="page-header">
        <h1 className="page-title">Pengaturan Sistem</h1>
        <p className="page-subtitle">Informasi perangkat dan konfigurasi Easy Tunnel</p>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 16, color: 'var(--color-text)' }}>
          ℹ️ Informasi Sistem
        </h2>

        {info ? (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <tbody>
              {[
                ['Platform', info.platform === 'win32' ? '🪟 Windows' : `🐧 ${info.platform}`],
                ['Hostname', info.hostname],
                ['Mode Admin', info.is_admin ? '✅ Ya (Service bisa diinstall)' : '⚠️ Tidak (Butuh UAC elevation)'],
                ['Versi App', `Easy Tunnel v${info.app_version}`],
              ].map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <td style={{ padding: '10px 0', color: 'var(--color-text-muted)', fontSize: 13, width: '40%' }}>{label}</td>
                  <td style={{ padding: '10px 0', color: 'var(--color-text)', fontSize: 13, fontWeight: 500 }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div style={{ color: 'var(--color-text-dim)', fontSize: 13 }}>Memuat info sistem...</div>
        )}
      </div>

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
          🔐 Status WireGuard
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          WireGuard harus terinstall di komputer ini agar tunnel bisa berjalan.
        </p>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div className={`status-badge ${wgInstalled ? 'connected' : 'disconnected'}`}>
            {wgInstalled ? 'WireGuard Terinstall' : 'WireGuard Belum Terinstall'}
          </div>
        </div>

        {installMsg && (
          <div className={`alert ${installMsg.startsWith('✅') ? 'alert-success' : 'alert-warning'}`}>
            {installMsg}
          </div>
        )}

        {!wgInstalled && (
          <button
            id="btn-install-wireguard"
            className="btn btn-primary"
            onClick={handleInstallWireGuard}
            disabled={installing || polling}
          >
            {installing || polling
              ? <><span className="spinner" /> {polling ? 'Menginstall...' : 'Memulai download...'}</>
              : '⬇️ Auto-Install WireGuard'
            }
          </button>
        )}

        {!wgInstalled && (
          <p className="form-hint" style={{ marginTop: 10 }}>
            Atau download manual:{' '}
            <a
              href="https://download.wireguard.com/windows-client/wireguard-installer.exe"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--color-accent)' }}
            >
              wireguard-installer.exe
            </a>
          </p>
        )}
      </div>
    </div>
  );
}
