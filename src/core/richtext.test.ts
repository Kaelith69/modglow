import test from 'node:test';
import assert from 'node:assert/strict';
import { buildAnnouncementRichText } from './richtext.ts';

test('the SVG image is the first comment node and Markdown follows it', () => {
  const builder = buildAnnouncementRichText(
    'https://reddit.test/media/header.png',
    '# Release update\n\n**Bold notice** with [the rules](https://example.com/rules).\n\n- First item\n- Second item',
  );
  const serialized = builder.build();
  const document = JSON.parse(serialized) as {
    document?: Array<{
      e?: string;
      c?: Array<{ e?: string; mediaUrl?: string }>;
    }>;
  };

  assert.ok(Array.isArray(document.document));
  assert.equal(document.document[0]?.e, 'par');
  assert.equal(document.document[0]?.c?.[0]?.e, 'img');
  assert.equal(document.document[0]?.c?.[0]?.mediaUrl, 'https://reddit.test/media/header.png');
  assert.ok(document.document.length > 1);
  assert.ok(serialized.includes('Bold notice'));
  assert.ok(serialized.includes('https://example.com/rules'));
  assert.ok(serialized.includes('First item'));
});

test('separator only Markdown cannot create an empty body comment', () => {
  assert.throws(
    () => buildAnnouncementRichText('https://reddit.test/media/header.png', '---'),
    /Write some Markdown text/,
  );
});
