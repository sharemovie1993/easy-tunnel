import { Router, Request, Response } from 'express';
import {
  fetchPackages,
  requestNewLicense,
  checkLicenseStatus,
  checkInvoiceStatus,
  checkSlugAvailability,
  validateLicenseKey,
  fetchPaymentChannels
} from '../services/licenseClient';
import { WireguardManager } from '../services/wireguardManager';

const router = Router();

/** GET /api/order/payment-channels — ambil daftar metode pembayaran */
router.get('/payment-channels', async (req: Request, res: Response) => {
  try {
    const channels = await fetchPaymentChannels();
    res.json({ success: true, data: channels });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/order/packages — ambil daftar paket easy-tunnel */
router.get('/packages', async (req: Request, res: Response) => {
  try {
    const packages = await fetchPackages();
    res.json({ success: true, data: packages });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/order/check-slug/:slug — cek ketersediaan subdomain */
router.get('/check-slug/:slug', async (req: Request, res: Response) => {
  try {
    const result = await checkSlugAvailability(req.params.slug);
    res.json({ success: true, ...result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/** GET /api/order/validate-key/:key — validasi license key */
router.get('/validate-key/:key', async (req: Request, res: Response) => {
  try {
    const info = await validateLicenseKey(req.params.key);
    res.json({ success: true, data: info });
  } catch (err: any) {
    res.status(404).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/order/new — buat order lisensi baru / perpanjangan
 * Body: { school_name, plan_id, payment_method, renew_license_key, subdomain_slug, app_name, local_port }
 * Return: { license_key, invoice_number, amount, payment_instructions, ... }
 */
router.post('/new', async (req: Request, res: Response) => {
  const { school_name, plan_id, payment_method, renew_license_key, subdomain_slug, app_name, local_port } = req.body;
  if (!plan_id || !payment_method) {
    return res.status(400).json({ success: false, message: 'plan_id, payment_method wajib diisi.' });
  }
  if (!renew_license_key && !school_name) {
    return res.status(400).json({ success: false, message: 'school_name wajib diisi.' });
  }

  try {
    const result = await requestNewLicense({
      school_name: school_name || '',
      plan_id,
      payment_method,
      renew_license_key,
      subdomain_slug,
      app_name,
      local_port: local_port ? parseInt(local_port, 10) : undefined
    });

    // Sesuaikan port dan nama aplikasi ke server lisensi sesaat setelah lisensi dibuat
    const key = result.license_key || result.data?.license_key;
    if (key && local_port) {
      try {
        const { updateLicensePort } = require('../services/licenseClient');
        await updateLicensePort(key, parseInt(local_port, 10), app_name);
      } catch (updateErr: any) {
        console.warn('[Order New] Gagal mendaftarkan port/app awal ke server:', updateErr.message);
      }
    }

    res.json(result);
  } catch (err: any) {
    console.error('[Order New Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * POST /api/order/update-config — update port dan nama aplikasi ke server lisensi
 * Body: { license_key, local_port, app_name }
 */
router.post('/update-config', async (req: Request, res: Response) => {
  const { license_key, local_port, app_name } = req.body;
  if (!license_key || !local_port) {
    return res.status(400).json({ success: false, message: 'license_key dan local_port wajib diisi.' });
  }
  try {
    const { updateLicensePort } = require('../services/licenseClient');
    await updateLicensePort(license_key.trim(), parseInt(local_port, 10), app_name);
    res.json({ success: true, message: 'Konfigurasi lisensi berhasil disimpan di server.' });
  } catch (err: any) {
    console.error('[Order Update Config Error]', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/order/payment-status/:licenseKey — poll status pembayaran
 * Digunakan oleh frontend saat polling setelah bayar (fallback)
 */
router.get('/payment-status/:licenseKey', async (req: Request, res: Response) => {
  try {
    const status = await checkLicenseStatus(req.params.licenseKey);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * GET /api/order/invoice-status/:invoiceNumber — poll status pembayaran berdasarkan invoice
 */
router.get('/invoice-status/:invoiceNumber', async (req: Request, res: Response) => {
  try {
    const status = await checkInvoiceStatus(req.params.invoiceNumber);
    res.json(status);
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
