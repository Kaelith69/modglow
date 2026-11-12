import { escapeXml } from './format.ts';

const WIDTH = 1536;
const BODY_X = 88;
const BODY_FONT = 64;
const LINE_HEIGHT = 78;
export const MAX_ANNOUNCEMENT_CHARS = 2600;
const MAX_LINES = 24;
const MIN_HEIGHT = 585;
const BOTTOM_PADDING = 28;
const BODY_WIDTH = 1360;

type InlineRun = {
  text: string;
  bold: boolean;
  italic: boolean;
  strike: boolean;
  code: boolean;
  accent: boolean;
};

type RenderedBody = {
  markup: string;
  lineCount: number;
  visibleCharacters: number;
};

type RunStyle = Omit<InlineRun, 'text'>;

const PLAIN_STYLE: RunStyle = {
  bold: false,
  italic: false,
  strike: false,
  code: false,
  accent: false,
};

function appendRun(runs: InlineRun[], text: string, style: RunStyle): void {
  if (!text) return;
  const previous = runs[runs.length - 1];
  const sameStyle = previous
    && previous.bold === style.bold
    && previous.italic === style.italic
    && previous.strike === style.strike
    && previous.code === style.code
    && previous.accent === style.accent;

  if (sameStyle) {
    previous.text += text;
  } else {
    runs.push({ text, ...style });
  }
}

