import { useEffect, useState } from 'react';
import { Tunnel, tunnelApi, authApi } from '../services/api';
import TunnelCard from '../components/TunnelCard';
import { useNavigate } from 'react-router-dom';

interface CloudLicense {
  id: number;
  product_id: string;
  license_key: string;
  school_name: string;
  is_active: number;
  status: string;
  expires_at: string;
  requested_slug: string | null;
  local_port: number | null;
  app_name: string | null;
  active_hostname?: string | null;
}

export default function DashboardPage() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [cloudLicenses, setCloudLicenses] = useState<CloudLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // State Modal Klaim Lisensi
  const [showClaimModal, setShowClaimModal] = useState(false);
  const [claimKey, setClaimKey] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  // State Modal Setup Tunnel Cloud
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<CloudLicense | null>(null);
  const [setupSlug, setSetupSlug] = useState('');
  const [setupPort, setSetupPort] = useState(5002);
  const [setupAppName, setSetupAppName] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  const navigate = useNavigate();

  async function loadData() {
    try {
      setError(null);
      
      // Load tunnel lokal
      const localRes = await tunnelApi.list();
      setTunnels(localRes.data);

      // Load lisensi cloud dari VPS
      const cloudRes = await authApi.myLicenses();
      if (cloudRes.success) {
        setCloudLicenses(cloudRes.data);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    // Refresh data secara berkala setiap 10 detik
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleClaimLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimKey.trim()) return;

    setClaimLoading(true);
    setClaimError(null);
    setClaimSuccess(null);

    try {
      const res = await authApi.claimLicense(claimKey.trim());
      if (res.success) {
        setClaimSuccess('Lisensi berhasil diklaim dan ditambahkan ke akun Anda!');
        setClaimKey('');
        loadData();
        setTimeout(() => {
          setShowClaimModal(false);
          setClaimSuccess(null);
        }, 1500);
      } else {
        setClaimError(res.message || 'Gagal mengklaim lisensi.');
      }
    } catch (err: any) {
      setClaimError(err.message || 'Gagal mengklaim lisensi. Pastikan lisensi key benar.');
    } finally {
      setClaimLoading(false);
    }
  };

  const openSetupModal = (lic: CloudLicense) => {
    setSelectedLicense(lic);
    setSetupSlug(lic.requested_slug || '');
    setSetupPort(lic.local_port || 5002);
    setSetupAppName(lic.app_name || lic.school_name);
    setSetupError(null);
    setShowSetupModal(true);
  };

  const handleSetupTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLicense) return;

    setSetupLoading(true);
    setSetupError(null);

    try {
      const res = await tunnelApi.setup({
        license_key: selectedLicense.license_key,
        subdomain_slug: setupSlug.trim().toLowerCase(),
        local_port: setupPort,
        app_name: setupAppName.trim()
      });

      if (res.success) {
        setShowSetupModal(false);
        loadData();
      } else {
        setSetupError(res.message || 'Gagal memasang konfigurasi tunnel.');
      }
    } catch (err: any) {
      setSetupError(err.message || 'Terjadi kesalahan saat memasang tunnel.');
    } finally {
      setSetupLoading(false);
    }
  };

  // Saring terowongan lokal agar hanya menampilkan yang license_key-nya dimiliki oleh operator yang sedang login
  const allowedKeys = cloudLicenses.map(lic => lic.license_key);
  const userTunnels = tunnels.filter(t => allowedKeys.includes(t.license_key));

  // Filter lisensi VPS yang BELUM terpasang di SQLite lokal
  const localKeys = tunnels.map(t => t.license_key);
  const uninstalledLicenses = cloudLicenses.filter(lic => !localKeys.includes(lic.license_key));

  const connectedCount = userTunnels.filter(t => t.wg_status?.status === 'connected').length;

  return (
    <div>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 className="page-title">Dashboard Tunnel</h1>
          <p className="page-subtitle">Kelola koneksi tunnel lokal dan lisensi cloud Anda</p>
        </div>
        <div style={{ display: 'flex', gap: 12 }}>
          <button className="btn btn-outline" onClick={() => setShowClaimModal(true)}>
            🔑 Klaim Lisensi Key
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/order')}>
            ➕ Beli Lisensi Baru
          </button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="stats-row">
        <div className="stat-chip">
          <div className="stat-chip-label">Tunnel Lokal Terpasang</div>
          <div className="stat-chip-value">{userTunnels.length}</div>
        </div>
        <div className="stat-chip">
          <div className="stat-chip-label">🟢 Koneksi Tunnel Aktif</div>
          <div className="stat-chip-value">{connectedCount}</div>
        </div>
        <div className="stat-chip">
          <div className="stat-chip-label">☁️ Lisensi Cloud Anda</div>
          <div className="stat-chip-value">{cloudLicenses.length}</div>
        </div>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 24 }}>
          <span>⚠️</span> Gagal memuat data: {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ marginTop: 16 }}>Memuat data terowongan dan lisensi cloud...</p>
        </div>
      ) : (
        <div className="space-y-8" style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
          
          {/* BAGIAN 1: TUNNEL DI PC INI */}
          <section className="space-y-4">
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
              🖥️ Tunnel Aktif di Komputer Ini
            </h2>

            {userTunnels.length === 0 ? (
              <div className="card" style={{ padding: 40, textAlign: 'center', borderStyle: 'dashed' }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>🖥️</span>
                <h4 style={{ margin: '0 0 8px', fontSize: 15, color: 'var(--color-text)' }}>Belum Ada Tunnel Terpasang</h4>
                <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '0 0 16px' }}>
                  Tidak ada konfigurasi tunnel fisik yang dipasang di komputer ini. Silakan pasang salah satu lisensi cloud di bawah ini atau beli lisensi baru.
                </p>
              </div>
            ) : (
              <div className="card-grid">
                {userTunnels.map(tunnel => (
                  <TunnelCard key={tunnel.id} tunnel={tunnel} onRefresh={loadData} />
                ))}
              </div>
            )}
          </section>

          {/* BAGIAN 2: LISENSI CLOUD BELUM TERPASANG */}
          <section className="space-y-4">
            <h2 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 16px', color: 'var(--color-text)' }}>
              ☁️ Lisensi Cloud Anda (Belum Terpasang di PC Ini)
            </h2>

            {uninstalledLicenses.length === 0 ? (
              <div className="card" style={{ padding: 24, textAlign: 'center', background: 'rgba(255,255,255,0.02)' }}>
                <p style={{ color: 'var(--color-text-dim)', fontSize: 13, margin: 0 }}>
                  Semua lisensi cloud Anda telah terpasang di komputer ini, atau Anda belum memiliki lisensi cloud aktif.
                </p>
              </div>
            ) : (
              <div className="card-grid">
                {uninstalledLicenses.map(lic => (
                  <div key={lic.id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'between', minHeight: 200 }}>
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'between', alignItems: 'center', marginBottom: 12 }}>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4, background: lic.active_hostname ? 'rgba(239, 68, 68, 0.1)' : 'rgba(59, 130, 246, 0.1)', color: lic.active_hostname ? '#ef4444' : 'var(--color-primary)', border: lic.active_hostname ? '1px solid rgba(239, 68, 68, 0.2)' : '1px solid var(--color-border)' }}>
                          {lic.active_hostname ? '🔒 TERKUNCI' : (lic.status === 'active' ? '🟢 AKTIF' : '⏳ PENDING')}
                        </span>
                        <span style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                          Exp: <strong>{lic.expires_at}</strong>
                        </span>
                      </div>
                      <h3 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>{lic.school_name}</h3>
                      <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: lic.active_hostname ? 12 : 16 }}>
                        Key: <code style={{ fontSize: 11 }}>{lic.license_key}</code>
                      </div>
                      {lic.active_hostname && (
                        <div style={{ fontSize: 12, color: '#ef4444', background: 'rgba(239, 68, 68, 0.05)', padding: '8px 12px', borderRadius: 6, border: '1px solid rgba(239, 68, 68, 0.1)', marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 4 }}>
                          <div>⚠️ Aktif di komputer: <strong>{lic.active_hostname}</strong></div>
                          {lic.app_name && <div>Aplikasi: <strong>{lic.app_name}</strong></div>}
                          {lic.requested_slug && <div>Domain: <strong style={{ color: 'var(--color-accent)' }}>{lic.requested_slug}.absenta.id</strong></div>}
                          {lic.local_port && <div>Port Lokal: <strong>{lic.local_port}</strong></div>}
                        </div>
                      )}
                    </div>

                    <button 
                      className={lic.active_hostname ? "btn btn-outline btn-block" : "btn btn-primary btn-block"}
                      onClick={() => openSetupModal(lic)}
                      disabled={lic.status !== 'active' || !!lic.active_hostname}
                      style={lic.active_hostname ? { cursor: 'not-allowed', color: 'rgba(255,255,255,0.2)' } : undefined}
                    >
                      {lic.active_hostname ? '🔒 Lisensi Terkunci di Device Lain' : '🖥️ Pasang Konfigurasi di PC Ini'}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* ==============================================
          MODAL 1: KLAIM LISENSI KEY
          ============================================== */}
      {showClaimModal && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, padding: 28, position: 'relative' }}>
            <button 
              onClick={() => setShowClaimModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>
              Klaim Kunci Lisensi
            </h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
              Masukkan kunci lisensi Easy Tunnel yang Anda miliki untuk mengaitkannya dengan nomor WhatsApp Anda.
            </p>

            {claimError && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                <span>⚠️</span> {claimError}
              </div>
            )}

            {claimSuccess && (
              <div className="alert alert-success" style={{ marginBottom: 16 }}>
                <span>✓</span> {claimSuccess}
              </div>
            )}

            <form onSubmit={handleClaimLicense} className="space-y-4">
              <div className="form-group">
                <label className="form-label">Kunci Lisensi (License Key)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Contoh: ETN-XXXX-XXXX-XXXX"
                  value={claimKey}
                  onChange={(e) => setClaimKey(e.target.value)}
                  disabled={claimLoading}
                  style={{ textTransform: 'uppercase', letterSpacing: 1 }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowClaimModal(false)} disabled={claimLoading}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={claimLoading}>
                  {claimLoading ? <span className="spinner" style={{ marginRight: 8 }}></span> : ''}
                  Klaim Lisensi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ==============================================
          MODAL 2: SETUP TUNNEL CLOUD
          ============================================== */}
      {showSetupModal && selectedLicense && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28, position: 'relative' }}>
            <button 
              onClick={() => setShowSetupModal(false)}
              style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
            >
              ✕
            </button>
            <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text)' }}>
              Pasang Rute Tunnel Baru
            </h3>
            <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
              Konfigurasikan terowongan di komputer lokal ini untuk lisensi: <strong>{selectedLicense.school_name}</strong>
            </p>

            {setupError && (
              <div className="alert alert-danger" style={{ marginBottom: 16 }}>
                <span>⚠️</span> {setupError}
              </div>
            )}

            <form onSubmit={handleSetupTunnel} className="space-y-4" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div className="form-group">
                <label className="form-label">Subdomain Rute Terowongan</label>
                <div className="input-group">
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="nama-sekolah" 
                    value={setupSlug}
                    onChange={(e) => setSetupSlug(e.target.value)}
                    disabled={setupLoading}
                    required 
                  />
                  <span className="btn btn-outline" style={{ borderLeft: 'none', background: 'rgba(0,0,0,0.1)' }}>
                    .absenta.id
                  </span>
                </div>
                <span className="form-hint">Alamat web publik yang akan memetakan aplikasi lokal Anda.</span>
              </div>

              <div className="form-group">
                <label className="form-label">Port Aplikasi Lokal (Target Host)</label>
                <input 
                  type="number" 
                  className="form-input" 
                  placeholder="Contoh: 5173 atau 80"
                  value={setupPort}
                  onChange={(e) => setSetupPort(parseInt(e.target.value) || 0)}
                  disabled={setupLoading}
                  min={1} max={65535}
                  required 
                />
                <span className="form-hint">Port port server lokal yang berjalan di PC ini (seperti Dapodik / Rapor).</span>
              </div>

              <div className="form-group">
                <label className="form-label">Nama Aplikasi (Label Lokal)</label>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="Contoh: Aplikasi Dapodik"
                  value={setupAppName}
                  onChange={(e) => setSetupAppName(e.target.value)}
                  disabled={setupLoading}
                  required 
                />
              </div>

              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowSetupModal(false)} disabled={setupLoading}>
                  Batal
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={setupLoading}>
                  {setupLoading ? <span className="spinner" style={{ marginRight: 8 }}></span> : '💾 '}
                  Pasang Rute Tunnel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
