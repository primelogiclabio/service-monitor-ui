import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';

// In development the dashboard talks to a hub through this proxy, so no CORS setup is needed.
// Point it at your hub with VITE_HUB_URL (default: a hub on this machine).
const hub = process.env.VITE_HUB_URL || 'http://127.0.0.1:8080';

export default defineConfig({
  plugins: [svelte()],
  // Relative asset paths, so the built bundle works from any folder or sub-path.
  base: './',
  server: {
    port: 5173,
    proxy: { '/api': { target: hub, changeOrigin: true } },
  },
  build: { outDir: 'dist', sourcemap: false },
  test: { environment: 'node', include: ['test/**/*.test.js'] },
});
