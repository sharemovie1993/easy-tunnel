import { Package } from '../services/api';

interface OrderPaymentStepProps {
  orderResult: any;
  appName: string;
  subdomainSlug: string;
  paymentMethod: string;
  schoolName: string;
  licenseKey: string;
  currentPackage: Package | undefined;
  loading: boolean;
  onCheckPayment: () => void;
  baseDomain?: string;
}

const formatPrice = (num: number) => {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(num);
};

export default function OrderPaymentStep({
  orderResult,
  appName,
  subdomainSlug,
  paymentMethod,
  schoolName,
  licenseKey,
  currentPackage,
  loading,
  onCheckPayment,
  baseDomain = 'absenta.id',
}: OrderPaymentStepProps) {
  return (
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
          Untuk: {appName} · {subdomainSlug}.{baseDomain}
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
          onClick={onCheckPayment}
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
              ? `Halo Admin, saya sudah transfer pembayaran Easy Tunnel.\nNama: ${schoolName}\nAplikasi: ${appName}\nSubdomain: ${subdomainSlug}.${baseDomain}\nLicense Key: ${orderResult.data?.license_key || licenseKey}`
              : `Halo Admin, saya mengajukan pembayaran Easy Tunnel via ${paymentMethod}.\nNama: ${schoolName}\nAplikasi: ${appName}\nSubdomain: ${subdomainSlug}.${baseDomain}\nLicense Key: ${orderResult.data?.license_key || licenseKey}`;
            const msg = encodeURIComponent(msgText);
            window.open(`https://wa.me/${waNum}?text=${msg}`, '_blank');
          }}
        >
          📱 {paymentMethod === 'manual' ? 'Kirim Konfirmasi via WhatsApp' : 'Hubungi WhatsApp Admin (Butuh Bantuan)'}
        </button>
      </div>
    </div>
  );
}
