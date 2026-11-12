import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, markdownToPlainText, relativeTime, wrapText, wrapTextByWidth } from './format.ts';
import { buildCommentSvg } from './render.ts';

test('escapeXml neutralises markup characters', () => {
  assert.equal(escapeXml(`<tag a="x">Tom & 'Ada'</tag>`), '&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Ada&apos;&lt;/tag&gt;');
});

test('escapeXml removes XML-invalid control characters', () => {
  const input = 'safe' + String.fromCharCode(0, 8) + 'text and valid' + String.fromCharCode(10) + 'line';
  assert.equal(escapeXml(input), 'safetext and valid\nline');
});

test('markdownToPlainText keeps readable content and strips formatting syntax', () => {
  const result = markdownToPlainText('**Notice**\n\nRead [the rules](https://example.com).\n> Be kind');
  assert.equal(result, 'Notice\n\nRead the rules.\nBe kind');
});

test('wrapText wraps long lines and keeps all content', () => {
  const source = 'alpha beta gamma delta epsilon zeta';
  const lines = wrapText(source, 12);
  assert.deepEqual(lines, ['alpha beta', 'gamma delta', 'epsilon zeta']);
  assert.equal(lines.join(' '), source);
});

test('wrapping helpers reject invalid limits instead of looping forever', () => {
  assert.throws(() => wrapText('abc', 0), /positive integer/);
  assert.throws(() => wrapTextByWidth('abc', 0, 12), /positive finite number/);
  assert.throws(() => wrapTextByWidth('abc', 100, Number.NaN), /positive finite number/);
});

test('relativeTime handles invalid dates without exposing Invalid Date', () => {
  assert.equal(relativeTime(new Date(Number.NaN)), 'date unavailable');
});

test('wrapTextByWidth keeps wide text within the image column', () => {
  const lines = wrapTextByWidth('W'.repeat(120), 1000, 42);
  assert.ok(lines.length > 1);
  assert.equal(lines.join('').length, 120);
});

test('spotlight SVG is minimal AMOLED black with green comment, date, time, and MOD tag', () => {
  const svg = buildCommentSvg({
    body: 'A < 8 & 9 > 3, with **important** note',
    createdAt: new Date('2026-11-12T00:00:00Z'),
  });
  assert.match(svg, /fill="#000000"/);
  assert.match(svg, /fill="#39E879"/);
  assert.match(svg, /font-weight="700" font-style="italic"/);
  assert.match(svg, />MOD</);
  assert.match(svg, /12 Nov 2026/);
  assert.match(svg, /A &lt; 8 &amp; 9 &gt; 3, with important note/);
  assert.doesNotMatch(svg, /COMMUNITY|SPOTLIGHT|MODGLOW|u\/|r\//i);
  assert.doesNotMatch(svg, /<script>|linearGradient|circle|image|foreignObject/i);
});

test('spotlight SVG preserves multiline comments and escapes special characters', () => {
  const svg = buildCommentSvg({
    body: 'First line\nSecond line with <tag> & "quotes"\nThird line',
    createdAt: new Date('2026-11-12T00:00:00Z'),
  });
  assert.match(svg, /First line/);
  assert.match(svg, /Second line with &lt;tag&gt; &amp; &quot;quotes&quot;/);
  assert.match(svg, /Third line/);
  assert.match(svg, /height="468"/);
});

test('spotlight SVG wraps long comments without clipping', () => {
  const body = 'Readable comment content '.repeat(75);
  const svg = buildCommentSvg({ body, createdAt: new Date('2026-11-12T00:00:00Z') });
  assert.ok(Number(svg.match(/height="(\d+)"/)?.[1]) > 1000);
  assert.match(svg, /Readable comment content/);
});
test('spotlight image rejects oversized comments instead of clipping content', () => {
  assert.throws(() => buildCommentSvg({
    body: 'W'.repeat(3000),
    createdAt: new Date(),
  }), /too long to feature safely/);
});
