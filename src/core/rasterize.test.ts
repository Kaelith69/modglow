import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import { buildAnnouncementHeaderSvg } from './render.ts';

test('bundled Resvg WASM and WOFF2 fonts render the title banner and release resources', async () => {
  const wasm = readFileSync(new URL('../../node_modules/@resvg/resvg-wasm/index_bg.wasm', import.meta.url));
  const fontPaths = [
    '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2',
    '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2',
    '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2',
    '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2',
    '../../node_modules/@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-italic.woff2',
    '../../node_modules/@fontsource/noto-sans-malayalam/files/noto-sans-malayalam-malayalam-400-normal.woff2',
    '../../node_modules/@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2',
  ];
  const fontBuffers = fontPaths.map((path) => readFileSync(new URL(path, import.meta.url)));

  await initWasm(wasm);

  const renderer = new Resvg(buildAnnouncementHeaderSvg('NOTICE'), {
    fitTo: { mode: 'width', value: 1200 },
    background: '#000000',
    font: {
      fontBuffers,
      defaultFontFamily: 'IBM Plex Sans',
      sansSerifFamily: 'IBM Plex Sans',
      loadSystemFonts: false,
    },
  });

  let rendered: ReturnType<typeof renderer.render> | undefined;
  try {
    rendered = renderer.render();
    const png = rendered.asPng();
    assert.deepEqual(Array.from(png.subarray(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10]);
    const view = new DataView(png.buffer, png.byteOffset, png.byteLength);
    assert.equal(view.getUint32(16, false), 1200);
    assert.equal(view.getUint32(20, false), 360);
  } finally {
    try {
      rendered?.free();
    } finally {
      renderer.free();
    }
  }
});
