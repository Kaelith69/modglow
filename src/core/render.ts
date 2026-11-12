import { escapeXml, relativeTime, wrapTextByWidth } from './format.ts';

export type CommentCardInput = {
  subredditName: string;
  body: string;
  createdAt: Date;
  edited: boolean;
};

const WIDTH = 1536;
const BODY_X = 76;
const BODY_FONT = 64;
const LINE_HEIGHT = 82;
const MAX_BODY_CHARS = 2600;
const MAX_LINES = 24;
const MIN_HEIGHT = 438;
const BOTTOM_PADDING = 112;
const BODY_WIDTH = 1384;

type InlineRun = { text: string; bold: boolean; italic: boolean };

function separator(x: number, y: number): string {
  return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#A99B62"/>';
}

function moderatorBadge(x: number): string {
  return [
    '<rect x="' + x + '" y="84" width="194" height="68" rx="34" fill="#29230D" stroke="#A88C2C" stroke-width="1.5"/>',
    '<path d="M' + (x + 25) + ' 103 L' + (x + 43) + ' 97 L' + (x + 61) + ' 103 V123 Q' + (x + 43) + ' 140 ' + (x + 43) + ' 140 Q' + (x + 25) + ' 132 ' + (x + 25) + ' 123 Z" fill="#FFE45C"/>',
    '<path d="M' + (x + 32) + ' 106 L' + (x + 43) + ' 102 L' + (x + 54) + ' 106 V122 Q' + (x + 43) + ' 132 ' + (x + 43) + ' 132 Q' + (x + 32) + ' 126 ' + (x + 32) + ' 122 Z" fill="none" stroke="#8B741E" stroke-width="2"/>',
    '<text x="' + (x + 78) + '" y="132" font-family="IBM Plex Sans" font-size="43" font-weight="600" fill="#FFE45C">Mod</text>',
  ].join('');
}

function appLogo(): string {
  return [
    '<circle cx="132" cy="124" r="61" fill="#080808" stroke="#65551D" stroke-width="3"/>',
    '<g transform="translate(76 68) scale(.109375)">',
    '<path d="M512 92 L858 292 L858 692 L512 892 L166 692 L166 292 Z" fill="#FFE45C"/>',
    '<path d="M512 172 L788 332 L788 652 L512 812 L236 652 L236 332 Z" fill="#080808"/>',
    '<path d="M512 254 L716 372 L716 612 L512 730 L308 612 L308 372 Z" fill="none" stroke="#FFF4B0" stroke-width="26"/>',
    '<path d="M512 338 L642 413 L642 571 L512 646 L382 571 L382 413 Z" fill="#FFE45C"/>',
    '<path d="M512 390 L597 439 L597 545 L512 594 L427 545 L427 439 Z" fill="#17140A"/>',
    '<path d="M458 496 Q512 430 566 496" fill="none" stroke="#FFF4B0" stroke-width="22" stroke-linecap="round"/>',
    '<circle cx="512" cy="524" r="18" fill="#FFE45C"/>',
    '</g>',
  ].join('');
}

function pinIcon(x: number, y: number): string {
  return [
    '<path d="M' + (x + 23) + ' ' + (y + 4) + ' C' + (x + 31) + ' ' + (y - 4) + ' ' + (x + 45) + ' ' + (y - 4) + ' ' + (x + 51) + ' ' + (y + 4) + ' L' + (x + 54) + ' ' + (y + 8) + ' L' + (x + 46) + ' ' + (y + 17) + ' L' + (x + 51) + ' ' + (y + 31) + ' L' + (x + 43) + ' ' + (y + 39) + ' L' + (x + 29) + ' ' + (y + 25) + ' L' + (x + 16) + ' ' + (y + 39) + ' L' + (x + 9) + ' ' + (y + 32) + ' L' + (x + 22) + ' ' + (y + 19) + ' L' + (x + 17) + ' ' + (y + 12) + ' Z" fill="#FFE45C"/>',
    '<path d="M' + (x + 28) + ' ' + (y + 27) + ' L' + (x + 3) + ' ' + (y + 52) + '" stroke="#FFE45C" stroke-width="5" stroke-linecap="round"/>',
  ].join('');
}

