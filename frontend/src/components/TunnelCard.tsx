import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tunnel, tunnelApi, systemApi } from '../services/api';
import StatusBadge from './StatusBadge';
import { getBaseDomain } from '../utils/domainUtils';

interface TunnelCardProps {
  tunnel: Tunnel;
  onRefresh: () => void;
}

// Port labels untuk aplikasi umum
const PORT_LABELS: Record<number, string> = {
  8983: 'Dapodik',
  9000: 'E-Rapor',
  80:   'HTTP',
  443:  'HTTPS',
  3000: 'Node/React',
  8080: 'Tomcat',
  5432: 'PostgreSQL',
  3306: 'MySQL',
};

export default function TunnelCard({ tunnel, onRefresh }: TunnelCardProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<'start' | 'stop' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingPort, setUpdatingPort] = useState(false);
  const [isEditingPort, setIsEditingPort] = useState(false);
  const [editPortValue, setEditPortValue] = useState(String(tunnel.local_port || ''));

  const [installing, setInstalling] = useState(false);
  const [polling, setPolling] = useState(false);
  const [installMsg, setInstallMsg] = useState<string | null>(null);
  const [wgInstalled, setWgInstalled] = useState<boolean | null>(null);
  const [baseDomain, setBaseDomain] = useState('absenta.id');

  // Cek status WireGuard saat card dimuat
  useEffect(() => {
    systemApi.wireGuardStatus()
      .then(res => setWgInstalled(res.installed))
      .catch(() => setWgInstalled(null));

    systemApi.info()
      .then(res => {
        if (res?.data?.license_server_url) {
          setBaseDomain(getBaseDomain(res.data.license_server_url));
        }
      })
      .catch(() => {});
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
              setError(null);
              onRefresh();
            }
          } catch {}
        }, 3000);
      } else if (res.success) {
        setWgInstalled(true);
        setInstallMsg('✅ WireGuard berhasil diinstall!');
        setError(null);
        onRefresh();
      }
    } catch (err: any) {
      setInstallMsg('❌ ' + err.message);
    } finally {
      setInstalling(false);
    }
  }

  async function handlePortChange(newPort: number) {
    setUpdatingPort(true);
    setError(null);
    try {
      await tunnelApi.editTunnel(tunnel.id, newPort, tunnel.name || '');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingPort(false);
    }
  }

  const isConnected = tunnel.wg_status?.status === 'connected';
  const subdomain = tunnel.subdomain ? `${tunnel.subdomain}.${baseDomain}` : null;
  const portLabel = tunnel.local_port ? PORT_LABELS[tunnel.local_port] : null;

  const expiresAt = tunnel.expires_at
    ? new Date(tunnel.expires_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  const isExpired = tunnel.expires_at
    ? (() => {
        const expDate = new Date(tunnel.expires_at);
        const today = new Date();
        const d1 = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        return Math.floor((d1 - d2) / (1000 * 60 * 60 * 24)) < 0;
      })()
    : false;

  const isWarning = tunnel.expires_at
    ? (() => {
        const expDate = new Date(tunnel.expires_at);
        const today = new Date();
        const d1 = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
        const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
        const diffDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
        return diffDays >= 0 && diffDays <= 3;
      })()
    : false;

  async function handleStart() {
    setLoading('start');
    setError(null);
    try {
      await tunnelApi.start(tunnel.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleStop() {
    setLoading('stop');
    setError(null);
    try {
      await tunnelApi.stop(tunnel.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  async function handleDelete() {
    if (!confirm(`Yakin hapus tunnel "${tunnel.name}"? Tunnel akan berhenti dan konfigurasi dihapus.`)) return;
    setLoading('delete');
    try {
      await tunnelApi.remove(tunnel.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className={`card tunnel-card ${isConnected ? 'is-connected' : ''}`}>
      <div className="tunnel-card-header">
        <div>
          <h3 className="tunnel-card-name">
            {portLabel && <span style={{ marginRight: 6 }}>📡</span>}
            {tunnel.name}
          </h3>
          {subdomain ? (
            <a
              className="tunnel-card-url"
              href={`https://${subdomain}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              🌐 https://{subdomain}
            </a>
          ) : (
            <span style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>Subdomain belum dikonfigurasi</span>
          )}
        </div>
        <StatusBadge status={loading === 'start' ? 'loading' : (tunnel.wg_status?.status || 'disconnected')} />
      </div>

      {/* Info detail - TAMPIL DI MODE AKTIF/TERHUBUNG */}
      {isConnected && (tunnel.app_name || subdomain || tunnel.local_port) && (
        <div style={{
          fontSize: 12,
          color: 'var(--color-text)',
          background: 'rgba(34, 197, 94, 0.06)',
          padding: '8px 12px',
          borderRadius: 6,
          border: '1px solid rgba(34, 197, 94, 0.15)',
          marginBottom: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 4
        }}>
          {tunnel.app_name && (
            <div>🖥️ Aplikasi: <strong>{tunnel.app_name}</strong></div>
          )}
          {subdomain && (
            <div>🌐 Domain: <strong style={{ color: 'var(--color-accent)' }}>{subdomain}</strong></div>
          )}
          {tunnel.local_port && (
            <div>🔌 Port Lokal: <strong>{tunnel.local_port}{portLabel ? ` (${portLabel})` : ''}</strong></div>
          )}
        </div>
      )}

      <div className="tunnel-card-meta">
        {tunnel.local_port && (
          <span className="meta-chip" style={{ display: 'inline-flex', alignItems: 'center' }}>
            {isEditingPort ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                🔌 Port: 
                <input
                  type="number"
                  value={editPortValue}
                  onChange={(e) => setEditPortValue(e.target.value)}
                  style={{
                    width: 60,
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 4,
                    color: 'var(--color-text)',
                    padding: '1px 4px',
                    fontSize: 11,
                    outline: 'none'
                  }}
                  min="1"
                  max="65535"
                  disabled={updatingPort}
                  autoFocus
                />
                <button
                  onClick={async () => {
                    const newPort = parseInt(editPortValue, 10);
                    if (!isNaN(newPort) && newPort >= 1 && newPort <= 65535) {
                      await handlePortChange(newPort);
                      setIsEditingPort(false);
                    } else {
                      alert('Port tidak valid (1-65535).');
                    }
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center' }}
                  title="Simpan"
                  disabled={updatingPort}
                >
                  {updatingPort ? '⏳' : '✅'}
                </button>
                <button
                  onClick={() => {
                    setIsEditingPort(false);
                    setEditPortValue(String(tunnel.local_port));
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: 11, display: 'inline-flex', alignItems: 'center' }}
                  title="Batal"
                  disabled={updatingPort}
                >
                  ❌
                </button>
              </span>
            ) : (
              <>
                🔌 Port {tunnel.local_port}
                {portLabel && ` (${portLabel})`}
                <button
                  onClick={() => {
                    setEditPortValue(String(tunnel.local_port));
                    setIsEditingPort(true);
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    marginLeft: 6,
                    cursor: 'pointer',
                    padding: 0,
                    fontSize: 12,
                    display: 'inline-flex',
                    alignItems: 'center'
                  }}
                  title="Ubah Port"
                  disabled={updatingPort}
                >
                  ✏️
                </button>
              </>
            )}
          </span>
        )}
        {tunnel.wg_ip && (
          <span className="meta-chip">
            🔒 VPN {tunnel.wg_ip}
          </span>
        )}
        {tunnel.expires_at && (() => {
          const expDate = new Date(tunnel.expires_at);
          const today = new Date();
          const d1 = Date.UTC(expDate.getFullYear(), expDate.getMonth(), expDate.getDate());
          const d2 = Date.UTC(today.getFullYear(), today.getMonth(), today.getDate());
          const diffDays = Math.floor((d1 - d2) / (1000 * 60 * 60 * 24));
          
          if (diffDays < 0) {
            return (
              <span className="meta-chip" style={{ background: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                ⚠️ Kedaluwarsa
              </span>
            );
          } else if (diffDays <= 3) {
            return (
              <span className="meta-chip" style={{ background: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                ⚠️ Exp: {expiresAt} ({diffDays === 0 ? 'Hari ini' : `${diffDays} hari lagi`})
              </span>
            );
          } else {
            return (
              <span className="meta-chip">
                📅 {expiresAt}
              </span>
            );
          }
        })()}
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginTop: 8, marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
            <span>⚠️</span>
            <span>{error}</span>
          </div>
          {error.toLowerCase().includes('wireguard belum terinstall') && (
            <div style={{ marginTop: 4 }}>
              {installMsg && (
                <div style={{ 
                  fontSize: 12, 
                  color: installMsg.startsWith('❌') ? 'var(--color-danger)' : 'var(--color-success)', 
                  marginBottom: 8,
                  fontWeight: 600,
                  textAlign: 'left'
                }}>
                  {installMsg}
                </div>
              )}
              <button
                className="btn btn-primary btn-sm"
                onClick={handleInstallWireGuard}
                disabled={installing || polling}
                style={{ width: '100%', justifyContent: 'center' }}
              >
                {installing || polling ? (
                  <>
                    <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                    {polling ? 'Menginstall...' : 'Memulai download...'}
                  </>
                ) : (
                  '⬇️ Auto-Install WireGuard Now'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      <div className="tunnel-card-actions">
        {isConnected ? (
          <button
            id={`btn-stop-${tunnel.id}`}
            className="btn btn-danger btn-sm"
            onClick={handleStop}
            disabled={loading !== null}
          >
            {loading === 'stop' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '⏹'}
            Nonaktifkan
          </button>
        ) : (
          <button
            id={`btn-start-${tunnel.id}`}
            className="btn btn-success btn-sm"
            onClick={handleStart}
            disabled={loading !== null || isExpired || !tunnel.subdomain}
            title={isExpired ? 'Lisensi telah kedaluwarsa' : ''}
          >
            {loading === 'start' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '▶'}
            Aktifkan
          </button>
        )}

        {(isExpired || isWarning) && (
          <button
            className="btn btn-warning btn-sm"
            onClick={() => navigate(`/order?key=${tunnel.license_key}&mode=renew`)}
            style={{ marginLeft: 8 }}
          >
            🔄 Perpanjang
          </button>
        )}

        <button
          id={`btn-delete-${tunnel.id}`}
          className="btn btn-outline btn-sm"
          onClick={handleDelete}
          disabled={loading !== null}
          style={{ marginLeft: 'auto' }}
        >
          {loading === 'delete' ? <span className="spinner" style={{ width: 12, height: 12 }} /> : '🗑'}
          Hapus
        </button>
      </div>

      {/* Tombol Auto-Install WireGuard — tampil permanen jika WireGuard belum terinstall */}
      {wgInstalled === false && !error && (
        <div style={{
          marginTop: 10,
          paddingTop: 10,
          borderTop: '1px solid var(--color-border)'
        }}>
          {installMsg && (
            <div style={{ 
              fontSize: 12, 
              color: installMsg.startsWith('❌') ? 'var(--color-danger)' : 'var(--color-success)', 
              marginBottom: 8,
              fontWeight: 600
            }}>
              {installMsg}
            </div>
          )}
          {wgInstalled === false && !installMsg?.startsWith('✅') && (
            <button
              className="btn btn-outline btn-sm"
              onClick={handleInstallWireGuard}
              disabled={installing || polling}
              style={{ width: '100%', justifyContent: 'center', fontSize: 12 }}
            >
              {installing || polling ? (
                <>
                  <span className="spinner" style={{ width: 12, height: 12, marginRight: 6 }} />
                  {polling ? 'Menginstall WireGuard...' : 'Memulai download...'}
                </>
              ) : (
                '⬇️ Auto-Install WireGuard'
              )}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
