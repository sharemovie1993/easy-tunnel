import React, { useState, useEffect } from 'react';
import { authApi } from '../services/api';

interface LoginPageProps {
  onLoginSuccess: (token: string, nomor: string) => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [nomor, setNomor] = useState('');
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'request' | 'verify'>('request');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Timer countdown untuk kirim ulang OTP
  const [timer, setTimer] = useState(0);

  useEffect(() => {
    if (timer > 0) {
      const interval = setInterval(() => {
        setTimer(prev => prev - 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [timer]);

  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nomor.trim()) {
      setError('Nomor WhatsApp wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await authApi.requestOtp(nomor);
      if (res.success) {
        setSuccess('Kode OTP berhasil dikirim ke nomor WhatsApp Anda.');
        setStep('verify');
        setTimer(60); // 60 detik countdown
      } else {
        setError(res.message || 'Gagal mengirim OTP.');
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengirim OTP. Pastikan server lisensi aktif.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) {
      setError('Kode OTP wajib diisi.');
      return;
    }

    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const res = await authApi.verifyOtp(nomor, code);
      if (res.success && res.token) {
        setSuccess('Verifikasi berhasil! Mengalihkan...');
        setTimeout(() => {
          onLoginSuccess(res.token, nomor);
        }, 1000);
      } else {
        setError(res.message || 'Kode OTP tidak valid.');
      }
    } catch (err: any) {
      setError(err.message || 'Verifikasi gagal. Pastikan OTP benar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">🌐</span>
          <h2 className="login-title">Masuk / Daftar</h2>
          <p className="login-desc" style={{ marginBottom: 16 }}>Akses Dashboard Gateway Easy Tunnel</p>
        </div>

        {/* Step Indicator */}
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', marginBottom: '24px' }}>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            padding: '4px 12px',
            borderRadius: '12px',
            background: step === 'request' ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.04)',
            color: step === 'request' ? 'white' : 'var(--color-text-dim)',
            border: step === 'request' ? 'none' : '1px solid var(--color-border)',
            boxShadow: step === 'request' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}>
            1. Kirim OTP WA
          </span>
          <span style={{ fontSize: '11px', color: 'var(--color-text-dim)' }}>➔</span>
          <span style={{
            fontSize: '11px',
            fontWeight: '700',
            padding: '4px 12px',
            borderRadius: '12px',
            background: step === 'verify' ? 'var(--gradient-primary)' : 'rgba(255,255,255,0.04)',
            color: step === 'verify' ? 'white' : 'var(--color-text-dim)',
            border: step === 'verify' ? 'none' : '1px solid var(--color-border)',
            boxShadow: step === 'verify' ? '0 2px 8px rgba(59,130,246,0.3)' : 'none',
            transition: 'all 0.3s ease'
          }}>
            2. Verifikasi OTP
          </span>
        </div>

        {error && (
          <div className="alert alert-danger" style={{ textAlign: 'left', marginBottom: 16 }}>
            <span>⚠️</span> {error}
          </div>
        )}

        {success && (
          <div className="alert alert-success" style={{ textAlign: 'left', marginBottom: 16 }}>
            <span>✓</span> {success}
          </div>
        )}

        {step === 'request' ? (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            {/* Info Box untuk Mengatur Psikologi UX */}
            <div style={{
              background: 'rgba(6, 182, 212, 0.05)',
              border: '1px solid rgba(6, 182, 212, 0.2)',
              borderRadius: '12px',
              padding: '14px',
              textAlign: 'left',
              marginBottom: '20px',
              fontSize: '12px',
              lineHeight: '1.6'
            }}>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '13px', fontWeight: '700', color: 'var(--color-accent)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                💡 Info Pendaftaran & Akun
              </h4>
              <ul style={{ margin: 0, paddingLeft: '16px', color: 'var(--color-text-muted)' }}>
                <li style={{ marginBottom: '4px' }}>
                  <strong>Belum terdaftar?</strong> Cukup masukkan nomor WA Anda. Akun operator baru akan otomatis dibuat secara instan dan gratis.
                </li>
                <li style={{ marginBottom: '4px' }}>
                  <strong>Sudah punya lisensi?</strong> Gunakan nomor WhatsApp yang Anda pakai saat transaksi pembelian/klaim lisensi.
                </li>
                <li>
                  <strong>Tanpa Kata Sandi:</strong> Keamanan terjamin melalui verifikasi OTP instan. Tidak ada kata sandi yang perlu diingat.
                </li>
              </ul>
            </div>

            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Nomor WhatsApp Anda</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: 08123456789 atau 628123456789"
                value={nomor}
                onChange={(e) => setNomor(e.target.value)}
                disabled={loading}
                required
              />
              <span className="form-hint">Kode verifikasi OTP akan dikirim otomatis melalui chat WhatsApp dari bot lisensi.</span>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <span className="spinner" style={{ marginRight: 8 }}></span> : '✉️ '}
              Kirim Kode OTP
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="form-group" style={{ textAlign: 'left' }}>
              <label className="form-label">Kode Verifikasi OTP (6-Digit)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Masukkan 6 digit angka OTP"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={loading}
                style={{ textAlign: 'center', fontSize: 18, letterSpacing: 6, fontWeight: 700 }}
                required
              />
              <span className="form-hint">Masukkan kode verifikasi yang Anda terima di WhatsApp nomor <strong>{nomor}</strong>.</span>
            </div>

            <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
              {loading ? <span className="spinner" style={{ marginRight: 8 }}></span> : '🔑 '}
              Verifikasi & Masuk
            </button>

            <div style={{ marginTop: 16, fontSize: 13 }}>
              {timer > 0 ? (
                <span style={{ color: 'var(--color-text-dim)' }}>
                  Kirim ulang OTP dalam <strong>{timer}</strong> detik
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOtp}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--color-accent)',
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline'
                  }}
                  disabled={loading}
                >
                  Kirim Ulang Kode OTP
                </button>
              )}
            </div>

            <button
              type="button"
              className="btn btn-outline btn-block"
              style={{ marginTop: 12 }}
              onClick={() => {
                setStep('request');
                setError('');
                setSuccess('');
              }}
              disabled={loading}
            >
              ← Kembali
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
