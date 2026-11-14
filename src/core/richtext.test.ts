import test from 'node:test';
import assert from 'node:assert/strict';
import { RichTextBuilder } from '@devvit/reddit';
import { appendAnnouncementFooter, buildAnnouncementImageOnlyRichText, buildAnnouncementRichText } from './richtext.ts';
import { MARKDOWN_FORMAT, MAX_ANNOUNCEMENT_BODY_CHARS } from './markdown.ts';

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
  assert.deepEqual(boldNode?.f, [[1, 0, 11]]);

  const strikeNode = bodyParagraph?.c?.find((child) => child.t === 'old');
  assert.deepEqual(strikeNode?.f, [[9, 0, 3]]);

  const codeNode = bodyParagraph?.c?.find((child) => child.t === 'code');
  assert.deepEqual(codeNode?.f, [[MARKDOWN_FORMAT.monospace, 0, 4]]);

  const linkNode = bodyParagraph?.c?.find((child) => child.e === 'link');
  assert.equal(linkNode?.u, 'https://example.com/rules');
  assert.deepEqual(linkNode?.f, [[MARKDOWN_FORMAT.bold, 0, 9]]);

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

test('bold Markdown is represented by explicit formatting ranges without marker text', () => {
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
  const document = JSON.parse(serialized) as { document: Array<{ c?: Array<{ t?: string; f?: number[][] }> }> };
  const nodes = document.document.flatMap((block) => block.c ?? []);
  assert.deepEqual(nodes.find((node) => node.t === 'Bold')?.f, [[1, 0, 4]]);
  assert.deepEqual(nodes.find((node) => node.t === 'also bold')?.f, [[1, 0, 9]]);
  assert.deepEqual(nodes.find((node) => node.t === 'bold italic')?.f, [[3, 0, 11]]);
});

test('announcement body preserves only explicitly requested bold and italic styles', () => {
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
  ].join('\n');

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
      .replace(/\s+/gu, ' ')
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
  const bodyNodes = document.document
    .filter((block) => block.e === 'par')
    .flatMap((block) => block.c ?? [])
    .filter((node) => node.t && node.t !== 'Coconaad Moderator announcement');
  for (const node of bodyNodes) {
    if (node.t?.startsWith('Respect everyone.') || node.t?.startsWith('Stay relevant.')
      || node.t?.startsWith('No spam') || node.t?.startsWith('Use the right flair.')
      || node.t?.startsWith('Think before posting.') || node.t?.startsWith('Be part of the community.')) {
      assert.deepEqual(node.f, [[MARKDOWN_FORMAT.bold, 0, node.t.length]]);
    }
    if (node.t?.includes('Keep discussions civil.') || node.t?.includes('Follow the subreddit rules.')
      || node.t?.includes('Post responsibly.') || node.t?.includes('Keep content organised.')
      || node.t?.includes('Quality over quantity.') || node.t?.includes('Keep Coconaad welcoming.')) {
      assert.deepEqual(node.f, [[MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic, 0, node.t.length]]);
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


test('normal text remains plain while italic and combined emphasis retain explicit flags', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    'Normal *italic* ***bold italic***',
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as { document: Array<{ c?: Array<{ t?: string; f?: number[][] }> }> };
  const runs = document.document.flatMap((block) => block.c ?? []).filter((node) => node.t && node.t !== 'Coconaad Moderator announcement');
  assert.deepEqual(runs.map((node) => [node.t, node.f]), [
    ['Normal ', [[MARKDOWN_FORMAT.bold, 0, 7]]],
    ['italic', [[3, 0, 6]]],
    [' ', [[MARKDOWN_FORMAT.bold, 0, 1]]],
    ['bold italic', [[3, 0, 11]]],
  ]);
  assert.ok(!serialized.includes('**'));
});


test('announcement Markdown applies only explicitly requested formatting', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    'Normal text *Italic text* **Bold text** ***Bold italic*** ~~Deleted text~~ `Inline code`',
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ c?: Array<{ t?: string; f?: number[][] }> }>;
  };
  const runs = document.document.flatMap((block) => block.c ?? [])
    .filter((node) => node.t && node.t !== 'Coconaad Moderator announcement');
  const formatFlags = (text: string) => runs.find((node) => node.t?.includes(text))?.f?.[0]?.[0];
  assert.equal(formatFlags('Normal text'), MARKDOWN_FORMAT.bold);
  assert.equal(formatFlags('Italic text'), 3);
  assert.equal(formatFlags('Bold text'), 1);
  assert.equal(formatFlags('Bold italic'), 3);
  assert.equal(formatFlags('Deleted text'), 9);
  assert.equal(formatFlags('Inline code'), 64);
});


