import React, { useState } from 'react';
import { authApi } from '../services/api';

interface ClaimLicenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function ClaimLicenseModal({ isOpen, onClose, onSuccess }: ClaimLicenseModalProps) {
  const [claimKey, setClaimKey] = useState('');
  const [claimLoading, setClaimLoading] = useState(false);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimSuccess, setClaimSuccess] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleClaimLicense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimKey.trim()) return;
    setClaimLoading(true);
    setClaimError(null);
    setClaimSuccess(null);
    try {
      const res = await authApi.claimLicense(claimKey.trim());
      if (res.success) {
        setClaimSuccess('Lisensi berhasil diklaim!');
        setClaimKey('');
        onSuccess();
        setTimeout(() => {
          onClose();
          setClaimSuccess(null);
        }, 1500);
      } else {
        setClaimError(res.message || 'Gagal mengklaim lisensi.');
      }
    } catch (err: any) {
      setClaimError(err.message || 'Gagal mengklaim lisensi.');
    } finally {
      setClaimLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.7)', backdropFilter: 'blur(6px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 460, padding: 28, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
        >✕</button>
        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 8px', color: 'var(--color-text)' }}>
          Klaim Kunci Lisensi
        </h3>
        <p style={{ fontSize: 13, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
          Masukkan kunci lisensi Easy Tunnel yang Anda miliki untuk mengaitkannya dengan akun Anda.
        </p>
        {claimError && <div className="alert alert-danger" style={{ marginBottom: 16 }}><span>⚠️</span> {claimError}</div>}
        {claimSuccess && <div className="alert alert-success" style={{ marginBottom: 16 }}><span>✓</span> {claimSuccess}</div>}
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
            <button type="button" className="btn btn-outline flex-1" onClick={onClose} disabled={claimLoading}>Batal</button>
            <button type="submit" className="btn btn-primary flex-1" disabled={claimLoading}>
              {claimLoading ? <span className="spinner" style={{ marginRight: 8 }} /> : ''}
              Klaim Lisensi
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
