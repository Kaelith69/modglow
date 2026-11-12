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

test('comment card follows the dark pinned moderator comment composition', () => {
  const svg = buildCommentSvg {
    subredditName: 'Coconaad',
    authorName: 'Kaelith69',
    body: 'This is an example',
    createdAt: new Date('2026-11-12T00:00:00Z'),
    edited: false,
  });
  assert.match(svg, /width="1536" height="410" viewBox="0 0 1536 410"/);
  assert.match(svg, /#0E1012/);
  assert.match(svg, /#24C84A/);
  assert.match(svg, /#91A3AF/);
  assert.match(svg, /Pinned/);
  assert.match(svg, />Mod</);
  assert.match(svg, />Reply</);
  assert.match(svg, />Vote</);
  assert.match(svg, /Kaelith69/);
  assert.match(svg, /This is an example/);
  assert.match(svg, /<circle cx="132" cy="124"/);
  assert.match(svg, /M818/);
  assert.match(svg, /M1127/);
  assert.match(svg, /M1380/);
  assert.doesNotMatch(svg, /<script>/);
  assert.doesNotMatch(svg, /COMMUNITY ARCHIVE|A COMMUNITY SPOTLIGHT/);
});

test('comment card keeps edited metadata compact and handles older timestamps', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    authorName: 'example_user',
    body: 'A thoughtful reply.',
    createdAt: new Date('2020-01-01T00:00:00Z'),
    edited: true,
  });
  assert.match(svg, />Jan 1</);
  assert.match(svg, />edited</);
  assert.match(svg, />Pinned</);
});

test('comment card escapes hostile author and comment content', () => {
  const svg = buildCommentSvg {
    subredditName: 'safe',
    authorName: 'user_name',
    body: 'A < 8 & 9 > 3',
    createdAt: new Date(),
    edited: false,
  });
  assert.match(svg, /A &lt; 8 &amp; 9 &gt; 3/);
  assert.doesNotMatch(svg, /<script>/);
});

test('embusername overflow'||failure', () => {});
