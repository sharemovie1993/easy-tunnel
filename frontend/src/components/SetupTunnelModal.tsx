import React, { useState, useEffect } from 'react';
import { tunnelApi } from '../services/api';

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

interface SetupTunnelModalProps {
  isOpen: boolean;
  selectedLicense: CloudLicense | null;
  onClose: () => void;
  onSuccess: () => void;
  baseDomain?: string;
}

export default function SetupTunnelModal({ isOpen, selectedLicense, onClose, onSuccess, baseDomain = 'absenta.id' }: SetupTunnelModalProps) {
  const [setupSlug, setSetupSlug] = useState('');
  const [setupPort, setSetupPort] = useState(5002);
  const [setupAppName, setSetupAppName] = useState('');
  const [setupLoading, setSetupLoading] = useState(false);
  const [setupError, setSetupError] = useState<string | null>(null);

  // Sync state with selected license props
  useEffect(() => {
    if (selectedLicense) {
      setSetupSlug(selectedLicense.requested_slug || '');
      setSetupPort(selectedLicense.local_port || 5002);
      setSetupAppName(selectedLicense.app_name || selectedLicense.school_name);
    }
  }, [selectedLicense]);

  if (!isOpen || !selectedLicense) return null;

  const handleSetupTunnel = async (e: React.FormEvent) => {
    e.preventDefault();
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
        onSuccess();
        onClose();
      } else {
        setSetupError(res.message || 'Gagal memasang konfigurasi tunnel.');
      }
    } catch (err: any) {
      setSetupError(err.message || 'Terjadi kesalahan.');
    } finally {
      setSetupLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 480, padding: 28, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
        >✕</button>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 6px', color: 'var(--color-text)' }}>
          Pasang Rute Tunnel
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
          Konfigurasikan terowongan di komputer ini untuk: <strong>{selectedLicense.school_name}</strong>
        </p>
        {setupError && <div className="alert alert-danger" style={{ marginBottom: 16 }}><span>⚠️</span> {setupError}</div>}
        <form onSubmit={handleSetupTunnel} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
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
              <span className="btn btn-outline" style={{ borderLeft: 'none', background: 'rgba(0,0,0,0.1)' }}>.{baseDomain}</span>
            </div>
            <span className="form-hint">Alamat web publik yang memetakan aplikasi lokal Anda.</span>
          </div>
          <div className="form-group">
            <label className="form-label">Port Aplikasi Lokal</label>
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
            <span className="form-hint">Port server lokal yang berjalan di PC ini (Dapodik, Rapor, dsb).</span>
          </div>
          <div className="form-group">
            <label className="form-label">Nama Aplikasi</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Dapodik"
              value={setupAppName}
              onChange={(e) => setSetupAppName(e.target.value)}
              disabled={setupLoading}
              required
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            <button type="button" className="btn btn-outline flex-1" onClick={onClose} disabled={setupLoading}>Batal</button>
            <button type="submit" className="btn btn-primary flex-1" disabled={setupLoading}>
              {setupLoading ? <span className="spinner" style={{ marginRight: 8 }} /> : '💾 '}
              Pasang Tunnel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
