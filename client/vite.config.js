import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    // Forward API calls to the Express server so the browser sees one origin
    // in development and the httpOnly refresh cookie works without CORS issues.
    proxy: {
      '/api': 'http://localhost:5000',
    },
  },
});
