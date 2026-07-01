import { useState, useEffect, useRef } from 'react';
import { Package } from '../services/api';
import { PREDEFINED_APPS, PORT_HINTS } from '../utils/appData';

type PaymentMode = 'punya-key' | 'beli-baru';

interface OrderDetailStepProps {
  isRenewMode: boolean;
  paymentMode: PaymentMode;
  setPaymentMode: (mode: PaymentMode) => void;
  licenseKey: string;
  setLicenseKey: (val: string) => void;
  keyStatus: 'idle' | 'checking' | 'valid' | 'invalid';
  keyInfo: any;
  schoolName: string;
  setSchoolName: (val: string) => void;
  packages: Package[];
  selectedPlan: string;
  setSelectedPlan: (val: string) => void;
  paymentMethod: string;
  setPaymentMethod: (val: string) => void;
  paymentChannels: any[];
  appName: string;
  setAppName: (val: string) => void;
  localPort: number | '';
  setLocalPort: (val: number | '') => void;
  subdomainSlug: string;
  setSubdomainSlug: (val: string) => void;
  slugStatus: 'idle' | 'checking' | 'available' | 'taken';
  slugMessage: string;
  loading: boolean;
  onNext: () => void;
  baseDomain?: string;
}

export default function OrderDetailStep({
  isRenewMode,
  paymentMode,
  setPaymentMode,
  licenseKey,
  setLicenseKey,
  keyStatus,
  keyInfo,
  schoolName,
  setSchoolName,
  packages,
  selectedPlan,
  setSelectedPlan,
  paymentMethod,
  setPaymentMethod,
  paymentChannels,
  appName,
  setAppName,
  localPort,
  setLocalPort,
  subdomainSlug,
  setSubdomainSlug,
  slugStatus,
  slugMessage,
  loading,
  onNext,
  baseDomain = 'absenta.id',
}: OrderDetailStepProps) {
  // App select dropdown states & handlers
  const [selectedAppOption, setSelectedAppOption] = useState<string>('');
  const [customAppName, setCustomAppName] = useState('');

  const handleAppOptionChange = (val: string) => {
    setSelectedAppOption(val);
    if (val !== 'other') {
      setAppName(val);
      const matched = PREDEFINED_APPS.find(app => app.name === val);
      if (matched && matched.defaultPort) {
        setLocalPort(matched.defaultPort);
      }
    } else {
      setAppName(customAppName);
    }
  };

  const handleCustomAppNameChange = (val: string) => {
    setCustomAppName(val);
    setAppName(val);
  };

  // Sync appName from props load with selectedAppOption & customAppName
  useEffect(() => {
    if (appName) {
      const match = PREDEFINED_APPS.find(app => app.name === appName);
      if (match) {
        setSelectedAppOption(appName);
      } else {
        setSelectedAppOption('other');
        setCustomAppName(appName);
      }
    }
  }, [appName]);

  // Payment custom dropdown states & refs
  const [showPaymentDropdown, setShowPaymentDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPaymentDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  return (
    <div className="card">
      {/* Mode toggle */}
      {!isRenewMode ? (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          <button
            id="mode-punya-key"
            className={`btn ${paymentMode === 'punya-key' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setPaymentMode('punya-key')}
          >
            🔑 Punya License Key
          </button>
          <button
            id="mode-beli-baru"
            className={`btn ${paymentMode === 'beli-baru' ? 'btn-primary' : 'btn-outline'}`}
            style={{ flex: 1, justifyContent: 'center' }}
            onClick={() => setPaymentMode('beli-baru')}
          >
            🛒 Beli Berlangganan Baru
          </button>
        </div>
      ) : (
        <div className="alert alert-info" style={{ marginBottom: 24, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ fontWeight: 700 }}>🔄 Mode Perpanjangan Lisensi</div>
          <div style={{ fontSize: 12 }}>Kunci Lisensi: <code style={{ letterSpacing: 0.5 }}>{licenseKey}</code></div>
        </div>
      )}

      {paymentMode === 'punya-key' ? (
        <div className="form-group">
          <label className="form-label">License Key Easy Tunnel</label>
          <input
            id="input-license-key"
            type="text"
            className="form-input"
            placeholder="ETN-XXXX-XXXX-XXXX"
            value={licenseKey}
            onChange={e => setLicenseKey(e.target.value.toUpperCase())}
          />
          {keyStatus === 'checking' && <p className="form-hint">⏳ Memverifikasi key...</p>}
          {keyStatus === 'valid' && keyInfo && (
            <p className="form-hint success">
              ✅ Key valid — {keyInfo.school_name} · Aktif hingga {new Date(keyInfo.expires_at).toLocaleDateString('id-ID')}
            </p>
          )}
          {keyStatus === 'invalid' && <p className="form-hint error">❌ Key tidak ditemukan atau tidak aktif</p>}
        </div>
      ) : (
        <>
          <div className="form-group">
            <label className="form-label">Nama Instansi / Sekolah</label>
            <input id="input-school-name" type="text" className="form-input" placeholder="SDN 1 Cibinong" value={schoolName} onChange={e => setSchoolName(e.target.value)} disabled={isRenewMode || loading} />
          </div>

          <div className="form-group">
            <label className="form-label">Pilih Paket</label>
            <div className="package-grid">
              {packages.map(pkg => (
                <div
                  key={pkg.id}
                  id={`pkg-${pkg.id}`}
                  className={`package-card ${selectedPlan === pkg.id ? 'selected' : ''}`}
                  onClick={() => setSelectedPlan(pkg.id)}
                >
                  {pkg.badge && <div className="package-badge">{pkg.badge}</div>}
                  <div className="package-title">{pkg.title}</div>
                  <div className="package-price">
                    {pkg.price.replace('Rp ', 'Rp ')}
                    <span>/{pkg.duration}</span>
                  </div>
                  <div className="package-duration">1 Port / Aplikasi</div>
                </div>
              ))}
            </div>
          </div>

          <div className="form-group" ref={dropdownRef} style={{ position: 'relative' }}>
            <label className="form-label">Metode Pembayaran</label>
            
            {/* Trigger Button */}
            <div
              onClick={() => !loading && setShowPaymentDropdown(!showPaymentDropdown)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 14px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-border)',
                background: 'rgba(15, 28, 55, 0.5)',
                color: 'var(--color-text)',
                cursor: loading ? 'not-allowed' : 'pointer',
                userSelect: 'none',
                minHeight: 42,
                opacity: loading ? 0.6 : 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                {paymentMethod === 'manual' ? (
                  <>
                    <span style={{ fontSize: 18 }}>🏦</span>
                    <span style={{ fontWeight: 600 }}>Transfer Manual (Konfirmasi WhatsApp)</span>
                  </>
                ) : (() => {
                  const selectedChannel = paymentChannels.find(ch => ch.code === paymentMethod);
                  return selectedChannel ? (
                    <>
                      {selectedChannel.icon_url ? (
                        <img src={selectedChannel.icon_url} alt={selectedChannel.name} style={{ height: 18, maxWidth: 65, objectFit: 'contain' }} />
                      ) : (
                        <span style={{ fontSize: 18 }}>💳</span>
                      )}
                      <span style={{ fontWeight: 600 }}>{selectedChannel.name} (Otomatis)</span>
                    </>
                  ) : (
                    <span style={{ color: 'var(--color-text-dim)' }}>-- Pilih Metode Pembayaran --</span>
                  );
                })()}
              </div>
              <span style={{ fontSize: 10, color: 'var(--color-text-muted)', transform: showPaymentDropdown ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▼</span>
            </div>

            {/* Dropdown Menu Panel */}
            {showPaymentDropdown && (
              <div style={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                marginTop: 6,
                background: 'rgba(15, 28, 55, 0.95)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                backdropFilter: 'blur(20px)',
                boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
                zIndex: 100,
                maxHeight: 280,
                overflowY: 'auto',
              }}>
                {/* Manual Option */}
                <div
                  onClick={() => {
                    setPaymentMethod('manual');
                    setShowPaymentDropdown(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '10px 14px',
                    cursor: 'pointer',
                    background: paymentMethod === 'manual' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                    borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                  onMouseLeave={e => e.currentTarget.style.background = paymentMethod === 'manual' ? 'rgba(59, 130, 246, 0.15)' : 'transparent'}
                >
                  <span style={{ fontSize: 18 }}>🏦</span>
                  <span style={{ fontWeight: paymentMethod === 'manual' ? 700 : 500 }}>Transfer Manual (Konfirmasi WhatsApp)</span>
                  {paymentMethod === 'manual' && <span style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>}
                </div>

                {/* Channels Options */}
                {paymentChannels.map(ch => (
                  <div
                    key={ch.code}
                    onClick={() => {
                      setPaymentMethod(ch.code);
                      setShowPaymentDropdown(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 12,
                      padding: '10px 14px',
                      cursor: 'pointer',
                      background: paymentMethod === ch.code ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
                    onMouseLeave={e => e.currentTarget.style.background = paymentMethod === ch.code ? 'rgba(59, 130, 246, 0.15)' : 'transparent'}
                  >
                    {ch.icon_url ? (
                      <img src={ch.icon_url} alt={ch.name} style={{ height: 18, width: 60, objectFit: 'contain' }} />
                    ) : (
                      <span style={{ fontSize: 18 }}>💳</span>
                    )}
                    <span style={{ fontWeight: paymentMethod === ch.code ? 700 : 500 }}>{ch.name} (Otomatis)</span>
                    {paymentMethod === ch.code && <span style={{ marginLeft: 'auto', color: 'var(--color-primary)', fontWeight: 700 }}>✓</span>}
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}

      <div className="divider" />

      <div className="form-group">
        <label className="form-label">Nama Aplikasi</label>
        {isRenewMode ? (
          <input id="input-app-name" type="text" className="form-input" value={appName} disabled={true} />
        ) : (
          <>
            <select
              id="select-app-option"
              className="form-select"
              value={selectedAppOption}
              onChange={e => handleAppOptionChange(e.target.value)}
              disabled={loading}
              style={{ marginBottom: selectedAppOption === 'other' ? 10 : 0 }}
            >
              <option value="" disabled>-- Pilih Aplikasi --</option>
              <optgroup label="Dunia Pendidikan Indonesia">
                {PREDEFINED_APPS.filter(a => a.category === 'Pendidikan Indonesia').map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name} (Port Default: {a.defaultPort})
                  </option>
                ))}
              </optgroup>
              <optgroup label="Aplikasi Umum & Sysadmin">
                {PREDEFINED_APPS.filter(a => a.category === 'Aplikasi Umum & Sysadmin').map(a => (
                  <option key={a.name} value={a.name}>
                    {a.name} (Port Default: {a.defaultPort})
                  </option>
                ))}
              </optgroup>
              <option value="other">Aplikasi Lainnya (Ketik Manual)</option>
            </select>

            {selectedAppOption === 'other' && (
              <input
                id="input-custom-app-name"
                type="text"
                className="form-input"
                placeholder="Ketik nama aplikasi Anda (contoh: Dapodik SMKN 1 Bogor)"
                value={customAppName}
                onChange={e => handleCustomAppNameChange(e.target.value)}
                disabled={loading}
                required
              />
            )}
          </>
        )}
        <p className="form-hint">Nama untuk identifikasi tunnel ini di dashboard</p>
      </div>

      <div className="form-group">
        <label className="form-label">Port Lokal Aplikasi</label>
        <div className="input-group">
          <input
            id="input-local-port"
            type="number"
            className="form-input"
            placeholder="8983"
            min={1}
            max={65535}
            value={localPort}
            onChange={e => setLocalPort(e.target.value ? parseInt(e.target.value) : '')}
            disabled={isRenewMode || loading}
          />
        </div>
        {!isRenewMode && (
          <p className="form-hint">
            Port umum:{' '}
            {PORT_HINTS.map(h => (
              <button key={h.port} className="btn btn-outline btn-sm" style={{ marginRight: 4, marginTop: 4 }} onClick={() => setLocalPort(h.port)}>
                {h.port}
              </button>
            ))}
          </p>
        )}
      </div>

      <div className="form-group">
        <label className="form-label">Subdomain Publik</label>
        <div className="input-group">
          <input
            id="input-subdomain"
            type="text"
            className="form-input"
            placeholder="dapodik-smkn1"
            value={subdomainSlug}
            onChange={e => setSubdomainSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
            disabled={isRenewMode || loading}
          />
          <span className="btn btn-outline" style={{ cursor: 'default', borderLeft: 'none' }}>.{baseDomain}</span>
        </div>
        {slugStatus === 'checking' && <p className="form-hint">⏳ Mengecek ketersediaan...</p>}
        {slugStatus === 'available' && <p className="form-hint success">✅ Subdomain tersedia</p>}
        {slugStatus === 'taken' && <p className="form-hint error">❌ {slugMessage || 'Subdomain sudah digunakan'}</p>}
      </div>

      <button
        id="btn-next-step"
        className="btn btn-primary btn-lg btn-block"
        onClick={onNext}
        disabled={loading || slugStatus === 'checking' || keyStatus === 'checking'}
      >
        {loading ? <span className="spinner" /> : null}
        {paymentMode === 'punya-key' ? '🚀 Aktifkan Tunnel Sekarang' : '💳 Lanjut ke Pembayaran'}
      </button>
    </div>
  );
}
