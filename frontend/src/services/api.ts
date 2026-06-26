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
  app_name: string | null;
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
  os_release?: string;
  os_arch?: string;
  license_server_url?: string;
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
  editTunnel: (id: number, local_port: number, app_name: string) =>
    apiFetch<{ success: boolean; message: string }>(`/tunnels/${id}/edit`, {
      method: 'POST', body: JSON.stringify({ local_port, app_name })
    }),
  diagnose: (id: number) => 
    apiFetch<{ success: boolean; data: { success: boolean; message: string; details: string[] } }>(`/tunnels/${id}/diagnose`, { method: 'GET' }),
  forceRelease: (license_key: string) =>
    apiFetch<{ success: boolean; message: string }>('/tunnels/force-release', {
      method: 'POST', body: JSON.stringify({ license_key })
    })
};

// Order API
export const orderApi = {
  packages: () => apiFetch<{ success: boolean; data: Package[] }>('/order/packages'),
  paymentChannels: () => apiFetch<{ success: boolean; data: any[] }>('/order/payment-channels'),
  checkSlug: (slug: string) => apiFetch<{ success: boolean; available: boolean; message: string }>(`/order/check-slug/${slug}`),
  validateKey: (key: string) => apiFetch<{ success: boolean; data: any }>(`/order/validate-key/${encodeURIComponent(key)}`),
  newOrder: (body: any) =>
    apiFetch<any>('/order/new', { method: 'POST', body: JSON.stringify(body) }),
  updateConfig: (body: { license_key: string; local_port: number; app_name: string }) =>
    apiFetch<{ success: boolean; message: string }>('/order/update-config', { method: 'POST', body: JSON.stringify(body) }),
  paymentStatus: (licenseKey: string) => apiFetch<any>(`/order/payment-status/${encodeURIComponent(licenseKey)}`),
  invoiceStatus: (invoiceNumber: string) => apiFetch<any>(`/order/invoice-status/${encodeURIComponent(invoiceNumber)}`)
};

// System API
export const systemApi = {
  info: () => apiFetch<{ success: boolean; data: SystemInfo }>('/system/info'),
  installWireGuard: () => apiFetch<{ success: boolean; message: string; installing?: boolean }>('/system/install-wireguard', { method: 'POST' }),
  wireGuardStatus: () => apiFetch<{ success: boolean; installed: boolean }>('/system/wireguard-status'),
  tunnelsDiagnostics: () => apiFetch<{ success: boolean; data: { installed: any[]; db_tunnels: any[]; orphans: any[] } }>('/system/tunnels-diagnostics'),
  cleanTunnels: (service_names: string[]) => apiFetch<{ success: boolean; message: string }>('/system/clean-tunnels', { method: 'POST', body: JSON.stringify({ service_names }) })
};

export interface VncInstallState {
  status: 'idle' | 'downloading' | 'installing' | 'success' | 'failed';
  error: string | null;
}

export interface VncStatus {
  installed: boolean;
  running: boolean;
  port: number;
  installState: VncInstallState;
}

// VNC API
export const vncApi = {
  status: () => apiFetch<{ success: boolean; data: VncStatus }>('/vnc/status'),
  install: () => apiFetch<{ success: boolean; message: string }>('/vnc/install', { method: 'POST' }),
  start: (password: string) => apiFetch<{ success: boolean; message: string }>('/vnc/start', {
    method: 'POST', body: JSON.stringify({ password })
  }),
  stop: () => apiFetch<{ success: boolean; message: string }>('/vnc/stop', { method: 'POST' })
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
