import { escapeXml } from './format.ts';

const WIDTH = 1536;
const BODY_X = 76;
const BODY_FONT = 64;
const LINE_HEIGHT = 82;
export const MAX_ANNOUNCEMENT_CHARS = 2600;
const MAX_LINES = 24;
const MIN_HEIGHT = 438;
const BOTTOM_PADDING = 112;
const BODY_WIDTH = 1384;

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

function separator(x: number, y: number): string {
  return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#A99B62"/>';
}

function pinIcon(x: number, y: number): string {
  return [
    '<path d="M' + (x + 23) + ' ' + (y + 4) + ' C' + (x + 31) + ' ' + (y - 4) + ' ' + (x + 45) + ' ' + (y - 4) + ' ' + (x + 51) + ' ' + (y + 4) + ' L' + (x + 54) + ' ' + (y + 8) + ' L' + (x + 46) + ' ' + (y + 17) + ' L' + (x + 51) + ' ' + (y + 31) + ' L' + (x + 43) + ' ' + (y + 39) + ' L' + (x + 29) + ' ' + (y + 25) + ' L' + (x + 16) + ' ' + (y + 39) + ' L' + (x + 9) + ' ' + (y + 32) + ' L' + (x + 22) + ' ' + (y + 19) + ' L' + (x + 17) + ' ' + (y + 12) + ' Z" fill="#FFE45C"/>',
    '<path d="M' + (x + 28) + ' ' + (y + 27) + ' L' + (x + 3) + ' ' + (y + 52) + '" stroke="#FFE45C" stroke-width="5" stroke-linecap="round"/>',
  ].join('');
}

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
  else if (style.code) width = fontSize * 0.61;
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

function renderBody(markdown: string): RenderedBody {
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
        const family = run.code ? 'monospace' : 'IBM Plex Sans';
        const fill = run.accent ? '#FFEFA3' : '#F2F0E8';
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

export function buildAnnouncementSvg(markdown: string): string {
  if (typeof markdown !== 'string' || markdown.length > MAX_ANNOUNCEMENT_CHARS) {
    throw new Error('The announcement exceeds the ' + MAX_ANNOUNCEMENT_CHARS + ' character limit.');
  }

  const rendered = renderBody(markdown);
  if (rendered.visibleCharacters === 0) {
    throw new Error('The announcement has no renderable text.');
  }
  if (rendered.lineCount > MAX_LINES) {
    throw new Error('The announcement needs more than ' + MAX_LINES + ' rendered lines. Shorten it to keep the image readable.');
  }

  const bodyStartY = 252;
  const bodyEndY = bodyStartY + Math.max(0, rendered.lineCount - 1) * LINE_HEIGHT + BODY_FONT;
  const height = Math.max(MIN_HEIGHT, bodyEndY + BOTTOM_PADDING);

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>ModGlow moderator announcement</title>',
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
    '<text x="722" y="121" font-family="IBM Plex Sans" font-size="38" font-weight="700" letter-spacing="2" fill="#FFEFA3">ANNOUNCEMENT</text>',
    separator(1090, 111),
    pinIcon(1110, 78),
    '<text x="1180" y="121" font-family="IBM Plex Sans" font-size="42" font-weight="600" fill="#FFEFA3">Pinned</text>',
    '<text x="' + BODY_X + '" y="' + bodyStartY + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#F2F0E8" filter="url(#textShadow)">' + rendered.markup + '</text>',
    '</svg>',
  ].join('\n');
}
