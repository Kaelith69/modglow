import { escapeXml } from './format.ts';

const WIDTH = 2000;
const BODY_X = 195;
const BODY_START_Y = 475;
const BODY_FONT = 76;
const LINE_HEIGHT = 100;
const BODY_WIDTH = 1660;
const MAX_LINES = 24;
const FRAME_BOTTOM_GAP = 115;
const CANVAS_BOTTOM_GAP = 70;
export const MAX_ANNOUNCEMENT_CHARS = 2600;

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
  bold: true,
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

  if (sameStyle) previous.text += text;
  else runs.push({ text, ...style });
}

function parseInlineRuns(value: string, baseStyle: RunStyle): InlineRun[] {
  if (baseStyle.code) return [{ text: value, ...baseStyle }];

  const runs: InlineRun[] = [];
  const pattern = /\\([\\`*_{}()#+.!>])|`([^`]+)`|~~(.+?)~~|\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|__(.+?)__|\*(.+?)\*|_(.+?)_/g;
  let cursor = 0;

  for (const match of value.matchAll(pattern)) {
    const index = match.index ?? 0;
    if (index > cursor) appendRun(runs, value.slice(cursor, index), baseStyle);

    if (match[1] !== undefined) appendRun(runs, match[1], baseStyle);
    else if (match[2] !== undefined) appendRun(runs, match[2], { ...baseStyle, code: true, accent: true });
    else if (match[3] !== undefined) appendRun(runs, match[3], { ...baseStyle, strike: true });
    else if (match[4] !== undefined || match[5] !== undefined) appendRun(runs, match[4] ?? match[5] ?? '', { ...baseStyle, bold: true, italic: true });
    else if (match[6] !== undefined || match[7] !== undefined) appendRun(runs, match[6] ?? match[7] ?? '', { ...baseStyle, bold: true });
    else appendRun(runs, match[8] ?? match[9] ?? '', { ...baseStyle, italic: true });

    cursor = index + match[0].length;
  }

  if (cursor < value.length) appendRun(runs, value.slice(cursor), baseStyle);
  return runs.length ? runs : [{ text: value, ...baseStyle }];
}

/** Conservative width estimates deliberately leave unused space at the right edge. */
function glyphWidth(character: string, fontSize: number, style: RunStyle): number {
  if (/\p{Mark}/u.test(character) || character === '\u200d') return 0;

  let width: number;
  if (/\s/u.test(character)) width = fontSize * 0.30;
  else if (/[ilI.,'`!:;|]/u.test(character)) width = fontSize * 0.32;
  else if (/[mw@%&#]/u.test(character)) width = fontSize * 0.78;
  else if (/[MW]/u.test(character)) width = fontSize * 0.88;
  else if (/[A-Z]/u.test(character)) width = fontSize * 0.66;
  else if (/[0-9]/u.test(character)) width = fontSize * 0.58;
  else if (character.codePointAt(0)! > 0xffff) width = fontSize;
  else if (character.codePointAt(0)! > 0x024f) width = fontSize * 0.92;
  else if (/[frt]/u.test(character)) width = fontSize * 0.43;
  else width = fontSize * 0.54;

  return width * (style.bold ? 1.12 : 1.10);
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
        if (lineWidth > 0 && lineWidth + width > maxWidth) nextLine();
        else if (lineWidth > 0) {
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
      } else {
        for (const character of token) {
          const width = glyphWidth(character, fontSize, style);
          if (lineWidth > 0 && lineWidth + width > maxWidth) nextLine();
          append(character, style);
          lineWidth += width;
        }
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
  const source = markdown.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
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
      } else if (ordered) {
        line = ordered[2];
        prefix = ordered[1] + ' ';
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
    if (prefix) runs.unshift({
      text: prefix,
      bold: true,
      italic: false,
      strike: false,
      code: false,
      accent: true,
    });

    for (const wrappedLine of wrapInlineRuns(runs, BODY_WIDTH, BODY_FONT)) {
      const content = wrappedLine.map((run) => {
        const weight = run.bold ? '700' : '400';
        const style = run.italic ? 'italic' : 'normal';
        const fill = run.accent ? accentColor : '#FFF5E8';
        const decoration = run.strike ? ' text-decoration="line-through"' : '';
        return '<tspan font-family="Arial,sans-serif" font-weight="' + weight + '" font-style="' + style + '" fill="' + fill + '"' + decoration + '>' + escapeXml(run.text) + '</tspan>';
      }).join('');

      renderedLines.push('<tspan x="' + BODY_X + '" dy="' + (renderedLines.length === 0 ? 0 : LINE_HEIGHT) + '">' + content + '</tspan>');
      visibleCharacters += wrappedLine.reduce((sum, run) => sum + [...run.text].filter((character) => !/\s/u.test(character)).length, 0);
    }
  }

  return { markup: renderedLines.join(''), lineCount: renderedLines.length, visibleCharacters };
}

export const ANNOUNCEMENT_FLAIRS = ['IMPORTANT', 'NOTICE', 'REMINDER', 'ANNOUNCEMENT'] as const;
export type AnnouncementFlair = typeof ANNOUNCEMENT_FLAIRS[number];

type FlairTheme = {
  accent: string;
  background: string;
};

const FLAIR_THEMES: Record<AnnouncementFlair, FlairTheme> = {
  IMPORTANT: { accent: '#FF2525', background: '#080605' },
  NOTICE: { accent: '#078BFF', background: '#050D1C' },
  ANNOUNCEMENT: { accent: '#8CFF00', background: '#050A05' },
  REMINDER: { accent: '#FF7900', background: '#090604' },
};

function frameSvg(accent: string, height: number): string {
  const frameBottom = height - CANVAS_BOTTOM_GAP;
  const upperRight = frameBottom - 80;
  return '<path d="M110 65 H1970 V' + upperRight + ' L1890 ' + frameBottom + ' H30 V145 Z" fill="none" stroke="' + accent + '" stroke-width="16"/>';
}

function importantHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="Arial,sans-serif" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 120 H510 L390 360 H70 Z" fill="#FF2525"/>',
    '<path d="M530 135 H1720 L1600 345 H420 Z" fill="#FFF5E8"/>',
    '<g fill="none" stroke="#FFF5E8" stroke-width="16" stroke-linejoin="round"><path d="M270 155 L375 320 H165 Z"/><path d="M270 205 V260 M270 290 V292"/></g>',
    '<text x="570" y="300" fill="#080605" font-family="Arial,sans-serif" font-size="145" font-weight="900" font-style="italic" textLength="1050" lengthAdjust="spacingAndGlyphs">IMPORTANT</text>',
    '<g fill="#FF2525"><path d="M1750 170 L1810 170 L1725 325 H1665 Z"/><path d="M1840 170 L1900 170 L1815 325 H1755 Z"/></g>',
  ].join('');
}

function noticeHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="Arial,sans-serif" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#078BFF"/>',
    '<path d="M455 140 H1330 L1215 355 H350 Z" fill="#FFF5E8"/>',
    '<circle cx="245" cy="240" r="75" fill="none" stroke="#FFF5E8" stroke-width="15"/><circle cx="245" cy="195" r="10" fill="#FFF5E8"/><rect x="230" y="220" width="30" height="75" rx="12" fill="#FFF5E8"/>',
    '<text x="480" y="305" fill="#050D1C" font-family="Arial,sans-serif" font-size="150" font-weight="900" font-style="italic" textLength="720" lengthAdjust="spacingAndGlyphs">NOTICE</text>',
    '<g fill="#078BFF"><path d="M1370 140 H1430 L1315 345 H1255 Z"/><path d="M1460 140 H1520 L1405 345 H1345 Z"/></g>',
  ].join('');
}

function announcementHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="Arial,sans-serif" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#FFF5E8"/>',
    '<path d="M455 135 H1715 L1595 350 H350 Z" fill="#8CFF00"/>',
    '<g fill="#126B18" stroke="#126B18" stroke-width="12" stroke-linejoin="round"><path d="M135 215 L230 185 L230 285 L135 255 Z"/><path d="M230 185 L280 165 V305 L230 285 Z"/><path d="M165 260 L200 320 L230 310 L205 255 Z"/></g>',
    '<g stroke="#126B18" stroke-width="12" stroke-linecap="round"><path d="M295 190 L330 165"/><path d="M305 235 H350"/><path d="M295 280 L330 305"/></g>',
    '<text x="460" y="295" fill="#050A05" font-family="Arial,sans-serif" font-size="130" font-weight="900" font-style="italic" textLength="1180" lengthAdjust="spacingAndGlyphs">ANNOUNCEMENT</text>',
    '<g fill="#8CFF00"><path d="M1750 170 H1810 L1725 325 H1665 Z"/><path d="M1840 170 H1900 L1815 325 H1755 Z"/></g>',
  ].join('');
}

function reminderHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="Arial,sans-serif" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#FFF5E8"/>',
    '<path d="M455 130 H1635 L1515 355 H350 Z" fill="#FF7900"/>',
    '<g fill="none" stroke="#090604" stroke-width="15" stroke-linejoin="round"><rect x="160" y="185" width="145" height="125" rx="16"/><path d="M190 165 V200 M275 165 V200"/><path d="M160 225 H305"/></g>',
    '<g fill="#090604"><rect x="185" y="245" width="22" height="22" rx="5"/><rect x="225" y="245" width="22" height="22" rx="5"/><rect x="265" y="245" width="22" height="22" rx="5"/><rect x="185" y="280" width="22" height="15" rx="4"/><rect x="225" y="280" width="22" height="15" rx="4"/><rect x="265" y="280" width="22" height="15" rx="4"/></g>',
    '<text x="450" y="305" fill="#090604" font-family="Arial,sans-serif" font-size="145" font-weight="900" font-style="italic" textLength="1050" lengthAdjust="spacingAndGlyphs">REMINDER</text>',
    '<g fill="#FF7900"><path d="M1680 170 H1740 L1655 325 H1595 Z"/><path d="M1770 170 H1830 L1745 325 H1685 Z"/></g>',
  ].join('');
}

