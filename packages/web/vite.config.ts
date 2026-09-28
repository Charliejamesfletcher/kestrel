import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // In development, /api/* goes to the local API so there are no CORS issues.
    // KESTREL_API points it elsewhere (e.g. a mock server) without editing this file.
    proxy: { '/api': process.env.KESTREL_API ?? 'http://localhost:3000' }
  }
});
