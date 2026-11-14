import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnouncementSvg } from './render.ts';

test('embedded SVG body respects the default bold option while preserving explicit Markdown bold', () => {
  const normal = buildAnnouncementSvg('Plain text and **explicit bold**', 'NOTICE', false);
  const bold = buildAnnouncementSvg('Plain text and **explicit bold**', 'NOTICE', true);
  assert.match(normal, /font-weight="400"[^>]*>Plain text and /u);
  assert.match(normal, /font-weight="700"[^>]*>explicit bold/u);
  assert.match(bold, /font-weight="700"[^>]*>Plain text and /u);
});