test('fenced code blocks remain monospace without inheriting default bold', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    '```ts\nconst answer = 42;\n```',
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ c?: Array<{ t?: string; f?: number[][] }> }>;
  };
  const code = document.document.flatMap((block) => block.c ?? [])
    .find((node) => node.t === 'const answer = 42;');
  assert.deepEqual(code?.f, [[MARKDOWN_FORMAT.monospace, 0, 18]]);
  assert.equal((code?.f?.[0]?.[0] ?? 0) & MARKDOWN_FORMAT.bold, 0);
});


test('Markdown hard breaks are emitted as Reddit linebreak nodes, not literal newline text', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    'First line' + '\\   ' + '\n' + 'Second *italic* line',
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; f?: number[][] }> }>;
  };
  const paragraph = document.document.find((block) =>
    block.e === 'par' && block.c?.some((node) => node.t === 'First line'),
  );
  assert.ok(paragraph);
  assert.deepEqual(
    paragraph?.c?.filter((node) => node.t || node.e).map((node) => node.t ?? node.e),
    ['First line', 'br', 'Second ', 'italic', ' line'],
  );
  const italic = paragraph?.c?.find((node) => node.t === 'italic');
  assert.deepEqual(italic?.f, [[3, 0, 6]]);
});

test('nested bold strikethrough renders with combined Reddit formatting and no visible markers', () => {
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    'Before ~~**bold strikethrough**~~ after.',
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; f?: number[][] }> }>;
  };
  const paragraph = document.document.find((block) =>
    block.e === 'par' && block.c?.some((node) => node.t?.includes('bold strikethrough')),
  );
  const bodyNodes = paragraph?.c ?? [];
  const nestedRun = bodyNodes.find((node) => node.t === 'bold strikethrough');

  assert.deepEqual(nestedRun?.f, [[MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough, 0, 18]]);
  assert.equal(bodyNodes.map((node) => node.t ?? '').join(''), 'Before bold strikethrough after.');
  assert.ok(!bodyNodes.some((node) => node.t && /[*~`]/u.test(node.t)));
});

test('mixed inline formatting renders only the styles specified by Markdown', () => {
  const input = '**Bold text**, *italic text*, ~~strikethrough~~ ***Bold and italic***, `inline code`, ~~**bold strikethrough**~~';
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    input,
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; f?: number[][] }> }>;
  };
  const paragraph = document.document.find((block) =>
    block.e === 'par' && block.c?.some((node) => node.t?.includes('Bold text')),
  );
  const nodes = paragraph?.c ?? [];
  assert.equal(nodes.map((node) => node.t ?? '').join(''), 'Bold text, italic text, strikethrough Bold and italic, inline code, bold strikethrough');
  assert.ok(!nodes.some((node) => node.t && /[*~`]/u.test(node.t)));
  const flagsFor = (value: string) => nodes.find((node) => node.t?.startsWith(value))?.f?.[0]?.[0];
  assert.equal(flagsFor('Bold text'), MARKDOWN_FORMAT.bold);
  assert.equal(flagsFor('italic text'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic);
  assert.equal(flagsFor('strikethrough'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough);
  assert.equal(flagsFor('Bold and italic'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic);
  assert.equal(flagsFor('inline code'), MARKDOWN_FORMAT.monospace);
  assert.equal(flagsFor('bold strikethrough'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough);
});

test('complete announcement input removes escaped bold markers in paragraphs lists and links', () => {
  const input = [
    '# Heading',
    '\\*\\*Bold text\\*\\*, *italic text*, ~~strikethrough~~',
    '***Bold and italic***, `inline code`, ~~\\*\\*bold strikethrough\\*\\*~~',
    '> This is a blockquote with \\*\\*bold\\*\\* and *italic* text.',
    '- Unordered list with \\*\\*bold\\*\\* and *italic*',
    '[Link](https://example.com) and ![Image](https://example.com/image.png)',
  ].join('\n');
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    input,
    'modglow_dev',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; u?: string; f?: number[][] }> }>;
  };
  const collectText = (nodes: Array<{ t?: string; c?: Array<{ t?: string; c?: Array<{ t?: string }> }> }>): string =>
    nodes.map((node) => (node.t ?? '') + collectText(node.c ?? [])).join('');
  const visibleText = collectText(document.document.flatMap((block) => block.c ?? []));
  assert.ok(!visibleText.includes('*'));
  assert.ok(!visibleText.includes('~'));
  assert.ok(!visibleText.includes('`'));
  assert.ok(visibleText.includes('Bold text'));
  assert.ok(visibleText.includes('bold strikethrough'));
  assert.ok(visibleText.includes('Unordered list with bold and italic'));
  assert.ok(visibleText.includes('Link and Image'));
});

