import test from 'node:test';
import assert from 'node:assert/strict';
import { RichTextBuilder } from '@devvit/reddit';
import { appendAnnouncementFooter, buildAnnouncementImageOnlyRichText, buildAnnouncementRichText } from './richtext.ts';
import { MAX_ANNOUNCEMENT_BODY_CHARS } from './markdown.ts';

test('the SVG image is the first comment node and Markdown follows it', () => {
  const builder = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    '# Release update\n\n**Bold notice** with [the rules](https://example.com/rules), ~~old~~, and `code`.\n\n- First item\n- Second item',
    'Coconaad',
  );
  const serialized = builder.build();
  const document = JSON.parse(serialized) as {
    document?: Array<{
      e?: string;
      o?: boolean;
      c?: Array<{ e?: string; mediaUrl?: string; t?: string; u?: string; f?: number[][]; o?: boolean; c?: Array<{ e?: string; t?: string; u?: string; f?: number[][] }> }>;
    }>;
  };

  assert.ok(Array.isArray(document.document));
  assert.equal(document.document[0]?.e, 'par');
  assert.equal(document.document[0]?.c?.[0]?.e, 'img');
  assert.equal(document.document[0]?.c?.[0]?.mediaUrl, 'https://reddit.test/media/header.png');
  assert.ok(document.document.length > 1);
  assert.ok(serialized.includes('Bold notice'));
  assert.ok(!serialized.includes('**Bold notice**'));
  assert.ok(serialized.includes('https://example.com/rules'));
  assert.ok(serialized.includes('First item'));
  assert.ok(serialized.includes('Coconaad Moderator announcement'));
  assert.equal(document.document[document.document.length - 1]?.c?.[0]?.t, 'Coconaad Moderator announcement');
  assert.deepEqual(document.document[document.document.length - 1]?.c?.[0]?.f, [[32, 0, 31]]);

  const bodyParagraph = document.document.find((node) =>
    node.e === 'par' && node.c?.some((child) => child.t?.startsWith('Bold notice')),
  );
  const boldNode = bodyParagraph?.c?.find((child) => child.t?.startsWith('Bold notice'));
  assert.deepEqual(boldNode?.f, [[1, 0, 17]]);

  const strikeNode = bodyParagraph?.c?.find((child) => child.t === 'old');
  assert.deepEqual(strikeNode?.f, [[9, 0, 3]]);

  const codeNode = bodyParagraph?.c?.find((child) => child.t === 'code');
  assert.deepEqual(codeNode?.f, [[65, 0, 4]]);

  const linkNode = bodyParagraph?.c?.find((child) => child.e === 'link');
  assert.equal(linkNode?.u, 'https://example.com/rules');
  assert.deepEqual(linkNode?.f, [[1, 0, 9]]);

  const listNode = document.document.find((node) => node.e === 'list');
  assert.equal(listNode?.o, false);
});

test('separator only Markdown cannot create an empty body comment', () => {
  assert.throws(
    () => buildAnnouncementRichText('https://reddit.test/media/header.png', '---', 'Coconaad'),
    /Write some Markdown text/,
  );
});

test('rich text builder enforces the Markdown body grapheme limit', () => {
  assert.throws(
    () => buildAnnouncementRichText(
      'https://reddit.test/media/header.png',
      'x'.repeat(MAX_ANNOUNCEMENT_BODY_CHARS + 1),
      'Coconaad',
    ),
    /character limit/,
  );
});


test('the attribution helper appends a superscript footer', () => {
  const builder = appendAnnouncementFooter(new RichTextBuilder(), 'Coconaad');
  const document = JSON.parse(builder.build()) as { document: Array<{ c?: Array<{ t?: string; f?: number[][] }> }> };
  assert.equal(document.document[0]?.c?.[0]?.t, 'Coconaad Moderator announcement');
  assert.deepEqual(document.document[0]?.c?.[0]?.f, [[32, 0, 31]]);
});

