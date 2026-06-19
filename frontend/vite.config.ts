import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '0.0.0.0',        // Bisa diakses dari IP LAN, WireGuard, dll
    allowedHosts: true,     // Izinkan semua host (termasuk subdomain absenta.id)
    proxy: {
      '/api': {
        target: 'http://localhost:7080',
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true
  }
})
