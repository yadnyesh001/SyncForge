/**
 * vite.config.js
 * -----------------------------------------------------------------------------
 * Dev server + build config.
 *
 * The `/api` proxy forwards REST calls to the backend during development so the
 * browser sees a same-origin API (no CORS headaches). WebSockets connect
 * directly to VITE_SOCKET_URL (see src/socket/socket.js) because Socket.IO
 * manages its own upgrade handshake.
 */

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_ORIGIN || 'http://localhost:5000',
        changeOrigin: true,
      },
    },
  },
});
