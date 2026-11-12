import { escapeXml, markdownToPlainText, relativeTime, wrapTextByWidth } from './format.ts';

export type CommentCardInput = {
  subredditName: string;
  authorName: string;
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

function authorInitials(name: string): string {
  const parts = name.trim().split(/[._-]+/).filter(Boolean);
  const value = parts.length > 1 ? (parts[0][0] ?? '') + (parts[1][0] ?? '') : [...(parts[0] ?? 'M')][0];
  return escapeXml((value || 'M').toUpperCase());
}

function separator(x: number, y: number): string {
  return '<circle cx="' + x + '" cy="' + y + '" r="4" fill="#8C9EAA"/>';
}

function moderatorBadge(x: number): string {
  return [
    '<rect x="' + x + '" y="84" width="194" height="68" rx="34" fill="#123D1E" stroke="#1A6A2B" stroke-width="1.5"/>',
    '<path d="M' + (x + 25) + ' 103 L' + (x + 43) + ' 97 L' + (x + 61) + ' 103 V123 Q' + (x + 43) + ' 140 ' + (x + 43) + ' 140 Q' + (x + 25) + ' 132 ' + (x + 25) + ' 123 Z" fill="#16D94B"/>',
    '<path d="M' + (x + 32) + ' 106 L' + (x + 43) + ' 102 L' + (x + 54) + ' 106 V122 Q' + (x + 43) + ' 132 ' + (x + 43) + ' 132 Q' + (x + 32) + ' 126 ' + (x + 32) + ' 122 Z" fill="none" stroke="#0D6C2B" stroke-width="2"/>',
    '<text x="' + (x + 78) + '" y="132" font-family="IBM Plex Sans" font-size="43" font-weight="500" fill="#2BCB50">Mod</text>',
  ].join('');
}

function pinIcon(x: number, y: number): string {
  return [
    '<path d="M' + (x + 23) + ' ' + (y + 4) + ' C' + (x + 31) + ' ' + (y - 4) + ' ' + (x + 45) + ' ' + (y - 4) + ' ' + (x + 51) + ' ' + (y + 4) + ' L' + (x + 54) + ' ' + (y + 8) + ' L' + (x + 46) + ' ' + (y + 17) + ' L' + (x + 51) + ' ' + (y + 31) + ' L' + (x + 43) + ' ' + (y + 39) + ' L' + (x + 29) + ' ' + (y + 25) + ' L' + (x + 16) + ' ' + (y + 39) + ' L' + (x + 9) + ' ' + (y + 32) + ' L' + (x + 22) + ' ' + (y + 19) + ' L' + (x + 17) + ' ' + (y + 12) + ' Z" fill="#91A3AF"/>',
    '<path d="M' + (x + 28) + ' ' + (y + 27) + ' L' + (x + 3) + ' ' + (y + 52) + '" stroke="#91A3AF" stroke-width="5" stroke-linecap="round"/>',
  ].join('');
}

function actionRow(y: number): string {
  return [
    '<g fill="none" stroke="#91A3AF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">',
    '<circle cx="654" cy="' + (y - 20) + '" r="5" fill="#91A3AF" stroke="none"/>',
    '<circle cx="654" cy="' + y + '" r="5" fill="#91A3AF" stroke="none"/>',
    '<circle cx="654" cy="' + (y + 20) + '" r="5" fill="#91A3AF" stroke="none"/>',
    '<path d="M818 ' + (y - 26) + ' L792 ' + (y - 1) + ' L818 ' + (y + 23) + ' M792 ' + (y - 1) + ' H818 Q849 ' + (y - 1) + ' 849 ' + (y + 30) + ' V' + (y + 36) + '"/>',
    '<path d="M1127 ' + (y - 39) + ' L1153 ' + (y - 12) + ' H1139 V' + (y + 30) + ' H1115 V' + (y - 12) + ' H1101 Z"/>',
    '<path d="M1380 ' + (y + 39) + ' L1354 ' + (y + 12) + ' H1368 V' + (y - 30) + ' H1392 V' + (y + 12) + ' H1406 Z"/>',
    '</g>',
    '<text x="883" y="' + (y + 15) + '" font-family="IBM Plex Sans" font-size="43" font-weight="700" fill="#91A3AF">Reply</text>',
    '<text x="1210" y="' + (y + 15) + '" font-family="IBM Plex Sans" font-size="43" font-weight="700" fill="#91A3AF">Vote</text>',
  ].join('');
}

export function buildCommentSvg(input: CommentCardInput): string {
  if (!input.authorName.trim() || [...input.authorName].length > 20) {
    throw new Error('The selected comment has an invalid Reddit username.');
  }
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
  const actionY = Math.max(355, bodyEndY + 50);
  const height = actionY + 55;
  const author = escapeXml(input.authorName);
  const timeValue = relativeTime(input.createdAt);
  const timeLabel = timeValue === 'just now'
    ? 'Now'
    : (timeValue.match(/^([A-Za-z]{3} \d{1,2}),/)?.[1] ?? (timeValue.length > 8 ? 'Earlier' : timeValue));
  const time = escapeXml(timeLabel);
  const initials = authorInitials(input.authorName);
  const editedWidth = input.edited ? 94 : 0;

  const authorWidth = Math.min(510, Math.max(105, [...input.authorName].length * 26));
  const dotOneX = 240 + authorWidth + 22;
  const badgeX = dotOneX + 22;
  const dotTwoX = badgeX + 214;
  const timeX = dotTwoX + 26;
  const timeWidth = Math.max(95, [...timeLabel].length * 24);
  const dotThreeX = timeX + timeWidth + editedWidth + 22;
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
    '<linearGradient id="surface" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#171B1F"/><stop offset="1" stop-color="#121619"/></linearGradient>',
    '<linearGradient id="avatar" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#335A66"/><stop offset="1" stop-color="#182D3C"/></linearGradient>',
    '<radialGradient id="highlight"><stop offset="0" stop-color="#2D7B43" stop-opacity=".13"/><stop offset="1" stop-color="#2D7B43" stop-opacity="0"/></radialGradient>',
    '</defs>',
    '<rect width="' + WIDTH + '" height="' + height + '" fill="#0E1012"/>',
    '<rect x="10" y="10" width="1516" height="' + (height - 20) + '" rx="24" fill="url(#surface)" stroke="#293138" stroke-width="2"/>',
    '<ellipse cx="1160" cy="104" rx="500" ry="210" fill="url(#highlight)"/>',
    '<rect x="10" y="10" width="5" height="' + (height - 20) + '" rx="2.5" fill="#2B8A45" opacity=".72"/>',
    '<circle cx="132" cy="124" r="61" fill="#080A0C" stroke="#26313A" stroke-width="3"/>',
    '<circle cx="132" cy="124" r="54" fill="url(#avatar)" stroke="#526A73" stroke-width="2"/>',
    '<circle cx="132" cy="124" r="45" fill="none" stroke="#E9B86C" stroke-width="1.5" opacity=".48"/>',
    '<text x="132" y="141" text-anchor="middle" font-family="IBM Plex Sans" font-size="48" font-weight="700" fill="#F1E7D5">' + initials + '</text>',
    '<text x="240" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="700" fill="#24C84A">' + author + '</text>',
    separator(dotOneX, 111),
    moderatorBadge(badgeX),
    separator(dotTwoX, 111),
    '<text x="' + timeX + '" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="400" fill="#91A3AF">' + time + '</text>',
    input.edited ? '<text x="' + (timeX + timeWidth + 8) + '" y="121" font-family="IBM Plex Sans" font-size="27" font-weight="400" fill="#91A3AF">edited</text>' : '',
    separator(dotThreeX, 111),
    pinIcon(pinX, 78),
    '<text x="' + pinTextX + '" y="121" font-family="IBM Plex Sans" font-size="49" font-weight="400" fill="#91A3AF">Pinned</text>',
    '<text x="' + BODY_X + '" y="' + bodyStartY + '" font-family="IBM Plex Sans" font-size="' + BODY_FONT + '" font-weight="400" fill="#A9B9C4">' + bodyMarkup + '</text>',
    actionRow(actionY),
    '</svg>',
  ].join('\n');
}
