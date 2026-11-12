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

function authorInitials(authorName: string): string {
  const parts = authorName.trim().split(/[._-]+/).filter(Boolean);
  const initials = parts.length > 1
    ? `${parts[0][0] ?? ''}${parts[1][0] ?? ''}`
    : [...(parts[0] ?? 'M')].slice(0, 1).join('');
  return escapeXml(initials.toUpperCase() || 'M');
}

function separator(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="4" fill="#8C9EAA"/>`;
}

function moderatorBadge(x: number): string {
  return `
    <rect x="${x}" y="84" width="194" height="68" rx="34" fill="#123D1E" stroke="#1A6A2B" stroke-width="1.5"/>
    <path d="M${x + 25} 103 L${x + 43} 97 L${x + 61} 103 V123 Q${x + 43} 140 ${x + 43} 140 Q${x + 25} 132 ${x + 25} 123 Z" fill="#16D94B"/>
    <path d="M${x + 32} 106 L${x + 43} 102 L${x + 54} 106 V122 Q${x + 43} 132 ${x + 43} 132 Q${x + 32} 126 ${x + 32} 122 Z" fill="none" stroke="#0D6C2B" stroke-width="2"/>
    <text x="${x + 78}" y="132" font-family="IBM Plex Sans" font-size="43" font-weight="500" fill="#2BCB50">Mod</text>
  `;
}

function pinIcon(x: number, y: number): string {
  return `
    <path d="M${x + 23} ${y + 4} C${x + 31} ${y - 4} ${x + 45} ${y - 4} ${x + 51} ${y + 4} L${x + 54} ${y + 8} L${x + 46} ${y + 17} L${x + 51} ${y + 31} L${x + 43} ${y + 39} L${x + 29} ${y + 25} L${x + 16} ${y + 39} L${x + 9} ${y + 32} L${x + 22} ${y + 19} L${x + 17} ${y + 12} Z" fill="#91A3AF"/>
    <path d="M${x + 28} ${y + 27} L${x + 3} ${y + 52}" stroke="#91A3AF" stroke-width="5" stroke-linecap="round"/>
  `;
}

function actionRow(y: number): string {
  return `
    <g fill="none" stroke="#91A3AF" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="654" cy="${y - 20}" r="5" fill="#91A3AF" stroke="none"/>
      <circle cx="654" cy="${y}" r="5" fill="#91A3AF" stroke="none"/>
      <circle cx="654" cy="${y + 20}" r="5" fill="#91A3AF" stroke="none"/>
      <path d="M818 ${y - 26} L792 ${y - 1} L818 ${y + 23} M792 ${y - 1} H818 Q849 ${y - 1} 849 ${y + 30} V${y + 36}"/>
      <path d="M1127 ${y - 39} L1153 ${y - 12} H1139 V${y + 30} H1115 V${y - 12} H1101 Z"/>
      <path d="M1380 ${y + 39} L1354 ${y + 12} H1368 V${y - 30} H1392 V${y + 12} H1406 Z"/>
    </g>
    <text x="883" y="${y + 15}" font-family="IBM Plex Sans" font-size="43" font-weight="700" fill="#91A3AF">Reply</text>
    <text x="1210" y="${y + 15}" font-family="IBM Plex Sans" font-size="43" font-weight="700" fill="#91A3AF">Vote</text>
  `;
}

export function buildCommentSvg(input: CommentCardInput): string {
  if (!input.authorName.trim() || [...input.authorName].length > 20) {
    throw new Error('The selected comment has an invalid Reddit username.');
  }
  if (input.body.length > MAX_BODY_CHARS) {
    throw new Error(`This comment is too long to feature safely (${MAX_BODY_CHARS} character limit).`);
  }

  const body = markdownToPlainText(input.body);
  if (!body) throw new Error('The selected comment has no renderable text.');

  const lines = wrapTextByWidth(body, 1390, BODY_FONT);
  if (lines.length > MAX_LINES) ¶èÂw°ºè­8b±Ê&™éíç²j+zØZŸn%Šw¬J+µêÜ¢iÛ­êŞªè«y×è­ªŞiÖ›•è¦jœ¢{-n‡rJÖ«µ