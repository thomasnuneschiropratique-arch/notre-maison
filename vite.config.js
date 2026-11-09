import { defineConfig } from 'vite';
export default defineConfig({
  base: './',
  build: { outDir: 'docs', target: 'es2022', chunkSizeWarningLimit: 2500, assetsInlineLimit: 0 },
  server: { port: 5183, host: true },
});
