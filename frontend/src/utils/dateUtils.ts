// Kalkulasi info expiry untuk sebuah tanggal secara presisi (milidetik)
export function calcExpiry(expiresAt: string | null) {
  if (!expiresAt) return { diffDays: null, isExpired: false, isWarning: false, label: null };
  
  let expDate: Date;
  try {
    const parts = expiresAt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
    if (parts) {
      const year = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const day = parseInt(parts[3], 10);
      const hour = parts[4] ? parseInt(parts[4], 10) : 0;
      const min = parts[5] ? parseInt(parts[5], 10) : 0;
      const sec = parts[6] ? parseInt(parts[6], 10) : 0;
      expDate = new Date(year, month, day, hour, min, sec);
    } else {
      expDate = new Date(expiresAt);
    }
  } catch (err) {
    expDate = new Date(expiresAt);
  }

  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();
  const label = expDate.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });

  const isExpired = diffMs <= 0;
  const isWarning = diffMs > 0 && diffMs <= 7 * 24 * 60 * 60 * 1000;

  return {
    diffDays: Math.floor(diffMs / (1000 * 60 * 60 * 24)),
    isExpired,
    isWarning,
    label,
  };
}

// Menghitung friendly countdown durasi pakai
export function getFriendlyRemainingTime(expiresAt: string | null): string {
  if (!expiresAt) return '—';
  
  let expDate: Date;
  try {
    const parts = expiresAt.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}):(\d{2}))?/);
    if (parts) {
      const year = parseInt(parts[1], 10);
      const month = parseInt(parts[2], 10) - 1;
      const day = parseInt(parts[3], 10);
      const hour = parts[4] ? parseInt(parts[4], 10) : 0;
      const min = parts[5] ? parseInt(parts[5], 10) : 0;
      const sec = parts[6] ? parseInt(parts[6], 10) : 0;
      expDate = new Date(year, month, day, hour, min, sec);
    } else {
      expDate = new Date(expiresAt);
    }
  } catch (err) {
    expDate = new Date(expiresAt);
  }

  const now = new Date();
  const diffMs = expDate.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) {
    return `${diffDays} hari lagi`;
  }
  if (diffHours > 0) {
    return `${diffHours} jam lagi`;
  }
  if (diffMins > 0) {
    return `${diffMins} menit lagi`;
  }
  return `${diffSecs} detik lagi`;
}
