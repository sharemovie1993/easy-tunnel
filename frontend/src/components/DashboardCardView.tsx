import { useNavigate } from 'react-router-dom';
import { Tunnel } from '../services/api';
import { getFriendlyRemainingTime } from '../utils/dateUtils';

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

interface MergedItem {
  lic: CloudLicense;
  localTunnel: Tunnel | null;
  isConnected: boolean;
  isInstalledHere: boolean;
  isGhostLock: boolean;
  exp: {
    diffDays: number | null;
    isExpired: boolean;
    isWarning: boolean;
    label: string | null;
  };
}

interface DashboardCardViewProps {
  items: MergedItem[];
  actionLoading: Record<number, string>;
  actionError: Record<number, string>;
  onTunnelAction: (id: number, action: 'start' | 'stop' | 'delete') => void;
  onSetupClick: (lic: CloudLicense) => void;
  onDiagnoseClick: (id: number) => void;
  onForceReleaseClick: (licenseKey: string) => void;
  onEditClick: (tunnel: Tunnel) => void;
  baseDomain?: string;
}

export default function DashboardCardView({
  items,
  actionLoading,
  actionError,
  onTunnelAction,
  onSetupClick,
  onDiagnoseClick,
  onForceReleaseClick,
  onEditClick,
  baseDomain = 'absenta.id',
}: DashboardCardViewProps) {
  const navigate = useNavigate();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map(({ lic, localTunnel, isConnected, isInstalledHere, isGhostLock, exp }) => {
        const tunnelId = localTunnel?.id;
        // Gunakan hash dummy untuk actionLoading force-release
        const tempId = lic.license_key.charCodeAt(0) + lic.license_key.charCodeAt(lic.license_key.length-1);
        const aLoading = tunnelId ? actionLoading[tunnelId] : actionLoading[tempId];
        const aError = tunnelId ? actionError[tunnelId] : actionError[tempId];
        const subdomain = lic.requested_slug ? `${lic.requested_slug}.${baseDomain}` : null;

        // Border color reflects overall priority: expired (red) > warning (yellow) > connected (green) > default
        const borderColor = exp.isExpired
          ? '#ef4444'
          : exp.isWarning
            ? '#f59e0b'
            : isConnected
              ? '#22c55e'
              : 'var(--color-border)';

        const licenseStatusText = exp.isExpired
          ? '🔴 Kedaluwarsa'
          : exp.isWarning
            ? '⚠️ Segera Habis'
            : '🟢 Aktif';
        const licenseStatusColor = exp.isExpired
          ? '#ef4444'
          : exp.isWarning
            ? '#f59e0b'
            : '#22c55e';

        // Tunnel Badge (Physical Device Connection Status)
        const tunnelBadge = isConnected
          ? { text: '🟢 Terhubung', bg: 'rgba(34,197,94,0.1)', color: '#22c55e' }
          : isGhostLock
            ? { text: '⚠️ Data Lokal Hilang', bg: 'rgba(239,68,68,0.1)', color: '#ef4444' }
            : lic.active_hostname && !isInstalledHere
              ? { text: '🔒 Terkunci (PC Lain)', bg: 'rgba(245,158,11,0.1)', color: '#f59e0b' }
              : isInstalledHere
                ? { text: '⚪ Terputus (Idle)', bg: 'rgba(148,163,184,0.1)', color: '#94a3b8' }
                : { text: '💤 Belum Dipasang', bg: 'rgba(100,116,139,0.1)', color: '#94a3b8' };

        return (
          <div
            key={lic.id}
            style={{
              background: 'var(--color-bg-card)',
              border: '1px solid var(--color-border)',
              borderLeft: `4px solid ${borderColor}`,
              borderRadius: 12,
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              transition: 'box-shadow 0.25s, transform 0.2s',
              position: 'relative',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.boxShadow = '0 6px 24px rgba(0,0,0,0.25)';
              e.currentTarget.style.transform = 'translateY(-2px)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            {/* ── CARD HEADER: NAMA SEKOLAH ── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: 10 }}>
              <span style={{ fontWeight: 800, fontSize: 16, color: 'var(--color-text)', display: 'flex', alignItems: 'center', gap: 6, marginRight: 130 }}>
                🏫 {lic.school_name}
              </span>
            </div>

            {/* ── STEMPEL VISUAL STATUS LISENSI ── */}
            {exp.isExpired ? (
              <div className="stamp stamp-expired" style={{ position: 'absolute', right: 20, top: 12 }}>
                EXPIRED
              </div>
            ) : (isInstalledHere || lic.active_hostname) ? (
              <div className="stamp stamp-terpakai" style={{ position: 'absolute', right: 20, top: 12 }}>
                TERPAKAI
              </div>
            ) : (
              <div className="stamp stamp-kosong" style={{ position: 'absolute', right: 20, top: 12 }}>
                KOSONG
              </div>
            )}

            {/* ── SPLIT PANEL LAYOUT USING VERTICAL SEPARATOR ── */}
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
              
              {/* BLOK LISENSI */}
              <div style={{ flex: '1 1 250px', display: 'flex', flexDirection: 'column', gap: 12 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Informasi Lisensi
                </span>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Status:</span>
                    <span style={{ fontWeight: 700, color: licenseStatusColor }}>
                      {licenseStatusText}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Key:</span>
                    <code style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-accent)' }}>
                      {lic.license_key}
                    </code>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Expire at:</span>
                    <span style={{ fontWeight: 500, color: 'var(--color-text)' }}>
                      {exp.label ? (
                        <>
                          {exp.label}{' '}
                          <span style={{
                            fontWeight: 700,
                            color: exp.isExpired ? '#ef4444' : exp.isWarning ? '#f59e0b' : '#22c55e'
                          }}>
                            ({getFriendlyRemainingTime(lic.expires_at)})
                          </span>
                        </>
                      ) : '—'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Domain:</span>
                    {subdomain ? (
                      <a
                        href={`https://${subdomain}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
                        onClick={e => e.stopPropagation()}
                      >
                        🌐 https://{subdomain}
                      </a>
                    ) : (
                      <span style={{ fontStyle: 'italic', color: 'var(--color-text-muted)' }}>Belum diatur</span>
                    )}
                  </div>
                </div>

                {/* License Actions */}
                <div style={{ marginTop: 'auto', paddingTop: 10 }}>
                  {exp.isExpired || exp.isWarning ? (
                    <button
                      className="btn btn-warning btn-sm"
                      onClick={() => navigate(`/order?key=${lic.license_key}&mode=renew`)}
                      style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
                    >
                      🔄 Perpanjang Lisensi
                    </button>
                  ) : (
                    <span style={{ fontSize: 11, color: '#22c55e', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 4 }}>
                      ✓ Lisensi Valid
                    </span>
                  )}
                </div>
              </div>

              {/* BLOK TUNNEL (DENGAN PEMBATAS VERTIKAL) */}
              <div className="tunnel-block" style={{
                flex: '1 1 250px',
                borderLeft: '1px solid var(--color-border)',
                paddingLeft: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 12
              }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Informasi Tunnel
                </span>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Status:</span>
                    <span style={{
                      fontWeight: 700,
                      color: tunnelBadge.color
                    }}>
                      {tunnelBadge.text}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Hostname:</span>
                    <span style={{ fontWeight: 600 }}>{lic.active_hostname || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Aplikasi:</span>
                    <span style={{ fontWeight: 600 }}>{lic.app_name || '—'}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>Port:</span>
                    <span style={{ fontWeight: 600 }}>{lic.local_port ? `🔌 ${lic.local_port}` : '—'}</span>
                  </div>
                  {/* isInstalledHere && (
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ color: 'var(--color-text-dim)', width: 90, flexShrink: 0 }}>VNC Server:</span>
                      <span style={{ fontWeight: 600, color: vncStatus?.running ? '#22c55e' : '#94a3b8' }}>
                        {vncStatus?.running ? '🟢 Aktif' : '⚪ Nonaktif'}
                      </span>
                    </div>
                  ) */}
                </div>

                {/* Tunnel Actions */}
                <div style={{ marginTop: 'auto', paddingTop: 10, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {isInstalledHere && localTunnel ? (
                    <>
                      {isConnected ? (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => onTunnelAction(localTunnel.id, 'stop')}
                          disabled={!!aLoading}
                          style={{ fontSize: 11, flex: '1 1 auto', padding: '6px 12px', fontWeight: 600 }}
                        >
                          {aLoading === 'stop' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '⏹'} Nonaktifkan
                        </button>
                      ) : (
                        <button
                          className="btn btn-success btn-sm"
                          onClick={() => onTunnelAction(localTunnel.id, 'start')}
                          disabled={!!aLoading || exp.isExpired}
                          style={{ fontSize: 11, flex: '1 1 auto', padding: '6px 12px', fontWeight: 600 }}
                        >
                          {aLoading === 'start' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '▶'} Aktifkan
                        </button>
                      )}

                      {/* <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onVncControlClick(lic)}
                        style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
                        title="Kelola Remote VNC"
                      >
                        🖥️ {vncStatus?.installed ? 'Kelola VNC' : 'Pasang VNC'}
                      </button> */}

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onEditClick(localTunnel)}
                        disabled={!!aLoading}
                        style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
                        title="Edit port atau nama aplikasi"
                      >
                        ✏️ Edit Port
                      </button>

                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => onDiagnoseClick(localTunnel.id)}
                        disabled={!!aLoading}
                        style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600 }}
                        title="Diagnosa Koneksi VPN"
                      >
                        {aLoading === 'diagnose' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🔍 Diagnosa'}
                      </button>

                      <button
                        className="btn btn-outline btn-sm btn-danger-outline"
                        onClick={() => onTunnelAction(localTunnel.id, 'delete')}
                        disabled={!!aLoading}
                        style={{ fontSize: 11, padding: '6px 12px', fontWeight: 600, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                        title="Hapus konfigurasi dari PC ini"
                      >
                        {aLoading === 'delete' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🗑 Hapus'}
                      </button>
                    </>
                  ) : (
                    // Tampilkan tombol pasang jika belum terinstal
                    <>
                      {!lic.active_hostname && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => onSetupClick(lic)}
                          disabled={exp.isExpired}
                          style={{ fontSize: 11, width: '100%', padding: '6px 12px', fontWeight: 600 }}
                        >
                          ⚙️ Pasang Tunnel di PC Ini
                        </button>
                      )}
                      
                      {isGhostLock && (
                        <button
                          className="btn btn-outline btn-sm btn-danger-outline"
                          onClick={() => onForceReleaseClick(lic.license_key)}
                          disabled={!!aLoading}
                          style={{ fontSize: 11, width: '100%', padding: '6px 12px', fontWeight: 600, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                          title="Hapus kunci paksa dari PC ini"
                        >
                          {aLoading === 'force-release' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🗑 Sinkronkan (Hapus Kunci)'}
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>

            </div>

            {/* Notifikasi Error Aksi */}
            {aError && (
              <div style={{ fontSize: 11, color: '#ef4444', display: 'flex', alignItems: 'center', gap: 4, marginTop: 4 }}>
                <span>⚠️</span> {aError}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
