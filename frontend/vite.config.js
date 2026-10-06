import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Sesi unik yang hanya ada di memori proses Vite selama 'npm run dev' aktif.
// Begitu 'npm run dev' dihentikan/ditutup, sesi ini hilang dan di-generate ulang pada run berikutnya.
const DEV_SESSION_ID = 'dev_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);

function devSessionPlugin() {
  return {
    name: 'dev-session-plugin',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/api/dev-session' || req.url === '/__dev_session') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ sessionId: DEV_SESSION_ID, active: true }));
          return;
        }
        next();
      });
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), devSessionPlugin()],
  define: {
    __DEV_RUN_ID__: JSON.stringify(DEV_SESSION_ID),
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
})

