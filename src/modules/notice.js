import { mkdir, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';

import { CliError } from '../core/errors.js';
import { absoluteUrl, attr, htmlToText, innerOf, links, stripTags } from '../core/html.js';
import { fetchBuffer, fetchText } from '../core/http.js';

// Public notice boards. `cms` decides list/article parsing:
//   webplus — www.njau.edu.cn (list.htm, list2.htm …; article URLs carry the date)
//   vsb     — 博达 VSB sites such as aao.njau.edu.cn (tzgg.htm, then tzgg/<N-1>.htm … tzgg/1.htm)
export const SOURCES = {
  www: { label: '学校通知', cms: 'webplus', base: 'https://www.njau.edu.cn', column: 'tzgg_1094' },
  events: { label: '科研文化活动预告（学术报告/讲座）', cms: 'webplus', base: 'https://www.njau.edu.cn', column: '1096' },
  announce: { label: '学校其他公告', cms: 'webplus', base: 'https://www.njau.edu.cn', column: '1097' },
  news: { label: '南农要闻', cms: 'webplus', base: 'https://www.njau.edu.cn', column: 'nnyw' },
  focus: { label: '南农聚焦（媒体报道）', cms: 'webplus', base: 'https://www.njau.edu.cn', column: 'mtnn' },
  aao: { label: '教务处通知公告', cms: 'vsb', base: 'https://aao.njau.edu.cn', column: 'tzgg' },
  'aao-news': { label: '教务处教学新闻', cms: 'vsb', base: 'https://aao.njau.edu.cn', column: 'jyjxxw' },
  'aao-download': { label: '教务处下载中心（表格/文件）', cms: 'vsb', base: 'https://aao.njau.edu.cn', column: 'xzzx' },
  'aao-calendar': { label: '教学日历（校历）', cms: 'vsb', base: 'https://aao.njau.edu.cn', column: 'jxrl1' }
};

export const DEFAULT_SOURCES = ['www', 'aao'];

export function getSource(id) {
  const source = SOURCES[id];
  if (!source) {
    throw new CliError('INVALID_ARGUMENT', `Unknown notice source: ${id}`, { hint: `Available: ${Object.keys(SOURCES).join(', ')}` });
  }
  return { id, ...source };
}

export function listSources() {
  return Object.entries(SOURCES).map(([id, source]) => ({ id, label: source.label, url: firstPageUrl({ id, ...source }) }));
}

function firstPageUrl(source) {
  return source.cms === 'webplus' ? `${source.base}/${source.column}/list.htm` : `${source.base}/${source.column}.htm`;
}

// ---------- list parsing ----------

const WEBPLUS_ARTICLE = /\/(\d{4})\/(\d{2})(\d{2})\/c\d+a\d+\/page\.htm$/;

export function parseWebplusList(html, pageUrl) {
  const listHtml = innerOf(html, /<div[^>]+id="wp_news_w\d+"[^>]*>/i) ?? innerOf(html, /<div[^>]+class="[^"]*col_news_list[^"]*"[^>]*>/i) ?? html;
  const seen = new Set();
  const items = [];
  for (const link of links(listHtml)) {
    const url = absoluteUrl(link.href, pageUrl);
    if (!url || seen.has(url)) {
      continue;
    }
    const path = new URL(url).pathname;
    const match = WEBPLUS_ARTICLE.exec(path);
    const external = /mp\.weixin\.qq\.com|_redirect/.test(url);
    if (!match && !external) {
      continue;
    }
    const title = (link.title || link.text || '').trim();
    if (!title) {
      continue;
    }
    seen.add(url);
    const nearby = listHtml.slice(Math.max(0, link.index - 400), link.index);
    const shownDate = /(\d{4})[.\-/](\d{2})[.\-/](\d{2})(?![\s\S]*\d{4}[.\-/]\d{2}[.\-/]\d{2})/.exec(nearby);
    const date = match ? `${match[1]}-${match[2]}-${match[3]}` : shownDate ? `${shownDate[1]}-${shownDate[2]}-${shownDate[3]}` : null;
    const [, publisher] = /^([^|｜]{1,12})\s*[|｜]\s*/.exec(title) ?? [];
    items.push({ title, date, url, ...(publisher ? { publisher: publisher.trim() } : {}), ...(external ? { external: true } : {}) });
  }
  const pages = Number(/class="all_pages">(\d+)</.exec(html)?.[1] ?? 1);
  return { items, pages };
}

export function parseVsbList(html, pageUrl) {
  const listHtml = innerOf(html, /<ul[^>]+class="[^"]*news_list[^"]*"[^>]*>/i) ?? html;
  const items = [];
  const seen = new Set();
  for (const link of links(listHtml)) {
    if (!/info\/\d+\/\d+\.htm/.test(link.href ?? '')) {
      continue;
    }
    const url = absoluteUrl(link.href, pageUrl);
    if (seen.has(url)) {
      continue;
    }
    seen.add(url);
    const after = listHtml.slice(link.end, link.end + 300);
    const date = /(\d{4})[-./年](\d{1,2})[-./月](\d{1,2})/.exec(after);
    items.push({
      title: (link.title || link.text).trim(),
      date: date ? `${date[1]}-${date[2].padStart(2, '0')}-${date[3].padStart(2, '0')}` : null,
      url
    });
  }
  const paging = /共(\d+)条(?:&nbsp;|\s)*\d+\/(\d+)/.exec(html);
  return { items, pages: paging ? Number(paging[2]) : 1, total: paging ? Number(paging[1]) : items.length };
}

export function pageUrl(source, page, pages) {
  if (page <= 1) {
    return firstPageUrl(source);
  }
  if (source.cms === 'webplus') {
    return `${source.base}/${source.column}/list${page}.htm`;
  }
  if (!pages) {
    throw new CliError('INVALID_ARGUMENT', 'Total page count is required for VSB paging.');
  }
  return `${source.base}/${source.column}/${pages - page + 1}.htm`;
}

export async function fetchNoticePage(sourceId, page = 1) {
  const source = getSource(sourceId);
  const parse = source.cms === 'webplus' ? parseWebplusList : parseVsbList;
  const firstUrl = firstPageUrl(source);
  if (page <= 1 || source.cms === 'webplus') {
    const url = pageUrl(source, page);
    const result = parse(await fetchText(url), url);
    return { source: source.id, label: source.label, page, ...result, url };
  }
  const first = parse(await fetchText(firstUrl), firstUrl);
  if (page > first.pages) {
    return { source: source.id, label: source.label, page, items: [], pages: first.pages, url: firstUrl };
  }
  const url = pageUrl(source, page, first.pages);
  const result = parse(await fetchText(url), url);
  return { source: source.id, label: source.label, page, ...result, url };
}

export async function listNotices({ sources = DEFAULT_SOURCES, page = 1, pages = 1, limit = 20, since, keyword } = {}) {
  const errors = [];
  const items = [];
  for (const sourceId of sources) {
    for (let current = page; current < page + pages; current += 1) {
      try {
        const result = await fetchNoticePage(sourceId, current);
        items.push(...result.items.map((item) => ({ ...item, source: sourceId, sourceLabel: result.label })));
        if (current >= result.pages) {
          break;
        }
      } catch (error) {
        errors.push({ source: sourceId, page: current, code: error.code ?? 'UNKNOWN_ERROR', message: error.message });
        break;
      }
    }
  }
  if (!items.length && errors.length) {
    throw new CliError(errors[0].code, errors[0].message, { details: { errors } });
  }
  const terms = keyword ? String(keyword).split(/\s+/).filter(Boolean) : [];
  const filtered = items
    .filter((item) => !since || (item.date && item.date >= since))
    .filter((item) => terms.every((term) => item.title.includes(term) || item.publisher?.includes(term)))
    .sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return {
    total: filtered.length,
    items: filtered.slice(0, limit),
    ...(errors.length ? { errors } : {})
  };
}

// ---------- article parsing ----------

const FILE_EXT = /\.(pdf|docx?|xlsx?|pptx?|zip|rar|7z|txt|wps|et|jpg|png)(\?|$)/i;

export function parseArticle(html, url) {
  const title = stripTags(innerOf(html, /<h1[^>]*class="[^"]*arti_title[^"]*"[^>]*>/i) ?? '')
    || stripTags(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '').replace(/-南京农业大学.*$/, '');
  const metaHtml = innerOf(html, /<p[^>]*class="[^"]*arti_metas[^"]*"[^>]*>/i) ?? '';
  const meta = stripTags(metaHtml);
  const dateMatch = /(\d{4})[-/年.](\d{1,2})[-/月.](\d{1,2})日?(?:\s*(\d{1,2}:\d{2}))?/.exec(meta) ?? /\/(\d{4})\/(\d{2})(\d{2})\//.exec(url);
  const contentHtml = innerOf(html, /<div[^>]*class="[^"]*wp_articlecontent[^"]*"[^>]*>/i)
    ?? innerOf(html, /<div[^>]*class="[^"]*v_news_content[^"]*"[^>]*>/i)
    ?? innerOf(html, /<div[^>]*class="[^"]*\bread\b[^"]*"[^>]*>/i)
    ?? '';

  const attachments = [];
  const pushAttachment = (name, href) => {
    const absolute = absoluteUrl(href, url);
    if (absolute && !attachments.some((item) => item.url === absolute)) {
      attachments.push({ name: name || decodeURIComponent(basename(new URL(absolute).pathname)), url: absolute });
    }
  };
  for (const link of links(html)) {
    if (!link.href) {
      continue;
    }
    if (/download\.jsp|DownloadAttachUrl/.test(link.href) || (FILE_EXT.test(link.href) && /_upload|__local|\/system\//.test(link.href))) {
      pushAttachment(link.text || link.title, link.href);
    }
  }
  for (const match of html.matchAll(/showVsbpdfIframe\("([^"]+\.pdf)"/g)) {
    pushAttachment(`${title}.pdf`, match[1]);
  }
  for (const match of html.matchAll(/pdfsrc=["']([^"']+)["']/gi)) {
    pushAttachment(`${title}.pdf`, match[1]);
  }

  const images = [];
  for (const match of contentHtml.matchAll(/<img\b[^>]*>/gi)) {
    const src = attr(match[0], 'src') || attr(match[0], 'original-src') || attr(match[0], 'data-imgsrc');
    const absolute = src ? absoluteUrl(src, url) : null;
    if (absolute && !/\/images\/|logo/i.test(absolute)) {
      images.push(absolute);
    }
  }

  const text = htmlToText(contentHtml);
  return {
    title,
    date: dateMatch ? `${dateMatch[1]}-${String(dateMatch[2]).padStart(2, '0')}-${String(dateMatch[3]).padStart(2, '0')}` : null,
    ...(dateMatch?.[4] ? { time: dateMatch[4] } : {}),
    publisher: /来源[:：]\s*([^\s作]+)/.exec(meta)?.[1] ?? null,
    author: /作者[:：]\s*(\S+)/.exec(meta)?.[1] ?? null,
    url,
    text: text || (attachments.some((item) => /\.pdf/i.test(item.url)) ? '（正文为 PDF，见 attachments）' : ''),
    attachments,
    ...(images.length ? { images } : {})
  };
}

export async function viewNotice(target) {
  const url = normalizeTarget(target);
  return parseArticle(await fetchText(url), url);
}

export function normalizeTarget(target) {
  const value = String(target ?? '').trim();
  if (/^https?:\/\//i.test(value)) {
    const host = new URL(value).hostname;
    if (!/(^|\.)njau\.edu\.cn$/i.test(host)) {
      throw new CliError('INVALID_ARGUMENT', 'Only njau.edu.cn pages are supported.');
    }
    return value;
  }
  if (/^\/?\d{4}\/\d{4}\/c\d+a\d+\/page\.htm$/.test(value)) {
    return `https://www.njau.edu.cn/${value.replace(/^\//, '')}`;
  }
  if (/^info\/\d+\/\d+\.htm$/.test(value)) {
    return `https://aao.njau.edu.cn/${value}`;
  }
  throw new CliError('INVALID_ARGUMENT', `Pass a notice URL from \`notice list\`, got: ${target}`);
}

export async function downloadAttachments(target, options = {}) {
  const article = await viewNotice(target);
  const selected = options.index ? article.attachments.filter((_, index) => index + 1 === Number(options.index)) : article.attachments;
  if (!selected.length) {
    throw new CliError('DOWNLOAD_UNAVAILABLE', 'This notice has no downloadable attachments.', { details: { url: article.url } });
  }
  const dir = resolve(options.dir ?? 'downloads');
  await mkdir(dir, { recursive: true });
  const saved = [];
  for (const attachment of selected) {
    const { buffer, disposition } = await fetchBuffer(attachment.url);
    const name = safeFileName(fileNameFromDisposition(disposition) ?? attachment.name);
    const path = join(dir, name);
    await writeFile(path, buffer);
    saved.push({ name, path, bytes: buffer.length, url: attachment.url });
  }
  return { title: article.title, dir, files: saved };
}

function fileNameFromDisposition(value) {
  if (!value) {
    return null;
  }
  const star = /filename\*=UTF-8''([^;]+)/i.exec(value);
  if (star) {
    return decodeURIComponent(star[1]);
  }
  const plain = /filename="?([^";]+)"?/i.exec(value);
  if (!plain) {
    return null;
  }
  // Servers often send raw UTF-8 bytes that fetch exposes as latin1 characters.
  const decoded = Buffer.from(plain[1], 'latin1').toString('utf8');
  return decoded.includes('�') ? plain[1] : decoded;
}

function safeFileName(name) {
  return String(name ?? 'attachment').replace(/[\\/:*?"<>|\r\n]+/g, '_').slice(0, 150) || 'attachment';
}
