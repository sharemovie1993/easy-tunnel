import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderApi, authApi, Package, systemApi } from '../services/api';
import OrderDetailStep from '../components/OrderDetailStep';
import OrderPaymentStep from '../components/OrderPaymentStep';
import OrderActivationStep from '../components/OrderActivationStep';
import { getBaseDomain } from '../utils/domainUtils';

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
  const [licenseServerUrl, setLicenseServerUrl] = useState('');

  // State
  const [packages, setPackages] = useState<Package[]>([]);
  const [paymentChannels, setPaymentChannels] = useState<any[]>([]);
  const [slugStatus, setSlugStatus] = useState<'idle' | 'checking' | 'available' | 'taken'>(isRenewMode ? 'available' : 'idle');
  const [slugMessage, setSlugMessage] = useState('');
  const [keyStatus, setKeyStatus] = useState<'idle' | 'checking' | 'valid' | 'invalid'>('idle');
  const [keyInfo, setKeyInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newExpiryDate, setNewExpiryDate] = useState<string>('');

  // Order result (setelah beli baru)
  const [orderResult, setOrderResult] = useState<any>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    systemApi.info().then(res => {
      if (res?.data?.license_server_url) {
        setLicenseServerUrl(res.data.license_server_url);
      }
    }).catch(() => {});

    orderApi.packages().then(res => {
      setPackages(res.data);
      if (res.data.length > 0) setSelectedPlan(res.data[0].id);
    }).catch(() => {});

    orderApi.paymentChannels().then(res => {
      const activeChannels = (res.data || []).filter((c: any) => c.active !== false);
      setPaymentChannels(activeChannels);
    }).catch(() => {});

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
      }
    };
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
      if (keyInfo?.expired) { setError('Lisensi Easy Tunnel telah kedaluwarsa. Silakan gunakan tombol perpanjangan di dashboard.'); return false; }
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
    if (loading) return;
    setError(null);
    if (!validateStep1()) return;

    if (paymentMode === 'punya-key') {
      setStep('activate');
      await handleActivate();
    } else {
      setLoading(true);
      try {
        const payload: any = {
          school_name: schoolName,
          plan_id: selectedPlan,
          payment_method: paymentMethod,
          subdomain_slug: subdomainSlug,
          app_name: appName,
          local_port: localPort,
          phone_number: localStorage.getItem('@easy_tunnel_operator') || undefined
        };
        if (isRenewMode) {
          payload.renew_license_key = licenseKey;
        }
        const res = await orderApi.newOrder(payload);
        setOrderResult(res);
        
        const resolvedKey = res.data?.license_key || res.license_key || licenseKey;
        setLicenseKey(resolvedKey);
        
        const invNum = res.data?.invoice_number || res.invoice_number;
        setStep('payment');
        if (invNum) {
          startPolling(invNum, resolvedKey);
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
  }

  function startPolling(invoiceNumber: string, key: string) {
    if (pollingRef.current) clearInterval(pollingRef.current);
    pollingRef.current = setInterval(async () => {
      try {
        const status = await orderApi.invoiceStatus(invoiceNumber);
        if (status.success && status.data?.status === 'paid') {
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
      try {
        await authApi.claimLicense(key.trim());
      } catch (claimErr: any) {
        console.warn('Auto-claim license info:', claimErr.message);
      }

      // Update konfigurasi port dan nama aplikasi ke server lisensi sesaat setelah klaim
      if (!isRenewMode && localPort && appName) {
        try {
          await orderApi.updateConfig({
            license_key: key.trim(),
            local_port: Number(localPort),
            app_name: appName.trim()
          });
        } catch (updateErr: any) {
          console.warn('Gagal sinkronisasi konfigurasi awal ke server lisensi:', updateErr.message);
        }
      }

      if (isRenewMode) {
        const res = await orderApi.validateKey(key.trim());
        if (res.data?.expires_at) {
          setNewExpiryDate(res.data.expires_at);
        }
      }
      setTimeout(() => navigate('/'), 4000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const currentPackage = packages.find(p => p.id === selectedPlan);

  const handleCheckPaymentStatus = async () => {
    setLoading(true);
    try {
      const invNum = orderResult.data?.invoice_number || orderResult.invoice_number;
      if (!invNum) throw new Error('Nomor invoice tidak ditemukan.');
      
      const status = await orderApi.invoiceStatus(invNum);
      if (status.success && status.data?.status === 'paid') {
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
  };

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
        <div className={`wizard-step ${step === 'payment' ? 'active' : (step === 'activate' ? 'done' : '')}`}>
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

      {/* Render Steps */}
      {step === 'detail' && (
        <OrderDetailStep
          isRenewMode={isRenewMode}
          paymentMode={paymentMode}
          setPaymentMode={setPaymentMode}
          licenseKey={licenseKey}
          setLicenseKey={setLicenseKey}
          keyStatus={keyStatus}
          keyInfo={keyInfo}
          schoolName={schoolName}
          setSchoolName={setSchoolName}
          packages={packages}
          selectedPlan={selectedPlan}
          setSelectedPlan={setSelectedPlan}
          paymentMethod={paymentMethod}
          setPaymentMethod={setPaymentMethod}
          paymentChannels={paymentChannels}
          appName={appName}
          setAppName={setAppName}
          localPort={localPort}
          setLocalPort={setLocalPort}
          subdomainSlug={subdomainSlug}
          setSubdomainSlug={setSubdomainSlug}
          slugStatus={slugStatus}
          slugMessage={slugMessage}
          loading={loading}
          onNext={handleNextFromDetail}
          baseDomain={getBaseDomain(licenseServerUrl)}
        />
      )}

      {step === 'payment' && orderResult && (
        <OrderPaymentStep
          orderResult={orderResult}
          appName={appName}
          subdomainSlug={subdomainSlug}
          paymentMethod={paymentMethod}
          schoolName={schoolName}
          licenseKey={licenseKey}
          currentPackage={currentPackage}
          loading={loading}
          onCheckPayment={handleCheckPaymentStatus}
          baseDomain={getBaseDomain(licenseServerUrl)}
        />
      )}

      {step === 'activate' && (
        <OrderActivationStep
          loading={loading}
          error={error}
          isRenewMode={isRenewMode}
          appName={appName}
          newExpiryDate={newExpiryDate}
          onRetry={handleActivate}
        />
      )}
    </div>
  );
}
