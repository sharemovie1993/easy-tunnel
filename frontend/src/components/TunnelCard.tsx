import { useState } from 'react';
import { Tunnel, tunnelApi } from '../services/api';
import StatusBadge from './StatusBadge';

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
  const [loading, setLoading] = useState<'start' | 'stop' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updatingPort, setUpdatingPort] = useState(false);
  const [isEditingPort, setIsEditingPort] = useState(false);
  const [editPortValue, setEditPortValue] = useState(String(tunnel.local_port || ''));

  async function handlePortChange(newPort: number) {
    setUpdatingPort(true);
    setError(null);
    try {
      await tunnelApi.changePort(tunnel.id, newPort);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdatingPort(false);
    }
  }

  const isConnected = tunnel.wg_status?.status === 'connected';
  const subdomain = tunnel.subdomain ? `${tunnel.subdomain}.absenta.id` : null;
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
        <div className="alert alert-danger" style={{ marginTop: 8, marginBottom: 0 }}>
          ⚠️ {error}
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
    </div>
  );
}
