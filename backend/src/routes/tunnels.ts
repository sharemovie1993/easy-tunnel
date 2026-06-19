import { Router, Request, Response } from 'express';
import os from 'os';
import { getDb } from '../db';
import { WireguardManager } from '../services/wireguardManager';
import {
  validateLicenseKey,
  requestTunnelConfig,
  releaseLicense
} from '../services/licenseClient';

const router = Router();

/**
 * Sinkronisasi port lokal ↔ server lisensi secara diam-diam (background).
 * Dipanggil setiap kali daftar tunnel dimuat.
 */
async function syncPortFromServer(tunnels: any[]): Promise<void> {
  const db = await getDb();
  for (const tunnel of tunnels) {
    if (!tunnel.license_key) continue;
    try {
      const remoteInfo = await validateLicenseKey(tunnel.license_key);
      
      // Update local expiration date
      if (remoteInfo.expires_at && remoteInfo.expires_at !== tunnel.expires_at) {
        await db.run(
          "UPDATE tunnels SET expires_at = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
          [remoteInfo.expires_at, tunnel.id]
        );
      }

      const remotePort = remoteInfo.local_port;
      if (remotePort && remotePort !== tunnel.local_port) {
        await db.run(
          "UPDATE tunnels SET local_port = ?, updated_at = datetime('now', 'localtime') WHERE id = ?",
          [remotePort, tunnel.id]
        );
        console.log(`[Auto-Sync] Tunnel #${tunnel.id} "${tunnel.name}": port lokal diperbarui ${tunnel.local_port} → ${remotePort}`);
      }
    } catch (e: any) {
      if (e.message && (e.message.toLowerCase().includes('kedaluwarsa') || e.message.toLowerCase().includes('expired'))) {
        console.warn(`[Auto-Sync] Tunnel #${tunnel.id} "${tunnel.name}" terdeteksi kedaluwarsa di server lisensi. Menonaktifkan tunnel lokal secara paksa...`);
        
        // Hentikan WireGuard service lokal secara fisik hanya jika proses berjalan dengan hak akses Administrator (Admin)
        // Jika bukan Admin, kita lewati pemanggilan stopTunnel untuk menghindari popup UAC misterius di background,
        // namun kita tetap mengupdate status di DB lokal agar antarmuka UI merender status Nonaktif/Kedaluwarsa.
        if (tunnel.subdomain && WireguardManager.isAdmin()) {
          try {
            await WireguardManager.stopTunnel(tunnel.subdomain);
          } catch (stopErr: any) {
            console.error(`[Auto-Sync] Gagal menghentikan terowongan #${tunnel.id}:`, stopErr.message);
          }
        }

        // Set status ke inactive dan tandai expires_at ke hari ini
        await db.run(
          "UPDATE tunnels SET status = 'inactive', expires_at = date('now'), updated_at = datetime('now', 'localtime') WHERE id = ?",
          [tunnel.id]
        );
      } else {
        // Abaikan error network biasa agar tidak menghambat load data
        console.warn(`[Auto-Sync] Gagal sinkron port tunnel #${tunnel.id}:`, e.message);
      }
    }
  }
}

