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

interface DashboardTableViewProps {
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

export default function DashboardTableView({
  items,
  actionLoading,
  actionError,
  onTunnelAction,
  onSetupClick,
  onDiagnoseClick,
  onForceReleaseClick,
  onEditClick,
  baseDomain = 'absenta.id',
}: DashboardTableViewProps) {
  const navigate = useNavigate();

  return (
    <div className="table-container">
      <table className="dashboard-table">
        <thead>
          <tr>
            <th>Sekolah & Aplikasi</th>
            <th>Kunci Lisensi & Domain</th>
            <th>Masa Berlaku</th>
            <th>Status Terowongan</th>
            <th style={{ textAlign: 'center' }}>Stempel</th>
            <th style={{ textAlign: 'right' }}>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {items.map(({ lic, localTunnel, isConnected, isInstalledHere, isGhostLock, exp }) => {
            const tunnelId = localTunnel?.id;
            // Gunakan hash dummy untuk actionLoading force-release
            const tempId = lic.license_key.charCodeAt(0) + lic.license_key.charCodeAt(lic.license_key.length-1);
            const aLoading = tunnelId ? actionLoading[tunnelId] : actionLoading[tempId];
            const aError = tunnelId ? actionError[tunnelId] : actionError[tempId];
            const subdomain = lic.requested_slug ? `${lic.requested_slug}.${baseDomain}` : null;

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
              <tr key={lic.id}>
                {/* Sekolah / Aplikasi */}
                <td>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--color-text)' }}>
                    🏫 {lic.school_name}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 2 }}>
                    Aplikasi: <span style={{ fontWeight: 600, color: lic.app_name ? 'var(--color-text-muted)' : 'var(--color-text-dim)' }}>{lic.app_name || '—'}</span>
                  </div>
                </td>

                {/* Kunci Lisensi / Domain */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>
                      <code style={{ fontFamily: 'monospace', fontSize: 11, background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4, color: 'var(--color-accent)' }}>
                        {lic.license_key}
                      </code>
                    </div>
                    <div style={{ fontSize: 12 }}>
                      {subdomain ? (
                        <a
                          href={`https://${subdomain}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: 'var(--color-accent)', textDecoration: 'none', fontWeight: 600 }}
                          onClick={e => e.stopPropagation()}
                        >
                          🌐 {subdomain}
                        </a>
                      ) : (
                        <span style={{ fontStyle: 'italic', color: 'var(--color-text-dim)', fontSize: 11 }}>Belum diatur</span>
                      )}
                    </div>
                  </div>
                </td>

                {/* Masa Berlaku */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <div style={{ fontWeight: 600 }}>{exp.label || '—'}</div>
                    {exp.label && (
                      <div style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: exp.isExpired ? '#ef4444' : exp.isWarning ? '#f59e0b' : '#22c55e'
                      }}>
                        {getFriendlyRemainingTime(lic.expires_at)}
                      </div>
                    )}
                  </div>
                </td>

                {/* Status Terowongan */}
                <td>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div>
                      <span style={{ fontWeight: 700, color: tunnelBadge.color, fontSize: 12 }}>
                        {tunnelBadge.text}
                      </span>
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--color-text-muted)' }}>
                      {lic.active_hostname ? (
                        <span>PC: <strong style={{ color: 'var(--color-text)' }}>{lic.active_hostname}</strong></span>
                      ) : (
                        <span style={{ color: 'var(--color-text-dim)' }}>PC: —</span>
                      )}
                      {lic.local_port ? (
                        <span style={{ marginLeft: 8 }}>Port: <strong style={{ color: 'var(--color-text)' }}>{lic.local_port}</strong></span>
                      ) : null}
                      {/* isInstalledHere && (
                        <span style={{ marginLeft: 8 }}>VNC: <strong style={{ color: vncStatus?.running ? '#22c55e' : '#94a3b8' }}>{vncStatus?.running ? 'Aktif' : 'Nonaktif'}</strong></span>
                      ) */}
                    </div>
                  </div>
                </td>

                {/* Stempel */}
                <td style={{ textAlign: 'center' }}>
                  {exp.isExpired ? (
                    <div className="stamp-mini stamp-mini-expired">
                      EXPIRED
                    </div>
                  ) : (isInstalledHere || lic.active_hostname) ? (
                    <div className="stamp-mini stamp-mini-terpakai">
                      TERPAKAI
                    </div>
                  ) : (
                    <div className="stamp-mini stamp-mini-kosong">
                      KOSONG
                    </div>
                  )}
                </td>

                {/* Aksi */}
                <td style={{ textAlign: 'right' }}>
                  <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
                    {/* Error actions if any */}
                    {aError && (
                      <span style={{ fontSize: 11, color: '#ef4444', marginRight: 4 }} title={aError}>
                        ⚠️ Error
                      </span>
                    )}

                    {/* License Renew Button */}
                    {(exp.isExpired || exp.isWarning) && (
                      <button
                        className="btn btn-warning btn-sm"
                        onClick={() => navigate(`/order?key=${lic.license_key}&mode=renew`)}
                        style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                        title="Perpanjang Lisensi"
                      >
                        🔄 Perpanjang
                      </button>
                    )}

                    {/* Tunnel Actions */}
                    {isInstalledHere && localTunnel ? (
                      <>
                        {isConnected ? (
                          <button
                            className="btn btn-danger btn-sm"
                            onClick={() => onTunnelAction(localTunnel.id, 'stop')}
                            disabled={!!aLoading}
                            style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          >
                            {aLoading === 'stop' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '⏹'} Stop
                          </button>
                        ) : (
                          <button
                            className="btn btn-success btn-sm"
                            onClick={() => onTunnelAction(localTunnel.id, 'start')}
                            disabled={!!aLoading || exp.isExpired}
                            style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          >
                            {aLoading === 'start' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '▶'} Start
                          </button>
                        )}

                        {/* <button
                          className="btn btn-outline btn-sm"
                          onClick={() => onVncControlClick(lic)}
                          style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          title="Kelola Remote VNC"
                        >
                          🖥️ VNC
                        </button> */}

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => onEditClick(localTunnel)}
                          disabled={!!aLoading}
                          style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          title="Edit port atau nama aplikasi"
                        >
                          ✏️ Edit
                        </button>

                        <button
                          className="btn btn-outline btn-sm"
                          onClick={() => onDiagnoseClick(localTunnel.id)}
                          disabled={!!aLoading}
                          style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          title="Diagnosa Koneksi VPN"
                        >
                          {aLoading === 'diagnose' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🔍 Diagnosa'}
                        </button>

                        <button
                          className="btn btn-outline btn-sm btn-danger-outline"
                          onClick={() => onTunnelAction(localTunnel.id, 'delete')}
                          disabled={!!aLoading}
                          style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
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
                            style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600 }}
                          >
                            ⚙️ Pasang Tunnel
                          </button>
                        )}
                        
                        {isGhostLock && (
                          <button
                            className="btn btn-outline btn-sm btn-danger-outline"
                            onClick={() => onForceReleaseClick(lic.license_key)}
                            disabled={!!aLoading}
                            style={{ fontSize: 11, padding: '5px 10px', fontWeight: 600, color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.3)' }}
                            title="Hapus kunci paksa dari PC ini"
                          >
                            {aLoading === 'force-release' ? <span className="spinner" style={{ width: 10, height: 10 }} /> : '🗑 Sinkronkan (Hapus Kunci)'}
                            </button>
                        )}
                      </>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
