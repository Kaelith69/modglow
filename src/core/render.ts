import { escapeXml, markdownToPlainText, wrapTextByWidth } from './format.ts';

export type CommentCardInput = {
  body: string;
  createdAt: Date;
};

const WIDTH = 1200;
const SIDE_PADDING = 92;
const BODY_FONT = 42;
const LINE_HEIGHT = 62;
const MAX_BODY_CHARS = 2600;
const MAX_LINES = 42;
const TEXT_WIDTH = WIDTH - SIDE_PADDING * 2;

export function buildCommentSvg(input: CommentCardInput): string {
  if (input.body.length > MAX_BODY_CHARS) {
    throw new Error(`This comment is too long to render safely (${MAX_BODY_CHARS} character limit).`);
  }

  const body = markdownToPlainText(input.body);
  if (!body) throw new Error('The selected comment has no renderable text.');

  const lines = wrapTextByWidth(body, TEXT_WIDTH, BODY_FONT);
  if (lines.length > MAX_LINES) {
    throw new Error(`This comment needs more than ${MAX_LINES} lines. Shorter comments are required for a readable image.`);
  }

  const date = Number.isFinite(input.createdAt.getTime())
    ? input.createdAt.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'Asia/Kolkata' })
    : 'Date unavailable';
  const time = Number.isFinite(input.createdAt.getTime())
    ? input.createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' })
    : 'Time unavailable';

  const badgeX = WIDTH - SIDE_PADDING - 104;
  const bodyStartY = 178;
  const bodyEndY = bodyStartY + Math.max(1, lines.length) * LINE_HEIGHT;
  const height = Math.max(360, bodyEndY + 104);
  const bodyMarkup = lines.map((line, index) =>
    `<tspan x="${SIDE_PADDING}" dy="${index === 0 ? 0 : LINE_HEIGHT}">${escapeXml(line || ' ')}</tspan>`,
  ).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${height}" viewBox="0 0 ${WIDTH} ${height}">
  <rect width="${WIDTH}" height="${height}" fill="#000000"/>
  <rect x="${badgeX}" y="48" width="104" height="38" rx="8" fill="#073B20"/>
  <text x="${badgeX + 52}" y="74" text-anchor="middle" font-family="IBM Plex Sans" font-size="20" font-weight="700" letter-spacing="1.4" fill="#69F0A2">MOD</text>
  <text x="${SIDE_PADDING}" y="76" font-family="IBM Plex Sans" font-size="20" font-weight="600" fill="#69F0A2">${escapeXml(date)}  ·  ${escapeXml(time)}</text>
  <text x="${SIDE_PADDING}" y="${bodyStartY}" font-family="IBM Plex Sans" font-size="${BODY_FONT}" font-weight="700" font-style="italic" fill="#39E879">${bodyMarkup}</text>
</svg>`;
}
