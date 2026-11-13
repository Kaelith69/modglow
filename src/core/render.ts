import { escapeXml } from './format.ts';

const WIDTH = 2000;
const BODY_X = 195;
const BODY_START_Y = 475;
const BODY_FONT = 76;
const FONT_FAMILY = 'Arial, Helvetica, sans-serif';
const GRAPHEME_SEGMENTER = new Intl.Segmenter(undefined, { granularity: 'grapheme' });

function graphemeCount(value: string, stopAfter: number): number {
  let count = 0;
  for (const part of GRAPHEME_SEGMENTER.segment(value)) {
    if (part.segment.length > 0) count += 1;
    if (count > stopAfter) return count;
  }
  return count;
}

function graphemes(value: string): string[] {
  return Array.from(GRAPHEME_SEGMENTER.segment(value), (part) => part.segment);
}
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
  const pattern = /\\([\\`*_{}()#+.!>])|`([^`]+)`|~~(.+?)~~|\*\*\*(.+?)\*\*\*|___(.+?)___|\*\*(.+?)\*\*|(?<![\p{L}\p{N}])__(.+?)__(?![\p{L}\p{N}])|\*(.+?)\*|(?<![\p{L}\p{N}])_(.+?)_(?![\p{L}\p{N}])/gu;
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

/**
 * Conservative estimates for the bundled IBM Plex Sans raster fallback used
 * when Arial and Helvetica are unavailable. These are not
 * font metrics: keep a right margin and cover wide glyphs, punctuation,
 * combining marks and unbroken tokens with regression tests.
 */
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
        const width = graphemes(token).reduce((sum, character) => sum + glyphWidth(character, fontSize, style), 0);
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
        for (const character of graphemes(token)) {
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
    .replace(/!\[([^\]]*)\]\((?:[^\s()]|\([^()\s]*\))+\)/gu, '$1')
    .replace(/\[([^\]]+)\]\(https?:\/\/(?:[^\s()]|\([^()\s]*\))+\)/gu, '$1')
    .replace(/<https?:\/\/([^>]+)>/g, 'https://$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/[ \t]+$/g, '');
}

function renderBody(markdown: string, accentColor: string): RenderedBody {
  const source = markdown.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  const renderedLines: string[] = [];
  let activeFence: { character: string; length: number } | undefined;
  let visibleCharacters = 0;

  for (const originalLine of source.split('\n')) {
    const fence = originalLine.match(/^\s*(`{3,}|~{3,})([A-Za-z0-9_+#.-]{0,24})\s*$/u);
    if (fence) {
      if (!activeFence) {
        activeFence = { character: fence[1][0], length: fence[1].length };
        continue;
      }
      if (fence[1][0] === activeFence.character && fence[1].length >= activeFence.length && !fence[2]) {
        activeFence = undefined;
        continue;
      }
    }

    const inCodeBlock = Boolean(activeFence);
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
        return '<tspan font-family="' + FONT_FAMILY + '" font-weight="' + weight + '" font-style="' + style + '" fill="' + fill + '"' + decoration + '>' + escapeXml(run.text) + '</tspan>';
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
  // The upper rail starts after the MODGLOW wordmark, as in the source artwork.
  return '<path d="M466 65 H1970 V' + upperRight + ' L1890 ' + frameBottom + ' H30 V145 L85 65" fill="none" stroke="' + accent + '" stroke-width="16" stroke-linejoin="miter"/>';
}

function importantHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="' + FONT_FAMILY + '" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 120 H510 L390 360 H70 Z" fill="#FF2525"/>',
    '<path d="M530 135 H1720 L1600 345 H420 Z" fill="#FFF5E8"/>',
    '<g fill="none" stroke="#FFF5E8" stroke-width="16" stroke-linejoin="round"><path d="M270 155 L375 320 H165 Z"/><path d="M270 205 V260 M270 290 V292"/></g>',
    '<text x="570" y="300" fill="#080605" font-family="' + FONT_FAMILY + '" font-size="145" font-weight="900" font-style="italic" textLength="1000" lengthAdjust="spacingAndGlyphs">IMPORTANT</text>',
    '<g fill="#FF2525"><path d="M1655 170 H1715 L1630 325 H1570 Z"/><path d="M1745 170 H1805 L1720 325 H1660 Z"/><path d="M1835 170 H1895 L1810 325 H1750 Z"/></g>',
  ].join('');
}

function noticeHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="' + FONT_FAMILY + '" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#078BFF"/>',
    '<path d="M455 140 H1330 L1215 355 H350 Z" fill="#FFF5E8"/>',
    '<circle cx="245" cy="240" r="75" fill="none" stroke="#FFF5E8" stroke-width="15"/><circle cx="245" cy="195" r="10" fill="#FFF5E8"/><rect x="230" y="220" width="30" height="75" rx="12" fill="#FFF5E8"/>',
    '<text x="480" y="305" fill="#050D1C" font-family="' + FONT_FAMILY + '" font-size="150" font-weight="900" font-style="italic" textLength="720" lengthAdjust="spacingAndGlyphs">NOTICE</text>',
    '<g fill="#078BFF"><path d="M1370 140 H1430 L1315 345 H1255 Z"/><path d="M1460 140 H1520 L1405 345 H1345 Z"/></g>',
  ].join('');
}

function announcementHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="' + FONT_FAMILY + '" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#FFF5E8"/>',
    '<path d="M455 135 H1715 L1595 350 H350 Z" fill="#8CFF00"/>',
    '<g transform="scale(1.3020833)" fill="#126B18" stroke="#126B18" stroke-linejoin="round"><path d="M186 139 L166 153 L135 167 L135 185 L141 211 L175 213 L200 220 Z"/><path d="M101 175 L90 190 L92 206 L108 217 L114 216 L143 252 L154 251 L157 243 L130 210 L125 169 Z"/><path d="M199 122 L195 127 L195 137 L209 224 L212 230 L219 230 L222 224 L216 188 L221 182 L221 171 L211 159 L207 126 L204 122 Z"/></g>',
    '<g transform="scale(1.3020833)" fill="none" stroke="#126B18" stroke-width="8" stroke-linecap="round"><path d="M249 132 L230 146 L228 152"/><path d="M266 165 L237 167 L233 173"/><path d="M235 192 L251 202 L261 202"/></g>',
    '<text x="460" y="295" fill="#050A05" font-family="' + FONT_FAMILY + '" font-size="130" font-weight="900" font-style="italic" textLength="1100" lengthAdjust="spacingAndGlyphs">ANNOUNCEMENT</text>',
    '<g fill="#8CFF00"><path d="M1655 170 H1715 L1630 325 H1570 Z"/><path d="M1745 170 H1805 L1720 325 H1660 Z"/><path d="M1835 170 H1895 L1810 325 H1750 Z"/></g>',
  ].join('');
}

function reminderHeader(): string {
  return [
    '<text x="165" y="80" fill="#FFF5E8" font-family="' + FONT_FAMILY + '" font-size="40" font-weight="bold" letter-spacing="12">MODGLOW</text>',
    '<path d="M70 130 H435 L330 350 H70 Z" fill="#FFF5E8"/>',
    '<path d="M455 130 H1635 L1515 355 H350 Z" fill="#FF7900"/>',
    '<g transform="scale(1.3020833)" fill="#090604"><path d="M126 136 Q122 140 122 150 V229 Q122 242 136 245 H235 Q249 245 249 229 V144 Q249 134 239 132 L223 130 L221 119 Q217 116 213 118 L208 130 H164 L162 119 Q158 116 154 118 L149 130 H134 Z"/></g>',
    '<g transform="scale(1.3020833)" fill="#FFF5E8"><rect x="135" y="153" width="101" height="76" rx="5"/></g>',
    '<g transform="scale(1.3020833)" fill="#090604"><rect x="143" y="164" width="13" height="13" rx="3"/><rect x="174" y="164" width="13" height="13" rx="3"/><rect x="205" y="164" width="13" height="13" rx="3"/><rect x="143" y="190" width="13" height="13" rx="3"/><rect x="174" y="190" width="13" height="13" rx="3"/><rect x="205" y="190" width="13" height="13" rx="3"/><rect x="143" y="214" width="13" height="10" rx="3"/><rect x="174" y="214" width="13" height="10" rx="3"/></g>',
    '<text x="450" y="305" fill="#090604" font-family="' + FONT_FAMILY + '" font-size="145" font-weight="900" font-style="italic" textLength="1050" lengthAdjust="spacingAndGlyphs">REMINDER</text>',
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

/** Build the fixed-height title banner used when the Markdown body is separate. */
export function buildAnnouncementHeaderSvg(flair: AnnouncementFlair = 'ANNOUNCEMENT'): string {
  if (!ANNOUNCEMENT_FLAIRS.includes(flair)) {
    throw new Error('Choose one of the four supported announcement flairs.');
  }

  const width = WIDTH;
  const height = 600;
  const theme = FLAIR_THEMES[flair];

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + width + '" height="' + height + '" viewBox="0 0 ' + width + ' ' + height + '">',
    '<title>MODGLOW ' + flair.toLowerCase() + '</title>',
    '<rect width="' + width + '" height="' + height + '" fill="' + theme.background + '"/>',
    frameSvg(theme.accent, height),
    flairHeader(flair),
    '</svg>',
  ].join('\n');
}

export function buildAnnouncementSvg(markdown: string, flair: AnnouncementFlair = 'ANNOUNCEMENT'): string {
  if (typeof markdown !== 'string' || graphemeCount(markdown, MAX_ANNOUNCEMENT_CHARS) > MAX_ANNOUNCEMENT_CHARS) {
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
    '<text x="' + BODY_X + '" y="' + BODY_START_Y + '" font-family="' + FONT_FAMILY + '" font-size="' + BODY_FONT + '" fill="#FFF5E8">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}