/** GET /api/tunnels — daftar semua tunnel (dengan auto-sync port dari server lisensi) */
router.get('/', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tunnels = await db.all('SELECT * FROM tunnels ORDER BY id DESC');

    // Sinkronisasi port dari server lisensi — tunggu selesai agar data terbaru
    await syncPortFromServer(tunnels);

    // Ambil data segar setelah sync
    const freshTunnels = await db.all('SELECT * FROM tunnels ORDER BY id DESC');

    const enriched = freshTunnels.map((t: any) => {
      const wgStatus = t.subdomain
        ? WireguardManager.getStatus(t.subdomain)
        : { status: 'not_configured' };
      return { ...t, wg_status: wgStatus };
    });

    res.json({ success: true, data: enriched });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/tunnels/:id — detail satu tunnel */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tunnel = await db.get('SELECT * FROM tunnels WHERE id = ?', [req.params.id]) as any;
    if (!tunnel) return res.status(404).json({ success: false, message: 'Tunnel tidak ditemukan.' });

    const wgStatus = tunnel.subdomain
      ? WireguardManager.getStatus(tunnel.subdomain)
      : { status: 'not_configured' };

    res.json({ success: true, data: { ...tunnel, wg_status: wgStatus } });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/tunnels/setup
 * Setup tunnel dari license key yang sudah aktif.
 * Body: { license_key, subdomain_slug, local_port, app_name }
 */
router.post('/setup', async (req: Request, res: Response) => {
  const { license_key, subdomain_slug, local_port, app_name } = req.body;

  if (!license_key || !subdomain_slug || !local_port || !app_name) {
    return res.status(400).json({
      success: false,
      message: 'license_key, subdomain_slug, local_port, dan app_name wajib diisi.'
    });
  }

  const portNum = parseInt(local_port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ success: false, message: 'Port lokal tidak valid (1-65535).' });
  }

  try {
    const db = await getDb();

    // Cek apakah license key sudah terdaftar lokal
    const existing = await db.get('SELECT id FROM tunnels WHERE license_key = ?', [license_key.trim()]);
    if (existing) {
      return res.status(409).json({
        success: false,
        message: 'License key ini sudah terdaftar. Gunakan tombol Start/Stop di dashboard.'
      });
    }

    // 1. Request tunnel config ke server lisensi (dengan hostname)
    const tunnelData = await requestTunnelConfig({
      license_key: license_key.trim(),
      subdomain_slug: subdomain_slug.trim().toLowerCase(),
      local_port: portNum,
      app_name: app_name.trim(),
      hostname: os.hostname()
    });

    // 2. Tulis file .conf WireGuard ke disk lokal
    const slug = tunnelData.subdomain.replace('.absenta.id', '');
    const confPath = WireguardManager.writeConfig(slug, tunnelData.config);

    // 3. Simpan ke database lokal
    let expiresAt: string | null = null;
    try {
      const licInfo = await validateLicenseKey(license_key.trim());
      expiresAt = licInfo.expires_at;
    } catch {}

    const result = await db.run(
      `INSERT INTO tunnels (name, license_key, subdomain, local_port, wg_ip, conf_path, status, expires_at)
       VALUES (?, ?, ?, ?, ?, ?, 'inactive', ?)`,
      [app_name.trim(), license_key.trim(), slug, portNum, tunnelData.client_ip, confPath, expiresAt]
    );

    res.json({
      success: true,
      message: `Tunnel untuk "${app_name}" berhasil dikonfigurasi! Klik "Aktifkan" untuk memulai.`,
      data: {
        tunnel_id: result.lastID,
        subdomain: tunnelData.subdomain,
        client_ip: tunnelData.client_ip,
        local_port: portNum,
        expires_at: expiresAt
      }
    });

  } catch (err: any) {
    console.error('[Tunnel Setup Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/tunnels/:id/start */
router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tunnel = await db.get('SELECT * FROM tunnels WHERE id = ?', [req.params.id]) as any;
    if (!tunnel) return res.status(404).json({ success: false, message: 'Tunnel tidak ditemukan.' });
    if (tunnel.license_key) {
      try {
        const remoteInfo = await validateLicenseKey(tunnel.license_key);
        if (remoteInfo.expires_at) {
          await db.run("UPDATE tunnels SET expires_at = ? WHERE id = ?", [remoteInfo.expires_at, tunnel.id]);
        }
      } catch (e: any) {
        if (e.message && (e.message.toLowerCase().includes('kedaluwarsa') || e.message.toLowerCase().includes('expired'))) {
          await db.run("UPDATE tunnels SET status = 'inactive', expires_at = date('now'), updated_at = datetime('now', 'localtime') WHERE id = ?", [tunnel.id]);
          return res.status(403).json({
            success: false,
            message: 'Gagal mengaktifkan tunnel: Lisensi terowongan ini telah kedaluwarsa.'
          });
        }
        // Abaikan network error biasa agar tetap bisa start offline
      }
    }

    if (!WireguardManager.isWireGuardInstalled()) {
      return res.status(428).json({
        success: false,
        message: 'WireGuard belum terinstall. Silakan install terlebih dahulu.',
        need_install: true
      });
    }

    const result = await WireguardManager.startTunnel(tunnel.subdomain);
    await db.run("UPDATE tunnels SET status = 'active', updated_at = datetime('now', 'localtime') WHERE id = ?", [tunnel.id]);
    res.json({ success: true, message: result.message });
  } catch (err: any) {
    console.error('[Tunnel Start Error]', err);
    try {
      const db = await getDb();
      await db.run("UPDATE tunnels SET status = 'error', updated_at = datetime('now', 'localtime') WHERE id = ?", [req.params.id]);
    } catch {}
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/tunnels/:id/stop */
router.post('/:id/stop', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tunnel = await db.get('SELECT * FROM tunnels WHERE id = ?', [req.params.id]) as any;
    if (!tunnel) return res.status(404).json({ success: false, message: 'Tunnel tidak ditemukan.' });

    const result = await WireguardManager.stopTunnel(tunnel.subdomain);
    await db.run("UPDATE tunnels SET status = 'inactive', updated_at = datetime('now', 'localtime') WHERE id = ?", [tunnel.id]);
    res.json({ success: true, message: result.message });
  } catch (err: any) {
    console.error('[Tunnel Stop Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** DELETE /api/tunnels/:id */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const tunnel = await db.get('SELECT * FROM tunnels WHERE id = ?', [req.params.id]) as any;
    if (!tunnel) return res.status(404).json({ success: false, message: 'Tunnel tidak ditemukan.' });

    // 1. Lepas kunci perangkat (device lock) di server lisensi
    try {
      if (tunnel.license_key) {
        await releaseLicense(tunnel.license_key);
      }
    } catch (releaseErr: any) {
      console.warn('[Tunnel Delete Warning] Gagal melepas kunci perangkat di server lisensi (kemungkinan offline):', releaseErr.message);
    }

    // 2. Hapus terowongan lokal
    if (tunnel.subdomain) {
      await WireguardManager.removeTunnel(tunnel.subdomain);
    }
    await db.run('DELETE FROM tunnels WHERE id = ?', [tunnel.id]);
    res.json({ success: true, message: `Tunnel "${tunnel.name}" berhasil dihapus.` });
  } catch (err: any) {
    console.error('[Tunnel Delete Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/tunnels/:id/change-port */
router.post('/:id/change-port', async (req: Request, res: Response) => {
  const { local_port } = req.body;
  if (!local_port) {
    return res.status(400).json({ success: false, message: 'local_port wajib diisi.' });
  }

  const portNum = parseInt(local_port, 10);
  if (isNaN(portNum) || portNum < 1 || portNum > 65535) {
    return res.status(400).json({ success: false, message: 'Port lokal tidak valid (1-65535).' });
  }

  try {
    const db = await getDb();
    const tunnel = await db.get('SELECT * FROM tunnels WHERE id = ?', [req.params.id]) as any;
    if (!tunnel) return res.status(404).json({ success: false, message: 'Tunnel tidak ditemukan.' });

    // 1. Hubungi server lisensi untuk update port
    const { updateLicensePort } = require('../services/licenseClient');
    await updateLicensePort(tunnel.license_key, portNum);

    // 2. Update database lokal
    await db.run('UPDATE tunnels SET local_port = ?, updated_at = datetime(\'now\', \'localtime\') WHERE id = ?', [portNum, tunnel.id]);

    res.json({ success: true, message: `Port lokal berhasil diubah ke ${portNum} dan ter-update di server lisensi VPS.` });
  } catch (err: any) {
    console.error('[Tunnel Change Port Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
