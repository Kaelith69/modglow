import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, markdownToPlainText, relativeTime, wrapText, wrapTextByWidth } from './format.ts';
import { buildAnnouncementSvg, buildCommentSvg } from './render.ts';

test('escapeXml neutralises markup characters', () => {
  assert.equal(escapeXml("<tag a=\"x\">Tom & 'Ada'</tag>"), '&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Ada&apos;&lt;/tag&gt;');
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

test('comment card uses the ModGlow identity and a clean pinned comment layout', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    body: 'This is an example',
    createdAt: new Date('2026-11-12T00:00:00Z'),
    edited: false,
  });
  assert.match(svg, /width="1536" height="438" viewBox="0 0 1536 438"/);
  assert.match(svg, /#000000/);
  assert.match(svg, /#FFE45C/);
  assert.match(svg, /#C9C5B5/);
  assert.match(svg, /#FFE45C/);
  assert.match(svg, /Pinned/);
  assert.match(svg, />Mod</);
  assert.match(svg, />ModGlow</);
  assert.match(svg, /<circle cx="132" cy="124"/);
  assert.match(svg, /M512 92 L858 292/);
  assert.doesNotMatch(svg, /Reply|Vote|<script>|cx="654"|M818|M1127|M1380/);
});

test('comment card preserves bold, italic, and bold italic Markdown', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    body: 'A **bold** and *italic* and ***bold italic*** phrase.',
    createdAt: new Date(),
    edited: false,
  });
  assert.match(svg, /font-weight="700" font-style="normal">bold</);
  assert.match(svg, /font-weight="400" font-style="italic">italic</);
  assert.match(svg, /font-weight="700" font-style="italic">bold italic</);
});

test('comment card keeps edited metadata compact and handles older timestamps', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    body: 'A thoughtful reply.',
    createdAt: new Date('2020-01-01T00:00:00Z'),
    edited: true,
  });
  assert.match(svg, />Jan 1</);
  assert.match(svg, />edited</);
  assert.match(svg, />Pinned</);
});

test('comment card escapes hostile comment content', () => {
  const svg = buildCommentSvg({
    subredditName: 'safe',
    body: 'A < 8 & 9 > 3',
    createdAt: new Date(),
    edited: false,
  });
  assert.match(svg, /A &lt; 8 &amp; 9 &gt; 3/);
  assert.doesNotMatch(svg, /<script>/);
});

test('comment card grows with multiline text and keeps comfortable bottom padding', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    body: 'A first line with enough words to wrap across the card. '.repeat(8),
    createdAt: new Date(),
    edited: false,
  });
  const height = Number(svg.match(/width="1536" height="(\d+)"/)?.[1]);
  const bodyEndY = 252 + ((svg.match(/<tspan /g)?.length ?? 1) - 1) * 82 + 64;
  assert.ok(height > 410);
  assert.ok(height >= bodyEndY + 112);
  assert.doesNotMatch(svg, /Reply|Vote|cx="654"/);
});

test('spotlight image rejects oversized comments instead of clipping content', () => {
  assert.throws(() => buildCommentSvg({
    subredditName: 'Coconaad',
    body: 'W'.repeat(3000),
    createdAt: new Date(),
    edited: false,
  }), /too long to feature safely/);
});

test('announcement card renders moderator-authored Markdown as a pinned image comment', () => {
  const svg = buildAnnouncementSvg('## Important update\n\nA **bold** and *italic* and ***bold italic*** announcement.');
  assert.match(svg, /ModGlow moderator announcement/);
  assert.match(svg, />INFO</);
  assert.match(svg, />Pinned</);
  assert.match(svg, /font-weight="700" font-style="normal">bold</);
  assert.match(svg, /font-weight="400" font-style="italic">italic</);
  assert.match(svg, /font-weight="700" font-style="italic">bold italic</);
  assert.match(svg, /fill="#000000"/);
  assert.match(svg, /url\(#yellowSmoke\)/);
  assert.match(svg, /url\(#neonEdge\)/);
});

test('announcement Markdown emphasis survives wrapping across multiple SVG lines', () => {
  const svg = buildAnnouncementSvg(`**${'W'.repeat(120)}** and *${'i'.repeat(120)}*`);
  const boldLines = [...svg.matchAll(/<tspan font-weight="700" font-style="normal">/g)];
  const italicLines = [...svg.matchAll(/<tspan font-weight="400" font-style="italic">/g)];
  assert.ok(boldLines.length >= 2);
  assert.ok(italicLines.length >= 2);
});
