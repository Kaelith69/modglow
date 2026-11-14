import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countGraphemes,
  MARKDOWN_FORMAT,
  MAX_ANNOUNCEMENT_BODY_CHARS,
  parseInlineMarkdown,
  parseMarkdown,
  hasMarkdownContent,
} from './markdown.ts';

test('inline Markdown preserves explicit bold, italic, combined emphasis, strike and code flags', () => {
  assert.deepEqual(MARKDOWN_FORMAT, { bold: 1, italic: 2, strikethrough: 8, monospace: 64 });
  const nodes = parseInlineMarkdown('**bold** *italic* ***both*** ~~removed~~ `code`');
  assert.deepEqual(
    nodes.map((node) => [node.text, node.formatting]),
    [
      ['bold ', MARKDOWN_FORMAT.bold],
      ['italic', MARKDOWN_FORMAT.italic],
      [' ', 0],
      ['both', MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic],
      [' ', 0],
      ['removed', MARKDOWN_FORMAT.strikethrough],
      [' ', 0],
      ['code', MARKDOWN_FORMAT.monospace],
    ],
  );
});

test('bold nested inside strikethrough is parsed without leaking Markdown delimiters', () => {
  assert.deepEqual(
    parseInlineMarkdown('~~**bold strikethrough**~~ and ~~__underscore bold strikethrough__~~'),
    [
      { type: 'text', text: 'bold strikethrough', formatting: MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough },
      { type: 'text', text: ' and ', formatting: 0 },
      { type: 'text', text: 'underscore bold strikethrough', formatting: MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough },
    ],
  );
});

test('adjacent Markdown tokens do not reprocess delimiters consumed by compound tokens', () => {
  const input = '**Bold text**, *italic text*, ~~strikethrough~~ ***Bold and italic***, `inline code`, ~~**bold strikethrough**~~';
  assert.deepEqual(
    parseInlineMarkdown(input).map((node) => [node.text, node.formatting]),
    [
      ['Bold text, ', MARKDOWN_FORMAT.bold],
      ['italic text', MARKDOWN_FORMAT.italic],
      [', ', 0],
      ['strikethrough', MARKDOWN_FORMAT.strikethrough],
      [' ', 0],
      ['Bold and italic', MARKDOWN_FORMAT.italic],
      [', ', 0],
      ['inline code', MARKDOWN_FORMAT.monospace],
      [', ', 0],
      ['bold strikethrough', MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.strikethrough],
    ],
  );
});

test('balanced escaped bold delimiters from paragraph form input are normalized before parsing', () => {
  assert.deepEqual(
    parseInlineMarkdown('\\*\\*Bold text\\*\\* and \\*\\*more bold\\*\\*'),
    [{ type: 'text', text: 'Bold text and more bold', formatting: 0 }],
  );
  assert.deepEqual(
    parseInlineMarkdown('\\**Bold text\\**'),
    [{ type: 'text', text: 'Bold text', formatting: 0 }],
  );
  assert.deepEqual(
    parseInlineMarkdown('\\*literal\\*'),
    [{ type: 'text', text: '*literal*', formatting: 0 }],
  );
});

test('Markdown links are retained as safe HTTP links and images degrade to alt text', () => {
  const nodes = parseInlineMarkdown('Read [the rules](https://example.com/rules). ![Diagram](https://example.com/image.png)');
  const link = nodes.find((node) => node.type === 'link');
  assert.deepEqual(link, { type: 'link', text: 'the rules', url: 'https://example.com/rules', formatting: 0 });
  assert.ok(nodes.some((node) => node.type === 'text' && node.text.includes('Diagram')));
  assert.ok(!nodes.some((node) => node.type === 'link' && node.url.includes('image.png')));

  const unsafe = parseInlineMarkdown('[unsafe](javascript:alert)');
  assert.deepEqual(unsafe, [{ type: 'text', text: 'unsafe', formatting: 0 }]);
});

test('inline parser preserves identifier underscores and balanced link parentheses', () => {
  const nodes = parseInlineMarkdown('Use snake_case_value and [the article](https://example.com/path_(part)).');
  assert.ok(nodes.some((node) => node.type === 'text' && node.text.includes('snake_case_value') && node.formatting === 0));
  assert.deepEqual(
    nodes.find((node) => node.type === 'link'),
    { type: 'link', text: 'the article', url: 'https://example.com/path_(part)', formatting: 0 },
  );

  const unsafe = parseInlineMarkdown('[unsafe](javascript:alert(1))');
  assert.deepEqual(unsafe, [{ type: 'text', text: 'unsafe', formatting: 0 }]);
});

