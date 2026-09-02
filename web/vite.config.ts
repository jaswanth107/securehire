import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5175,
    // Proxying keeps the API same-origin in development, so the HTTP-only
    // session cookie is sent without any cross-site cookie relaxation.
    proxy: {
      '/api': {
        target: 'http://localhost:4100',
        changeOrigin: false,
      },
    },
  },
});
