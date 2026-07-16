import { getDb } from '../db';
import os from 'os';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://api.absenta.id';

export async function startTelemetryScheduler() {
  console.log('[Telemetry] Initializing telemetry scheduler (5 minutes interval)...');
  
  // Run once on startup, then every 5 minutes (300,000 ms)
  sendTelemetry();
  setInterval(sendTelemetry, 300000);
}

async function sendTelemetry() {
  try {
    const db = await getDb();
    
    // Fetch all active tunnels (running)
    const activeTunnels = await db.all("SELECT license_key, name FROM tunnels WHERE status = 'active'");
    if (activeTunnels.length === 0) {
      return;
    }

    // System memory usage fraction (0 - 1)
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memoryUsage = totalMem > 0 ? usedMem / totalMem : 0;

    // Database size in MB
    let dbSize = 0;
    try {
      let dbPath = path.join(__dirname, '../../local.db');
      
      // Handle Electron AppData path resolution
      if (process.versions && process.versions.electron) {
        const { app } = require('electron');
        const userDataPath = app.getPath('userData');
        dbPath = path.join(userDataPath, 'local.db');
      }
      
      if (fs.existsSync(dbPath)) {
        dbSize = fs.statSync(dbPath).size / (1024 * 1024);
      }
    } catch (dbErr: any) {
      console.warn('[Telemetry] Failed to read db size:', dbErr.message);
    }

    const osType = `${os.type()} ${os.release()} (${os.arch()})`;
    const hostname = os.hostname();

    for (const tunnel of activeTunnels) {
      try {
        const payload = {
          activeUsers: 1, // Represents 1 active gateway connection
          dbSize: parseFloat(dbSize.toFixed(2)),
          memoryUsage: parseFloat(memoryUsage.toFixed(4)),
          lastTapped: new Date().toISOString(),
          deployMode: 'easy-tunnel',
          schoolName: tunnel.name,
          hostname: hostname,
          osType: osType
        };

        const res = await fetch(`${LICENSE_SERVER_URL}/api/platform/heartbeat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-license-key': tunnel.license_key
          },
          body: JSON.stringify(payload),
          timeout: 10000
        });

        if (!res.ok) {
          const text = await res.text();
          console.warn(`[Telemetry] Failed to send heartbeat for license ${tunnel.license_key}: HTTP ${res.status} - ${text}`);
        } else {
          console.log(`[Telemetry] Sent heartbeat successfully for license ${tunnel.license_key} (${tunnel.name})`);
        }
      } catch (err: any) {
        console.error(`[Telemetry] Error sending heartbeat for license ${tunnel.license_key}:`, err.message);
      }
    }
  } catch (err: any) {
    console.error('[Telemetry] Error in telemetry loop:', err.message);
  }
}
