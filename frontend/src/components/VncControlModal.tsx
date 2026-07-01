import React, { useState, useEffect, useRef } from 'react';
import { vncApi, VncStatus } from '../services/api';

interface VncControlModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseKey: string;
  schoolName: string;
  vncStatus: VncStatus | null;
  onRefreshStatus: () => void;
}

export default function VncControlModal({
  isOpen,
  onClose,
  licenseKey,
  schoolName,
  vncStatus,
  onRefreshStatus
}: VncControlModalProps) {
  const [password, setPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isInstalling, setIsInstalling] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showChangePassword, setShowChangePassword] = useState(false);
  
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    
    pollIntervalRef.current = setInterval(async () => {
      try {
        const statusRes = await vncApi.status();
        if (statusRes.success) {
          const state = statusRes.data.installState;
          if (statusRes.data.installed || state.status === 'success') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsInstalling(false);
            setSuccess('VNC Server berhasil dipasang! Silakan aktifkan dengan memasukkan kata sandi.');
            setError(null);
            onRefreshStatus();
          } else if (state.status === 'failed') {
            if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
            setIsInstalling(false);
            setError(state.error || 'Gagal memasang VNC Server.');
            setSuccess(null);
            onRefreshStatus();
          } else if (state.status === 'downloading') {
            setSuccess('Sedang mengunduh TightVNC installer...');
            setError(null);
          } else if (state.status === 'installing') {
            setSuccess('Sedang memasang VNC Server (menunggu konfirmasi UAC)...');
            setError(null);
          }
        }
      } catch (err) {
        console.error('[VNC Poll Error]', err);
      }
    }, 2000);
  };

  useEffect(() => {
    if (isOpen && vncStatus && (vncStatus.installState?.status === 'downloading' || vncStatus.installState?.status === 'installing')) {
      setIsInstalling(true);
      startPolling();
    }
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [isOpen, vncStatus?.installState?.status]);

  if (!isOpen) return null;

  const handleInstall = async () => {
    setError(null);
    setSuccess(null);
    setIsInstalling(true);
    try {
      const res = await vncApi.install();
      if (res.success) {
        setSuccess(res.message);
        startPolling();
      } else {
        setError(res.message || 'Gagal memulai instalasi VNC.');
        setIsInstalling(false);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal memasang VNC.');
      setIsInstalling(false);
    }
  };

  const handleStartVnc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 4 || password.length > 8) {
      setError('Kata sandi harus antara 4 sampai 8 karakter.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await vncApi.start(password);
      if (res.success) {
        setSuccess(res.message || 'Remote VNC berhasil diaktifkan.');
        setPassword('');
        onRefreshStatus();
      } else {
        setError(res.message || 'Gagal mengaktifkan Remote VNC.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengaktifkan Remote VNC.');
    } finally {
      setLoading(false);
    }
  };

  const handleStopVnc = async () => {
    if (!confirm('Apakah Anda yakin ingin menonaktifkan Remote VNC? PC ini tidak akan bisa diremote sementara.')) {
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await vncApi.stop();
      if (res.success) {
        setSuccess(res.message || 'Remote VNC berhasil dinonaktifkan.');
        onRefreshStatus();
      } else {
        setError(res.message || 'Gagal menonaktifkan Remote VNC.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal menonaktifkan Remote VNC.');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 4 || newPassword.length > 8) {
      setError('Kata sandi baru harus antara 4 sampai 8 karakter.');
      return;
    }
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await vncApi.start(newPassword);
      if (res.success) {
        setSuccess('Kata sandi VNC berhasil diubah.');
        setNewPassword('');
        setShowChangePassword(false);
        onRefreshStatus();
      } else {
        setError(res.message || 'Gagal mengubah kata sandi VNC.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah kata sandi VNC.');
    } finally {
      setLoading(false);
    }
  };

  const isVncInstalled = vncStatus?.installed || false;
  const isVncRunning = vncStatus?.running || false;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0, 0, 0, 0.75)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
    }}>
      <div className="card" style={{ width: '100%', maxWidth: 500, padding: 28, position: 'relative' }}>
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', color: 'var(--color-text-muted)', fontSize: 16, cursor: 'pointer' }}
          disabled={loading || isInstalling}
        >✕</button>

        <h3 style={{ fontSize: 18, fontWeight: 700, margin: '0 0 4px', color: 'var(--color-text)' }}>
          Remote VNC Desktop
        </h3>
        <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 20px' }}>
          Lisensi: <strong>{schoolName}</strong> ({licenseKey})
        </p>

        {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}><span>⚠️</span> {error}</div>}
        {success && <div className="alert alert-success" style={{ marginBottom: 16 }}><span>✓</span> {success}</div>}

        {/* 1. Belum Pasang VNC */}
        {!isVncInstalled && (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <span style={{ fontSize: 48, display: 'block', marginBottom: 16 }}>🖥️</span>
            <p style={{ fontSize: 13, color: 'var(--color-text)', lineHeight: 1.5, marginBottom: 20 }}>
              Sistem remote desktop (TightVNC Server) belum terpasang di komputer ini. 
              Gunakan fitur auto-install senyap (silent) di bawah untuk memasang otomatis.
            </p>
            <button
              className="btn btn-primary"
              onClick={handleInstall}
              disabled={isInstalling}
              style={{ width: '100%' }}
            >
              {isInstalling ? (
                <>
                  <span className="spinner" style={{ marginRight: 8 }} />
                  Sedang Mengunduh & Memasang VNC...
                </>
              ) : '⚙️ Pasang VNC Server Sekarang (Senyap)'}
            </button>
            {isInstalling && (
              <span style={{ display: 'block', fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8 }}>
                Mengunduh installer TightVNC Server dan memasang secara otomatis sebagai Windows Service.
              </span>
            )}
          </div>
        )}

        {/* 2. Sudah Pasang VNC */}
        {isVncInstalled && (
          <div>
            {/* Status Section */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid var(--color-border)',
              borderRadius: 10,
              padding: 16,
              marginBottom: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--color-text-muted)', display: 'block' }}>VNC SERVER STATE</span>
                <span style={{ fontWeight: 800, fontSize: 15, color: isVncRunning ? '#22c55e' : '#94a3b8' }}>
                  {isVncRunning ? '🟢 Aktif & Siap Diremote' : '⚪ Nonaktif'}
                </span>
              </div>
              <div>
                <button 
                  className="btn btn-outline btn-sm"
                  onClick={onRefreshStatus}
                  title="Refresh status"
                  disabled={loading}
                >
                  🔄 Refresh
                </button>
              </div>
            </div>

            {/* A. Running State */}
            {isVncRunning && !showChangePassword && (
              <div className="space-y-4">
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5 }}>
                  Remote VNC sudah aktif dan berjalan di port lokal 5900. 
                  Anda dapat meremote PC ini dari komputer manapun melalui tombol <strong>Remote PC Ini</strong> di dashboard.
                </p>

                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-outline flex-1"
                    onClick={() => setShowChangePassword(true)}
                    disabled={loading}
                  >
                    🔑 Ubah Sandi VNC
                  </button>
                  <button
                    type="button"
                    className="btn btn-danger flex-1"
                    onClick={handleStopVnc}
                    disabled={loading}
                  >
                    {loading ? <span className="spinner" style={{ marginRight: 8 }} /> : '⏹'} Nonaktifkan VNC
                  </button>
                </div>
              </div>
            )}

            {/* B. Change Password Form */}
            {isVncRunning && showChangePassword && (
              <form onSubmit={handleChangePassword} className="space-y-4">
                <div className="form-group">
                  <label className="form-label">Kata Sandi Baru (VNC Password)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Masukkan sandi baru (4 - 8 karakter)"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    maxLength={8}
                    disabled={loading}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Kata sandi harus berupa kombinasi alfanumerik antara 4 hingga 8 karakter.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-outline flex-1"
                    onClick={() => {
                      setShowChangePassword(false);
                      setError(null);
                    }}
                    disabled={loading}
                  >
                    Kembali
                  </button>
                  <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                    {loading ? <span className="spinner" style={{ marginRight: 8 }} /> : ''}
                    Simpan Sandi Baru
                  </button>
                </div>
              </form>
            )}

            {/* C. Not Running (Inactive) State: Perlu setup sandi pertama kali atau jalankan */}
            {!isVncRunning && (
              <form onSubmit={handleStartVnc} className="space-y-4">
                <p style={{ fontSize: 13, color: 'var(--color-text-muted)', lineHeight: 1.5, marginBottom: 12 }}>
                  Tentukan kata sandi akses VNC (remote desktop) untuk PC ini. 
                  Kata sandi ini digunakan untuk memverifikasi ketika Anda ingin mengakses PC ini dari jarak jauh.
                </p>
                <div className="form-group">
                  <label className="form-label">Kata Sandi VNC (4 - 8 Karakter)</label>
                  <input
                    type="password"
                    className="form-input"
                    placeholder="Masukkan kata sandi untuk remote"
                    value={password}
                    onChange={(e) => setPassword(e.target.value.replace(/[^a-zA-Z0-9]/g, ''))}
                    maxLength={8}
                    disabled={loading}
                    required
                  />
                  <span style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4, display: 'block' }}>
                    Sandi ini tersimpan aman di konfigurasi sistem lokal TightVNC.
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                  <button
                    type="button"
                    className="btn btn-outline flex-1"
                    onClick={onClose}
                    disabled={loading}
                  >
                    Tutup
                  </button>
                  <button type="submit" className="btn btn-primary flex-1" disabled={loading}>
                    {loading ? <span className="spinner" style={{ marginRight: 8 }} /> : '▶'}
                    Aktifkan Remote VNC
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
