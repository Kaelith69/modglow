import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeXml, markdownToPlainText, relativeTime, wrapText, wrapTextByWidth } from './format.ts';
import { buildCommentSvg } from './render.ts';

test('escapeXml neutralises markup characters', () => {
  assert.equal(escapeXml(`<tag a="x">Tom & 'Ada'</tag>`), '&lt;tag a=&quot;x&quot;&gt;Tom &amp; &apos;Ada&apos;&lt;/tag&gt;');
});

test('escapeXml removes XML-invalid control characters', () => {
  assert.equal(escapeXml('safe\\u0000text\\u0008 and valid\\nline'), 'safetext and valid\\nline');
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

test('spotlight image credits the original author and uses original visual branding', () => {
  const svg = buildCommentSvg({
    subredditName: 'Coconaad',
    authorName: 'example_user',
    body: 'A < 8 & 9 > 3, with **important** note',
    createdAt: new Date('2026-11-12T00:00:00Z'),
    edited: false,
  });
  assert.match(svg, /r\/Coconaad moderation team/);
  assert.match(svg, /u\/example_user/);
  assert.match(svg, /A &lt; 8 &amp; 9 &gt; 3/);
  assert.doesNotMatch(svg, /<script>/);
  assert.match(svg, /COMMUNITY ARCHIVE/);
  assert.match(svg, /COMMUNITY SPOTLIGHT/);
  assert.doesNotMatch(svg, /Reply|Upvote|Downvote|reddit snoo/i);
});

test('spotlight image rejects oversized comments instead of clipping content', () => {
  assert.throws(() => buildCommentSvg({
    subredditName: 'Coconaad',
    authorName: 'example_user',
    body: 'W'.repeat(3000),
    createdAt: new Date(),
    edited: false,
  }), /too long to feature safely/);
});
