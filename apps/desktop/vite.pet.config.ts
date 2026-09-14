import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'renderer-pet'),
  base: './',
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/renderer-pet'),
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});
