const BASE = '/api';

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem('@easy_tunnel_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options?.headers as Record<string, string>)
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    headers,
    ...options
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`);
  return data;
}

// Tunnel types
export interface Tunnel {
  id: number;
  name: string;
  license_key: string;
  subdomain: string | null;
  local_port: number | null;
  wg_ip: string | null;
  conf_path: string | null;
  status: 'inactive' | 'active' | 'error';
  expires_at: string | null;
  created_at: string;
  wg_status: {
    status: 'connected' | 'disconnected' | 'not_configured' | 'error';
    wg_ip?: string;
  };
}

export interface Package {
  id: string;
  title: string;
  price: string;
  duration: string;
  badge: string | null;
}

export interface SystemInfo {
  platform: string;
  hostname: string;
  is_windows: boolean;
  wireguard_installed: boolean;
  is_admin: boolean;
  app_version: string;
}

// Tunnel API
export const tunnelApi = {
  list: () => apiFetch<{ success: boolean; data: Tunnel[] }>('/tunnels'),
  get: (id: number) => apiFetch<{ success: boolean; data: Tunnel }>(`/tunnels/${id}`),
  setup: (body: { license_key: string; subdomain_slug: string; local_port: number; app_name: string }) =>
    apiFetch<{ success: boolean; message: string; data: any }>('/tunnels/setup', {
      method: 'POST', body: JSON.stringify(body)
    }),
  start: (id: number) => apiFetch<{ success: boolean; message: string }>(`/tunnels/${id}/start`, { method: 'POST' }),
  stop: (id: number) => apiFetch<{ success: boolean; message: string }>(`/tunnels/${id}/stop`, { method: 'POST' }),
  remove: (id: number) => apiFetch<{ success: boolean; message: string }>(`/tunnels/${id}`, { method: 'DELETE' }),
  changePort: (id: number, local_port: number) =>
    apiFetch<{ success: boolean; message: string }>(`/tunnels/${id}/change-port`, {
      method: 'POST', body: JSON.stringify({ local_port })
    })
};

// Order API
export const orderApi = {
  packages: () => apiFetch<{ success: boolean; data: Package[] }>('/order/packages'),
  paymentChannels: () => apiFetch<{ success: boolean; data: any[] }>('/order/payment-channels'),
  checkSlug: (slug: string) => apiFetch<{ success: boolean; available: boolean; message: string }>(`/order/check-slug/${slug}`),
  validateKey: (key: string) => apiFetch<{ success: boolean; data: any }>(`/order/validate-key/${encodeURIComponent(key)}`),
  newOrder: (body: { school_name: string; plan_id: string; payment_method: string }) =>
    apiFetch<any>('/order/new', { method: 'POST', body: JSON.stringify(body) }),
  paymentStatus: (licenseKey: string) => apiFetch<any>(`/order/payment-status/${encodeURIComponent(licenseKey)}`)
};

// System API
export const systemApi = {
  info: () => apiFetch<{ success: boolean; data: SystemInfo }>('/system/info'),
  installWireGuard: () => apiFetch<{ success: boolean; message: string; installing?: boolean }>('/system/install-wireguard', { method: 'POST' }),
  wireGuardStatus: () => apiFetch<{ success: boolean; installed: boolean }>('/system/wireguard-status')
};

// Auth & Operator API
export const authApi = {
  requestOtp: (nomor: string) =>
    apiFetch<{ success: boolean; message: string }>('/auth/request-otp', {
      method: 'POST', body: JSON.stringify({ nomor })
    }),
  verifyOtp: (nomor: string, code: string) =>
    apiFetch<{ success: boolean; token: string; message: string }>('/auth/verify-otp', {
      method: 'POST', body: JSON.stringify({ nomor, code })
    }),
  myLicenses: () =>
    apiFetch<{ success: boolean; count: number; data: any[] }>('/auth/my-licenses'),
  claimLicense: (license_key: string) =>
    apiFetch<{ success: boolean; message: string }>('/auth/claim-license', {
      method: 'POST', body: JSON.stringify({ license_key })
    }),
  myOrders: () =>
    apiFetch<{ success: boolean; count: number; data: any[] }>('/auth/my-orders')
};
