import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { initDb } from './db';
import tunnelsRouter from './routes/tunnels';
import orderRouter from './routes/order';
import systemRouter from './routes/system';
import authRouter from './routes/auth';
import vncRouter from './routes/vnc';

const app = express();
const PORT = parseInt(process.env.PORT || '7080', 10);
const FRONTEND_DIST = process.env.FRONTEND_DIST || path.join(__dirname, '../../frontend/dist');

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '5mb' }));

// API Routes
app.use('/api/tunnels', tunnelsRouter);
app.use('/api/order', orderRouter);
app.use('/api/system', systemRouter);
app.use('/api/auth', authRouter);
app.use('/api/vnc', vncRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'Easy Tunnel Backend is running.', port: PORT });
});

import fs from 'fs';

// Serve frontend build if it exists
if (fs.existsSync(FRONTEND_DIST)) {
  console.log(`[Frontend] Melayani static files dari: ${FRONTEND_DIST}`);
  app.use(express.static(FRONTEND_DIST));
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_DIST, 'index.html'));
  });
} else {
  console.log(`[Frontend] Direktori ${FRONTEND_DIST} tidak ditemukan. Berjalan dalam mode API-only.`);
  app.get('/', (req, res) => {
    res.send('Easy Tunnel API Server berjalan.');
  });
}

// Init DB then start server
initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Easy Tunnel Backend berjalan di http://localhost:${PORT}`);
    console.log(`📡 API tersedia di http://localhost:${PORT}/api/`);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`🌐 Frontend dev server: http://localhost:5173`);
    }
  });
}).catch(err => {
  console.error('[FATAL] Gagal inisialisasi database:', err);
  process.exit(1);
});

export default app;
