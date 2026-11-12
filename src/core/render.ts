import { escapeXml, markdownToPlainText, relativeTime, wrapTextByWidth } from './format.ts';

export type CommentCardInput = {
  subredditName: string;
  authorName: string;
  body: string;
  createdAt: Date;
  edited: boolean;
};

const WIDTH = 1200;
const BODY_X = 104;
const BODY_FONT = 40;
const LINE_HEIGHT = 58;
const MAX_BODY_CHARS = 2600;
const MAX_LINES = 38;

function brandMark(): string {
  return `
    <path d="M88 54 L122 74 V114 L88 134 L54 114 V74 Z" fill="#E9B86C"/>
    <path d="M88 68 L110 81 V107 L88 120 L66 107 V81 Z" fill="#17243B"/>
    <path d="M88 78 L101 86 V102 L88 110 L75 102 V86 Z" fill="none" stroke="#F8E8C8" stroke-width="4"/>
    <circle cx="88" cy="94" r="4.5" fill="#E9B86C"/>
  `;
}

export function buildCommentSvg(input: CommentCardInput): string {
  if (input.body.length > MAX_BODY_CHARS) {
    throw new Error(`This comment is too long to feature safely (${MAX_BODY_CHARS} character limit).`);
  }

  const body = markdownToPlainText(input.body);
  if (!body) throw new Error('The selected comment has no renderable text.');

  const lines = wrapTextByWidth(body, 930, BODY_FONT);
  if (lines.length > MAX_LINES) {
    throw new Error(`This comment needs more than ${MAX_LINES} lines. Shorter comments are required for a readable image.`);
  }

  const bodyStartY = 350;
  const bodyEndY = bodyStartY + Math.max(1, lines.length) * LINE_HEIGHT;
  const height = Math.max(650, bodyEndY + 190);
  const subreddit = escapeXml(input.subredditName);
  const author = escapeXml(input.authorName);
  const time = escapeXml(relativeTime(input.createdAt));
  const edited = input.edited ? ' · edited' : '';
  const bodyMarkup = lines.map((line, index) =>
    `<tspan x="${BODY_X}" dy="${index === 0 ? 0 : LINE_HEIGHT}">${escapeXml(line || ' ')}</tspan>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
    <defs>
      <linearGradient id="canvas" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#101B2E"/>
        <stop offset="1" stop-color="#263A50"/>
      </linearGradient>
      <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#FFFDF8"/>
        <stop offset="1" stop-color="#F2EEE5"/>
      </linearGradient>
    </defs>
    <rect width="${WIDTH}" height="${height}" fill="url(#canvas)"/>
    <circle cx="1110" cy="94" r="180" fill="#D8A45D" opacity=".08"/>
    <circle cx="1090" cy="100" r="125" fill="none" stroke="#E9B86C" stroke-width="2" opacity=".18"/>
    <path d="M0 ${height - 100} L380 ${height - 100} L450 ${height} H0 Z" fill="#E9B86C" opacity=".08"/>
    <rect x="28" y="28" width="1144" height="${height - 56}" rx="28" fill="url(#panel)"/>
    <rect x="28" y="28" width="1144" height="12" rx="6" fill="#D8A45D"/>
    <g>${brandMark()}</g>
    <text x="145" y="83" font-family="IBM Plex Sans" font-size="22" font-weight="700" letter-spacing="4" fill="#8A6334">COMMUNITY ARCHIVE</text>
    <text x="145" y="126" font-family="IBM Plex Sans" font-size="38" font-weight="700" fill="#17243B">A COMMUNITY SPOTLIGHT</text>
    <text x="145" y="166" font-family="IBM Plex Sans" font-size="25" fill="#596575">Selected by the r/${subreddit} moderation team</text>
    <rect x="920" y="72" width="208" height="52" rx="26" fill="#17243B"/>
    <text x="1024" y="105" text-anchor="middle" font-family="IBM Plex Sans" font-size="18" font-weight="700" letter-spacing="1.5" fill="#F5D7A5">FEATURED</text>
    <line x1="82" y1="205" x2="1118" y2="205" stroke="#D9D1C3" stroke-width="2"/>
    <text x="${BODY_X}" y="253" font-family="IBM Plex Sans" font-size="24" font-weight="700" fill="#17243B">u/${author}</text>
    <text x="${BODY_X}" y="282" font-family="IBM Plex Sans" font-size="19" fill="#687382">Original commenter · ${time}${edited}</text>
    <text x="${BODY_X}" y="${bodyStartY}" font-family="IBM Plex Sans" font-size="${BODY_FONT}" font-weight="400" fill="#202B39">${bodyMarkup}</text>
    <line x1="${BODY_X}" y1="${bodyEndY + 45}" x2="1118" y2="${bodyEndY + 45}" stroke="#D9D1C3" stroke-width="2"/>
    <text x="${BODY_X}" y="${bodyEndY + 91}" font-family="IBM Plex Sans" font-size="19" font-weight="700" letter-spacing="2" fill="#8A6334">SELECTED BY THE MODERATION TEAM</text>
    <text x="${BODY_X}" y="${bodyEndY + 125}" font-family="IBM Plex Sans" font-size="19" fill="#687382">Original author credited · Source discussion linked in the post</text>
    <text x="1118" y="${height - 70}" text-anchor="end" font-family="IBM Plex Sans" font-size="17" fill="#9A9489">MODGLOW  /  COMMUNITY EDITION</text>
  </svg>`;
}
