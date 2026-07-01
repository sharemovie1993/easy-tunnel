interface OrderActivationStepProps {
  loading: boolean;
  error: string | null;
  isRenewMode: boolean;
  appName: string;
  newExpiryDate: string;
  onRetry: () => void;
}

export default function OrderActivationStep({
  loading,
  error,
  isRenewMode,
  appName,
  newExpiryDate,
  onRetry,
}: OrderActivationStepProps) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: 40 }}>
      {loading ? (
        <>
          <div className="spinner" style={{ width: 48, height: 48, borderWidth: 4, margin: '0 auto 20px' }} />
          <h3 style={{ color: 'var(--color-text)', marginBottom: 8 }}>
            {isRenewMode ? 'Memproses Perpanjangan...' : 'Mengaktifkan Tunnel...'}
          </h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>
            {isRenewMode 
              ? 'Sedang menyinkronkan status perpanjangan lisensi dengan server...'
              : 'Server sedang mengkonfigurasi WireGuard peer. Ini memerlukan beberapa detik...'}
          </p>
        </>
      ) : error ? (
        <>
          <div style={{ fontSize: 48, marginBottom: 16 }}>❌</div>
          <h3 style={{ color: 'var(--color-danger)' }}>{isRenewMode ? 'Perpanjangan Gagal' : 'Aktivasi Gagal'}</h3>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 13 }}>{error}</p>
          <button id="btn-retry-activate" className="btn btn-primary" style={{ marginTop: 16 }} onClick={onRetry}>
            🔄 Coba Lagi
          </button>
        </>
      ) : (
        <>
          <div style={{ fontSize: 64, marginBottom: 16 }}>🎉</div>
          <h3 style={{ color: 'var(--color-success)', fontSize: 22 }}>
            {isRenewMode ? 'Lisensi Berhasil Diperpanjang!' : 'Pembelian Lisensi Berhasil!'}
          </h3>
          {isRenewMode ? (
            <>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 8 }}>
                Masa aktif lisensi untuk aplikasi <strong style={{ color: 'var(--color-text)' }}>{appName}</strong> telah berhasil diperpanjang.
              </p>
              {newExpiryDate && (
                <div style={{ margin: '20px 0', padding: '12px 16px', background: 'rgba(46, 213, 115, 0.1)', border: '1px solid rgba(46, 213, 115, 0.2)', borderRadius: 10, display: 'inline-block' }}>
                  <span style={{ fontSize: 12, color: 'var(--color-text-muted)', display: 'block', marginBottom: 2 }}>📅 BERLAKU HINGGA:</span>
                  <strong style={{ fontSize: 15, color: 'var(--color-success)' }}>
                    {new Date(newExpiryDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </strong>
                </div>
              )}
            </>
          ) : (
            <>
              <p style={{ color: 'var(--color-text-muted)', fontSize: 14, marginBottom: 8 }}>
                Lisensi Easy Tunnel baru Anda telah berhasil diterbitkan dan terikat pada akun Anda.
              </p>
              <p style={{ color: 'var(--color-text-dim)', fontSize: 13, margin: '8px auto', maxWidth: 400 }}>
                Silakan lakukan instalasi rute terowongan nanti melalui tombol <strong style={{ color: 'var(--color-text)' }}>Pasang Tunnel</strong> di dashboard utama.
              </p>
            </>
          )}
          <p style={{ fontSize: 12, color: 'var(--color-text-dim)', marginTop: 12 }}>
            Mengalihkan ke dashboard...
          </p>
        </>
      )}
    </div>
  );
}
