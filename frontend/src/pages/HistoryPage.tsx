import { useEffect, useState } from 'react';
import { authApi } from '../services/api';

interface Invoice {
  id: string;
  invoice_number: string;
  license_id: string;
  school_name: string;
  product_id: string;
  plan_title: string;
  amount: number;
  status: 'paid' | 'unpaid' | string;
  payment_method: string;
  expired_time: string;
  paid_at: string | null;
  created_at: string;
  payment_instructions?: any;
}

interface HistoryPageProps {
  licenseServerUrl?: string;
}

export default function HistoryPage({ licenseServerUrl }: HistoryPageProps) {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'unpaid' | 'paid'>('all');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [copied, setCopied] = useState(false);

  const serverUrl = licenseServerUrl || 'https://api.absenta.id';

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await authApi.myOrders();
      if (res.success) {
        setInvoices(res.data || []);
      }
    } catch (err: any) {
      setError(err.message || 'Gagal mengambil riwayat transaksi.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredInvoices = invoices.filter(inv => {
    if (filterStatus === 'all') return true;
    const invStatus = String(inv.status).toLowerCase();
    if (filterStatus === 'unpaid') return invStatus === 'unpaid' || invStatus === 'pending';
    return invStatus === 'paid' || invStatus === 'lunas';
  });

  const formatRupiah = (num: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0
    }).format(num);
  };

  const getStatusBadge = (statusStr: string) => {
    const status = String(statusStr).toLowerCase();
    if (status === 'paid' || status === 'lunas') {
      return <span className="status-badge connected">Lunas</span>;
    }
    if (status === 'expired' || status === 'cancelled') {
      return <span className="status-badge disconnected" style={{ filter: 'grayscale(0.5)' }}>Kedaluwarsa</span>;
    }
    return <span className="status-badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', padding: '2px 8px', borderRadius: '4px', fontSize: '11px', display: 'inline-flex', alignItems: 'center' }}>Menunggu Pembayaran</span>;
  };

  const parseInstructions = (inv: Invoice) => {
    if (!inv.payment_instructions) return null;
    try {
      if (typeof inv.payment_instructions === 'string') {
        return JSON.parse(inv.payment_instructions);
      }
      return inv.payment_instructions;
    } catch (e) {
      console.warn('Failed to parse payment instructions JSON:', e);
      return null;
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 className="page-title">Riwayat Transaksi</h1>
          <p className="page-subtitle">Daftar pemesanan dan status pembayaran lisensi Anda</p>
        </div>
        <button className="btn btn-outline" onClick={loadData} disabled={loading} style={{ padding: '8px 16px' }}>
          🔄 Segarkan
        </button>
      </div>

      {error && (
        <div className="alert alert-danger" style={{ marginBottom: 16 }}>
          ⚠️ {error}
        </div>
      )}

      {/* Filter Tabs */}
      <div className="tabs-container" style={{ display: 'flex', gap: 8, marginBottom: 16, borderBottom: '1px solid var(--color-border)', paddingBottom: 8 }}>
        {[
          { id: 'all', label: 'Semua Transaksi' },
          { id: 'unpaid', label: 'Menunggu Pembayaran' },
          { id: 'paid', label: 'Sudah Lunas' }
        ].map(tab => (
          <button
            key={tab.id}
            className={`btn ${filterStatus === tab.id ? 'btn-primary' : 'btn-outline'}`}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              borderRadius: 16,
              background: filterStatus === tab.id ? 'var(--color-primary)' : 'transparent',
              borderColor: filterStatus === tab.id ? 'var(--color-primary)' : 'var(--color-border)',
              color: filterStatus === tab.id ? '#white' : 'var(--color-text-muted)'
            }}
            onClick={() => setFilterStatus(tab.id as any)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--color-text-dim)' }}>
          <div className="spinner" style={{ display: 'inline-block', marginRight: 8 }} />
          Memuat riwayat transaksi...
        </div>
      ) : filteredInvoices.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--color-text-muted)' }}>
          📁 Belum ada transaksi yang sesuai filter ini.
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filteredInvoices.map(inv => (
            <div key={inv.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <strong style={{ color: 'var(--color-text)', fontSize: 14 }}>{inv.invoice_number}</strong>
                  {getStatusBadge(inv.status)}
                </div>
                <div style={{ fontSize: 13, color: 'var(--color-text-muted)' }}>
                  🏫 Instansi: <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{inv.school_name}</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-dim)' }}>
                  📦 Paket: {inv.plan_title} ({inv.product_id.toUpperCase()})
                </div>
                <div style={{ fontSize: 11, color: 'var(--color-text-dim)' }}>
                  📅 Dibuat: {new Date(inv.created_at).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-accent)' }}>
                  {formatRupiah(inv.amount)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--color-text-muted)' }}>
                  💳 {inv.payment_method}
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {String(inv.status).toLowerCase() === 'unpaid' ? (
                    <button
                      className="btn btn-primary"
                      style={{ padding: '6px 12px', fontSize: 11 }}
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      💳 Bayar / Konfirmasi
                    </button>
                  ) : (
                    <a
                      href={`${serverUrl}/api/license/print-invoice/${inv.invoice_number}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-outline"
                      style={{ padding: '6px 12px', fontSize: 11, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                    >
                      📄 Lihat Invoice / Cetak
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Detail Pembayaran / Konfirmasi */}
      {selectedInvoice && (() => {
        const payInfo = parseInstructions(selectedInvoice);
        const isManual = selectedInvoice.payment_method.toLowerCase() === 'manual';
        const hasPayCode = payInfo && payInfo.pay_code;
        const hasQrUrl = payInfo && payInfo.qr_url;

        return (
          <div className="modal-overlay" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 1000
          }}>
            <div className="card" style={{ maxWidth: 480, width: '90%', maxHeight: '90vh', overflowY: 'auto', padding: 24, borderRadius: 16, border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <h3 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: 'var(--color-text)' }}>Petunjuk Pembayaran</h3>
                <button
                  style={{ background: 'none', border: 'none', color: 'var(--color-text-dim)', fontSize: 20, cursor: 'pointer' }}
                  onClick={() => setSelectedInvoice(null)}
                >
                  &times;
                </button>
              </div>

              {/* Rincian Tagihan */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, marginBottom: 16, backgroundColor: 'rgba(255,255,255,0.02)', padding: 12, borderRadius: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-dim)' }}>No. Invoice</span>
                  <strong style={{ color: 'var(--color-text)' }}>{selectedInvoice.invoice_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-dim)' }}>Instansi</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 500 }}>{selectedInvoice.school_name}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-dim)' }}>Metode Bayar</span>
                  <span style={{ color: 'var(--color-text)', fontWeight: 700 }}>{selectedInvoice.payment_method}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--color-text-dim)' }}>Total Tagihan</span>
                  <strong style={{ color: 'var(--color-accent)', fontSize: 16 }}>{formatRupiah(selectedInvoice.amount)}</strong>
                </div>
              </div>

              {/* Tampilan Dinamis Petunjuk Pembayaran */}
              {isManual ? (
                // ── MANUAL TRANSFER INSTRUCTIONS ──
                <div className="alert alert-warning" style={{ fontSize: 12, marginBottom: 20, lineHeight: 1.5 }}>
                  💡 <strong>Instruksi Transfer Manual:</strong><br />
                  Silakan lakukan transfer manual sebesar <strong>{formatRupiah(selectedInvoice.amount)}</strong> ke rekening BNI Pengelola utama yang tertera di WA Notifikasi Anda.<br /><br />
                  <strong>PENTING:</strong> Setelah transfer, silakan balas notifikasi WhatsApp Easy Tunnel dengan kata <strong>KONFIRMASI {selectedInvoice.invoice_number}</strong> dan kirim foto/gambar bukti transfer Anda.
                </div>
              ) : (
                // ── TRIPAY / GATEWAY VIRTUAL ACCOUNT / QRIS INSTRUCTIONS ──
                <div style={{ marginBottom: 20 }}>
                  {hasQrUrl ? (
                    // QRIS / E-Wallet QR Code
                    <div style={{ textAlign: 'center', marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 8 }}>Silakan scan QR Code di bawah untuk membayar:</p>
                      <img
                        src={payInfo.qr_url}
                        alt="QR Code Pembayaran"
                        style={{ maxWidth: 200, width: '100%', borderRadius: 12, border: '4px solid white', display: 'inline-block' }}
                      />
                      <div style={{ marginTop: 8 }}>
                        <a
                          href={payInfo.qr_url}
                          target="_blank"
                          rel="noreferrer"
                          className="btn btn-outline"
                          style={{ padding: '6px 12px', fontSize: 11, textDecoration: 'none' }}
                        >
                          👁️ Buka QR di Tab Baru
                        </a>
                      </div>
                    </div>
                  ) : hasPayCode ? (
                    // Virtual Account Number / Payment Code
                    <div style={{ textAlign: 'center', backgroundColor: 'rgba(255,255,255,0.03)', padding: 16, borderRadius: 12, border: '1px dashed var(--color-border)', marginBottom: 16 }}>
                      <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: '0 0 4px 0' }}>Nomor Virtual Account / Kode Bayar:</p>
                      <strong style={{ fontSize: 22, color: 'var(--color-accent)', letterSpacing: 1 }}>{payInfo.pay_code}</strong>
                      <div style={{ marginTop: 10 }}>
                        <button
                          className="btn btn-outline"
                          style={{ padding: '4px 12px', fontSize: 11 }}
                          onClick={() => handleCopyCode(payInfo.pay_code)}
                        >
                          {copied ? '✅ Tersalin' : '📋 Salin Kode'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="alert alert-warning" style={{ fontSize: 12, marginBottom: 16 }}>
                      ⚠️ Info instruksi pembayaran gateway tidak ditemukan di server. Silakan hubungi admin.
                    </div>
                  )}

                  {/* Langkah-langkah instruksi dari Tripay */}
                  {payInfo && payInfo.instructions && payInfo.instructions.length > 0 && (
                    <div style={{ marginTop: 16 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-text)' }}>📋 Langkah Pembayaran:</p>
                      <div style={{ maxHeight: 200, overflowY: 'auto', border: '1px solid var(--color-border)', borderRadius: 8, padding: 10 }}>
                        {payInfo.instructions.map((step: any, idx: number) => (
                          <div key={idx} style={{ marginBottom: 12, fontSize: 12 }}>
                            <strong style={{ color: 'var(--color-primary)', display: 'block', marginBottom: 4 }}>{idx + 1}. {step.title}</strong>
                            <ol style={{ margin: 0, paddingLeft: 18, color: 'var(--color-text-muted)' }}>
                              {step.steps.map((s: string, sIdx: number) => (
                                <li key={sIdx} style={{ marginBottom: 4 }} dangerouslySetInnerHTML={{ __html: s }}></li>
                              ))}
                            </ol>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Footer Modal */}
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', borderTop: '1px solid var(--color-border)', paddingTop: 14 }}>
                <button className="btn btn-outline" style={{ padding: '8px 16px' }} onClick={() => setSelectedInvoice(null)}>
                  Tutup
                </button>
                <a
                  href={`https://wa.me/${localStorage.getItem('@easy_tunnel_operator') || ''}`}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-primary"
                  style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 4, textDecoration: 'none' }}
                >
                  💬 Buka Chat WA
                </a>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
