import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(import.meta.dirname, 'renderer-app'),
  base: './',
  plugins: [tailwindcss()],
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/renderer-app'),
    emptyOutDir: true,
  },
  server: {
    port: 5174,
    strictPort: true,
  },
});
