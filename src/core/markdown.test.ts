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

test('inline Markdown maps bold, italic, combined, strike and code to Reddit flags', () => {
  const nodes = parseInlineMarkdown('**bold** *italic* ***both*** ~~removed~~ `code`');
  assert.deepEqual(
    nodes.map((node) => [node.text, node.formatting]),
    [
      ['bold', MARKDOWN_FORMAT.bold],
      [' ', 0],
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
  assert.ok(blocks.some((block) => block.type === 'code' && block.language === 'typescript' && block.text === 'const answer = 42;'));
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
  assert.equal(MAX_ANNOUNCEMENT_BODY_CHARS, 9000);
  assert.equal(countGraphemes('👨‍👩‍👧‍👦'.repeat(9001)), 9001);
});
