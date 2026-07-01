import React, { useState, useEffect } from 'react';
import { VncScreen } from 'react-vnc';

interface VncViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  licenseKey: string;
  schoolName: string;
  licenseServerUrl?: string;
}

export default function VncViewerModal({
  isOpen,
  onClose,
  licenseKey,
  schoolName,
  licenseServerUrl = 'https://api.absenta.id'
}: VncViewerModalProps) {
  const [password, setPassword] = useState('');
  const [passwordSubmitted, setPasswordSubmitted] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setPasswordSubmitted(false);
      setConnectionStatus('connecting');
      setErrorMsg(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Membuat URL WebSocket Proxy
  const getProxyWsUrl = () => {
    try {
      const cleanUrl = licenseServerUrl.trim();
      const proto = cleanUrl.startsWith('https') ? 'wss://' : 'ws://';
      const host = cleanUrl.replace(/^https?:\/\//, '');
      return `${proto}${host}/api/vnc/connect/${licenseKey}`;
    } catch (e) {
      return `wss://api.absenta.id/api/vnc/connect/${licenseKey}`;
    }
  };

  const handlePasswordSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setPasswordSubmitted(true);
    setConnectionStatus('connecting');
    setErrorMsg(null);
  };

  const wsUrl = getProxyWsUrl();

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: '#0b0f19',
      display: 'flex', flexDirection: 'column', zIndex: 1100,
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* ── HEADER VIEWER ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 24px', background: '#111827', borderBottom: '1px solid rgba(255,255,255,0.06)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button
            onClick={onClose}
            style={{
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', borderRadius: 8, padding: '6px 14px', fontSize: 13,
              fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
              transition: 'background 0.2s'
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
          >
            ← Kembali
          </button>
          <div>
            <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#f3f4f6' }}>
              💻 Remote Desktop: {schoolName}
            </h4>
            <span style={{ fontSize: 11, color: '#9ca3af' }}>License Key: {licenseKey}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {passwordSubmitted && (
            <span style={{
              fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 20,
              background: connectionStatus === 'connected' ? 'rgba(34,197,94,0.15)' : connectionStatus === 'connecting' ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)',
              color: connectionStatus === 'connected' ? '#4ade80' : connectionStatus === 'connecting' ? '#fbbf24' : '#f87171',
              border: '1px solid currentColor'
            }}>
              {connectionStatus === 'connected' ? '🟢 Terhubung' : connectionStatus === 'connecting' ? '⚡ Menyambungkan...' : '🔴 Terputus'}
            </span>
          )}
        </div>
      </div>

      {/* ── VIEWER BODY ── */}
      <div style={{
        flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: '#030712', position: 'relative', overflow: 'hidden'
      }}>
        
        {/* A. Prompt Input Password VNC */}
        {!passwordSubmitted && (
          <div style={{
            width: '100%', maxWidth: 400, padding: 32, background: '#111827',
            border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16,
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)', textAlign: 'center'
          }}>
            <span style={{ fontSize: 42, display: 'block', marginBottom: 16 }}>🔒</span>
            <h3 style={{ margin: '0 0 8px', fontSize: 18, color: '#f3f4f6', fontWeight: 700 }}>
              Masukkan Sandi VNC
            </h3>
            <p style={{ margin: '0 0 24px', fontSize: 12, color: '#9ca3af', lineHeight: 1.5 }}>
              Harap masukkan kata sandi akses VNC yang telah Anda atur sebelumnya pada komputer target.
            </p>

            <form onSubmit={handlePasswordSubmit}>
              <div className="form-group" style={{ textAlign: 'left', marginBottom: 20 }}>
                <label className="form-label" style={{ color: '#d1d5db' }}>Kata Sandi Remote</label>
                <input
                  type="password"
                  className="form-input"
                  placeholder="Password VNC PC target"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={{
                    background: '#1f2937', color: '#fff', border: '1px solid #374151',
                    width: '100%', height: 40, padding: '0 12px', borderRadius: 8
                  }}
                  required
                  autoFocus
                />
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  onClick={onClose}
                  style={{ flex: 1, height: 40, fontSize: 13 }}
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1, height: 40, fontSize: 13 }}
                >
                  Hubungkan
                </button>
              </div>
            </form>
          </div>
        )}

        {/* B. noVNC Screen Viewer */}
        {passwordSubmitted && (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {connectionStatus === 'connecting' && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                textAlign: 'center', zIndex: 10, pointerEvents: 'none'
              }}>
                <div className="spinner" style={{ width: 40, height: 40, margin: '0 auto 16px', border: '3px solid #6366f1', borderTopColor: 'transparent' }} />
                <p style={{ color: '#fff', fontSize: 14, margin: 0 }}>Menghubungkan ke remote desktop...</p>
                <span style={{ color: '#9ca3af', fontSize: 11, display: 'block', marginTop: 4 }}>
                  Proxying via Caddy & WireGuard Tunnel
                </span>
              </div>
            )}

            {errorMsg && (
              <div style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                textAlign: 'center', zIndex: 10, background: '#1f2937', padding: 24, borderRadius: 12,
                border: '1px solid #ef4444', maxWidth: 380
              }}>
                <span style={{ fontSize: 32, display: 'block', marginBottom: 12 }}>⚠️</span>
                <p style={{ color: '#fca5a5', fontSize: 13, margin: '0 0 16px', lineHeight: 1.5 }}>
                  {errorMsg}
                </p>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => setPasswordSubmitted(false)}
                  style={{ color: '#fff', borderColor: '#374151' }}
                >
                  Coba Lagi
                </button>
              </div>
            )}

            {/* Canvas noVNC react-vnc wrapper */}
            <VncScreen
              url={wsUrl}
              rfbOptions={{
                credentials: {
                  password: password
                }
              } as any}
              scaleViewport={true}
              background="#030712"
              style={{
                width: '100%',
                height: '100%',
                display: 'block'
              }}
              onConnect={() => {
                setConnectionStatus('connected');
                setErrorMsg(null);
              }}
              onDisconnect={() => {
                setConnectionStatus('disconnected');
                setErrorMsg('Koneksi terputus. Pastikan VNC Server di PC klien menyala dengan password yang benar dan terhubung tunnel.');
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
