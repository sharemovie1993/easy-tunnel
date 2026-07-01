import { Router, Request, Response } from 'express';
import { VncManager } from '../services/vncManager';

const router = Router();

/** GET /api/vnc/status — Info status instalasi dan run state VNC */
router.get('/status', (req: Request, res: Response) => {
  try {
    const status = VncManager.getStatus();
    res.json({ success: true, data: status });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/vnc/install — Unduh dan pasang VNC Server secara senyap */
router.post('/install', async (req: Request, res: Response) => {
  try {
    // Respond immediately because installer runs download in background/timer
    VncManager.installVnc()
      .then((result) => {
        console.log('[VNC Installer Result]', result);
      })
      .catch((err) => {
        console.error('[VNC Installer Error]', err);
      });

    res.json({
      success: true,
      message: 'Proses unduh dan instalasi VNC Server dimulai di latar belakang. Silakan cek status kembali dalam beberapa menit.'
    });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/vnc/start — Aktifkan layanan VNC dengan password */
router.post('/start', async (req: Request, res: Response) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ success: false, message: 'Password wajib diisi.' });
  }

  try {
    const result = await VncManager.startVnc(password);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/vnc/stop — Nonaktifkan layanan VNC */
router.post('/stop', async (req: Request, res: Response) => {
  try {
    const result = await VncManager.stopVnc();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
