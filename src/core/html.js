// Minimal HTML helpers for the static CMS pages NJAU uses (WebPlus / VSB). No DOM dependency.

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ldquo: '“', rdquo: '”', lsquo: '‘', rsquo: '’', mdash: '—', ndash: '–', hellip: '…', middot: '·', times: '×', yen: '¥', copy: '©' };

export function decodeEntities(text) {
  return String(text ?? '').replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code) => {
    if (code[0] === '#') {
      const value = code[1].toLowerCase() === 'x' ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(value) ? String.fromCodePoint(value) : match;
    }
    return ENTITIES[code.toLowerCase()] ?? match;
  });
}

export function stripTags(html) {
  return decodeEntities(String(html ?? '').replace(/<[^>]*>/g, '')).replace(/\s+/g, ' ').trim();
}

// Converts an HTML fragment to readable plain text, keeping paragraph breaks.
export function htmlToText(html) {
  return decodeEntities(String(html ?? '')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|tr|h[1-6]|section|table)>/gi, '\n')
    .replace(/<(td|th)[^>]*>/gi, ' ')
    .replace(/<[^>]*>/g, ''))
    .replace(/[ \t 　]+/g, ' ')
    .replace(/ *\n */g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function attr(tag, name) {
  const match = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return match ? decodeEntities(match[1] ?? match[2] ?? match[3]) : null;
}

// Returns the inner HTML of the first element whose opening tag matches `openPattern`,
// balancing nested tags of the same name.
export function innerOf(html, openPattern) {
  const open = openPattern.exec(html);
  if (!open) {
    return null;
  }
  const tagName = /^<\s*([a-z0-9]+)/i.exec(open[0])?.[1]?.toLowerCase();
  if (!tagName) {
    return null;
  }
  const re = new RegExp(`<\\/?${tagName}\\b[^>]*>`, 'gi');
  re.lastIndex = open.index + open[0].length;
  let depth = 1;
  let match;
  while ((match = re.exec(html))) {
    depth += match[0][1] === '/' ? -1 : 1;
    if (depth === 0) {
      return html.slice(open.index + open[0].length, match.index);
    }
  }
  return html.slice(open.index + open[0].length);
}

export function links(html) {
  const result = [];
  const re = /<a\b[^>]*>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(html))) {
    const tag = /^<a\b[^>]*>/i.exec(match[0])[0];
    result.push({ href: attr(tag, 'href'), title: attr(tag, 'title'), text: stripTags(match[1]), index: match.index, end: re.lastIndex });
  }
  return result;
}

export function absoluteUrl(href, base) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}
