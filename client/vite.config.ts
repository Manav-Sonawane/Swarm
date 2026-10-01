import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

declare const process: { env: Record<string, string | undefined> }; // no @types/node in the client

// SIM_PORT points the dev proxy at a simulation server on another port (default 5000)
const target = `http://localhost:${process.env.SIM_PORT ?? 5000}`;

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': target,
      '/socket.io': { target, ws: true },
    },
  },
});
