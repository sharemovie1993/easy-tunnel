import { useState, useEffect } from 'react';
import { Tunnel, tunnelApi } from '../services/api';

interface EditTunnelModalProps {
  isOpen: boolean;
  tunnel: Tunnel | null;
  onClose: () => void;
  onSuccess: () => void;
}

export default function EditTunnelModal({ isOpen, tunnel, onClose, onSuccess }: EditTunnelModalProps) {
  const [appName, setAppName] = useState('');
  const [localPort, setLocalPort] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen && tunnel) {
      setAppName(tunnel.name || '');
      setLocalPort(tunnel.local_port ? tunnel.local_port.toString() : '');
      setError(null);
    }
  }, [isOpen, tunnel]);

  if (!isOpen || !tunnel) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPort) {
      setError('Port lokal wajib diisi.');
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      await tunnelApi.editTunnel(tunnel.id, parseInt(localPort, 10), appName);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan konfigurasi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 400, padding: 28, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
        >✕</button>
        <h3 style={{ margin: '0 0 16px', fontSize: 18 }}>✏️ Edit Terowongan</h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 20 }}>
          Ubah port aplikasi lokal atau nama aplikasi untuk <strong>{tunnel.subdomain || tunnel.license_key}</strong>.
        </p>

        {error && (
          <div className="alert alert-danger" style={{ marginBottom: 16 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Nama Aplikasi (Opsional)</label>
            <input
              type="text"
              className="form-input"
              value={appName}
              onChange={e => setAppName(e.target.value)}
              placeholder="Misal: Dapodik, E-Rapor"
            />
            <div style={{ fontSize: 11, color: 'var(--color-text-dim)', marginTop: 4 }}>
              Hanya untuk penamaan di PC ini agar mudah dikenali.
            </div>
          </div>

          <div>
            <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Port Lokal Aplikasi</label>
            <input
              type="number"
              className="form-input"
              value={localPort}
              onChange={e => setLocalPort(e.target.value)}
              placeholder="Misal: 5774"
              min="1"
              max="65535"
              required
            />
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={onClose} disabled={loading}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