function prepareMarkdown(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/<https?:\/\/([^>]+)>/g, 'https://$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+[.)]\s+/gm, '• ')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\\([\\`*_{}()#+.!>])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function parseInlineRuns(value: string): InlineRun[] {
  const runs: InlineRun[] = [];
  const pattern = /\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  let cursor = 0;
  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) runs.push({ text: value.slice(cursor, index), bold: false, italic: false });
    const triple = match[1] ?? match[2];
    const bold = match[3] ?? match[4];
    const italic = match[5] ?? match[6];
    runs.push({
      text: triple ?? bold ?? italic ?? '',
      bold: Boolean(triple || bold),
      italic: Boolean(triple || italic),
    });
    cursor = index + match[0].length;
  }
  if (cursor < value.length) runs.push({ text: value.slice(cursor), bold: false, italic: false });
  return runs.length ? runs : [{ text: value, bold: false, italic: false }];
}

function plainText(value: string): string {
  return value.replace(/\*{1,3}|_{1,3}/g, '');
}

function glyphWidth(character: string, fontSize: number): number {
  if (/\s/.test(character)) return fontSize * 0.28;
  if (/[ilI.,'`!:;|]/.test(character)) return fontSize * 0.28;
  if (/[MW@%#&]/.test(character)) return fontSize * 0.86;
  if (/[A-Z]/.test(character)) return fontSize * 0.64;
  if (/[0-9]/.test(character)) return fontSize * 0.56;
  if (character.codePointAt(0)! > 0xffff) return fontSize;
  return fontSize * 0.52;
}

function wrapInlineRuns(runs: InlineRun[], maxWidth: number, fontSize: number): InlineRun[][] {
  const lines: InlineRun[][] = [[]];
  let lineWidth = 0;

  const append = (text: string, style: Omit<InlineRun, 'text'>): void => {
    if (!text) return;
    const line = lines[lines.length - 1];
    const previous = line[line.length - 1];
    if (previous && previous.bold === style.bold && previous.italic === style.italic) {
      previous.text += text;
    } else {
      line.push({ text, ...style });
    }
  };

  const nextLine = (): void => {
    if (lines[lines.length - 1].length > 0) {
      lines.push([]);
      lineWidth = 0;
    }
  };

  for (const run of runs) {
    const tokens = run.text.match(/\s+|[^\s]+/gu) ?? [];
    for (const token of tokens) {
      const style = { bold: run.bold, italic: run.italic };
      if (/^\s+$/u.test(token)) {
        const width = [...token].reduce((sum, character) => sum + glyphWidth(character, fontSize), 0);
        if (lineWidth > 0 && lineWidth + width > maxWidth) {
          nextLine();
        } else if (lineWidth > 0) {
          append(token, style);
          lineWidth += width;
        }
        continue;
      }

      const tokenWidth = [...token].reduce((sum, character) => sum + glyphWidth(character, fontSize), 0);
      if (lineWidth > 0 && lineWidth + tokenWidth > maxWidth) nextLine();

      if (tokenWidth <= maxWidth) {
        append(token, style);
        lineWidth += tokenWidth;
        continue;
      }

      for (const character of token) {
        const width = glyphWidth(character, fontSize);
        if (lineWidth > 0 && lineWidth + width > maxWidth) nextLine();
        append(character, style);
        lineWidth += width;
      }
    }
  }

  return lines.filter((line, index) => line.length > 0 || index === 0);
}

function renderBody(markdown: string): { markup: string; lineCount: number } {
  const prepared = prepareMarkdown(markdown);
  const renderedLines: string[] = [];

  for (const paragraph of prepared.split('\n')) {
    if (!paragraph) {
      renderedLines.push('<tspan x="' + BODY_X + '" dy="' + LINE_HEIGHT + '"> </tspan>');
      continue;
    }

    const wrapped = wrapInlineRuns(parseInlineRuns(paragraph), BODY_WIDTH, BODY_FONT);
    for (const line of wrapped) {
      const content = line.map((run) => {
        const weight = run.bold ? '700' : '400';
        const style = run.italic ? 'italic' : 'normal';
        return '<tspan font-weight="' + weight + '" font-style="' + style + '">' + escapeXml(run.text) + '</tspan>';
      }).join('');
      renderedLines.push('<tspan x="' + BODY_X + '" dy="' + (renderedLines.length === 0 ? 0 : LINE_HEIGHT) + '">' + content + '</tspan>');
    }
  }

  return { markup: renderedLines.join(''), lineCount: renderedLines.length };
}

export function buildCommentSvg(input: CommentCardInput): string {
  if (input.body.length > MAX_BODY_CHARS) {
    throw new Error('This comment is too long to feature safely (' + MAX_BODY_CHARS + ' character limit).');
  }

  const prepared = prepareMarkdown(input.body);
  if (!prepared) throw new Error('The comment has no renderable text.');
  const rendered = renderBody(input.body);
  if (rendered.lineCount > MAX_LINES) {
    throw new Error('This comment needs more than ' + MAX_LINES + ' lines. Shorter comments are required for a readable image.');
  }

  const bodyStartY = 252;
  const bodyEndY = bodyStartY + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT + BODY_FONT;
  const height = Math.max(MIN_HEIGHT, bodyEndY + BOTTOM_PADDING);
  const timeValue = relativeTime(input.createdAt);
  const timeLabel = timeValue === 'just now'
    ? 'Now'
    : (timeValue.match(/^([A-Za-z]{3} \d{1,2}),/)?.[1] ?? (timeValue.length > 8 ? 'Earlier' : timeValue));
  const time = escapeXml(timeLabel);
  const timeWidth = Math.max(95, [...timeLabel].length * 24);
  const editedWidth = input.edited ? 94 : 0;
  const dotThreeX = 850 + timeWidth + editedWidth - 95;
  const pinX = dotThreeX + 20;
  const pinTextX = pinX + 72;

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>ModGlow moderator authored image comment</title>',
    '<defs>',
    '<linearGradient id="smokedSurface" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#101010" stop-opacity=".98"/><stop offset=".5" stop-color="#080808" stop-opacity=".99"/><stop offset="1" stop-color="#050505"/></linearGradient>',
    '<radialGradient id="yellowSmoke"><stop offset="0" stop-color="#FFE45C" stop-opacity=".105"/><stop offset=".48" stop-color="#FFE45C" stop-opacity=".035"/><stop offset="1" stop-color="#FFE45C" stop-opacity="0"/></radialGradient>',
    '<linearGradient id="neonEdge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFE45C" stop-opacity=".62"/><stop offset=".5" stop-color="#A58A2C" stop-opacity=".22"/><stop offset="1" stop-color="#FFE45C" stop-opacity=".48"/></linearGradient>',
    '<filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="12" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    '<filter id="textShadow" x="-20%" y="-30%" width="140%" height="160%"><feGaussianBlur in="SourceAlpha" stdDeviation="2.2" result="blur"/><feOffset dy="2" result="offset"/><feComponentTransfer><feFuncA type="linear" slope=".42"/></feComponentTransfer><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter>',
    '</defs>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="#000000"/>',
    '<rect x="10" y="10" width="1516" height="' + (height - 20) + '" rx="25" fill="url(#smokedSurface)" stroke="url(#neonEdge)" stroke-width="2"/>',
    '<ellipse cx="1110" cy="125" rx="640" ry="270" fill="url(#yellowSmoke)"/>',
    '<rect x="10" y="10" width="4" height="' + (height - 20) + '" rx="2" fill="#FFE45C" opacity=".78" filter="url(#softGlow)"/>',
    appLogo(),
    '<text x="240" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="700" fill="#FFE45C" filter="url(#textShadow)">ModGlow</text>',
    separator(456, 111),
    moderatorBadge(478),
    separator(696, 111),
    '<text x="722" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="400" fill="#C9C5B5">' + time + '</text>',
    input.edited ? '<text x="' + (722 + timeWidth + 8) + '" y="121" font-family="IBM Plex Sans" font-size="27" font-weight="400" fill="#A99B62">edited</text>' : '',
    separator(dotThreeX, 111),
    pinIcon(pinX, 78),
    '<text x="' + pinTextX + '" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="500" fill="#FFEFA3">Pinned</text>',
    '<text x="' + BODY_X + '" y="' + bodyStartY + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#F2F0E8" filter="url(#textShadow)">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}

/**
 * Render moderator-authored Markdown as the visual payload of a top-level
 * ModGlow image comment. The underlying renderer supplies the smoked AMOLED
 * surface, yellow neon edge, readable type scale, shadows, and Markdown
 * emphasis. The neutral INFO label replaces the source-comment timestamp.
 */
export function buildAnnouncementSvg(markdown: string): string {
  const svg = buildCommentSvg({
    subredditName: '',
    body: markdown,
    createdAt: new Date(),
    edited: false,
  });
  return svg
    .replace('ModGlow moderator authored image comment', 'ModGlow moderator announcement')
    .replace('>Now</text>', '>INFO</text>');
