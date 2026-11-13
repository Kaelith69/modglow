import { RichTextBuilder } from '@devvit/reddit';
import { countGraphemes, hasMarkdownBlocksContent, MAX_ANNOUNCEMENT_BODY_CHARS, parseMarkdown, type MarkdownBlock, type MarkdownInline } from './markdown.ts';

type FormatRange = [number, number, number];

type InlineContext = {
  text(options: { text: string; formatting?: FormatRange[] }): unknown;
  link(options: { text: string; url: string; formatting?: FormatRange[] }): unknown;
};

type HeadingInlineContext = {
  rawText(text: string): unknown;
  link(options: { text: string; url: string }): unknown;
};

function appendInline(context: InlineContext, nodes: MarkdownInline[]): void {
  for (const node of nodes) {
    const formatting = [[(node.formatting ?? 0) | 1, 0, node.text.length] as FormatRange];

    if (node.type === 'link') {
      context.link({
        text: node.text,
        url: node.url,
        formatting,
      });
    } else {
      context.text({
        text: node.text,
        formatting,
      });
    }
  }
}

function appendHeading(context: HeadingInlineContext, nodes: MarkdownInline[]): void {
  for (const node of nodes) {
    if (node.type === 'link') context.link({ text: node.text, url: node.url });
    else context.rawText(node.text);
  }
}

function appendBlock(builder: RichTextBuilder, block: MarkdownBlock): void {
  switch (block.type) {
    case 'paragraph':
      builder.paragraph((paragraph) => appendInline(paragraph, block.content));
      break;
    case 'heading':
      builder.heading({ level: block.level }, (heading) => appendHeading(heading, block.content));
      break;
    case 'blockquote':
      builder.blockQuote({}, (quote) => {
        for (const paragraphNodes of block.paragraphs) {
          quote.paragraph((paragraph) => appendInline(paragraph, paragraphNodes));
        }
      });
      break;
    case 'list':
      builder.list({ ordered: block.ordered }, (list) => {
        for (const itemNodes of block.items) {
          list.item((item) => {
            item.paragraph((paragraph) => appendInline(paragraph, itemNodes));
          });
        }
      });
      break;
    case 'code':
      builder.paragraph((paragraph) => {
        paragraph.text({
          text: block.text,
          formatting: [[65, 0, block.text.length]],
        });
      });
      break;
    case 'hr':
      builder.horizontalRule();
      break;
  }
}

/**
 * Creates the complete comment rich text with the SVG image as its first node.
 * The Markdown body is appended as native Reddit rich text, never baked into
 * the image, so Reddit handles its layout, links, and accessibility.
 */
export function buildAnnouncementRichText(mediaUrl: string, markdown: string, subredditName: string): RichTextBuilder {
  if (countGraphemes(markdown, MAX_ANNOUNCEMENT_BODY_CHARS) > MAX_ANNOUNCEMENT_BODY_CHARS) {
    throw new Error('The Markdown body exceeds the ' + MAX_ANNOUNCEMENT_BODY_CHARS + ' character limit.');
  }
  const blocks = parseMarkdown(markdown);
  if (!hasMarkdownBlocksContent(blocks)) throw new Error('Write some Markdown text before publishing.');


  const builder = new RichTextBuilder();
  builder.paragraph((paragraph) => {
    paragraph.image({
      mediaUrl,
    });
  });

  for (const block of blocks) appendBlock(builder, block);

  builder.paragraph((paragraph) => {
    const attribution = `${subredditName} Moderator announcement`;
    paragraph.text({
      text: attribution,
      formatting: [[32, 0, attribution.length]],
    });
  });
  return builder;
}
