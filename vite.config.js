import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import notifyHandler from './api/notify.js';

const SERVER_ENV_KEYS = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
];

function readJsonBody(req) {
  return new Promise((resolve) => {
    const chunks = [];
    req.on('data', (chunk) => chunks.push(chunk));
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) {
        req.body = {};
      } else {
        try {
          req.body = JSON.parse(raw);
        } catch {
          req.body = {};
        }
      }
      resolve();
    });
    req.on('error', () => {
      req.body = {};
      resolve();
    });
  });
}

// `npm run dev` tidak menjalankan folder api/, jadi jalankan handler-nya
// langsung di proses Vite memakai variabel dari file .env.
// Harus berupa plugin: configureServer adalah hook plugin, bukan opsi `server.*`.
function localApiPlugin() {
  return {
    name: 'bawaslu-local-api',
    configureServer(server) {
      server.middlewares.use('/api/notify', (req, res) => {
        readJsonBody(req)
          .then(() => notifyHandler(req, res))
          .catch((error) => {
            res.statusCode = 500;
            res.setHeader('Content-Type', 'application/json; charset=utf-8');
            res.end(
              JSON.stringify({ error: error?.message || 'Gagal memproses permintaan.' })
            );
          });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  SERVER_ENV_KEYS.forEach((key) => {
    if (process.env[key] === undefined && env[key] !== undefined) {
      process.env[key] = env[key];
    }
  });

  return {
    plugins: [react(), tailwindcss(), localApiPlugin()],
    server: {
      port: 5173,
      open: true,
      allowedHosts: true, // Mengizinkan ngrok dan tunnel eksternal lainnya
    },
  };
});
