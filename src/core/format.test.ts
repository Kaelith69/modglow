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

test('default announcement uses the reference comic layout and dynamic frame', () => {
  const svg = buildAnnouncementSvg('A moderator announcement.');
  assert.match(svg, /width="1536" height="584" viewBox="0 0 1536 584"/);
  assert.match(svg, /<title>ModGlow announcement<\/title>/);
  assert.match(svg, /fill="#010703"/);
  assert.match(svg, /M350 57 H1512 V462 L1450 524 H22 V112 L82 50/);
  assert.match(svg, /<text x="112" y="62"/);
  assert.match(svg, /<text x="366" y="229"/);
  assert.match(svg, /<text x="145" y="350"/);
  assert.match(svg, /M96 306 V378/);
  assert.match(svg, />ANNOUNCEMENT</);
  assert.doesNotMatch(svg, /linearGradient|radialGradient|filter=|opacity=|<script>/);
  assert.doesNotMatch(svg, /Reply|Vote|Pinned/);
});

test('all four flairs share reference geometry and use their supplied palette', async () => {
  const { ANNOUNCEMENT_FLAIRS } = await import('./render.ts');
  assert.deepEqual(ANNOUNCEMENT_FLAIRS, ['IMPORTANT', 'NOTICE', 'REMINDER', 'ANNOUNCEMENT']);
  const cards = ANNOUNCEMENT_FLAIRS.map((flair) => buildAnnouncementSvg('Read this update.', flair));
  assert.equal(new Set(cards).size, 4);
  for (const card of cards) {
    assert.match(card, /M350 57 H1512 V462 L1450 524 H22 V112 L82 50/);
    assert.match(card, /<text x="112" y="62"/);
    assert.match(card, /<text x="366" y="229"/);
    assert.match(card, /<text x="145" y="350"/);
    assert.match(card, /M96 306 V378/);
    assert.match(card, /M1290 128 H1350/);
    assert.match(card, /M1365 128 H1425/);
    assert.match(card, /M1440 128 H1500/);
    assert.match(card, /fill="#(?:050000|02091B|070300|010703)"/);
    assert.doesNotMatch(card, /linearGradient|radialGradient|filter=|opacity=/);
  }
  assert.match(cards[0], /#F20D24/);
  assert.match(cards[1], /#087CFF/);
  assert.match(cards[2], /#FF7900/);
  assert.match(cards[3], /#7CFF00/);
});

test('frame grows with body lines and retains bottom clearance', () => {
  const short = buildAnnouncementSvg('One line.', 'NOTICE');
  const long = buildAnnouncementSvg('A wrapped announcement line with enough words to fill the card width. '.repeat(7), 'NOTICE');
  const shortHeight = Number(short.match(/height="(\d+)"/)?.[1]);
  const longHeight = Number(long.match(/height="(\d+)"/)?.[1]);
  assert.ok(longHeight > shortHeight);
  const lastBaseline = 350 + ((long.match(/<tspan x="145" dy="/g)?.length ?? 1) - 1) * 78;
  const frameBottom = longHeight - 60;
  assert.ok(frameBottom - (lastBaseline + 64) >= 32);
  assert.match(long, new RegExp('M96 306 V' + (lastBaseline + 28)));
});

test('long unbroken words wrap rather than crossing the body width', () => {
  const svg = buildAnnouncementSvg('W'.repeat(500), 'IMPORTANT');
  const lineCount = svg.match(/<tspan x="145" dy="/g)?.length ?? 0;
  assert.ok(lineCount > 1);
  assert.ok(lineCount <= 24);
});
test('unsupported flair values are rejected', () => {
  assert.throws(
    () => buildAnnouncementSvg('Not allowed.', 'URGENT' as never),
    /four supported announcement flairs/,
  );
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
  assert.match(svg, /and \*literal\*<\/tspan>/);
  assert.doesNotMatch(svg, /font-style="italic"[^>]*>literal<\/tspan>/);
});

test('headings, quotes, ordered lists, and unordered lists retain block styling', () => {
  const svg = buildAnnouncementSvg(
    '# Important\n> Please read this.\n- First item\n2. Second item',
  );
  assert.match(svg, /font-weight="700" font-style="normal" fill="#F20D24">Important<\/tspan>/);
  assert.match(svg, /› /);
  assert.match(svg, /• /);
  assert.match(svg, /2\. /);
  assert.match(svg, /font-style="italic"/);
});

test('inline and fenced code remain literal and use highlighted text styling', () => {
  const svg = buildAnnouncementSvg(
    'Run `**not bold**` now.\n\n```ts\nconst value = `**literal**`;\n```',
  );
  assert.match(svg, /font-family="IBM Plex Sans"[^>]*fill="#7CFF00"/);
  assert.match(svg, /\*\*not bold\*\*/);
  assert.match(svg, /\*\*literal\*\*/);
  assert.doesNotMatch(svg, /font-weight="700" font-style="normal"[^>]*>not bold</);
});

test('links preserve their readable label and images preserve their alt text', () => {
  const svg = buildAnnouncementSvg(
    'Read [the rules](https://example.com/rules).\n![Diagram](https://example.com/image.png)',
  );
  assert.match(svg, /Read the rules\./);
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
  const boldLines = [...svg.matchAll(/font-weight="700" font-style="normal"/g)];
  const italicLines = [...svg.matchAll(/font-weight="400" font-style="italic"/g)];
  assert.ok(boldLines.length >= 2);
  assert.ok(italicLines.length >= 2);
  assert.match(svg, /height="\d+"/);
});

test('the card grows with wrapped text and preserves bottom breathing room', () => {
  const svg = buildAnnouncementSvg('A first line with enough words to wrap across the card. '.repeat(8));
  const height = Number(svg.match(/width="1536" height="(\d+)"/)?.[1]);
  const lineCount = svg.match(/<tspan x="88" dy="/g)?.length ?? 1;
  const bodyEndY = 340 + (lineCount - 1) * 78 + 64;
  assert.ok(height > 438);
  assert.ok(height >= bodyEndY + 103);
});

test('empty, markup-only, overlong, and excessively tall announcements are rejected', () => {
  assert.throws(() => buildAnnouncementSvg('   '), /no renderable text/);
  assert.throws(() => buildAnnouncementSvg('<b></b>'), /no renderable text/);
  assert.throws(() => buildAnnouncementSvg('A'.repeat(2601)), /2600 character limit/);
  assert.throws(() => buildAnnouncementSvg('W '.repeat(650)), /more than 24 rendered lines/);
});