test('the exact raw announcement example emits no Markdown markers in any rich text block', () => {
  const input = [
    '# Heading',
    '**Bold text**, *italic text*, ~~strikethrough~~',
    '***Bold and italic***, `inline code`, ~~**bold strikethrough**~~',
    '> This is a blockquote with **bold** and *italic* text.',
    '- Unordered list with **bold** and *italic*',
    '[Link](https://example.com) and ![Image](https://example.com/image.png)',
  ].join('\n');
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    input,
    'modglow_dev',
  ).build();
  const document = JSON.parse(serialized) as { document: Array<unknown> };
  const textNodes: string[] = [];
  const richTextNodes: Array<Record<string, unknown>> = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (const child of value) visit(child);
      return;
    }
    if (!value || typeof value !== 'object') return;
    const node = value as Record<string, unknown>;
    if (typeof node.t === 'string') {
      textNodes.push(node.t);
      richTextNodes.push(node);
    }
    if (node.c !== undefined) visit(node.c);
    if (node.document !== undefined) visit(node.document);
  };
  visit(document.document);

  const flagsFor = (text: string) => {
    const node = richTextNodes.find((candidate) =>
      typeof candidate.t === 'string' && candidate.t.includes(text),
    );
    const ranges = node?.f as number[][] | undefined;
    return ranges?.[0]?.[0];
  };
  assert.equal(flagsFor('Bold text'), MARKDOWN_FORMAT.bold);
  assert.equal(flagsFor('italic text'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic);
  assert.equal(flagsFor('strikethrough'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough);
  assert.equal(flagsFor('Bold and italic'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic);
  assert.equal(flagsFor('inline code'), MARKDOWN_FORMAT.monospace);
  assert.equal(flagsFor('bold strikethrough'), MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough);
  assert.deepEqual(richTextNodes.filter((node) => node.t === 'bold').map((node) => (node.f as number[][] | undefined)?.[0]?.[0]), [MARKDOWN_FORMAT.bold, MARKDOWN_FORMAT.bold]);
  assert.equal(flagsFor('Unordered list with '), MARKDOWN_FORMAT.bold);
  assert.deepEqual(richTextNodes.find((node) => node.e === 'link')?.f, [[MARKDOWN_FORMAT.bold, 0, 4]]);

  const visibleText = textNodes.join('');
  assert.ok(!visibleText.includes('*'), `unexpected asterisk in: ${JSON.stringify(textNodes)}`);
  assert.ok(!visibleText.includes('~'), `unexpected tilde in: ${JSON.stringify(textNodes)}`);
  assert.ok(!visibleText.includes(String.fromCharCode(96)), `unexpected backtick in: ${JSON.stringify(textNodes)}`);
  assert.ok(!visibleText.includes(String.fromCharCode(92)), `unexpected backslash in: ${JSON.stringify(textNodes)}`);
  assert.ok(visibleText.includes('Bold text'));
  assert.ok(visibleText.includes('bold strikethrough'));
  assert.ok(visibleText.includes('This is a blockquote with bold and italic text.'));
  assert.ok(visibleText.includes('Unordered list with bold and italic'));
  assert.ok(visibleText.includes('Link and Image'));
});

test('the full announcement example preserves bold italic strike code and each hard break', () => {
  const slash = String.fromCharCode(92);
  const input = [
    '**Bold text** for emphasis.' + slash,
    '*Italic text* for subtle emphasis.' + slash,
    '***Bold and italic*** for extra emphasis.' + slash,
    '~~Strikethrough~~ for deleted text.' + slash,
    '`Inline code` for technical terms.',
  ].join('\n');
  const serialized = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    input,
    'Coconaad',
  ).build();
  const document = JSON.parse(serialized) as {
    document: Array<{ e?: string; c?: Array<{ e?: string; t?: string; f?: number[][] }> }>;
  };
  const body = document.document.find((block) =>
    block.e === 'par' && block.c?.some((node) => node.t?.includes('Bold text')),
  );
  const nodes = body?.c ?? [];
  const flagsFor = (needle: string) => nodes.find((node) => node.t?.includes(needle))?.f?.[0]?.[0];
  assert.equal(flagsFor('Bold text'), 1);
  assert.equal(flagsFor('Italic text'), 3);
  assert.equal(flagsFor('Bold and italic'), 3);
  assert.equal(flagsFor('Strikethrough'), 9);
  assert.equal(flagsFor('Inline code'), 64);
  assert.equal(nodes.filter((node) => node.e === 'br').length, 4);
  assert.ok(!nodes.some((node) => node.t?.includes(slash)));

  // Assert the exact visible body text, not only formatting flags. This catches
  // Markdown delimiters leaking into Reddit text nodes after formatting.
  assert.equal(
    nodes.map((node) => node.t ?? '').join(''),
    'Bold text for emphasis.Italic text for subtle emphasis.Bold and italic for extra emphasis.Strikethrough for deleted text.Inline code for technical terms.',
  );
  assert.ok(!nodes.some((node) => node.t && /[*~`]/u.test(node.t)));
});
