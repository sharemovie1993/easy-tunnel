interface StatusBadgeProps {
  status: 'connected' | 'disconnected' | 'not_configured' | 'error' | 'loading';
}

const STATUS_MAP = {
  connected:      { label: 'Aktif & Terhubung',  cls: 'connected' },
  disconnected:   { label: 'Tidak Aktif',          cls: 'disconnected' },
  not_configured: { label: 'Belum Dikonfigurasi', cls: 'disconnected' },
  error:          { label: 'Error',               cls: 'error' },
  loading:        { label: 'Menghubungkan...',    cls: 'loading' }
};

export default function StatusBadge({ status }: StatusBadgeProps) {
  const config = STATUS_MAP[status] || STATUS_MAP.disconnected;
  return (
    <span className={`status-badge ${config.cls}`}>
      {config.label}
    </span>
  );
}
