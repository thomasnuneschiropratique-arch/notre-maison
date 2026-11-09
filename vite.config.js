import { defineConfig } from 'vite';
import { mkdirSync, writeFileSync } from 'node:fs';

// Outil de développement : enregistre les vignettes de meubles calculées dans le navigateur.
const saveThumbs = {
  name: 'save-thumbs', apply: 'serve',
  configureServer(server) {
    const dir = new URL('./public/thumbs/p/', import.meta.url).pathname;
    mkdirSync(dir, { recursive: true });
    server.middlewares.use('/__thumb', (req, res) => {
      const id = new URL(req.url, 'http://x').searchParams.get('id');
      if (req.method !== 'POST' || !/^[\w-]+$/.test(id || '')) { res.statusCode = 400; res.end(); return; }
      const parts = [];
      req.on('data', (c) => parts.push(c));
      req.on('end', () => { writeFileSync(`${dir}${id}.webp`, Buffer.concat(parts)); res.end('ok'); });
    });
  },
};

export default defineConfig({
  base: './',
  plugins: [saveThumbs],
  build: {
    outDir: 'docs', target: 'es2022', chunkSizeWarningLimit: 2500, assetsInlineLimit: 0,
    rollupOptions: {
      output: {
        advancedChunks: {
          groups: [
            { name: 'three', test: /node_modules\/three\//, priority: 20 },
            { name: 'pathtracer', test: /node_modules\/(three-gpu-pathtracer|three-mesh-bvh)/, priority: 10 },
          ],
        },
      },
    },
  },
  server: { port: 5183, host: true },
});
