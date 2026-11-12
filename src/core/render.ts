import { escapeXml } from './format.ts';

const WIDTH = 1536;
const BODY_X = 145;
const BODY_FONT = 64;
const LINE_HEIGHT = 78;
export const MAX_ANNOUNCEMENT_CHARS = 2600;
const MAX_LINES = 24;
const MIN_HEIGHT = 584;
const BOTTOM_PADDING = 100;
const BODY_WIDTH = 1300;

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
  if (/\p{Mark}/u.test(character) || character === '\u200d') return 0;

  let width: number;
  if (/\s/u.test(character)) width = fontSize * 0.32;
  else if (/[ilI.,'`!:;|]/u.test(character)) width = fontSize * 0.34;
  else if (/[mw@%&#]/u.test(character)) width = fontSize * 0.86;
  else if (/[MW]/u.test(character)) width = fontSize * 0.94;
  else if (/[A-Z]/u.test(character)) width = fontSize * 0.70;
  else if (/[0-9]/u.test(character)) width = fontSize * 0.62;
  else if (character.codePointAt(0)! > 0xffff) width = fontSize;
  else if (character.codePointAt(0)! > 0x024f) width = fontSize * 0.90;
  else if (/[frt]/u.test(character)) width = fontSize * 0.43;
  else width = fontSize * 0.62;

  return width * (style.bold ? 1.10 : 1.08);
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
  background: string;
  iconColor: string;
  titlePanel: string;
  titleColor: string;
};

const FLAIR_THEMES: Record<AnnouncementFlair, FlairTheme> = {
  IMPORTANT: { accent: '#F20D24', background: '#050000', iconColor: '#F5F0E6', titlePanel: '#F5F0E6', titleColor: '#050505' },
  NOTICE: { accent: '#087CFF', background: '#02091B', iconColor: '#F5F0E6', titlePanel: '#F5F0E6', titleColor: '#050505' },
  REMINDER: { accent: '#FF7900', background: '#070300', iconColor: '#080808', titlePanel: '#FF7900', titleColor: '#050505' },
  ANNOUNCEMENT: { accent: '#7CFF00', background: '#010703', iconColor: '#174B0A', titlePanel: '#7CFF00', titleColor: '#050505' },
};

const BODY_START_Y = 350;
const FRAME_BOTTOM_INSET = 60;

function flairIcon(flair: AnnouncementFlair, color: string): string {
  const icons: Record<AnnouncementFlair, string> = {
    IMPORTANT: '<path d="M170 126 L235 238 H105 Z" fill="none" stroke="' + color + '" stroke-width="13" stroke-linejoin="round"/><path d="M170 158 V196 M170 216 V218" fill="none" stroke="' + color + '" stroke-width="13" stroke-linecap="round"/>',
    NOTICE: '<circle cx="170" cy="182" r="57" fill="none" stroke="' + color + '" stroke-width="13"/><path d="M170 174 V215 M170 146 V149" fill="none" stroke="' + color + '" stroke-width="14" stroke-linecap="round"/>',
    REMINDER: '<rect x="111" y="132" width="118" height="112" rx="15" fill="none" stroke="' + color + '" stroke-width="13"/><path d="M137 119 V151 M203 119 V151 M111 166 H229 M145 188 H160 M183 188 H198 M145 216 H160 M183 216 H198" fill="none" stroke="' + color + '" stroke-width="13" stroke-linecap="round"/>',
    ANNOUNCEMENT: '<path d="M108 160 H155 L218 132 V220 L155 192 H108 Z" fill="none" stroke="' + color + '" stroke-width="13" stroke-linejoin="round"/><path d="M128 195 L145 239 H177 L162 196 M236 151 L255 138 M239 178 H263 M236 205 L255 218" fill="none" stroke="' + color + '" stroke-width="13" stroke-linecap="round" stroke-linejoin="round"/>',
  };
  return '<g>' + icons[flair] + '</g>';
}

function flairHeader(flair: AnnouncementFlair, theme: FlairTheme): string {
  const iconTile = '<path d="M56 98 H348 L264 270 H56 Z" fill="' + (flair === 'IMPORTANT' || flair === 'NOTICE' ? theme.accent : '#F5F0E6') + '"/>';
  const titlePanel = '<path d="M362 98 H1318 L1234 270 H278 Z" fill="' + theme.titlePanel + '"/>';
  const titleSize = flair === 'ANNOUNCEMENT' ? 76 : 88;
  const title = '<text x="366" y="229" font-family="IBM Plex Sans" font-size="' + titleSize + '" font-weight="700" font-style="italic" letter-spacing="1" fill="' + theme.titleColor + '">' + flair + '</text>';
  const slashes = [
    '<path d="M1290 128 H1350 L1285 260 H1225 Z" fill="' + theme.accent + '"/>',
    '<path d="M1365 128 H1425 L1360 260 H1300 Z" fill="' + theme.accent + '"/>',
    '<path d="M1440 128 H1500 L1435 260 H1375 Z" fill="' + theme.accent + '"/>',
  ].join('');
  return [
    '<text x="112" y="62" font-family="IBM Plex Sans" font-size="34" font-weight="700" letter-spacing="7" fill="#F5F0E6">MODGLOW</text>',
    iconTile,
    titlePanel,
    flairIcon(flair, theme.iconColor),
    title,
    slashes,
  ].join('');
}

function frameSvg(accent: string, height: number): string {
  const bottom = height - FRAME_BOTTOM_INSET;
  const rightChamfer = 62;
  return '<path d="M350 57 H1512 V' + (bottom - rightChamfer) + ' L' + (1512 - rightChamfer) + ' ' + bottom + ' H22 V112 L82 50" fill="none" stroke="' + accent + '" stroke-width="14" stroke-linecap="butt" stroke-linejoin="miter"/>';
}

export function buildAnnouncementSvg(markdown: string, flair: AnnouncementFlair = 'ANNOUNCEMENT'): string {
  if (typeof markdown !== 'string' || markdown.length > MAX_ANNOUNCEMENT_CHARS) {
    throw new Error('The announcement exceeds the ' + MAX_ANNOUNCEMENT_CHARS + ' character limit.');
  }
  if (!ANNOUNCEMENT_FLAIRS.includes(flair)) {
    throw new Error('Choose one of the four supported announcement flairs.');
  }

  const theme = FLAIR_THEMES[flair];
  const rendered = renderBody(markdown, theme.accent);
  if (rendered.visibleCharacters === 0) {
    throw new Error('The announcement has no renderable text.');
  }
  if (rendered.lineCount > MAX_LINES) {
    throw new Error('The announcement needs more than ' + MAX_LINES + ' rendered lines. Shorten it to keep the image readable.');
  }

  const bodyEndY = BODY_START_Y + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT + BODY_FONT;
  const height = Math.max(MIN_HEIGHT, bodyEndY + BOTTOM_PADDING);
  const bodyMarkerBottom = BODY_START_Y + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT + 28;
  const bodyMarker = '<path d="M96 306 V' + bodyMarkerBottom + '" stroke="' + theme.accent + '" stroke-width="14" stroke-linecap="square"/>';
  const header = flairHeader(flair, theme);
  const frame = frameSvg(theme.accent, height);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>ModGlow ' + flair.toLowerCase() + '</title>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="' + theme.background + '"/>',
    frame,
    header,
    bodyMarker,
    '<text x="' + BODY_X + '" y="' + BODY_START_Y + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#F5F0E6">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}
