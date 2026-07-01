export interface PredefinedApp {
  category: 'Pendidikan Indonesia' | 'Aplikasi Umum & Sysadmin';
  name: string;
  defaultPort: number;
}

export const PORT_HINTS: { port: number; label: string }[] = [
  { port: 5774, label: '5774 — Dapodik' },
  { port: 8239, label: '8239 — E-Rapor SMA' },
  { port: 3154, label: '3154 — E-Rapor SMK' },
  { port: 80,   label: '80   — HTTP (umum)' },
  { port: 443,  label: '443  — HTTPS' },
  { port: 8291, label: '8291 — Winbox' },
];

export const PREDEFINED_APPS: PredefinedApp[] = [
  // Dunia Pendidikan Indonesia
  { category: 'Pendidikan Indonesia', name: '🏫 Dapodik', defaultPort: 5774 },
  { category: 'Pendidikan Indonesia', name: '📊 E-Rapor SD', defaultPort: 3689 },
  { category: 'Pendidikan Indonesia', name: '📊 E-Rapor SMP', defaultPort: 2679 },
  { category: 'Pendidikan Indonesia', name: '📊 E-Rapor SMA', defaultPort: 8239 },
  { category: 'Pendidikan Indonesia', name: '📊 E-Rapor SMK', defaultPort: 3154 },
  { category: 'Pendidikan Indonesia', name: '🎓 Feeder PDDikti', defaultPort: 8082 },
  { category: 'Pendidikan Indonesia', name: '👩‍🏫 SISTER Kemendikbud', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '📚 SLiMS Perpustakaan', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '🏫 JIBAS', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '📝 Candy CBT', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '📝 Beesmart CBT', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '🕌 E-Learning Madrasah', defaultPort: 80 },
  { category: 'Pendidikan Indonesia', name: '🕋 Aplikasi Rapor Digital / ARD', defaultPort: 80 },
  // Aplikasi Umum & Sysadmin
  { category: 'Aplikasi Umum & Sysadmin', name: '🌐 Web Server (HTTP)', defaultPort: 80 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🔒 Web Server (HTTPS)', defaultPort: 443 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🎛️ Winbox Mikrotik', defaultPort: 8291 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🔌 API Mikrotik', defaultPort: 8728 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🖥️ Proxmox VE', defaultPort: 8006 },
  { category: 'Aplikasi Umum & Sysadmin', name: '💼 Odoo ERP', defaultPort: 8069 },
  { category: 'Aplikasi Umum & Sysadmin', name: '💾 MySQL/MariaDB Database', defaultPort: 3306 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🐘 PostgreSQL Database', defaultPort: 5432 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🖥️ Remote Desktop / RDP', defaultPort: 3389 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🐚 SSH Server', defaultPort: 22 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🐬 phpMyAdmin / Adminer', defaultPort: 80 },
  { category: 'Aplikasi Umum & Sysadmin', name: '🐳 Portainer Docker', defaultPort: 9000 },
  { category: 'Aplikasi Umum & Sysadmin', name: '☁️ Nextcloud', defaultPort: 80 },
];
