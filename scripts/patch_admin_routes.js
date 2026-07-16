const fs = require('fs');
const path = require('path');

const filePath = '/var/www/licensing-server/src/routes/admin.routes.ts';
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add imports at the top
if (!content.includes("import fs from 'fs';")) {
  content = "import fs from 'fs';\nimport path from 'path';\n" + content;
}

// 2. Insert Caddy endpoints before the last };
const targetMarker = `    try {
      await waGateway.sendMessage(number, message);
      return reply.send({ success: true, message: 'Pesan test berhasil dikirim.' });
    } catch (err: any) {
      return reply.status(500).send({ success: false, message: 'Gagal mengirim pesan test: ' + err.message });
    }
  });`;

const caddyEndpoints = `

  // 21. GET /api/admin/caddy/status
  fastify.get('/api/admin/caddy/status', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    const checkCmd = process.platform === 'linux' ? 'systemctl is-active caddy' : 'echo active';

    return new Promise((resolve) => {
      exec(checkCmd, (err, stdout) => {
        const isActive = !err && stdout.trim() === 'active';
        let caddyfileContent = '';
        try {
          const caddyPath = process.platform === 'linux' ? '/etc/caddy/Caddyfile' : path.join(__dirname, '../../Caddyfile.generated');
          if (fs.existsSync(caddyPath)) {
            caddyfileContent = fs.readFileSync(caddyPath, 'utf8');
          }
        } catch (e) {}

        resolve(reply.send({
          success: true,
          status: isActive ? 'online' : 'offline',
          caddyfile: caddyfileContent
        }));
      });
    });
  });

  // 22. POST /api/admin/caddy/sync
  fastify.post('/api/admin/caddy/sync', async (request: FastifyRequest, reply: FastifyReply) => {
    await verifyAdmin(request, reply);
    if (reply.sent) return;

    try {
      await triggerCaddySync();
      return reply.send({ success: true, message: 'Sinkronisasi konfigurasi Caddy berhasil dan Caddy telah dimuat ulang.' });
    } catch (err: any) {
      console.error('[Caddy Sync API] Manual sync failed:', err.message);
      return reply.status(500).send({ success: false, error: err.message });
    }
  });`;

const index = content.indexOf(targetMarker);
if (index === -1) {
  console.error('Target marker not found!');
  process.exit(1);
}
const insertPos = index + targetMarker.length;
content = content.slice(0, insertPos) + caddyEndpoints + content.slice(insertPos);
fs.writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched admin.routes.ts!');
