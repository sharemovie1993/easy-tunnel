import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi, tunnelApi, authApi, Package } from '../services/api';

// Port hints untuk aplikasi umum
const PORT_HINTS: { port: number; label: string }[] = [
  { port: 8983, label: '8983 — Dapodik' },
  { port: 9000, label: '9000 — E-Rapor' },
  { port: 80,   label: '80   — HTTP (umum)' },
  { port: 8080, label: '8080 — Tomcat / HTTP Alt' },
  { port: 3000, label: '3000 — Node.js / React' },
  { port: 3001, label: '3001 — Node.js Alt' },
];

const formatPrice = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
};

type Step = 'detail' | 'payment' | 'activate';
type PaymentMode = 'punya-key' | 'beli-baru';

export default function OrderPage() {
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(window.location.search);
  const renewKeyParam = queryParams.get('key') || '';
  const isRenewMode = queryParams.get('mode') === 'renew';

  // Mode: apakah punya key sendiri atau beli baru
  const [paymentMode, setPaymentMode] = useState<PaymentMode>(isRenewMode ? 'beli-baru' : 'punya-key');

  // Step wizard
  const [step, setStep] = useState<Step>('detail');

  // Form fields
  const [licenseKey, setLicenseKey] = useState(renewKeyParam);
  const [appName, setAppName] = useState('');
  const [localPort, setLocalPort] = useState<number | ''>('');
  const [subdomainSlug, setSubdomainSlug] = useState('');
  const [selectedPlan, setSelectedPlan] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('manual');
  const [schoolName, setSchoolName] = useState('');

  // State
  const [packages, setPackages] = useState<Package[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(isRenewMode ? 'available' : 'idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [keyInfo, setKeyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Order result (setelah beli baru)
  const [orderResult, setOrderResult] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    orderApi.packages().then(res => {
      setPackages(res.data);
      if (res.data.length > 0) setSelectedPlan(res.data[0].id);
    }).catch(() => {});

    orderApi.paymentChannels().then(res => {
      const activeChannels = (res.data || []).filter((c: any) => c.active !== false);
      setPaymentChannels(activeChannels);
    }).catch(() => {});
  }, []);

  // Load existing license info for renewal mode immediately
  useEffect(() => {
    if (isRenewMode && renewKeyParam) {
      setKeyStatus('checking');
      orderApi.validateKey(renewKeyParam).then(res => {
        setKeyStatus('valid');
        setKeyInfo(res.data);
        setSchoolName(res.data.school_name || '');
        if (res.data.requested_slug) setSubdomainSlug(res.data.requested_slug);
        if (res.data.local_port) setLocalPort(res.data.local_port);
        if (res.data.app_name) setAppName(res.data.app_name);
        setSlugStatus('available');
      }).catch(() => {
        setKeyStatus('invalid');
      });
    }
  }, [isRenewMode, renewKeyParam]);

  // Slug availability check (debounced)
  useEffect(() => {
    if (isRenewMode) return;
    if (subdomainSlug.length < 3) { setSlugStatus('idle'); return; }
    setSlugStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await orderApi.checkSlug(subdomainSlug);
        setSlugStatus(res.available ? 'available' : 'taken');
        setSlugMessage(res.message);
      } catch {
        setSlugStatus('idle');
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [subdomainSlug, isRenewMode]);

  // License key validation (debounced)
  useEffect(() => {
    if (isRenewMode) return;
    if (paymentMode !== 'punya-key' || licenseKey.length < 8) { setKeyStatus('idle'); return; }
    setKeyStatus('checking');
    const timer = setTimeout(async () => {
      try {
        const res = await orderApi.validateKey(licenseKey);
        setKeyStatus('valid');
        setKeyInfo(res.data);
        setSchoolName(res.data.school_name || '');
        // Auto-isi subdomain dan port jika license sudah pernah dikonfig
        if (res.data.requested_slug) setSubdomainSlug(res.data.requested_slug);
        if (res.data.local_port) setLocalPort(res.data.local_port);
        if (res.data.app_name) setAppName(res.data.app_name);
      } catch {
        setKeyStatus('invalid');
        setKeyInfo(null);
      }
    }, 700);
    return () => clearTimeout(timer);
  }, [licenseKey, paymentMode, isRenewMode]);

  function validateStep1(): boolean {
    if (isRenewMode) {
      if (!licenseKey.trim()) { setError('Masukkan license key Anda.'); return false; }
      if (keyStatus !== 'valid') { setError('License key tidak valid atau belum diverifikasi.'); return false; }
    } else if (paymentMode === 'punya-key') {
      if (!licenseKey.trim()) { setError('Masukkan license key Anda.'); return false; }
      if (keyStatus !== 'valid') { setError('License key tidak valid atau belum diverifikasi.'); return false; }
    } else {
      if (!schoolName.trim()) { setError('Nama instansi wajib diisi.'); return false; }
      if (!selectedPlan) { setError('Pilih paket terlebih dahulu.'); return false; }
    }
    if (!appName.trim()) { setError('Nama aplikasi wajib diisi.'); return false; }
    if (!localPort || localPort < 1) { setError('Port lokal wajib diisi.'); return false; }
    if (!subdomainSlug.trim()) { setError('Subdomain wajib diisi.'); return false; }
    if (!isRenewMode) {
      if (slugStatus === 'taken') { setError('Subdomain sudah digunakan. Pilih yang lain.'); return false; }
      if (slugStatus !== 'available') { setError('Tunggu pengecekan subdomain selesai.'); return false; }
    }
    return true;
  }

  async function handleNextFromDetail() {
    setError(null);
    if (!validateStep1()) return;

    if (paymentMode === 'punya-key') {
      // Langsung ke aktivasi
      setStep('activate');
      await handleActivate();
    } else {
      // Order baru → ke payment step
      setLoading(true);
      try {
        const payload: any = { school_name: schoolName, plan_id: selectedPlan, payment_method: paymentMethod };
        if (isRenewMode) {
          payload.renew_license_key = licenseKey;
        }
        const res = await orderApi.newOrder(payload);
        setOrderResult(res);
        setLicenseKey(res.data?.license_key || res.license_key || licenseKey);
        setStep('payment');
        startPolling(res.data?.license_key || res.license_key || licenseKey);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  function startPolling(key: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await orderApi.paymentStatus(key);
        if (status.data?.is_active === 1 || status.data?.status === 'active') {
          if (pollingRef.current) clearInterval(pollingRef.current);
          setStep('activate');
          await handleActivate(key);
        }
      } catch {}
    }, 5000);
  }

  async function handleActivate(keyOverride?: string) {
    const key = keyOverride || licenseKey;
    setLoading(true);
    setError(null);
    try {
      // Auto-claim lisensi ke operator di VPS
      try {
        await authApi.claimLicense(key.trim());
      } catch (claimErr: any) {
        console.warn('Auto-claim license info:', claimErr.message);
        // Abaikan jika sudah diklaim
      }

      await tunnelApi.setup({
        license_key: key.trim(),
        subdomain_slug: subdomainSlug.trim().toLowerCase(),
        local_port: Number(localPort),
        app_name: appName.trim()
      });
      // Berhasil → redirect ke dashboard setelah 2 detik
      setTimeout(() => navigate('/'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const currentPackage = packages.find(p => p.id === selectedPlan);

  return (
    <div style={{ maxWidth: 640, margin: '0 auto' }}>
      <div className="page-header">
        <h1 className="page-title">
          {step === 'detail' ? '➕ Tambah Tunnel Baru' :
           step === 'payment' ? '💳 Pembayaran' :
           '🚀 Aktivasi Otomatis'}
        </h1>
        <p className="page-subtitle">
          {step === 'detail' ? 'Konfigurasi terowongan VPN untuk layanan lokal Anda' :
           step === 'payment' ? 'Selesaikan pembayaran untuk mengaktifkan lisensi' :
           'Tunnel Anda sedang dikonfigurasi...'}
        </p>
      </div>

      {/* Wizard Steps */}
      <div className="wizard-steps">
        <div className={`wizard-step ${step === 'detail' ? 'active' : 'done'}`}>
          <div className="step-circle">
            {step !== 'detail' ? '✓' : '1'}
          </div>
          <div className="step-label">Detail</div>
        </div>
        <div className={`wizard-step ${step === 'payment' ? 'active' : (step === 'activate' ? 'done' : '')} ${paymentMode === 'punya-key' ? '' : ''}`}>
          <div className="step-circle">
            {step === 'activate' ? '✓' : '2'}
          </div>
          <div className="step-label">Bayar</div>
        </div>
        <div className={`wizard-step ${step === 'activate' ? 'active' : ''}`}>
          <div className="step-circle">3</div>
          <div className="step-label">Aktif</div>
        </div>
      </div>

      {error && <div className="alert alert-danger">⚠️ {error}</div>}

      {/* ===== STEP 1: DETAIL ===== */}
      {step === 'detail' && (
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

              <div className="form-group">
                <label className="form-label">Metode Pembayaran</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(135px, 1fr))', gap: 10, marginTop: 8 }}>
                  {/* Manual Transfer Option */}
                  <div
                    className={`package-card ${paymentMethod === 'manual' ? 'selected' : ''}`}
                    style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: 75 }}
                    onClick={() => setPaymentMethod('manual')}
                  >
                    <div style={{ fontSize: 20, marginBottom: 4 }}>🏦</div>
                    <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.2 }}>Transfer Manual</div>
                  </div>

                  {/* Dynamic payment channels */}
                  {paymentChannels.map(ch => (
                    <div
                      key={ch.code}
                      className={`package-card ${paymentMethod === ch.code ? 'selected' : ''}`}
                      style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', height: 75 }}
                      onClick={() => setPaymentMethod(ch.code)}
                    >
                      {ch.icon_url ? (
                        <img src={ch.icon_url} alt={ch.name} style={{ height: 22, maxWidth: '100%', objectFit: 'contain', marginBottom: 6 }} />
                      ) : (
                        <div style={{ fontSize: 20, marginBottom: 4 }}>💳</div>
                      )}
                      <div style={{ fontSize: 10, fontWeight: 600, lineHeight: 1.2, color: 'var(--color-text)' }}>{ch.name}</div>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}

          <div className="divider" />

          <div className="form-group">
            <label className="form-label">Nama Aplikasi</label>
            <input id="input-app-name" type="text" className="form-input" placeholder="Dapodik SMKN 1 Bogor" value={appName} onChange={e => setAppName(e.target.value)} disabled={isRenewMode || loading} />
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
                Port umum: {PORT_HINTS.map(h => (
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
              <span className="btn btn-outline" style={{ cursor: 'default', borderLeft: 'none' }}>.absenta.id</span>
            </div>
            {slugStatus === 'checking' && <p className="form-hint">⏳ Mengecek ketersediaan...</p>}
            {slugStatus === 'available' && <p className="form-hint success">✅ Subdomain tersedia</p>}
            {slugStatus === 'taken' && <p className="form-hint error">❌ {slugMessage || 'Subdomain sudah digunakan'}</p>}
          </div>

          <button
            id="btn-next-step"
            className="btn btn-primary btn-lg btn-block"
            onClick={handleNextFromDetail}
            disabled={loading || slugStatus === 'checking' || keyStatus === 'checking'}
          >
            {loading ? <span className="spinner" /> : null}
            {paymentMode === 'punya-key' ? '🚀 Aktifkan Tunnel Sekarang' : '💳 Lanjut ke Pembayaran'}
          </button>
        </div>
      )}

      {/* ===== STEP 2: PAYMENT ===== */}
      {step === 'payment' && orderResult && (
        <div className="card">
          <div className="alert alert-info">
            ⏳ Menunggu konfirmasi pembayaran secara otomatis...
          </div>

          <div className="payment-box">
            <div style={{ fontSize: 13, color: 'var(--color-text-muted)', marginBottom: 8 }}>
              Total yang harus dibayar
            </div>
            <div className="payment-amount">
              {orderResult.data?.amount ? formatPrice(orderResult.data.amount) : (currentPackage?.price || 'Rp 50.000')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
              Untuk: {appName} · {subdomainSlug}.absenta.id
            </div>
          </div>

          {/* QRIS Code Image */}
          {orderResult.data?.qr_url && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '24px 0' }}>
              <div style={{ background: '#fff', padding: 16, borderRadius: 12, display: 'inline-block', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                <img
                  src={orderResult.data.qr_url}
                  alt="QRIS Code"
                  style={{ width: 200, height: 200, display: 'block' }}
                />
              </div>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 8, textAlign: 'center', maxWidth: 320 }}>
                Pindai QRIS di atas dengan aplikasi e-wallet Anda (Gopay, OVO, Dana, ShopeePay, BCA Mobile, dll.)
              </div>
            </div>
          )}

          {/* Virtual Account / Pay Code */}
          {orderResult.data?.pay_code && !orderResult.data?.qr_url && (
            <div style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--color-border)', borderRadius: 12, padding: '16px 20px', margin: '20px 0', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                NOMOR VIRTUAL ACCOUNT / KODE BAYAR
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                <strong style={{ fontSize: 22, color: 'var(--color-accent)', fontFamily: 'monospace', letterSpacing: 1 }}>
                  {orderResult.data.pay_code}
                </strong>
                <button
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    navigator.clipboard.writeText(orderResult.data.pay_code);
                    alert('Kode bayar berhasil disalin!');
                  }}
                >
                  Salin
                </button>
              </div>
            </div>
          )}

          {/* Dynamic Instructions */}
          {Array.isArray(orderResult.data?.instructions || orderResult.data?.payment_instructions) ? (
            <div style={{ marginTop: 24, textAlign: 'left' }}>
              <h4 style={{ fontSize: 13, fontWeight: 700, marginBottom: 12, color: 'var(--color-text)' }}>
                📖 Petunjuk Pembayaran:
              </h4>
              {(orderResult.data?.instructions || orderResult.data?.payment_instructions).map((inst: any, index: number) => (
                <div key={index} style={{ marginBottom: 16, background: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <strong style={{ fontSize: 12, color: 'var(--color-primary)', display: 'block', marginBottom: 6 }}>
                    {inst.title}
                  </strong>
                  <ol style={{ paddingLeft: 18, margin: 0, fontSize: 12, color: 'var(--color-text-muted)' }}>
                    {inst.steps.map((step: string, sIdx: number) => (
                      <li key={sIdx} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: step }}></li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          ) : (
            <div className="payment-instructions">
              <div className="instruction-step">
                <div className="step-num">1</div>
                <span>Transfer sesuai nominal yang tertera</span>
              </div>
              <div className="instruction-step">
                <div className="step-num">2</div>
                <span>Kirim bukti transfer ke WhatsApp Admin untuk aktivasi manual</span>
              </div>
            </div>
          )}

          <div className="divider" />

          <div style={{ fontSize: 12, color: 'var(--color-text-dim)', textAlign: 'center', marginBottom: 16 }}>
            License Key Anda: <code>{orderResult.data?.license_key || licenseKey}</code>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <button
              className="btn btn-outline btn-block"
              onClick={async () => {
                setLoading(true);
                try {
                  const status = await orderApi.paymentStatus(orderResult.data?.license_key || licenseKey);
                  if (status.data?.is_active === 1 || status.data?.status === 'active') {
                    if (pollingRef.current) clearInterval(pollingRef.current);
                    setStep('activate');
                    await handleActivate(orderResult.data?.license_key || licenseKey);
                  } else {
                    alert('Status pembayaran: Belum dibayar / Menunggu konfirmasi.');
                  }
                } catch (err: any) {
                  alert('Gagal memperbarui status: ' + err.message);
                } finally {
                  setLoading(false);
                }
              }}
              disabled={loading}
            >
              🔄 Perbarui Status Pembayaran
            </button>

            <button
              id="btn-wa-confirm"
              className="btn btn-success btn-block"
              onClick={() => {
                const waNum = '6287779937341';
                const isManual = paymentMethod === 'manual';
                const msgText = isManual 
                  ? `Halo Admin, saya sudah transfer pembayaran Easy Tunnel.\nNama: ${schoolName}\nAplikasi: ${appName}\nSubdomain: ${subdomainSlug}.absenta.id\nLicense Key: ${orderResult.data?.license_key || licenseKey}`
                  : `Halo Admin, saya mengajukan pembayaran Easy Tunnel via ${paymentMethod}.\nNama: ${schoolName}\nAplikasi: ${appName}\nSubdomain: ${subdomainSlug}.absenta.id\nLicense Key: ${orderResult.data?.license_key || licenseKey}`;
                const msg = encodeURIComponent(msgText);
                window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank');
              }}
            >
              📱 {paymentMethod === 'manual' ? 'Kirim Konfirmasi via WhatsApp' : 'Hubungi WhatsApp Admin (Butuh Bantuan)'}
            </button>
          </div>
        </div>
      )}

      {/* ===== STEP 3: ACTIVATION ===== */}
      {step === 'activate' && (
        <div className="card" style={{ textAlign: 'center', padding: 40 }}>
          {loading ? (
            <>
              <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4, margin: '0 auto 20px' }} />
              <h3 style={{ color: 'var(--color-text)', marginBottom: 8 }}>Mengaktifkan Tunnel...</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
                Server sedang mengkonfigurasi WireGuard peer.<br />
                Ini memerlukan beberapa detik...
              </p>
            </>
          ) : error ? (
            <>
              <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
              <h3 style={{ color: 'var(--color-danger)' }}>Aktivasi Gagal</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{error}</p>
              <button id="btn-retry-activate" className="btn btn-primary" style={{ marginTop: 16 }} onClick={() => handleActivate()}>
                🔄 Coba Lagi
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
              <h3 style={{ color: 'var(--color-success)', fontSize: 22 }}>Tunnel Berhasil Dibuat!</h3>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 8 }}>
                <strong style={{ color: 'var(--color-text)' }}>{appName}</strong> sekarang bisa diakses di:
              </p>
              <a
                href={`https://${subdomainSlug}.absenta.id`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: 'var(--color-accent)', fontSize: 16, fontWeight: 700, textDecoration: 'none' }}
              >
                🌐 https://{subdomainSlug}.absenta.id
              </a>
              <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 12 }}>
                Mengalihkan ke dashboard...
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
