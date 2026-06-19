import { Router, Request, Response } from 'express';
import {
  requestOTP,
  verifyOTP,
  fetchMyLicenses,
  claimLicense,
  fetchMyOrders
} from '../services/licenseClient';

const router = Router();

// Helper to extract Bearer token from authorization header
function getOperatorToken(req: Request): string {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Sesi login tidak ditemukan. Harap masuk kembali.');
  }
  return authHeader.split(' ')[1];
}

/** POST /api/auth/request-otp — Kirim OTP login ke nomor WA */
router.post('/request-otp', async (req: Request, res: Response) => {
  const { nomor } = req.body;
  if (!nomor) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp wajib diisi.' });
  }
  try {
    const data = await requestOTP(nomor);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/verify-otp — Verifikasi OTP & dapatkan JWT */
router.post('/verify-otp', async (req: Request, res: Response) => {
  const { nomor, code } = req.body;
  if (!nomor || !code) {
    return res.status(400).json({ success: false, message: 'Nomor WhatsApp dan OTP wajib diisi.' });
  }
  try {
    const data = await verifyOTP(nomor, code);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/auth/my-licenses — Daftar lisensi milik operator */
router.get('/my-licenses', async (req: Request, res: Response) => {
  try {
    const token = getOperatorToken(req);
    const licenses = await fetchMyLicenses(token);
    res.json({ success: true, count: licenses.length, data: licenses });
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message });
  }
});

/** POST /api/auth/claim-license — Hubungkan license key ke operator */
router.post('/claim-license', async (req: Request, res: Response) => {
  const { license_key } = req.body;
  if (!license_key) {
    return res.status(400).json({ success: false, message: 'License key wajib diisi.' });
  }
  try {
    const token = getOperatorToken(req);
    const data = await claimLicense(token, license_key);
    res.json(data);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/auth/my-orders — Riwayat transaksi operator */
router.get('/my-orders', async (req: Request, res: Response) => {
  try {
    const token = getOperatorToken(req);
    const orders = await fetchMyOrders(token);
    res.json({ success: true, count: orders.length, data: orders });
  } catch (err: any) {
    res.status(401).json({ success: false, message: err.message });
  }
});

export default router;