test('escaped Markdown markers stay literal', () => {
  assert.deepEqual(parseInlineMarkdown('\\*literal\\*'), [
    { type: 'text', text: '*literal*', formatting: 0 },
  ]);
});

test('block parser supports all heading depths, paragraphs, lists, quotes and code blocks', () => {
  const blocks = parseMarkdown([
    '# H1',
    '## H2',
    '### H3',
    '#### H4',
    '##### H5',
    '###### H6',
    '',
    'First paragraph',
    'continued on the next source line.',
    '',
    '- one',
    '- **two**',
    '',
    '1. first',
    '2. second',
    '',
    '> quoted **text**',
    '> second line',
    '',
    '```typescript',
    'const answer = 42;',
    '```',
    '',
    '````bash',
    'echo "literal ``` fence"',
    '````',
    '',
    '~~~python',
    'print("tilde fence")',
    '~~~',
    '',
    '~~~c#',
    'int answer = 42;',
    '~~~',
    '',
    '---',
  ].join('\n'));

  assert.deepEqual(
    blocks.filter((block) => block.type === 'heading').map((block) => block.level),
    [1, 2, 3, 4, 5, 6],
  );
  assert.deepEqual(blocks.filter((block) => block.type === 'list').map((block) => ({
    ordered: block.type === 'list' ? block.ordered : false,
    count: block.type === 'list' ? block.items.length : 0,
  })), [
    { ordered: false, count: 2 },
    { ordered: true, count: 2 },
  ]);
  assert.ok(blocks.some((block) => block.type === 'paragraph' && block.content.map((node) => node.text).join(' ') === 'First paragraph continued on the next source line.'));
  assert.ok(blocks.some((block) => block.type === 'blockquote' && block.paragraphs.length === 1));
  const quoteIndentation = parseMarkdown('> real quote\n\n    > literal text');
  assert.ok(quoteIndentation.some((block) => block.type === 'blockquote'));
  assert.ok(quoteIndentation.some((block) => block.type === 'paragraph' && block.content.map((node) => node.text).join('') === '> literal text'));
  const codeBlocks = blocks.filter((block) => block.type === 'code');
  assert.deepEqual(codeBlocks.map((block) => block.type === 'code' ? [block.language, block.text] : []), [
    ['typescript', 'const answer = 42;'],
    ['bash', 'echo "literal ``` fence"'],
    ['python', 'print("tilde fence")'],
    ['c#', 'int answer = 42;'],
  ]);
  assert.ok(blocks.some((block) => block.type === 'hr'));

  const nested = parseMarkdown('- parent\n  - nested child');
  assert.equal(nested[0]?.type, 'list');
  assert.equal(nested[1]?.type, 'paragraph');
  assert.equal(nested[1]?.type === 'paragraph' ? nested[1].content[0]?.text : '', '- nested child');
});

test('empty Markdown yields no blocks and grapheme limits count visible characters', () => {
  assert.deepEqual(parseMarkdown('  \n  '), []);
  assert.equal(hasMarkdownContent('---'), false);
  assert.equal(hasMarkdownContent('**real announcement**'), true);
  assert.equal(countGraphemes('a👨‍👩‍👧‍👦b'), 3);
  assert.equal(countGraphemes('abcdefgh', 3), 4);
  assert.equal(countGraphemes('abc', 3), 3);
  assert.equal(MAX_ANNOUNCEMENT_BODY_CHARS, 9000);
  assert.equal(countGraphemes('👨‍👩‍👧‍👦'.repeat(9001)), 9001);
});

test('bold Markdown delimiters are removed and represented by explicit bold flags', () => {
  assert.deepEqual(parseInlineMarkdown('**double asterisk** and __double underscore__'), [
    { type: 'text', text: 'double asterisk and double underscore', formatting: MARKDOWN_FORMAT.bold },
  ]);
  assert.deepEqual(parseInlineMarkdown('***bold italic*** and ___bold italic underscore___'), [
    { type: 'text', text: 'bold italic', formatting: MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic },
    { type: 'text', text: ' and ', formatting: 0 },
    { type: 'text', text: 'bold italic underscore', formatting: MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic },
  ]);
});


test('a trailing Markdown backslash creates a hard line break without leaking the slash', () => {
  const input = 'First line' + '\\   ' + '\n' + 'Second line';
  const blocks = parseMarkdown(input);
  assert.equal(blocks[0]?.type, 'paragraph');
  if (blocks[0]?.type !== 'paragraph') return;
  assert.equal(blocks[0].content.map((node) => node.text).join(''), 'First line\nSecond line');
});