function flairHeader(flair: AnnouncementFlair): string {
  switch (flair) {
    case 'IMPORTANT': return importantHeader();
    case 'NOTICE': return noticeHeader();
    case 'ANNOUNCEMENT': return announcementHeader();
    case 'REMINDER': return reminderHeader();
  }
}

export function buildAnnouncementSvg(markdown: string, flair: AnnouncementFlair = 'ANNOUNCEMENT'): string {
  if (typeof markdown !== 'string' || markdown.length > MAX_ANNOUNCEMENT_CHARS) {
    throw new Error('The announcement exceeds the ' + MAX_ANNOUNCEMENT_CHARS + ' character limit.');
  }
  if (!ANNOUNCEMENT_FLAIRS.includes(flair)) {
    throw new Error('Choose one of the four supported announcement flairs.');
  }

  const rendered = renderBody(markdown, FLAIR_THEMES[flair].accent);
  if (rendered.visibleCharacters === 0) throw new Error('The announcement has no renderable text.');
  if (rendered.lineCount > MAX_LINES) {
    throw new Error('The announcement needs more than ' + MAX_LINES + ' rendered lines. Shorten it to keep the image readable.');
  }

  const lastBaseline = BODY_START_Y + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT;
  const frameBottom = lastBaseline + FRAME_BOTTOM_GAP;
  const height = frameBottom + CANVAS_BOTTOM_GAP;
  const markerBottom = lastBaseline + 35;
  const theme = FLAIR_THEMES[flair];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>MODGLOW ' + flair.toLowerCase() + '</title>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="' + theme.background + '"/>',
    frameSvg(theme.accent, height),
    flairHeader(flair),
    '<rect x="115" y="415" width="16" height="' + (markerBottom - 415) + '" fill="' + theme.accent + '"/>',
    '<text x="' + BODY_X + '" y="' + BODY_START_Y + '" font-family="Arial,sans-serif" font-size="' + BODY_FONT + '" fill="#FFF5E8">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}
