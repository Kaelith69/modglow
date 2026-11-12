export const MAX_ANNOUNCEMENT_BODY_CHARS = 9000;

export const MARKDOWN_FORMAT = {
  bold: 1,
  italic: 2,
  strikethrough: 8,
  monospace: 64,
} as const;

export type MarkdownInline =
  | { type: 'text'; text: string; formatting: number }
  | { type: 'link'; text: string; url: string; formatting: number };

export type MarkdownBlock =
  | { type: 'paragraph'; content: MarkdownInline[] }
  | { type: 'heading'; level: 1 | 2 | 3 | 4 | 5 | 6; content: MarkdownInline[] }
  | { type: 'blockquote'; paragraphs: MarkdownInline[][] }
  | { type: 'list'; ordered: boolean; items: MarkdownInline[][] }
  | { type: 'code'; language?: string; text: string }
  | { type: 'hr' };

const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

export function countGraphemes(value: string): number {
  return Array.from(GRAPHEME_SEGMENTER.segment(value)).length;
}

function appendInline(
  nodes: MarkdownInline[],
  node: MarkdownInline,
): void {
  if (!node.text) return;
  const previous = nodes[nodes.length - 1];
  if (previous && previous.type === node.type && previous.formatting === node.formatting
    && (previous.type !== 'link' || (node.type === 'link' && previous.url === node.url))) {
    previous.text += node.text;
    return;
  }
  nodes.push(node);
}

function safeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === 'https:' || url.protocol === 'http:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

