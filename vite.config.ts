import { defineConfig } from 'vite';
import { devvit } from '@devvit/start/vite';

export default defineConfig({
  plugins: [devvit()],
  build: {
    // Keep the renderer's WebAssembly binary inside the server bundle.
    // Devvit Web server endpoints cannot read arbitrary files from disk.
    assetsInlineLimit: 5_000_000,
  },
});
