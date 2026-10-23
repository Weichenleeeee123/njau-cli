import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';

import { fixtureKey } from '../src/core/http.js';
import { htmlToText, innerOf } from '../src/core/html.js';
import { normalizeTarget, pageUrl, parseArticle, parseVsbList, parseWebplusList, SOURCES } from '../src/modules/notice.js';
import { runCli } from './helpers.js';

const WEBPLUS_LIST = `
<div class="sidebar"><a href="/2020/0101/c1a1/page.htm" title="侧栏不应出现">侧栏</a></div>
<div id="wp_news_w6"><ul class="news_list">
  <li class="news n1"><div class="news_time">2026.10.23</div>
    <a class="news_con" href="/2026/1022/c1094a142923/page.htm"><div class="news_title"><a href='/2026/1022/c1094a142923/page.htm' title='关于申报课题的通知'>关于申报课题的通知</a></div></a></li>
  <li class="news n2"><div class="news_time">2026.10.20</div>
    <div class="news_title"><a href='/2026/1020/c1094a142878/page.htm' title='外语院 | 选题经验分享会'>外语院 | 选题经验分享会</a></div></li>
</ul></div>
<span class="pages">页码&nbsp;<em class="curr_page">1</em>/<em class="all_pages">3</em></span>`;

const VSB_LIST = `
<ul class="news_list list2">
  <li class="news n clearfix"><span class="news_title"><a href="info/1101/7002.htm" title="关于校运动会期间停课的通知">关于校运动会期间停课的通知</a></span><span class="news_meta">2026-10-16</span></li>
  <li class="news n clearfix"><span class="news_title"><a href="info/1104/6573.htm" title="转专业报到单">转专业报到单</a></span><span class="news_meta">2026-03-02</span></li>
</ul>
<td id="fanye234609">共1653条&nbsp;&nbsp;1/83&nbsp;</td>`;

const WEBPLUS_ARTICLE = `
<h1 class="arti_title">关于临时交通管制的通知</h1>
<p class="arti_metas"><span class="arti_update">2026/10/15</span><span class="arti_from">来源：保卫处</span><span class="arti_author">作者：某某</span></p>
<div class="read"><div class='wp_articlecontent'><p>第一段&nbsp;内容。</p><p>第二段<br/>换行</p>
<a href="/_upload/article/files/ab/cd/form.docx">附件表格.docx</a></div></div>`;

const VSB_ARTICLE = `
<h1 class="arti_title">2026-2027学年教学日历</h1>
<p class="arti_metas"><span class="arti_update">发布时间：2026年06月15日 09:29</span></p>
<div class="v_news_content"><script>showVsbpdfIframe("/__local/C/33/2E/abc.pdf","100%","600")</script></div>
<ul><li>附件【<a href="/system/_content/download.jsp?urltype=news.DownloadAttachUrl&amp;owner=1&amp;wbfileid=2">教学日历.pdf</a>】</li></ul>`;

test('htmlToText keeps paragraphs and decodes entities', () => {
  assert.equal(htmlToText('<p>a&nbsp;b</p><p>c<br>d</p>'), 'a b\nc\nd');
  assert.equal(innerOf('<div class="x"><div>in</div>tail</div>after', /<div class="x">/), '<div>in</div>tail');
});

test('WebPlus list: dates from URL, publisher prefix, ignores sidebars', () => {
  const { items, pages } = parseWebplusList(WEBPLUS_LIST, 'https://www.njau.edu.cn/tzgg_1094/list.htm');
  assert.equal(pages, 3);
  assert.equal(items.length, 2);
  assert.deepEqual(items[0], { title: '关于申报课题的通知', date: '2026-10-22', url: 'https://www.njau.edu.cn/2026/1022/c1094a142923/page.htm' });
  assert.equal(items[1].publisher, '外语院');
});

test('VSB list: dates, total and page count', () => {
  const result = parseVsbList(VSB_LIST, 'https://aao.njau.edu.cn/tzgg.htm');
  assert.equal(result.pages, 83);
  assert.equal(result.total, 1653);
  assert.equal(result.items[0].url, 'https://aao.njau.edu.cn/info/1101/7002.htm');
  assert.equal(result.items[0].date, '2026-10-16');
});

test('paging URLs follow each CMS convention', () => {
  assert.equal(pageUrl({ ...SOURCES.www }, 3), 'https://www.njau.edu.cn/tzgg_1094/list3.htm');
  assert.equal(pageUrl({ ...SOURCES.aao }, 1), 'https://aao.njau.edu.cn/tzgg.htm');
  assert.equal(pageUrl({ ...SOURCES.aao }, 2, 83), 'https://aao.njau.edu.cn/tzgg/82.htm');
});

test('article parsing extracts meta, text and attachments', () => {
  const article = parseArticle(WEBPLUS_ARTICLE, 'https://www.njau.edu.cn/2026/1015/c1094a142765/page.htm');
  assert.equal(article.title, '关于临时交通管制的通知');
  assert.equal(article.date, '2026-10-15');
  assert.equal(article.publisher, '保卫处');
  assert.match(article.text, /第一段 内容。\n第二段\n换行/);
  assert.equal(article.attachments[0].name, '附件表格.docx');

  const pdf = parseArticle(VSB_ARTICLE, 'https://aao.njau.edu.cn/info/1074/6866.htm');
  assert.equal(pdf.date, '2026-06-15');
  assert.equal(pdf.time, '09:29');
  assert.equal(pdf.attachments.length, 2);
  assert.ok(pdf.attachments.some((item) => item.url.endsWith('/__local/C/33/2E/abc.pdf')));
  assert.ok(pdf.attachments.some((item) => item.url.includes('wbfileid=2')));
});

test('normalizeTarget accepts URLs and short paths, rejects other hosts', () => {
  assert.equal(normalizeTarget('info/1101/7002.htm'), 'https://aao.njau.edu.cn/info/1101/7002.htm');
  assert.equal(normalizeTarget('/2026/1015/c1094a142765/page.htm'), 'https://www.njau.edu.cn/2026/1015/c1094a142765/page.htm');
  assert.throws(() => normalizeTarget('https://example.com/a'), { code: 'INVALID_ARGUMENT' });
});

test('CLI notice list merges sources and filters by keyword (HTTP fixtures)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'njau-http-'));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, fixtureKey('https://www.njau.edu.cn/tzgg_1094/list.htm')), WEBPLUS_LIST);
  writeFileSync(join(dir, fixtureKey('https://aao.njau.edu.cn/tzgg.htm')), VSB_LIST);
  const env = { NJAU_HTTP_FIXTURES: dir, NJAU_BROWSER_BACKEND: '' };
  const all = runCli(['notice', 'list'], env);
  assert.equal(all.status, 0, all.stdout);
  assert.deepEqual(all.json.data.items.map((item) => item.date), ['2026-10-22', '2026-10-20', '2026-10-16', '2026-03-02']);
  const search = runCli(['notice', 'search', '停课'], env);
  assert.equal(search.json.data.items.length, 1);
  assert.equal(search.json.data.items[0].source, 'aao');
});
