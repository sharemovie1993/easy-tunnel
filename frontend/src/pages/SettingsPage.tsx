import { useEffect, useState } from 'react';
import { systemApi, SystemInfo } from '../services/api';

export default function SettingsPage() {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [wgInstalled, setWgInstalled] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [polling, setPolling] = useState(false);

  // State Layanan Konflik / Sampah
  const [checkingOrphans, setCheckingOrphans] = useState(false);
  const [cleaningOrphans, setCleaningOrphans] = useState(false);
  const [orphanedServices, setOrphanedServices] = useState<any[]>([]);
  const [hasScanned, setHasScanned] = useState(false);
  const [cleanMsg, setCleanMsg] = useState<string | null>(null);

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

  async function handleScanOrphans() {
    setCheckingOrphans(true);
    setCleanMsg(null);
    try {
      const res = await systemApi.tunnelsDiagnostics();
      if (res.success) {
        setOrphanedServices(res.data.orphans);
        setHasScanned(true);
      }
    } catch (err: any) {
      setCleanMsg('❌ Gagal memindai: ' + err.message);
    } finally {
      setCheckingOrphans(false);
    }
  }

  async function handleCleanOrphans() {
    if (orphanedServices.length === 0) return;
    if (!confirm(`Yakin ingin menghentikan dan menghapus ${orphanedServices.length} layanan terowongan yang konflik/tidak terpakai ini?`)) return;
    
    setCleaningOrphans(true);
    setCleanMsg(null);
    try {
      const names = orphanedServices.map(o => o.name);
      const res = await systemApi.cleanTunnels(names);
      setCleanMsg('✅ ' + res.message);
      await handleScanOrphans();
    } catch (err: any) {
      setCleanMsg('❌ ' + err.message);
    } finally {
      setCleaningOrphans(false);
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

      <div className="card" style={{ marginBottom: 16 }}>
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

      <div className="card">
        <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>
          🧹 Deteksi & Reset Layanan Konflik
        </h2>
        <p style={{ color: 'var(--color-text-muted)', fontSize: 13, marginBottom: 16 }}>
          Pindai dan bersihkan layanan VPN Wireguard lama/sampah yang masih berjalan di Windows tetapi tidak terdaftar aktif di sistem ini (menyebabkan tabrakan IP).
        </p>

        {cleanMsg && (
          <div className={`alert ${cleanMsg.startsWith('✅') ? 'alert-success' : 'alert-warning'}`} style={{ marginBottom: 16 }}>
            {cleanMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
          <button
            className="btn btn-outline"
            onClick={handleScanOrphans}
            disabled={checkingOrphans || cleaningOrphans}
            style={{ fontSize: 13 }}
          >
            {checkingOrphans ? '🔍 Memindai...' : '🔍 Pindai Layanan Konflik'}
          </button>

          {hasScanned && orphanedServices.length > 0 && (
            <button
              className="btn btn-danger"
              onClick={handleCleanOrphans}
              disabled={checkingOrphans || cleaningOrphans}
              style={{ fontSize: 13 }}
            >
              {cleaningOrphans ? '🧹 Sedang Membersihkan...' : '🧹 Bersihkan Semua Konflik'}
            </button>
          )}
        </div>

        {hasScanned && (
          <div>
            {orphanedServices.length === 0 ? (
              <div style={{
                background: 'rgba(34, 197, 94, 0.04)',
                border: '1px dashed rgba(34, 197, 94, 0.3)',
                borderRadius: 8,
                padding: '12px 16px',
                color: '#4ade80',
                fontSize: 13,
                fontWeight: 500
              }}>
                ✅ Bersih! Tidak ditemukan layanan terowongan WireGuard yang konflik atau sampah di komputer ini.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#f87171', marginBottom: 6 }}>
                  ⚠️ Ditemukan {orphanedServices.length} Layanan Konflik/Sampah:
                </div>
                <div style={{
                  background: 'rgba(239, 68, 68, 0.04)',
                  border: '1px solid rgba(239, 68, 68, 0.2)',
                  borderRadius: 8,
                  overflow: 'hidden'
                }}>
                  {orphanedServices.map((svc, idx) => (
                    <div key={svc.name} style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '10px 14px',
                      borderBottom: idx < orphanedServices.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                      fontSize: 13
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--color-text)' }}>{svc.display}</div>
                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>Name: {svc.name}</div>
                      </div>
                      <span style={{
                        background: svc.status === 'RUNNING' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.05)',
                        color: svc.status === 'RUNNING' ? '#ef4444' : 'var(--color-text-muted)',
                        padding: '2px 8px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 700
                      }}>
                        {svc.status}
                      </span>
                    </div>
                  ))}
                </div>
                <p className="form-hint" style={{ marginTop: 8, color: 'var(--color-text-muted)' }}>
                  Catatan: Mengklik "Bersihkan" mungkin akan meminta konfirmasi UAC Administrator di layar Anda untuk mengizinkan penghapusan layanan Windows.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
