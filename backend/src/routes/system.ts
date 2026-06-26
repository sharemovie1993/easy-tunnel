import { Router, Request, Response } from 'express';
import os from 'os';
import { WireguardManager } from '../services/wireguardManager';
import { getDb } from '../db';

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
      app_version: '1.0.0',
      os_release: os.release(),
      os_arch: os.arch(),
      license_server_url: process.env.LICENSE_SERVER_URL || 'https://api.absenta.id'
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

/** GET /api/system/tunnels-diagnostics — analisa tunnel sampah/orphaned */
router.get('/tunnels-diagnostics', async (req: Request, res: Response) => {
  try {
    const db = await getDb();
    const dbTunnels = await db.all('SELECT * FROM tunnels');
    
    // Dapatkan semua service terpasang
    const installedServices = WireguardManager.listInstalledServices();
    
    // Tentukan tunnel sampah/orphaned:
    // 1. Service terpasang di OS, tapi TIDAK ADA di DB sama sekali
    // 2. Service terpasang di OS, tapi status di DB adalah 'inactive' atau 'expired' (tidak seharusnya running)
    const orphans = installedServices.filter(svc => {
      const slugMatch = svc.name.includes('$') ? svc.name.split('$')[1] : svc.name;
      const slug = slugMatch.replace(/^et-/, '');
      
      const dbMatch = dbTunnels.find(t => t.subdomain === slug);
      if (!dbMatch) {
        return true;
      }
      
      // Jika running tapi di database statusnya inactive, expired, atau error
      if (svc.status === 'RUNNING' && (dbMatch.status === 'inactive' || dbMatch.status === 'expired' || dbMatch.status === 'error')) {
        return true;
      }
      
      return false;
    });

    res.json({
      success: true,
      data: {
        installed: installedServices,
        db_tunnels: dbTunnels,
        orphans: orphans
      }
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/system/clean-tunnels — bersihkan tunnel sampah terpilih */
router.post('/clean-tunnels', async (req: Request, res: Response) => {
  const { service_names } = req.body;
  if (!service_names || !Array.isArray(service_names)) {
    return res.status(400).json({ success: false, message: 'service_names (array) wajib diisi.' });
  }

  try {
    const result = await WireguardManager.cleanServices(service_names);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
