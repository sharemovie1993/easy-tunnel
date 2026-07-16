import { getDb } from '../db';
import { WireguardManager } from './wireguardManager';
import os from 'os';
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { execSync } from 'child_process';

const LICENSE_SERVER_URL = process.env.LICENSE_SERVER_URL || 'https://api.absenta.id';

export function getCpuSpec(): string {
  try {
    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      const model = cpus[0].model.replace(/\s+/g, ' ').trim();
      return `${model} (${cpus.length} Cores)`;
    }
  } catch (e) {}
  return 'Unknown CPU';
}

export function getRamSpecGB(): string {
  try {
    const totalBytes = os.totalmem();
    const totalGB = Math.round(totalBytes / (1024 * 1024 * 1024));
    return `${totalGB} GB`;
  } catch (e) {}
  return 'Unknown RAM';
}

export function getStorageSpecGB(): string {
  try {
    if (process.platform === 'win32') {
      const out = execSync('wmic logicaldisk where "DeviceID=\'C:\'" get size', { windowsHide: true }).toString();
      const match = out.match(/\d+/);
      if (match) {
        const sizeBytes = parseInt(match[0], 10);
        const sizeGB = Math.round(sizeBytes / (1024 * 1024 * 1024));
        return `${sizeGB} GB`;
      }
    } else {
      const out = execSync("df -B1 / | tail -1 | awk '{print $2}'", { windowsHide: true }).toString();
      const match = out.match(/\d+/);
      if (match) {
        const sizeBytes = parseInt(match[0], 10);
        const sizeGB = Math.round(sizeBytes / (1024 * 1024 * 1024));
        return `${sizeGB} GB`;
      }
    }
  } catch (e) {}
  return 'Unknown Storage';
}

export async function startTelemetryScheduler() {
  console.log('[Telemetry] Initializing telemetry scheduler (5 minutes interval)...');
  
  // Run once on startup, then every 5 minutes (300,000 ms)
  sendTelemetry();
  setInterval(sendTelemetry, 300000);
}

async function sendTelemetry() {
  try {
    const db = await getDb();
    
    // Fetch all tunnels in database
    const tunnels = await db.all("SELECT license_key, name, subdomain, status FROM tunnels");
    
    // Filter only running/connected tunnels
    const activeTunnels = tunnels.filter(tunnel => {
      const isRunning = (tunnel.subdomain && WireguardManager.getStatus(tunnel.subdomain).status === 'connected') || 
                        tunnel.status === 'active';
      return isRunning;
    });

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

    const cpuSpec = getCpuSpec();
    const ramSpec = getRamSpecGB();
    const storageSpec = getStorageSpecGB();
    const baseOs = `${os.type()} ${os.release()} (${os.arch()})`;
    const osType = `${baseOs} | CPU: ${cpuSpec} | RAM: ${ramSpec} | Storage: ${storageSpec}`;
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
