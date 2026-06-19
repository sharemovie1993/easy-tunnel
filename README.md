# 🌐 Easy Tunnel — Gateway Manager

**Zero-config WireGuard tunnel** untuk mengekspos layanan lokal (Dapodik, E-Rapor, dll) ke internet — dari order hingga aktif, semua dalam satu aplikasi.

---

## Fitur Utama

- ✅ **Zero-config** — Masukkan license key, isi port, pilih subdomain, langsung online
- 🔄 **Multi-tunnel** — Kelola banyak aplikasi sekaligus (Dapodik, E-Rapor, dll)
- 💳 **Terintegrasi billing** — Order & bayar langsung dari aplikasi
- 🔒 **WireGuard** — Enkripsi end-to-end, keamanan tingkat enterprise
- 🖥️ **Windows & Linux** — Berjalan di mana saja
- 🤖 **Auto-install WireGuard** — Tidak perlu konfigurasi manual

---

## Quick Start (Windows)

```powershell
# 1. Buka PowerShell as Administrator
# 2. Navigate ke folder proyek
cd "C:\Users\SERVER-DELL\Documents\Project-Easy-Tunnel"

# 3. Jalankan setup wizard (install otomatis semua dependency)
.\deploy.ps1

# 4. Browser akan terbuka otomatis ke http://localhost:7080
```

---

## Menjalankan Manual (Development)

```bash
# Backend (TypeScript + Express, port 7080)
cd backend
npm install
npm run dev

# Frontend (React + Vite, port 5173) — di terminal lain
cd frontend
npm install
npm run dev
```

Buka browser ke: **http://localhost:5173**

---

## Cara Pakai

### 1. Tambah Tunnel (Punya License Key)
1. Klik **"Tambah Tunnel Baru"** di dashboard
2. Pilih mode **"Punya License Key"**
3. Masukkan license key `ETN-XXXX-XXXX-XXXX`
4. Isi nama aplikasi, port lokal, dan pilih subdomain
5. Klik **"Aktifkan Tunnel Sekarang"**
6. Tunnel otomatis dikonfigurasi dan siap digunakan!

### 2. Tambah Tunnel (Beli Berlangganan Baru)
1. Klik **"Tambah Tunnel Baru"** → pilih **"Beli Berlangganan Baru"**
2. Isi nama instansi, pilih paket harga, metode bayar
3. Isi detail aplikasi (nama, port, subdomain)
4. Klik **"Lanjut ke Pembayaran"**
5. Ikuti instruksi pembayaran, konfirmasi via WhatsApp
6. Setelah dikonfirmasi, tunnel aktif **otomatis**!

### 3. Port Aplikasi Umum
| Aplikasi | Port Lokal |
|---|---|
| Dapodik | 8983 |
| E-Rapor | 9000 |
| HTTP umum | 80 |
| Tomcat | 8080 |
| Node.js | 3000 |

---

## Harga

| Paket | Harga | Durasi |
|---|---|---|
| Bulanan | Rp 50.000 | 30 hari |
| Semester | Rp 250.000 | 180 hari (hemat 17%) |
| Tahunan | Rp 480.000 | 365 hari (terbaik) |

*Setiap license = 1 port / 1 aplikasi*

---

## Struktur Proyek

```
Project-Easy-Tunnel/
├── backend/                    # Node.js + Express + TypeScript
│   ├── src/
│   │   ├── server.ts           # Entry point (port 7080)
│   │   ├── db.ts               # SQLite database
│   │   ├── routes/
│   │   │   ├── tunnels.ts      # CRUD + start/stop tunnel
│   │   │   ├── order.ts        # Order & billing
│   │   │   └── system.ts       # Info OS & WireGuard
│   │   └── services/
│   │       ├── wireguardManager.ts  # WireGuard engine
│   │       └── licenseClient.ts     # HTTP → api.absenta.id
│   ├── tunnels/                # File *.conf WireGuard per tunnel
│   └── local.db               # Database SQLite lokal
│
├── frontend/                   # React + Vite + TypeScript
│   └── src/
│       ├── pages/
│       │   ├── DashboardPage.tsx    # Grid semua tunnel
│       │   ├── OrderPage.tsx        # 3-step order wizard
│       │   └── SettingsPage.tsx     # Sistem & WireGuard
│       ├── components/
│       │   ├── TunnelCard.tsx
│       │   └── StatusBadge.tsx
│       └── services/api.ts          # Typed fetch wrapper
│
├── deploy.ps1                  # Windows setup wizard
└── ecosystem.config.js         # PM2 production config
```

---

## API Endpoints (Backend)

| Method | Endpoint | Deskripsi |
|---|---|---|
| GET | `/api/health` | Health check |
| GET | `/api/tunnels` | Daftar semua tunnel |
| POST | `/api/tunnels/setup` | Setup tunnel dari license key |
| POST | `/api/tunnels/:id/start` | Aktifkan tunnel |
| POST | `/api/tunnels/:id/stop` | Nonaktifkan tunnel |
| DELETE | `/api/tunnels/:id` | Hapus tunnel |
| GET | `/api/order/packages` | Daftar paket harga |
| GET | `/api/order/check-slug/:slug` | Cek ketersediaan subdomain |
| GET | `/api/order/validate-key/:key` | Validasi license key |
| POST | `/api/order/new` | Buat order baru |
| GET | `/api/order/payment-status/:key` | Cek status pembayaran |
| GET | `/api/system/info` | Info OS & WireGuard |
| POST | `/api/system/install-wireguard` | Auto-install WireGuard |

---

## Arsitektur VPN

```
Browser Pengguna
      │ HTTPS
      ▼
slug.absenta.id (Caddy di VPS)
      │ WireGuard Tunnel (UDP 51820)
      ▼
PC Lokal (10.0.0.X)
      │ localhost
      ▼
Dapodik :8983 / E-Rapor :9000 / dll
```

---

## Kontak & Support

- 🌐 Website: [absenta.id](https://absenta.id)
- 📱 WhatsApp: [+62 877 7993 7341](https://wa.me/6287779937341)
- 📧 Email: sharemovie1993@gmail.com
