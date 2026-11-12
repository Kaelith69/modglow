/** Escape user supplied content before placing it in SVG text nodes. */
export function escapeXml(value: string): string {
  // XML 1.0 forbids most C0 controls and unpaired UTF-16 surrogate code points.
  const xmlSafe = Array.from(value).filter((character) => {
    const codePoint = character.codePointAt(0)!;
    return codePoint === 0x09 || codePoint === 0x0a || codePoint === 0x0d
      || (codePoint >= 0x20 && codePoint <= 0xd7ff)
      || (codePoint >= 0xe000 && codePoint <= 0xfffd)
      || (codePoint >= 0x10000 && codePoint <= 0x10ffff);
  }).join('');

  return xmlSafe
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

/**
 * Convert the small, common subset of Reddit Markdown to readable plain text.
 * This deliberately does not interpret raw HTML or execute embedded content.
 */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(/\r\n?/g, '\n')
    .replace(/```[^\n]*\n?/g, '')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '$1')
    .replace(/<https?:\/\/([^>]+)>/g, 'https://$1')
    .replace(/<\/?[A-Za-z][^>]*>/g, '')
    .replace(/^\s{0,3}#{1,6}\s+/gm, '')
    .replace(/^\s{0,3}>\s?/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '• ')
    .replace(/^\s*\d+[.)]\s+/gm, '• ')
    .replace(/\*\*(.*?)\*\*/g, '$1')
    .replace(/__(.*?)__/g, '$1')
    .replace(/\*(.*?)\*/g, '$1')
    .replace(/_(.*?)_/g, '$1')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\\([\\`*_{}\[\]()#+\-.!>])/g, '$1')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Wrap text without splitting words; long URLs/tokens are split safely. */
export function wrapText(text: string, maxCharacters: number): string[] {
  if (!Number.isInteger(maxCharacters) || maxCharacters < 1) {
    throw new RangeError('maxCharacters must be a positive integer.');
  }

  const output: string[] = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.length === 0) {
      output.push('');
      continue;
    }

    const words = paragraph.split(/\s+/);
    let line = '';

    for (const word of words) {
      if (word.length > maxCharacters) {
        if (line) {
          output.push(line);
          line = '';
        }
        for (let offset = 0; offset < word.length; offset += maxCharacters) {
          output.push(word.slice(offset, offset + maxCharacters));
        }
        continue;
      }

      const candidate = line ? `${line} ${word}` : word;
      if (candidate.length > maxCharacters && line) {
        output.push(line);
        line = word;
      } else {
        line = candidate;
      }
    }

    if (line) output.push(line);
  }

  return output.length ? output : [''];
}

export function relativeTime(date: Date, now = new Date()): string {
  if (!Number.isFinite(date.getTime())) return 'date unavailable';
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return date.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Estimate IBM Plex Sans glyph width to keep rendered SVG lines inside the card. */
export function wrapTextByWidth(text: string, maxWidthPx: number, fontSizePx: number): string[] {
  if (!Number.isFinite(maxWidthPx) || maxWidthPx <= 0) {
    throw new RangeError('maxWidthPx must be a positive finite number.');
  }
  if (!Number.isFinite(fontSizePx) || fontSizePx <= 0) {
    throw new RangeError('fontSizePx must be a positive finite number.');
  }

  const glyphWidth = (character: string): number => {
    if (/\s/.test(character)) return fontSizePx * 0.28;
    if (/[ilI.,'`!:;|]/.test(character)) return fontSizePx * 0.28;
    if (/[MW@%#&]/.test(character)) return fontSizePx * 0.86;
    if (/[A-Z]/.test(character)) return fontSizePx * 0.64;
    if (/[0-9]/.test(character)) return fontSizePx * 0.56;
    if (character.codePointAt(0)! > 0xffff) return fontSizePx;
    return fontSizePx * 0.52;
  };

  const widthOf = (value: string): number => [...value].reduce((total, character) => total + glyphWidth(character), 0);
  const output: string[] = [];

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      output.push('');
      continue;
    }

    let line = '';
    for (const word of paragraph.split(/\s+/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (widthOf(candidate) <= maxWidthPx) {
        line = candidate;
        continue;
      }

      if (line) output.push(line);

      if (widthOf(word) <= maxWidthPx) {
        line = word;
        continue;
      }

      let fragment = '';
      for (const character of word) {
        if (fragment && widthOf(fragment + character) > maxWidthPx) {
          output.push(fragment);
          fragment = character;
        } else {
          fragment += character;
        }
      }
      line = fragment;
    }

    if (line) output.push(line);
  }

  return output.length ? output : [''];
}
