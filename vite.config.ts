import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { devvit } from '@devvit/start/vite';

const require = createRequire(import.meta.url);

/**
 * Vite 8 / Rolldown does not reliably resolve the wasm-bindgen package's
 * `index_bg.wasm?inline` import on Windows. Read the package's WASM at build
 * time and expose it as a base64 virtual module instead. The resulting server
 * bundle remains self contained and does not need filesystem access at runtime.
 */
function resvgWasmInlinePlugin(): Plugin {
  const virtualId = 'virtual:resvg-wasm-base64';
  const resolvedVirtualId = `\0${virtualId}`;

  return {
    name: 'modglow:resvg-wasm-inline',
    resolveId(source) {
      if (source === virtualId) return resolvedVirtualId;
      return null;
    },
    load(id) {
      if (id !== resolvedVirtualId) return null;

      const resvgEntry = require.resolve('@resvg/resvg-wasm');
      const wasmPath = join(dirname(resvgEntry), 'index_bg.wasm');
      const wasmBase64 = readFileSync(wasmPath).toString('base64');

      return `export default ${JSON.stringify(wasmBase64)};`;
    },
  };
}

export default defineConfig({
  plugins: [resvgWasmInlinePlugin(), devvit()],
  build: {
    // Keep the renderer's WebAssembly binary inside the server bundle.
    // Devvit Web server endpoints cannot read arbitrary files from disk.
    assetsInlineLimit: 5_000_000,
  },
});
