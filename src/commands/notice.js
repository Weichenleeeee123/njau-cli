import { CliError } from '../core/errors.js';
import { addDays, resolveDate, today } from '../core/time.js';
import {
  DEFAULT_SOURCES,
  downloadAttachments,
  fetchNoticePage,
  listNotices,
  listSources,
  SOURCES,
  viewNotice
} from '../modules/notice.js';

const SOURCE_OPTION = {
  source: { type: 'list', description: `来源，可重复：${Object.keys(SOURCES).join(' / ')}；默认 www + aao` }
};

function sourcesFrom(options) {
  const list = options.source?.length ? options.source.flatMap((value) => value.split(',')) : DEFAULT_SOURCES;
  return list.includes('all') ? Object.keys(SOURCES).filter((id) => !['news', 'focus', 'aao-news'].includes(id)) : list;
}

export default [
  {
    name: 'notice sources',
    summary: '可用的公开通知来源（无需登录）',
    run: () => ({ items: listSources() })
  },
  {
    name: 'notice list',
    summary: '最新通知公告（学校通知、教务处等，无需登录）',
    options: {
      ...SOURCE_OPTION,
      page: { type: 'number', default: 1, min: 1 },
      pages: { type: 'number', default: 1, min: 1, max: 10, description: '连续抓取的页数' },
      limit: { type: 'number', default: 20, min: 1, max: 500 },
      days: { type: 'number', min: 1, description: '只看最近 N 天' }
    },
    examples: ['njau-cli notice list', 'njau-cli notice list --source aao --limit 10', 'njau-cli notice list --source events --days 7'],
    run: ({ options }) => listNotices({
      sources: sourcesFrom(options),
      page: options.page,
      pages: options.pages,
      limit: options.limit,
      since: options.days ? addDays(today(), -options.days) : undefined
    })
  },
  {
    name: 'notice search',
    summary: '按标题关键词检索通知（扫描前若干页，无需登录）',
    args: ['keyword...'],
    options: {
      ...SOURCE_OPTION,
      pages: { type: 'number', default: 5, min: 1, max: 30, description: '每个来源扫描的页数' },
      limit: { type: 'number', default: 30, min: 1 },
      since: { type: 'string', description: '起始日期，如 2026-09-01' }
    },
    examples: ['njau-cli notice search 奖学金', 'njau-cli notice search 选课 --source aao --pages 10'],
    run: ({ args, options }) => listNotices({
      sources: sourcesFrom(options),
      pages: options.pages,
      limit: options.limit,
      keyword: args.keyword,
      since: options.since ? resolveDate(options.since) : undefined
    })
  },
  {
    name: 'notice view',
    summary: '读取通知正文、附件与图片链接',
    args: ['url'],
    run: ({ args }) => viewNotice(args.url)
  },
  {
    name: 'notice download',
    summary: '下载通知附件到本地目录',
    args: ['url'],
    options: {
      dir: { type: 'string', default: 'downloads' },
      index: { type: 'number', min: 1, description: '只下载第 N 个附件' }
    },
    run: ({ args, options }) => downloadAttachments(args.url, options)
  },
  {
    name: 'calendar school',
    summary: '教务处发布的学年教学日历（校历）文件',
    options: { year: { type: 'string', description: '学年关键字，如 2026-2027；默认最新' } },
    run: async ({ options }) => {
      const page = await fetchNoticePage('aao-calendar', 1);
      const item = options.year ? page.items.find((entry) => entry.title.includes(options.year)) : page.items[0];
      if (!item) {
        throw new CliError('NOT_FOUND', `No teaching calendar found for ${options.year}.`, { details: { available: page.items.map((entry) => entry.title) } });
      }
      const article = await viewNotice(item.url);
      return { title: article.title, date: article.date, url: article.url, files: article.attachments, available: page.items.map((entry) => entry.title) };
    }
  }
];
