import { RichTextBuilder } from '@devvit/reddit';
import { hasMarkdownContent, parseMarkdown, type MarkdownBlock, type MarkdownInline } from './markdown.ts';

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
    const formatting = node.formatting
      ? [[node.formatting, 0, node.text.length] as FormatRange]
      : undefined;

    if (node.type === 'link') {
      context.link({
        text: node.text,
        url: node.url,
        ...(formatting ? { formatting } : {}),
      });
    } else {
      context.text({
        text: node.text,
        ...(formatting ? { formatting } : {}),
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
      builder.codeBlock(block.language ? { language: block.language } : {}, (code) => {
        code.rawText(block.text);
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
export function buildAnnouncementRichText(mediaUrl: string, markdown: string): RichTextBuilder {
  const blocks = parseMarkdown(markdown);
  if (!hasMarkdownContent(markdown)) throw new Error('Write some Markdown text before publishing.');


  const builder = new RichTextBuilder();
  builder.paragraph((paragraph) => {
    paragraph.image({
      mediaUrl,
      caption: 'ModGlow moderator announcement',
    });
  });

  for (const block of blocks) appendBlock(builder, block);
  return builder;
}
