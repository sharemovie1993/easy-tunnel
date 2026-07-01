import { useEffect, useState, useMemo } from 'react';
import { Tunnel, tunnelApi, authApi, systemApi, SystemInfo, vncApi, VncStatus } from '../services/api';
import { useNavigate } from 'react-router-dom';
import { calcExpiry } from '../utils/dateUtils';
import { getBaseDomain } from '../utils/domainUtils';
import ClaimLicenseModal from '../components/ClaimLicenseModal';
import SetupTunnelModal from '../components/SetupTunnelModal';
import DashboardCardView from '../components/DashboardCardView';
import DashboardTableView from '../components/DashboardTableView';
import VncControlModal from '../components/VncControlModal';
import VncViewerModal from '../components/VncViewerModal';
import EditTunnelModal from '../components/EditTunnelModal';

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

type FilterStatus = 'all' | 'installed' | 'idle' | 'locked' | 'expired';

export default function DashboardPage() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [cloudLicenses, setCloudLicenses] = useState<CloudLicense[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [ticker, setTicker] = useState(0);
  const [viewMode, setViewMode] = useState<'card' | 'table'>(() => {
    return (localStorage.getItem('dashboard_view_mode') as 'card' | 'table') || 'card';
  });
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  // State VNC
  const [vncStatus, setVncStatus] = useState<VncStatus | null>(null);
  const [showVncControlModal, setShowVncControlModal] = useState(false);
  const [showVncViewerModal, setShowVncViewerModal] = useState(false);
  const [selectedVncLicense, setSelectedVncLicense] = useState<CloudLicense | null>(null);

  const toggleViewMode = (mode: 'card' | 'table') => {
    setViewMode(mode);
    localStorage.setItem('dashboard_view_mode', mode);
  };

  useEffect(() => {
    const clock = setInterval(() => setTicker(t => t + 1), 1000);
    return () => clearInterval(clock);
  }, []);

  useEffect(() => {
    systemApi.info().then(res => {
      setSystemInfo(res.data);
    }).catch(() => {});
  }, []);

  // State Modal Klaim Lisensi
  const [showClaimModal, setShowClaimModal] = useState(false);

  // State Modal Setup Tunnel Cloud
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [selectedLicense, setSelectedLicense] = useState<CloudLicense | null>(null);

  // State Modal Edit Tunnel
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedEditTunnel, setSelectedEditTunnel] = useState<Tunnel | null>(null);

  const openEditModal = (tunnel: Tunnel) => {
    setSelectedEditTunnel(tunnel);
    setShowEditModal(true);
  };

  // State untuk tunnel actions
  const [actionLoading, setActionLoading] = useState<Record<number, string>>({});
  const [actionError, setActionError] = useState<Record<number, string>>({});

  const navigate = useNavigate();

  async function loadData() {
    try {
      setError(null);
      const [localRes, cloudRes] = await Promise.all([
        tunnelApi.list(),
        authApi.myLicenses(),
      ]);
      setTunnels(localRes.data);
      if (cloudRes.success) setCloudLicenses(cloudRes.data);

      // Load local VNC status
      try {
        const vncRes = await vncApi.status();
        if (vncRes.success) setVncStatus(vncRes.data);
      } catch (vncErr) {
        console.warn('VNC API is not available or failed:', vncErr);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memuat data dari server.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  // Merge: buat list unified (satu entry per lisensi cloud)
  const mergedItems = useMemo(() => {
    return cloudLicenses.map(lic => {
      const localTunnel = tunnels.find(t => t.license_key === lic.license_key) || null;
      const wgStatus = localTunnel?.wg_status?.status || null;
      const isConnected = wgStatus === 'connected';
      const isInstalledHere = !!localTunnel;
      const exp = calcExpiry(lic.expires_at);

      // primaryStatus: eksklusif, hanya untuk filter
      let primaryStatus: FilterStatus;
      if (exp.isExpired)                                primaryStatus = 'expired';
      else if (lic.active_hostname && !isInstalledHere) primaryStatus = 'locked';
      else if (isInstalledHere)                         primaryStatus = 'installed';
      else                                              primaryStatus = 'idle';

      // Ghost lock detection: if it's locked, but the active_hostname matches this PC's hostname.
      const isGhostLock = !!(primaryStatus === 'locked' && 
                          systemInfo?.hostname && 
                          lic.active_hostname?.toLowerCase() === systemInfo.hostname.toLowerCase());

      return { lic, localTunnel, isConnected, isInstalledHere, exp, primaryStatus, isGhostLock };
    });
  }, [cloudLicenses, tunnels, systemInfo]);

  // Filter & sort
  const filteredItems = useMemo(() => {
    let items = mergedItems;
    if (filterStatus === 'installed') {
      items = items.filter(i => i.isInstalledHere);
    } else if (filterStatus === 'idle') {
      items = items.filter(i => !i.isInstalledHere && !i.lic.active_hostname && !i.exp.isExpired);
    } else if (filterStatus !== 'all') {
      items = items.filter(i => i.primaryStatus === filterStatus);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(i =>
        i.lic.school_name.toLowerCase().includes(q) ||
        i.lic.license_key.toLowerCase().includes(q) ||
        (i.lic.requested_slug || '').toLowerCase().includes(q) ||
        (i.lic.app_name || '').toLowerCase().includes(q)
      );
    }
    // Sort: expired → locked → idle → installed
    return [...items].sort((a, b) => {
      const order: Record<FilterStatus, number> = {
        expired: 0, locked: 1, idle: 2, installed: 3, all: 4
      };
      const oa = order[a.primaryStatus] ?? 4;
      const ob = order[b.primaryStatus] ?? 4;
      if (oa !== ob) return oa - ob;
      const da = a.exp.diffDays ?? 9999;
      const db = b.exp.diffDays ?? 9999;
      return da - db;
    });
  }, [mergedItems, filterStatus, searchQuery]);

  // Stats
  const stats = useMemo(() => ({
    total: mergedItems.length,
    connected: mergedItems.filter(i => i.isConnected).length,
    expired: mergedItems.filter(i => i.primaryStatus === 'expired').length,
    expiringSoon: mergedItems.filter(i => !i.exp.isExpired && i.exp.isWarning).length,
  }), [mergedItems]);

  const isUnsupportedWindows = useMemo(() => {
    if (!systemInfo) return false;
    if (systemInfo.platform !== 'win32') return false;
    const release = systemInfo.os_release || '';
    const arch = systemInfo.os_arch || '';
    const isOldWin = release.startsWith('5.') || release.startsWith('6.');
    const is32Bit = arch.includes('32') || arch === 'ia32' || arch === 'x86';
    return isOldWin || is32Bit;
  }, [systemInfo]);

  const openSetupModal = (lic: CloudLicense) => {
    setSelectedLicense(lic);
    setShowSetupModal(true);
  };

  // (FITUR VNC HIDDEN SEMENTARA)
  /*
  const openVncControl = (lic: CloudLicense) => {
    setSelectedVncLicense(lic);
    setShowVncControlModal(true);
  };

  const openVncViewer = (lic: CloudLicense) => {
    setSelectedVncLicense(lic);
    setShowVncViewerModal(true);
  };
  */

  const refreshVncStatus = async () => {
    try {
      const vncRes = await vncApi.status();
      if (vncRes.success) setVncStatus(vncRes.data);
    } catch (err) {
      console.error('Gagal memperbarui status VNC:', err);
    }
  };

  const handleTunnelAction = async (tunnelId: number, action: 'start' | 'stop' | 'delete') => {
    if (action === 'delete') {
      if (!confirm('Yakin hapus tunnel ini? Konfigurasi akan dihapus dari PC ini.')) return;
    }
    setActionLoading(prev => ({ ...prev, [tunnelId]: action }));
    setActionError(prev => { const n = { ...prev }; delete n[tunnelId]; return n; });
    try {
      if (action === 'start') await tunnelApi.start(tunnelId);
      else if (action === 'stop') await tunnelApi.stop(tunnelId);
      else await tunnelApi.remove(tunnelId);
      loadData();
    } catch (err: any) {
      setActionError(prev => ({ ...prev, [tunnelId]: err.message }));
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[tunnelId]; return n; });
    }
  };

  const handleDiagnoseClick = async (tunnelId: number) => {
    setActionLoading(prev => ({ ...prev, [tunnelId]: 'diagnose' }));
    try {
      const res = await tunnelApi.diagnose(tunnelId);
      if (res.success && res.data) {
        alert("🔍 Hasil Diagnosa Koneksi:\\n\\n" + res.data.details.join("\\n"));
      } else {
        alert("Gagal melakukan diagnosa: " + (res.data?.message || "Unknown error"));
      }
    } catch (err: any) {
      alert("Gagal melakukan diagnosa: " + err.message);
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[tunnelId]; return n; });
    }
  };

  const handleForceRelease = async (licenseKey: string) => {
    if (!confirm('Yakin ingin mereset kunci lisensi ini? Ini akan memaksa pelepasan lisensi dari server pusat sehingga Anda dapat memasangnya kembali di PC ini.')) return;
    
    // Gunakan hash ID dummy atau semacamnya untuk loading state, kita pakai hash string sederhana
    const tempId = licenseKey.charCodeAt(0) + licenseKey.charCodeAt(licenseKey.length-1);
    setActionLoading(prev => ({ ...prev, [tempId]: 'force-release' }));
    
    try {
      await tunnelApi.forceRelease(licenseKey);
      alert('Lisensi berhasil direset! Silakan pasang ulang terowongan.');
      loadData();
    } catch (err: any) {
      alert("Gagal mereset lisensi: " + err.message);
    } finally {
      setActionLoading(prev => { const n = { ...prev }; delete n[tempId]; return n; });
    }
  };

  const FILTERS: { key: FilterStatus; label: string }[] = [
    { key: 'all',       label: 'Semua' },
    { key: 'installed', label: '🖥️ Terpasang di PC Ini' },
    { key: 'idle',      label: '💤 Idle / Belum Dipakai' },
    { key: 'locked',    label: '🔒 Terkunci di PC Lain' },
    { key: 'expired',   label: '🔴 Kedaluwarsa' },
  ];

  return (
    <div data-ticker={ticker}>
      {/* ── HEADER ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16, marginBottom: 24 }}>
        <div>
          <h1 className="page-title">Dashboard Lisensi</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <p className="page-subtitle" style={{ margin: 0 }}>Kelola semua lisensi Easy Tunnel Anda</p>
            {systemInfo?.license_server_url && (
              <span style={{
                background: 'rgba(34, 197, 94, 0.08)',
                color: '#4ade80',
                border: '1px solid rgba(34, 197, 94, 0.2)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '11px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                fontWeight: 500,
                marginTop: '2px'
              }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px #22c55e' }}></span>
                License Server: {systemInfo.license_server_url.replace(/^https?:\/\//, '')}
              </span>
            )}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-outline btn-sm" onClick={() => setShowClaimModal(true)}>
            🔑 Klaim Key
          </button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate('/order')}>
            ➕ Beli Lisensi
          </button>
        </div>
      </div>

      {/* ── STATS RINGKAS ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Lisensi', value: stats.total, color: 'var(--color-text-muted)' },
          { label: '🟢 Terhubung', value: stats.connected, color: '#22c55e' },
          { label: '⚠️ Mau Habis', value: stats.expiringSoon, color: '#f59e0b' },
          { label: '🔴 Kedaluwarsa', value: stats.expired, color: '#ef4444' },
        ].map(stat => (
          <div key={stat.label} style={{
            padding: '10px 18px',
            background: 'var(--color-bg-card)',
            border: '1px solid var(--color-border)',
            borderRadius: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minWidth: 110,
          }}>
            <span style={{ fontSize: 11, color: 'var(--color-text-muted)', letterSpacing: 0.5 }}>{stat.label}</span>
            <span style={{ fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1.2 }}>{stat.value}</span>
          </div>
        ))}
      </div>

      {/* ── SYSTEM COMPATIBILITY BANNER ── */}
      {isUnsupportedWindows ? (
        <div className="alert alert-danger" style={{ marginBottom: 24, padding: '16px 20px', borderRadius: 12, textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontWeight: 800, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444' }}>
            <span>⚠️</span> Peringatan: Sistem Tidak Didukung!
          </div>
          <div style={{ fontSize: 13, lineHeight: 1.5 }}>
            Sistem mendeteksi server lokal Anda berjalan pada <strong>Windows {systemInfo?.os_release} ({systemInfo?.os_arch})</strong>. 
            Versi Windows 7/8/8.1 atau sistem 32-bit <strong>tidak didukung secara resmi</strong>. 
            Driver VPN WireGuard (Wintun) dan runtime Node.js tidak akan berjalan stabil dan dapat menyebabkan kegagalan koneksi. 
            Disarankan untuk melakukan upgrade ke <strong>Windows 10/11 (64-bit)</strong> atau <strong>Windows Server 2016 ke atas</strong>.
          </div>
        </div>
      ) : (
        <div style={{
          background: 'rgba(34, 197, 94, 0.06)',
          border: '1px solid rgba(34, 197, 94, 0.25)',
          borderRadius: 12,
          padding: '14px 20px',
          marginBottom: 24,
          fontSize: 13,
          color: 'var(--color-text)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: 16
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 280 }}>
            <span style={{ fontSize: 18 }}>🟢</span>
            <span>
              <strong>Syarat Sistem Easy Tunnel:</strong> Windows 10/11 (64-bit) atau Windows Server 2016/2019/2022 (Minimal RAM 4GB, Driver WireGuard resmi). Windows 7/8/32-bit tidak didukung.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{
              background: 'rgba(34, 197, 94, 0.15)',
              color: '#4ade80',
              padding: '4px 10px',
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              border: '1px solid rgba(34, 197, 94, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: 4
            }}>
              ✅ Kompatibel
            </span>
            {systemInfo && (
              <span style={{
                background: 'rgba(255,255,255,0.05)',
                color: 'var(--color-text-muted)',
                padding: '4px 10px',
                borderRadius: 20,
                fontSize: 11,
                fontWeight: 600,
                border: '1px solid var(--color-border)'
              }}>
                OS: {systemInfo.platform === 'win32' ? 'Windows' : systemInfo.platform} ({systemInfo.os_arch || '64-bit'})
              </span>
            )}
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          <span>⚠️</span> {error}
        </div>
      )}

      {/* ── FILTER BAR & SEARCH ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1 1 200px', maxWidth: 320 }}>
          <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: 'var(--color-text-muted)', pointerEvents: 'none' }}>🔍</span>
          <input
            type="text"
            className="form-input"
            placeholder="Cari nama, domain, key..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 32, height: 36, fontSize: 13 }}
          />
        </div>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {FILTERS.map(f => {
            let count = 0;
            if (f.key === 'all') count = mergedItems.length;
            else if (f.key === 'installed') count = mergedItems.filter(i => i.isInstalledHere).length;
            else if (f.key === 'idle') count = mergedItems.filter(i => !i.isInstalledHere && !i.lic.active_hostname && !i.exp.isExpired).length;
            else count = mergedItems.filter(i => i.primaryStatus === f.key).length;

            return (
              <button
                key={f.key}
                onClick={() => setFilterStatus(f.key)}
                style={{
                  padding: '5px 12px',
                  borderRadius: 20,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  border: filterStatus === f.key ? '1px solid var(--color-accent)' : '1px solid var(--color-border)',
                  background: filterStatus === f.key ? 'rgba(99, 102, 241, 0.15)' : 'transparent',
                  color: filterStatus === f.key ? 'var(--color-accent)' : 'var(--color-text-muted)',
                  transition: 'all 0.15s',
                  whiteSpace: 'nowrap',
                }}
              >
                {f.label}
                {f.key !== 'all' && (
                  <span style={{ marginLeft: 4, opacity: 0.7 }}>({count})</span>
                )}
              </button>
            );
          })}
        </div>
        {/* Right controls */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Segmented Control Switcher */}
          <div style={{
            display: 'flex',
            background: 'rgba(15, 28, 55, 0.6)',
            border: '1px solid var(--color-border)',
            borderRadius: 8,
            padding: 3,
            gap: 2,
          }}>
            <button
              onClick={() => toggleViewMode('card')}
              style={{
                padding: '4px 10px',
                border: 'none',
                background: viewMode === 'card' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'card' ? '#fff' : 'var(--color-text-muted)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Tampilan Kartu"
            >
              🎴 Kartu
            </button>
            <button
              onClick={() => toggleViewMode('table')}
              style={{
                padding: '4px 10px',
                border: 'none',
                background: viewMode === 'table' ? 'var(--color-primary)' : 'transparent',
                color: viewMode === 'table' ? '#fff' : 'var(--color-text-muted)',
                borderRadius: 6,
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: 600,
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Tampilan Tabel"
            >
              📋 Tabel
            </button>
          </div>

          {/* Refresh button */}
          <button
            className="btn btn-outline btn-sm"
            onClick={loadData}
            style={{ fontSize: 12, height: 32 }}
            title="Refresh data"
          >
            🔄
          </button>
        </div>
      </div>

      {/* ── LICENSE LIST ── */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--color-text-muted)' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
          <p style={{ marginTop: 16 }}>Memuat data lisensi...</p>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="card" style={{ padding: 48, textAlign: 'center', borderStyle: 'dashed' }}>
          <span style={{ fontSize: 36, display: 'block', marginBottom: 12 }}>🔍</span>
          <h4 style={{ margin: '0 0 8px', color: 'var(--color-text)' }}>
            {cloudLicenses.length === 0 ? 'Belum Ada Lisensi' : 'Tidak Ada Hasil'}
          </h4>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13, margin: '0 0 20px' }}>
            {cloudLicenses.length === 0
              ? 'Beli atau klaim lisensi Easy Tunnel untuk memulai.'
              : 'Coba ubah filter atau kata kunci pencarian.'}
          </p>
          {cloudLicenses.length === 0 && (
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
              <button className="btn btn-outline" onClick={() => setShowClaimModal(true)}>🔑 Klaim Key</button>
              <button className="btn btn-primary" onClick={() => navigate('/order')}>➕ Beli Lisensi</button>
            </div>
          )}
        </div>
      ) : viewMode === 'card' ? (
        <DashboardCardView
          items={filteredItems}
          actionLoading={actionLoading}
          actionError={actionError}
          onTunnelAction={handleTunnelAction}
          onSetupClick={openSetupModal}
          onDiagnoseClick={handleDiagnoseClick}
          onForceReleaseClick={handleForceRelease}
          onEditClick={openEditModal}
          baseDomain={getBaseDomain(systemInfo?.license_server_url)}
        />
      ) : (
        <DashboardTableView
          items={filteredItems}
          actionLoading={actionLoading}
          actionError={actionError}
          onTunnelAction={handleTunnelAction}
          onSetupClick={openSetupModal}
          onDiagnoseClick={handleDiagnoseClick}
          onForceReleaseClick={handleForceRelease}
          onEditClick={openEditModal}
          baseDomain={getBaseDomain(systemInfo?.license_server_url)}
        />
      )}

      {/* ── MODAL 1: KLAIM LISENSI ── */}
      <ClaimLicenseModal
        isOpen={showClaimModal}
        onClose={() => setShowClaimModal(false)}
        onSuccess={loadData}
      />

      {/* ── MODAL 2: SETUP TUNNEL ── */}
      <SetupTunnelModal
        isOpen={showSetupModal}
        selectedLicense={selectedLicense}
        onClose={() => {
          setShowSetupModal(false);
          setSelectedLicense(null);
        }}
        onSuccess={loadData}
        baseDomain={getBaseDomain(systemInfo?.license_server_url)}
      />

      {/* ── MODAL 3: EDIT TUNNEL ── */}
      <EditTunnelModal
        isOpen={showEditModal}
        tunnel={selectedEditTunnel}
        onClose={() => {
          setShowEditModal(false);
          setSelectedEditTunnel(null);
        }}
        onSuccess={loadData}
      />

      {/* ── MODAL 3: KONTROL VNC LOKAL ── */}
      {selectedVncLicense && (
        <VncControlModal
          isOpen={showVncControlModal}
          onClose={() => {
            setShowVncControlModal(false);
            setSelectedVncLicense(null);
          }}
          licenseKey={selectedVncLicense.license_key}
          schoolName={selectedVncLicense.school_name}
          vncStatus={vncStatus}
          onRefreshStatus={refreshVncStatus}
        />
      )}

      {/* ── MODAL 4: VNC REMOTE VIEWER ── */}
      {selectedVncLicense && (
        <VncViewerModal
          isOpen={showVncViewerModal}
          onClose={() => {
            setShowVncViewerModal(false);
            setSelectedVncLicense(null);
          }}
          licenseKey={selectedVncLicense.license_key}
          schoolName={selectedVncLicense.school_name}
          licenseServerUrl={systemInfo?.license_server_url}
        />
      )}
    </div>
  );
}