/** Parse the inline Markdown styles ModGlow renders without interpreting HTML. */
function parseInlineRuns(value: string, baseStyle: RunStyle): InlineRun[] {
  if (baseStyle.code) return [{ text: value, ...baseStyle }];

  const runs: InlineRun[] = [];
  const pattern = /\\([\\`*_{}()#+.!>])|`([^`]+)`|~~(.+?)~~|\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) appendRun(runs, value.slice(cursor, index), baseStyle);

    if (match[1] !== undefined) {
      appendRun(runs, match[1], baseStyle);
    } else if (match[2] !== undefined) {
      appendRun(runs, match[2], { ...baseStyle, code: true, accent: true });
    } else if (match[3] !== undefined) {
      appendRun(runs, match[3], { ...baseStyle, strike: true });
    } else if (match[4] !== undefined || match[5] !== undefined) {
      appendRun(runs, match[4] ?? match[5] ?? '', { ...baseStyle, bold: true, italic: true });
    } else if (match[6] !== undefined || match[7] !== undefined) {
      appendRun(runs, match[6] ?? match[7] ?? '', { ...baseStyle, bold: true });
    } else {
      appendRun(runs, match[8] ?? match[9] ?? '', { ...baseStyle, italic: true });
    }

    cursor = index + match[0].length;
  }

  if (cursor < value.length) appendRun(runs, value.slice(cursor), baseStyle);
  return runs.length ? runs : [{ text: value, ...baseStyle }];
}

function glyphWidth(character: string, fontSize: number, style: RunStyle): number {
  if (/\p{Mark}/u.test(character)) return 0;

  let width: number;
  if (/\s/u.test(character)) width = fontSize * 0.28;
  else if (/[ilI.,'`!:;|]/u.test(character)) width = fontSize * 0.28;
  else if (/[MW@%#&]/u.test(character)) width = fontSize * 0.86;
  else if (/[A-Z]/u.test(character)) width = fontSize * 0.64;
  else if (/[0-9]/u.test(character)) width = fontSize * 0.56;
  else if (character.codePointAt(0)! > 0xffff) width = fontSize;
  else if (character.codePointAt(0)! > 0x024f) width = fontSize * 0.76;
  else width = fontSize * 0.52;

  return width * (style.bold ? 1.045 : 1);
}

function wrapInlineRuns(runs: InlineRun[], maxWidth: number, fontSize: number): InlineRun[][] {
  const lines: InlineRun[][] = [[]];
  let lineWidth = 0;

  const append = (text: string, style: RunStyle): void => {
    appendRun(lines[lines.length - 1], text, style);
  };

  const nextLine = (): void => {
    if (lines[lines.length - 1].length > 0) {
      lines.push([]);
      lineWidth = 0;
    }
  };

  for (const run of runs) {
    const style: RunStyle = {
      bold: run.bold,
      italic: run.italic,
      strike: run.strike,
      code: run.code,
      accent: run.accent,
    };
    const tokens = run.text.match(/\s+|[^\s]+/gu) ?? [];

    for (const token of tokens) {
      if (/^\s+$/u.test(token)) {
        const width = [...token].reduce((sum, character) => sum + glyphWidth(character, fontSize, style), 0);
        if (lineWidth > 0 && lineWidth + width > maxWidth) {
          nextLine();
        } else if (lineWidth > 0) {
          append(token, style);
          lineWidth += width;
        }
        continue;
      }

      const tokenWidth = [...token].reduce((sum, character) => sum + glyphWidth(character, fontSize, style), 0);
      if (lineWidth > 0 && lineWidth + tokenWidth > maxWidth) nextLine();

      if (tokenWidth <= maxWidth) {
        append(token, style);
        lineWidth += tokenWidth;
        continue;
      }

      for (const character of token) {
        const width = glyphWidth(character, fontSize, style);
        if (lineWidth > 0 && lineWidth + width > maxWidth) nextLine();
        append(character, style);
        lineWidth += width;
      }
    }
  }

  return lines.filter((line, index) => line.length > 0 || index === 0);
}

function normalizeInlineMarkdown(line: string): string {
  return line
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\(https?:\/\/[^)]+\)/g, '$1')
    .replace(/<https?:\/\/([^>]+)>/g, 'https://$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/[ \t]+$/g, '');
}

function renderBody(markdown: string, accentColor: string): RenderedBody {
  const source = markdown
    .replace(/\r\n?/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
  const renderedLines: string[] = [];
  let inCodeBlock = false;
  let visibleCharacters = 0;

  for (const originalLine of source.split('\n')) {
    if (/^\s*```/.test(originalLine)) {
      inCodeBlock = !inCodeBlock;
      continue;
    }

    let line = originalLine;
    let baseStyle = PLAIN_STYLE;
    let prefix = '';

    if (!inCodeBlock) {
      const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+)$/);
      const quote = line.match(/^\s{0,3}>\s?(.*)$/);
      const unordered = line.match(/^\s*[-*+]\s+(.+)$/);
      const ordered = line.match(/^\s*(\d+[.)])\s+(.+)$/);

      if (heading) {
        line = heading[2];
        baseStyle = { ...PLAIN_STYLE, bold: true, accent: true };
      } else if (quote) {
        line = quote[1];
        prefix = '› ';
        baseStyle = { ...PLAIN_STYLE, italic: true };
      } else if (unordered) {
        line = unordered[1];
        prefix = '• ';
        baseStyle = { ...PLAIN_STYLE };
      } else if (ordered) {
        line = ordered[2];
        prefix = ordered[1] + ' ';
        baseStyle = { ...PLAIN_STYLE };
      }

      line = normalizeInlineMarkdown(line);
    } else {
      baseStyle = { ...PLAIN_STYLE, code: true, accent: true };
    }

    if (!line.trim() && !prefix) {
      if (renderedLines.length > 0) {
        renderedLines.push('<tspan x="' + BODY_X + '" dy="' + LINE_HEIGHT + '"> </tspan>');
      }
      continue;
    }

    const runs = parseInlineRuns(line, baseStyle);
    if (prefix) {
      runs.unshift({
        text: prefix,
        bold: true,
        italic: false,
        strike: false,
        code: false,
        accent: true,
      });
    }

    const wrapped = wrapInlineRuns(runs, BODY_WIDTH, BODY_FONT);
    for (const wrappedLine of wrapped) {
      const content = wrappedLine.map((run) => {
        const weight = run.bold ? '700' : '400';
        const style = run.italic ? 'italic' : 'normal';
        const family = 'IBM Plex Sans';
        const fill = run.accent ? accentColor : '#F2F0E8';
        const decoration = run.strike ? ' text-decoration="line-through"' : '';
        return '<tspan font-family="' + family + '" font-weight="' + weight + '" font-style="' + style + '" fill="' + fill + '"' + decoration + '>' + escapeXml(run.text) + '</tspan>';
      }).join('');

      renderedLines.push('<tspan x="' + BODY_X + '" dy="' + (renderedLines.length === 0 ? 0 : LINE_HEIGHT) + '">' + content + '</tspan>');
      visibleCharacters += wrappedLine.reduce((sum, run) => sum + [...run.text].filter((character) => !/\s/u.test(character)).length, 0);
    }
  }

  return {
    markup: renderedLines.join(''),
    lineCount: renderedLines.length,
    visibleCharacters,
  };
}


export const ANNOUNCEMENT_FLAIRS = ['IMPORTANT', 'NOTICE', 'REMINDER', 'ANNOUNCEMENT'] as const;
export type AnnouncementFlair = typeof ANNOUNCEMENT_FLAIRS[number];


type FlairTheme = {
  accent: string;
  accentText: string;
};

const FLAIR_THEMES: Record<AnnouncementFlair, FlairTheme> = {
  IMPORTANT: { accent: '#FF4055', accentText: '#FF9AA6' },
  NOTICE: { accent: '#32B8FF', accentText: '#9CDEFF' },
  REMINDER: { accent: '#FF9900', accentText: '#FFC266' },
  ANNOUNCEMENT: { accent: '#FFE34F', accentText: '#FFF0A0' },
};

function flairIcon(flair: AnnouncementFlair, color: string): string {
  const icons: Record<AnnouncementFlair, string> = {
    IMPORTANT: '<path d="M153 143 V181 M153 196 V198" stroke="' + color + '" stroke-width="12" stroke-linecap="round"/>',
    NOTICE: '<circle cx="153" cy="174" r="39" fill="none" stroke="' + color + '" stroke-width="10"/><path d="M153 168 V196 M153 148 V150" stroke="' + color + '" stroke-width="10" stroke-linecap="round"/>',
    REMINDER: '<rect x="116" y="143" width="74" height="68" rx="10" fill="none" stroke="' + color + '" stroke-width="10"/><path d="M135 133 V151 M171 133 V151 M116 164 H190" stroke="' + color + '" stroke-width="10" stroke-linecap="round"/>',
    ANNOUNCEMENT: '<path d="M116 165 L185 143 V203 L116 181 Z" fill="none" stroke="' + color + '" stroke-width="10" stroke-linejoin="round"/><path d="M132 185 L143 211 H162 L151 190 M197 158 L211 150 M198 187 L212 194" fill="none" stroke="' + color + '" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return '<g>' + icons[flair] + '</g>';
}

function flairHeader(flair: AnnouncementFlair, accent: string): string {
  const title = flair;
  const titleSize = flair === 'ANNOUNCEMENT' ? 76 : 88;
  return [
    '<text x="104" y="67" font-family="IBM Plex Sans" font-size="34" font-weight="700" letter-spacing="7" fill="#F2F0E8">MODGLOW</text>',
    '<path d="M32 90 V59 H90 M352 59 H1504 V' + (CURRENT_FRAME_BOTTOM) + ' H32 Z" fill="none" stroke="' + accent + '" stroke-width="12" stroke-linecap="square" stroke-linejoin="miter"/>',
    '<path d="M72 98 H1464 V' + (CURRENT_INNER_BOTTOM) + ' H72 M72 98 V252 M72 98 H878 L806 252 H72" fill="none" stroke="' + accent + '" stroke-width="8" stroke-linejoin="miter"/>',
    flairIcon(flair, accent),
    '<text x="263" y="207" font-family="IBM Plex Sans" font-size="' + titleSize + '" font-weight="700" letter-spacing="2" fill="#F2F0E8">' + title + '</text>',
  ].join('');
}

export function buildAnnouncementSvg(markdown: string, flair: AnnouncementFlair = 'ANNOUNCEMENT'): string {
  if (typeof markdown !== 'string' || markdown.length > MAX_ANNOUNCEMENT_CHARS) {
    throw new Error('The announcement exceeds the ' + MAX_ANNOUNCEMENT_CHARS + ' character limit.');
  }
  if (!ANNOUNCEMENT_FLAIRS.includes(flair)) {
    throw new Error('Choose one of the four supported announcement flairs.');
  }

  const theme = FLAIR_THEMES[flair];
  const rendered = renderBody(markdown, theme.accentText);
  if (rendered.visibleCharacters === 0) {
    throw new Error('The announcement has no renderable text.');
  }
  if (rendered.lineCount > MAX_LINES) {
    throw new Error('The announcement needs more than ' + MAX_LINES + ' rendered lines. Shorten it to keep the image readable.');
  }

  const bodyStartY = 340;
  const bodyEndY = bodyStartY + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT + BODY_FONT;
  const height = Math.max(MIN_HEIGHT, bodyEndY + BOTTOM_PADDING + 75);
  const frameBottom = height - 75;
  const innerBottom = height - 85;
  const CURRENT_FRAME_BOTTOM = frameBottom;
  const CURRENT_INNER_BOTTOM = innerBottom;

  const header = flairHeader(flair, theme.accent);
  const svgHeader = header
    .replaceAll(String.raw`(CURRENT_FRAME_BOTTOM)`, String(frameBottom))
    .replaceAll(String.raw`(CURRENT_INNER_BOTTOM)`, String(innerBottom));

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>ModGlow ' + flair.toLowerCase() + '</title>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="#000000"/>',
    svgHeader,
    '<text x="' + BODY_X + '" y="' + bodyStartY + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#F2F0E8">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}
