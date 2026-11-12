import { Buffer } from 'node:buffer';
import { initWasm, Resvg } from '@resvg/resvg-wasm';
import wasmBase64 from 'virtual:resvg-wasm-base64';
import regularFontDataUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-normal.woff2?inline';
import semiboldFontDataUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-600-normal.woff2?inline';
import italicFontDataUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-400-italic.woff2?inline';
import boldFontDataUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-normal.woff2?inline';
import boldItalicFontDataUrl from '@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-700-italic.woff2?inline';
import malayalamFontDataUrl from '@fontsource/noto-sans-malayalam/files/noto-sans-malayalam-malayalam-400-normal.woff2?inline';
import tamilFontDataUrl from '@fontsource/noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff2?inline';

let rendererReady: Promise<void> | undefined;
let fontBuffers: Uint8Array[] | undefined;

function decodeDataUrl(dataUrl: string): Uint8Array {
  const comma = dataUrl.indexOf(',');
  if (comma < 0) throw new Error('An embedded rendering asset was not bundled correctly.');
  return new Uint8Array(Buffer.from(dataUrl.slice(comma + 1), 'base64'));
}

function decodeWasmBase64(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

function getFontBuffers(): Uint8Array[] {
  if (!fontBuffers) {
    fontBuffers = [
      decodeDataUrl(regularFontDataUrl),
      decodeDataUrl(semiboldFontDataUrl),
      decodeDataUrl(italicFontDataUrl),
      decodeDataUrl(boldFontDataUrl),
      decodeDataUrl(boldItalicFontDataUrl),
      decodeDataUrl(malayalamFontDataUrl),
      decodeDataUrl(tamilFontDataUrl),
    ];
  }
  return fontBuffers;
}

async function ensureRenderer(): Promise<void> {
  if (!rendererReady) {
    rendererReady = (async () => {
      await initWasm(decodeWasmBase64(wasmBase64));
    })();
  }

  try {
    await rendererReady;
  } catch (error) {
    rendererReady = undefined;
    throw error;
  }
}

export async function renderAnnouncementPng(svg: string): Promise<Uint8Array> {
  await ensureRenderer();
  const renderer = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    background: '#000000',
    font: {
      fontBuffers: getFontBuffers(),
      defaultFontFamily: 'IBM Plex Sans',
      sansSerifFamily: 'IBM Plex Sans',
      loadSystemFonts: false,
    },
  });

  let rendered: ReturnType<typeof renderer.render> | undefined;
  try {
    rendered = renderer.render();
    const png = rendered.asPng();
    if (png.byteLength > 19 * 1024 * 1024) {
      throw new Error('The generated image exceeds Reddit’s safe upload size.');
    }
    return png;
  } finally {
    try {
      rendered?.free();
    } finally {
      renderer.free();
    }
  }
}