/** Parse the inline Markdown subset supported by Reddit rich text comments. */
export function parseInlineMarkdown(value: string): MarkdownInline[] {
  const nodes: MarkdownInline[] = [];
  const pattern = /\\([\\`*_{}\[\]()#+.!>~-])|!\[([^\]]*)\]\(([^\s)]+)\)|\[([^\]]+)\]\(([^\s)]+)\)|\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|`([^`]+)`|\*(.+?)\*|_(.+?)_/gu;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) {
      appendInline(nodes, { type: 'text', text: value.slice(cursor, index), formatting: 0 });
    }

    if (match[1] !== undefined) {
      appendInline(nodes, { type: 'text', text: match[1], formatting: 0 });
    } else if (match[2] !== undefined) {
      // Images intentionally degrade to their readable alt text. External images
      // are never fetched or embedded in a moderator comment.
      appendInline(nodes, { type: 'text', text: match[2], formatting: 0 });
    } else if (match[4] !== undefined) {
      const label = match[4];
      const url = match[5] ?? '';
      if (safeHttpUrl(url)) appendInline(nodes, { type: 'link', text: label, url, formatting: 0 });
      else appendInline(nodes, { type: 'text', text: label, formatting: 0 });
    } else if (match[6] !== undefined || match[7] !== undefined) {
      appendInline(nodes, { type: 'text', text: match[6] ?? match[7] ?? '', formatting: MARKDOWN_FORMAT.bold | MARKDOWN_FORMAT.italic });
    } else if (match[8] !== undefined || match[9] !== undefined) {
      appendInline(nodes, { type: 'text', text: match[8] ?? match[9] ?? '', formatting: MARKDOWN_FORMAT.bold });
    } else if (match[10] !== undefined) {
      appendInline(nodes, { type: 'text', text: match[10], formatting: MARKDOWN_FORMAT.strikethrough });
    } else if (match[11] !== undefined) {
      appendInline(nodes, { type: 'text', text: match[11], formatting: MARKDOWN_FORMAT.monospace });
    } else {
      appendInline(nodes, { type: 'text', text: match[12] ?? match[13] ?? '', formatting: MARKDOWN_FORMAT.italic });
    }

    cursor = index + match[0].length;
  }

  if (cursor < value.length) {
    appendInline(nodes, { type: 'text', text: value.slice(cursor), formatting: 0 });
  }

  return nodes;
}

function isHeading(line: string): RegExpMatchArray | null {
  return line.match(/^\s{0,3}(#{1,6})\s+(.+)$/u);
}

function isUnorderedItem(line: string): RegExpMatchArray | null {
  return line.match(/^\s*[-*+]\s+(.+)$/u);
}

function isOrderedItem(line: string): RegExpMatchArray | null {
  return line.match(/^\s*\d+[.)]\s+(.+)$/u);
}

function isHorizontalRule(line: string): boolean {
  return /^\s*(?:\*\s*){3,}$|^\s*(?:-\s*){3,}$|^\s*(?:_\s*){3,}$/u.test(line);
}

function isSpecialBlockStart(line: string): boolean {
  return Boolean(
    isHeading(line)
    || /^\s*>/u.test(line)
    || isUnorderedItem(line)
    || isOrderedItem(line)
    || isHorizontalRule(line)
    || /^\s*```/u.test(line),
  );
}

/**
 * Parse Markdown blocks without evaluating raw HTML or unsafe URL schemes.
 * Nested lists and tables are deliberately left as literal paragraph text.
 */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  const source = markdown.replace(/\r\n?/gu, '\n').trim();
  if (!source) return [];

  const lines = source.split('\n');
  const blocks: MarkdownBlock[] = [];
  let paragraphLines: string[] = [];
  let index = 0;

  const flushParagraph = (): void => {
    if (paragraphLines.length === 0) return;
    const text = paragraphLines.join(' ').trim();
    if (text) blocks.push({ type: 'paragraph', content: parseInlineMarkdown(text) });
    paragraphLines = [];
  };

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      flushParagraph();
      index += 1;
      continue;
    }

    const fence = line.match(/^\s*```([A-Za-z0-9_+-]{0,24})\s*$/u);
    if (fence) {
      flushParagraph();
      const codeLines: string[] = [];
      index += 1;
      while (index < lines.length && !/^\s*```\s*$/u.test(lines[index])) {
        codeLines.push(lines[index]);
        index += 1;
      }
      if (index < lines.length) index += 1;
      blocks.push({
        type: 'code',
        ...(fence[1] ? { language: fence[1] } : {}),
        text: codeLines.join('\n'),
      });
      continue;
    }

    const heading = isHeading(line);
    if (heading) {
      flushParagraph();
      blocks.push({
        type: 'heading',
        level: heading[1].length as 1 | 2 | 3 | 4 | 5 | 6,
        content: parseInlineMarkdown(heading[2]),
      });
      index += 1;
      continue;
    }

    if (/^\s*>/u.test(line)) {
      flushParagraph();
      const quoteLines: string[] = [];
      while (index < lines.length && /^\s*>/u.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^\s*>\s?/u, ''));
        index += 1;
      }
      const quoteParagraphs: MarkdownInline[][] = [];
      let quoteParagraph: string[] = [];
      const flushQuoteParagraph = (): void => {
        const quoteText = quoteParagraph.join(' ').trim();
        if (quoteText) quoteParagraphs.push(parseInlineMarkdown(quoteText));
        quoteParagraph = [];
      };
      for (const quoteLine of quoteLines) {
        if (quoteLine.trim()) quoteParagraph.push(quoteLine);
        else flushQuoteParagraph();
      }
      flushQuoteParagraph();
      if (quoteParagraphs.length) blocks.push({ type: 'blockquote', paragraphs: quoteParagraphs });
      continue;
    }

    const unordered = isUnorderedItem(line);
    const ordered = isOrderedItem(line);
    if (unordered || ordered) {
      flushParagraph();
      const isOrdered = Boolean(ordered);
      const items: MarkdownInline[][] = [];
      while (index < lines.length) {
        const item = isOrdered ? isOrderedItem(lines[index]) : isUnorderedItem(lines[index]);
        if (!item) break;
        items.push(parseInlineMarkdown(item[1]));
        index += 1;
      }
      blocks.push({ type: 'list', ordered: isOrdered, items });
      continue;
    }

    if (isHorizontalRule(line)) {
      flushParagraph();
      blocks.push({ type: 'hr' });
      index += 1;
      continue;
    }

    if (isSpecialBlockStart(line) && paragraphLines.length) flushParagraph();
    paragraphLines.push(line);
    index += 1;
  }

  flushParagraph();
  return blocks;
}
