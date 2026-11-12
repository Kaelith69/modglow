import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml } from './format.ts';
import { ANNOUNCEMENT_FLAIRS, buildAnnouncementSvg } from './render.ts';

test('escapeXml neutralises XML markup and removes invalid XML characters', () => {
  assert.equal(escapeXml('<tag a="x">Tom & \'Ada\'</tag>'), '&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Ada&apos;&lt;/tag&gt;');
  const invalid = 'safe' + String.fromCharCode(0, 8, 0xd800, 0xfffe) + 'text\nline';
  assert.equal(escapeXml(invalid), 'safetext\nline');
});

test('all four templates retain their exact supplied geometry and palettes', () => {
  assert.deepEqual(ANNOUNCEMENT_FLAIRS, ['IMPORTANT', 'NOTICE', 'REMINDER', 'ANNOUNCEMENT']);
  const important = buildAnnouncementSvg('Please follow the sub rules no religion or politics here', 'IMPORTANT');
  const notice = buildAnnouncementSvg('Please follow the sub rules no religion or politics here', 'NOTICE');
  const announcement = buildAnnouncementSvg('Please follow the sub rules no religion or politics here', 'ANNOUNCEMENT');
  const reminder = buildAnnouncementSvg('Please follow the sub rules no religion or politics here', 'REMINDER');

  for (const svg of [important, notice, announcement, reminder]) {
    assert.match(svg, /viewBox="0 0 2000 [0-9]+"/);
    assert.match(svg, /M110 65 H1970 V[0-9]+ L1890 [0-9]+ H30 V145 Z/);
    assert.match(svg, /x="165" y="80"/);
    assert.match(svg, /x="195" y="475"/);
    assert.match(svg, /<rect x="115" y="415" width="16" height="[0-9]+"/);
    assert.doesNotMatch(svg, /linearGradient|radialGradient|filter=|opacity=|<image/);
  }

  assert.match(important, /fill="#080605"/);
  assert.match(important, /stroke="#FF2525"/);
  assert.match(important, /M70 120 H510 L390 360 H70 Z/);
  assert.match(important, /textLength="1050"/);
  assert.match(important, /IMPORTANT<\/text>/);

  assert.match(notice, /fill="#050D1C"/);
  assert.match(notice, /stroke="#078BFF"/);
  assert.match(notice, /cx="245" cy="240" r="75"/);
  assert.match(notice, /textLength="720"/);
  assert.match(notice, /NOTICE<\/text>/);

  assert.match(announcement, /fill="#050A05"/);
  assert.match(announcement, /stroke="#8CFF00"/);
  assert.match(announcement, /M135 215 L230 185 L230 285 L135 255 Z/);
  assert.match(announcement, /textLength="1180"/);
  assert.match(announcement, /ANNOUNCEMENT<\/text>/);

  assert.match(reminder, /fill="#090604"/);
  assert.match(reminder, /stroke="#FF7900"/);
  assert.match(reminder, /<rect x="160" y="185" width="145" height="125" rx="16"/);
  assert.match(reminder, /textLength="1050"/);
  assert.match(reminder, /REMINDER<\/text>/);
});

test('two line reference text retains the original 2000 by 760 composition', () => {
  const svg = buildAnnouncementSvg('Please follow the sub rules no religion or\npolitics here', 'IMPORTANT');
  assert.match(svg, /viewBox="0 0 2000 760"/);
  assert.match(svg, /M110 65 H1970 V610 L1890 690 H30 V145 Z/);
  assert.match(svg, /<tspan x="195" dy="0">/);
  assert.match(svg, /<tspan x="195" dy="100">/);
});

test('canvas and outer frame grow with the final body line', () => {
  const oneLine = buildAnnouncementSvg('A short announcement.', 'NOTICE');
  const manyLines = buildAnnouncementSvg('A sentence that wraps across the card width. '.repeat(12), 'NOTICE');
  const oneHeight = Number(oneLine.match(/viewBox="0 0 2000 (\d+)"/)?.[1]);
  const manyHeight = Number(manyLines.match(/viewBox="0 0 2000 (\d+)"/)?.[1]);
  const lineCount = manyLines.match(/<tspan x="195" dy="/g)?.length ?? 0;
  const lastBaseline = 475 + (lineCount - 1) * 100;
  const frameBottom = manyHeight - 70;
  assert.ok(manyHeight > oneHeight);
  assert.ok(lineCount > 1);
  assert.equal(frameBottom, lastBaseline + 115);
  assert.equal(manyHeight, frameBottom + 70);
  assert.match(manyLines, new RegExp('V' + (frameBottom - 80) + ' L1890 ' + frameBottom));
});

test('long unbroken tokens split into lines and never exceed the line limit', () => {
  const svg = buildAnnouncementSvg('W'.repeat(300), 'IMPORTANT');
  const lineCount = svg.match(/<tspan x="195" dy="/g)?.length ?? 0;
  assert.ok(lineCount > 1);
  assert.ok(lineCount <= 24);
  assert.throws(() => buildAnnouncementSvg('W'.repeat(600), 'IMPORTANT'), /more than 24 rendered lines/);
  assert.throws(() => buildAnnouncementSvg('W '.repeat(1300), 'IMPORTANT'), /more than 24 rendered lines/);
});

test('plain announcement body and blockquotes are bold by default', () => {
  const svg = buildAnnouncementSvg('Ordinary announcement text.\n> Quoted announcement text.', 'NOTICE');
  assert.match(svg, /font-weight="700"[^>]*>Ordinary announcement text\\./);
  assert.match(svg, /font-weight="700" font-style="italic"[^>]*>Quoted announcement text\\./);
});

test('Markdown styles and block prefixes remain supported', () => {
  const svg = buildAnnouncementSvg('# Heading\n> quoted text\n- first item\n2. second item\n**bold** *italic* ***both*** ~~strike~~', 'ANNOUNCEMENT');
  assert.match(svg, /font-weight="700"/);
  assert.match(svg, /font-style="italic"/);
  assert.match(svg, /text-decoration="line-through"/);
  assert.match(svg, /› /);
  assert.match(svg, /• /);
  assert.match(svg, /2\. /);
});

test('links and images display readable labels rather than external resources', () => {
  const svg = buildAnnouncementSvg('Read [the rules](https://example.com/rules).\n![Diagram](https://example.com/image.png)', 'NOTICE');
  assert.match(svg, /Read the rules/);
  assert.match(svg, />Diagram</);
  assert.doesNotMatch(svg, /https:\/\/example\.com/);
});

test('XML sensitive text is escaped and unsupported HTML is not emitted', () => {
  const svg = buildAnnouncementSvg('Text <script>alert(1)</script> & 2 < 3', 'REMINDER');
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /Text alert\(1\) &amp; 2 &lt; 3/);
});

test('empty, overlong and excessively tall announcements are rejected', () => {
  assert.throws(() => buildAnnouncementSvg('   '), /no renderable text/);
  assert.throws(() => buildAnnouncementSvg('A'.repeat(2601)), /2600 character limit/);
  assert.throws(() => buildAnnouncementSvg('W '.repeat(1300)), /more than 24 rendered lines/);
  assert.throws(() => buildAnnouncementSvg('Not allowed.', 'URGENT' as never), /four supported announcement flairs/);
});
