import { Router, Request, Response } from 'express';
import os from 'os';
import { WireguardManager } from '../services/wireguardManager';

const router = Router();

/** GET /api/system/info — info sistem dan status WireGuard */
router.get('/info', (req: Request, res: Response) => {
  const platform = os.platform();
  const wgInstalled = WireguardManager.isWireGuardInstalled();
  const isAdmin = WireguardManager.isAdmin();

  res.json({
    success: true,
    data: {
      platform,
      hostname: os.hostname(),
      is_windows: platform === 'win32',
      wireguard_installed: wgInstalled,
      is_admin: isAdmin,
      app_version: '1.0.0'
    }
  });
});

/**
 * POST /api/system/install-wireguard — auto-download dan install WireGuard
 * Hanya Windows. Butuh koneksi internet.
 */
router.post('/install-wireguard', async (req: Request, res: Response) => {
  if (!WireguardManager.isWindows()) {
    return res.status(400).json({
      success: false,
      message: 'Auto-install hanya tersedia di Windows. Install manual dengan: sudo apt install wireguard'
    });
  }

  if (WireguardManager.isWireGuardInstalled()) {
    return res.json({ success: true, message: 'WireGuard sudah terinstall.' });
  }

  try {
    // Respond cepat dulu, proses berjalan di background
    res.json({
      success: true,
      message: 'Proses download & install WireGuard dimulai. Ini mungkin butuh 1-2 menit...',
      installing: true
    });

    // Jalankan install di background
    WireguardManager.installWireGuard().then(result => {
      console.log('[System] WireGuard install result:', result);
    });

  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/system/wireguard-status — apakah WireGuard sudah selesai install */
router.get('/wireguard-status', (req: Request, res: Response) => {
  const installed = WireguardManager.isWireGuardInstalled();
  res.json({ success: true, installed });
});

export default router;