test('redundant bold Markdown markers do not leak into rendered Reddit rich text', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    '**Bold** __also bold__ ***bold italic***',
    'Coconaad',
  ).build();
  assert.ok(serialized.includes('Bold'));
  assert.ok(serialized.includes('also bold'));
  assert.ok(serialized.includes('bold italic'));
  assert.ok(!serialized.includes('**'));
  assert.ok(!serialized.includes('__'));
  assert.ok(serialized.includes('"f":[[1,0,15]]'));
  assert.ok(serialized.includes('"f":[[1,0,11]]'));
});

test('all announcement body text is bold and user emphasis syntax is removed', () => {
  const input = [
    '**Respect everyone.** *Keep discussions civil.*',
    '',
    '**Stay relevant.** *Follow the subreddit rules.*',
    '',
    '**No spam, harassment, or hate.** *Post responsibly.*',
    '',
    '**Use the right flair.** *Keep content organised.*',
    '',
    '**Think before posting.** *Quality over quantity.*',
    '',
    '**Be part of the community.** *Keep Coconaad welcoming.*',
  ].join('\\n');

  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    input,
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; f?: number[][] }> }>;
  };
  const bodyParagraphs = document.document
    .filter((block) => block.e === 'par'
      && block.c?.some((node) => node.t && node.t !== 'Coconaad Moderator announcement'))
    .map((block) => (block.c ?? [])
      .filter((node) => node.t)
      .map((node) => node.t)
      .join('')
      .replace(/\\s+/gu, ' ')
      .trim());

  assert.deepEqual(bodyParagraphs, [
    'Respect everyone. Keep discussions civil.',
    'Stay relevant. Follow the subreddit rules.',
    'No spam, harassment, or hate. Post responsibly.',
    'Use the right flair. Keep content organised.',
    'Think before posting. Quality over quantity.',
    'Be part of the community. Keep Coconaad welcoming.',
  ]);
  assert.ok(!serialized.includes('**'));
  assert.ok(!serialized.includes('*'));
  for (const block of document.document) {
    if (block.e !== 'par') continue;
    for (const node of block.c ?? []) {
      if (!node.t || node.t === 'Coconaad Moderator announcement') continue;
      assert.ok(node.f?.some((range) => (range[0] & 1) === 1), 'every body text node must be bold');
      assert.ok(!node.f?.some((range) => (range[0] & 2) === 2), 'user italic markup must not produce italic text');
    }
  }
});

test('optional rules link is emitted as a clickable native rich text link', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    '**Respect everyone.** *Keep discussions civil.*',
    'Coconaad',
    true,
  ).build();
  const document = JSON.parse(serialized) as { document: Array<{ c?: Array<{ e?: string; t?: string; u?: string }> }> };
  const link = document.document.flatMap((node) => node.c ?? []).find((node) => node.e === 'link');
  assert.equal(link?.t, 'Subreddit rules and guidelines');
  assert.equal(link?.u, 'https://www.reddit.com/r/Coconaad/about/rules');
  assert.ok(!serialized.includes('**'));
  assert.ok(serialized.includes('Respect everyone.'));
  assert.ok(serialized.includes('Keep discussions civil.'));
});

test('compact image only announcements include the optional rules link after the image', () => {
  const serialized = buildAnnouncementImageOnlyRichText(
    'https://reddit.test/media/header.png',
    'Coconaad',
    true,
  ).build();
  const document = JSON.parse(serialized) as { document: Array<{ c?: Array<{ e?: string; mediaUrl?: string; t?: string; u?: string }> }> };
  assert.equal(document.document[0]?.c?.[0]?.e, 'img');
  assert.equal(document.document[0]?.c?.[0]?.mediaUrl, 'https://reddit.test/media/header.png');
  const link = document.document.flatMap((node) => node.c ?? []).find((node) => node.e === 'link');
  assert.equal(link?.t, 'Subreddit rules and guidelines');
  assert.equal(link?.u, 'https://www.reddit.com/r/Coconaad/about/rules');
});

test('compact image only announcements omit the rules link when disabled', () => {
  const serialized = buildAnnouncementImageOnlyRichText(
    'https://reddit.test/media/header.png',
    'Coconaad',
  ).build();
  assert.ok(!serialized.includes('Subreddit rules and guidelines'));
});
