import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  root,
  plugins: [react()],
  server: { port: 4100 },
  build: {
    outDir: resolve(root, '../../dist/super-admin'),
    emptyOutDir: true,
  },
});
