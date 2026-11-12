import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml } from './format.ts';
import { buildAnnouncementSvg } from './render.ts';

test('escapeXml neutralises all XML markup characters', () => {
  assert.equal(
    escapeXml(`<tag a="x">Tom & 'Ada'</tag>`),
    '&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Ada&apos;&lt;/tag&gt;',
  );
});

test('escapeXml removes XML-invalid control and surrogate characters', () => {
  const input = 'safe' + String.fromCharCode(0, 8, 0xd800, 0xfffe) + 'text\nline';
  assert.equal(escapeXml(input), 'safetext\nline');
});

test('announcement SVG uses the AMOLED smoked yellow ModGlow identity', () => {
  const svg = buildAnnouncementSvg('A moderator announcement.');
  assert.match(svg, /width="1536" height="438" viewBox="0 0 1536 438"/);
  assert.match(svg, /<title>ModGlow moderator announcement<\/title>/);
  assert.match(svg, /fill="#000000"/);
  assert.match(svg, /url\(#smokedSurface\)/);
  assert.match(svg, /url\(#yellowSmoke\)/);
  assert.match(svg, /url\(#neonEdge\)/);
  assert.match(svg, /filter="url\(#softGlow\)"/);
  assert.match(svg, /filter="url\(#textShadow\)"/);
  assert.match(svg, />ModGlow</);
  assert.match(svg, />Mod</);
  assert.match(svg, />ANNOUNCEMENT</);
  assert.match(svg, />Pinned</);
  assert.doesNotMatch(svg, /Reply|Vote|<script>/);
});

test('inline Markdown preserves bold, italic, bold italic, and strikethrough', () => {
  const svg = buildAnnouncementSvg(
    'A **bold** and *italic* and ***bold italic*** and ~~removed~~ phrase.',
  );
  assert.match(svg, /font-weight="700" font-style="normal"[^>]*>bold<\/tspan>/);
  assert.match(svg, /font-weight="400" font-style="italic"[^>]*>italic<\/tspan>/);
  assert.match(svg, /font-weight="700" font-style="italic"[^>]*>bold italic<\/tspan>/);
  assert.match(svg, /text-decoration="line-through">removed<\/tspan>/);
});

test('underscore emphasis and escaped Markdown markers render literally', () => {
  const svg = buildAnnouncementSvg('__bold__ and _italic_ and \\*literal\\*');
  assert.match(svg, /font-weight="700" font-style="normal"[^>]*>bold<\/tspan>/);
  assert.match(svg, /font-weight="400" font-style="italic"[^>]*>italic<\/tspan>/);
  assert.match(svg, /<tspan[^>]*>\*literal\*<\/tspan>/);
  assert.doesNotMatch(svg, /<tspan[^>]*>literal<\/tspan>/);
});

test('headings, quotes, ordered lists, and unordered lists retain block styling', () => {
  const svg = buildAnnouncementSvg(
    '# Important\n> Please read this.\n- First item\n2. Second item',
  );
  assert.match(svg, /font-weight="700" font-style="normal" fill="#FFEFA3">Important<\/tspan>/);
  assert.match(svg, /› /);
  assert.match(svg, /• /);
  assert.match(svg, /2\. /);
  assert.match(svg, /font-style="italic"/);
});

test('inline and fenced code remain literal and use monospace styling', () => {
  const svg = buildAnnouncementSvg(
    'Run `**not bold**` now.\n\n```ts\nconst value = `**literal**`;\n```',
  );
  assert.match(svg, /font-family="IBM Plex Sans"[^>]*fill="#FFEFA3"/);
  assert.match(svg, /\*\*not bold\*\*/);
  assert.match(svg, /\*\*literal\*\*/);
  assert.doesNotMatch(svg, /font-weight="700" font-style="normal"[^>]*>not bold</);
});

test('links preserve their readable label and images preserve their alt text', () => {
  const svg = buildAnnouncementSvg(
    'Read [the rules](https://example.com/rules).\n![Diagram](https://example.com/image.png)',
  );
  assert.match(svg, />the rules</);
  assert.match(svg, />Diagram</);
  assert.doesNotMatch(svg, /https:\/\/example\.com/);
});

test('hostile HTML and SVG content is displayed as safe text or removed as markup', () => {
  const svg = buildAnnouncementSvg('Text <script>alert(1)</script> & 2 < 3');
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /Text alert\(1\) &amp; 2 &lt; 3/);
});

test('long Markdown runs wrap across lines without losing emphasis', () => {
  const svg = buildAnnouncementSvg(`**${'W'.repeat(120)}** and *${'i'.repeat(120)}*`);
  const boldLines = [...svg.matchAll(/<tspan font-weight="700" font-style="normal"/g)];
  const italicLines = [...svg.matchAll(/<tspan font-weight="400" font-style="italic"/g)];
  assert.ok(boldLines.length >= 2);
  assert.ok(italicLines.length >= 2);
  assert.match(svg, /height="\d+"/);
});

test('the card grows with wrapped text and preserves bottom breathing room', () => {
  const svg = buildAnnouncementSvg('A first line with enough words to wrap across the card. '.repeat(8));
  const height = Number(svg.match(/width="1536" height="(\d+)"/)?.[1]);
  const lineCount = svg.match(/<tspan x="76" dy="/g)?.length ?? 1;
  const bodyEndY = 252 + (lineCount - 1) * 82 + 64;
  assert.ok(height > 438);
  assert.ok(height >= bodyEndY + 112);
});

test('empty, markup-only, overlong, and excessively tall announcements are rejected', () => {
  assert.throws(() => buildAnnouncementSvg('   '), /no renderable text/);
  assert.throws(() => buildAnnouncementSvg('<b></b>'), /no renderable text/);
  assert.throws(() => buildAnnouncementSvg('A'.repeat(2601)), /2600 character limit/);
  assert.throws(() => buildAnnouncementSvg('W '.repeat(650)), /more than 24 rendered lines/);
});
