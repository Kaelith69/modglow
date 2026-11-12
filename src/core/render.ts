import { escapeXml, markdownToPlainText, relativeTime, wrapTextByWidth } from './format.ts';

export type CommentCardInput = {
  subredditName: string;
  body: string;
  createdAt: Date;
  edited: boolean;
};

const WIDTH = 1536;
const BODY_X = 68;
const BODY_FONT = 58;
const LINE_HEIGHT = 72;
const MAX_BODY_CHARS = 2600;
const MAX_LINES = 24;
const MIN_HEIGHT = 410;
const BOTTOM_PADDING = 106;

function separator(x: number, y: number): string {
  return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#8C9EAA"/>';
}

function moderatorBadge(x: number): string {
  return [
    '<rect x="' + x + '" y="84" width="194" height="68" rx="34" fill="#17380D" stroke="#285A16" stroke-width="1.5"/>',
    '<path d="M' + (x + 25) + ' 103 L' + (x + 43) + ' 97 L' + (x + 61) + ' 103 V123 Q' + (x + 43) + ' 140 ' + (x + 43) + ' 140 Q' + (x + 25) + ' 132 ' + (x + 25) + ' 123 Z" fill="#23B82F"/>',
    '<path d="M' + (x + 32) + ' 106 L' + (x + 43) + ' 102 L' + (x + 54) + ' 106 V122 Q' + (x + 43) + ' 132 ' + (x + 43) + ' 132 Q' + (x + 32) + ' 126 ' + (x + 32) + ' 122 Z" fill="none" stroke="#0D6C2B" stroke-width="2"/>',
    '<text x="' + (x + 78) + '" y="132" font-family="IBM Plex Sans" font-size="43" font-weight="500" fill="#61C64B">Mod</text>',
  ].join('');
}

function appLogo(): string {
  // Vector paths are taken from ModGlow's own app icon asset.
  return [
    '<circle cx="132" cy="124" r="61" fill="#101B2E" stroke="#26313A" stroke-width="3"/>',
    '<g transform="translate(76 68) scale(.109375)">',
    '<path d="M512 92 L858 292 L858 692 L512 892 L166 692 L166 292 Z" fill="#E9B86C"/>',
    '<path d="M512 172 L788 332 L788 652 L512 812 L236 652 L236 332 Z" fill="#101B2E"/>',
    '<path d="M512 254 L716 372 L716 612 L512 730 L308 612 L308 372 Z" fill="none" stroke="#F6F1E7" stroke-width="26"/>',
    '<path d="M512 338 L642 413 L642 571 L512 646 L382 571 L382 413 Z" fill="#E9B86C"/>',
    '<path d="M512 390 L597 439 L597 545 L512 594 L427 545 L427 439 Z" fill="#1D2B43"/>',
    '<path d="M458 496 Q512 430 566 496" fill="none" stroke="#F6F1E7" stroke-width="22" stroke-linecap="round"/>',
    '<circle cx="512" cy="524" r="18" fill="#E9B86C"/>',
    '</g>',
  ].join('');
}

function pinIcon(x: number, y: number): string {
  return [
    '<path d="M' + (x + 23) + ' ' + (y + 4) + ' C' + (x + 31) + ' ' + (y - 4) + ' ' + (x + 45) + ' ' + (y - 4) + ' ' + (x + 51) + ' ' + (y + 4) + ' L' + (x + 54) + ' ' + (y + 8) + ' L' + (x + 46) + ' ' + (y + 17) + ' L' + (x + 51) + ' ' + (y + 31) + ' L' + (x + 43) + ' ' + (y + 39) + ' L' + (x + 29) + ' ' + (y + 25) + ' L' + (x + 16) + ' ' + (y + 39) + ' L' + (x + 9) + ' ' + (y + 32) + ' L' + (x + 22) + ' ' + (y + 19) + ' L' + (x + 17) + ' ' + (y + 12) + ' Z" fill="#91A3AF"/>',
    '<path d="M' + (x + 28) + ' ' + (y + 27) + ' L' + (x + 3) + ' ' + (y + 52) + '" stroke="#91A3AF" stroke-width="5" stroke-linecap="round"/>',
  ].join('');
}

export function buildCommentSvg(input: CommentCardInput): string {
  if (input.body.length > MAX_BODY_CHARS) {
    throw new Error('This comment is too long to feature safely (' + MAX_BODY_CHARS + ' character limit).');
  }

  const body = markdownToPlainText(input.body);
  if (!body) throw new Error('The selected comment has no renderable text.');

  const lines = wrapTextByWidth(body, 1390, BODY_FONT);
  if (lines.length > MAX_LINES) {
    throw new Error('This comment needs more than ' + MAX_LINES + ' lines. Shorter comments are required for a readable image.');
  }

  const bodyStartY = 246;
  const bodyEndY = bodyStartY + Math.max(0, lines.length - 1) * LINE_HEIGHT + BODY_FONT;
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

  const bodyMarkup = lines.map((line, index) =>
    '<tspan x="' + BODY_X + '" dy="' + (index === 0 ? 0 : LINE_HEIGHT) + '">' + escapeXml(line || ' ') + '</tspan>',
  ).join('');

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + WIDTH + '" height="' + height + '" viewBox="0 0 ' + WIDTH + ' ' + height + '">',
    '<title>ModGlow featured community comment</title>',
    '<defs>',
    '<linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1B1B1B"/><stop offset=".56" stop-color="#17191A"/><stop offset="1" stop-color="#121619"/></linearGradient>',
    '<radialGradient id="highlight"><stop offset="0" stop-color="#D9E83F" stop-opacity=".105"/><stop offset="1" stop-color="#D9E83F" stop-opacity="0"/></radialGradient>',
    '<linearGradient id="edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#B8C83B" stop-opacity=".48"/><stop offset=".48" stop-color="#66732A" stop-opacity=".20"/><stop offset="1" stop-color="#B8C83B" stop-opacity=".34"/></linearGradient>',
    '</defs>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="#101113"/>',
    '<rect x="10" y="10" width="1516" height="' + (height - 20) + '" rx="24" fill="url(#surface)" stroke="url(#edge)" stroke-width="2"/>',
    '<ellipse cx="1160" cy="104" rx="560" ry="250" fill="url(#highlight)"/>',
    '<rect x="10" y="10" width="5" height="' + (height - 20) + '" rx="2.5" fill="#C4D83F" opacity=".62"/>',
    appLogo(),
    '<text x="240" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="700" fill="#5FBD47">ModGlow</text>',
    separator(456, 111),
    moderatorBadge(478),
    separator(696, 111),
    '<text x="722" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="400" fill="#91A3AF">' + time + '</text>',
    input.edited ? '<text x="' + (722 + timeWidth + 8) + '" y="121" font-family="IBM Plex Sans" font-size="27" font-weight="400" fill="#91A3AF">edited</text>' : '',
    separator(dotThreeX, 111),
    pinIcon(pinX, 78),
    '<text x="' + pinTextX + '" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="400" fill="#91A3AF">Pinned</text>',
    '<text x="' + BODY_X + '" y="' + bodyStartY + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#A9B9C4">' + bodyMarkup + '</text>',
    '</svg>',
  ].join('\n');
}
