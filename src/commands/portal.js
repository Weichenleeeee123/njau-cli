import { CliError } from '../core/errors.js';
import { withSession } from '../core/session.js';

// 网上办事大厅 myportal.njau.edu.cn（金智 AMP）。jsonp 接口不带 callback 时直接返回 JSON。
const PORTAL = 'https://myportal.njau.edu.cn';

export function normalizeApp(app) {
  return {
    id: app.appId,
    name: app.appName,
    categories: (app.categoryList ?? []).map((category) => category.categoryName),
    description: app.description && app.description !== app.appName ? app.description : null,
    canUse: app.hasPermission !== false,
    maintaining: Boolean(app.maintaining),
    url: `${PORTAL}/appShow?appId=${app.appId}`
  };
}

export function searchApps(apps, { keyword, category, all } = {}) {
  const terms = String(keyword ?? '').split(/\s+/).filter(Boolean);
  return apps
    .filter((app) => all || app.canUse)
    .filter((app) => !category || app.categories.some((name) => name.includes(category)))
    .filter((app) => terms.every((term) => `${app.name}${app.description ?? ''}${app.categories.join('')}`.includes(term)));
}

async function loadApps(session) {
  const data = await session.requestJson(`${PORTAL}/jsonp/serviceCenterData.json?containLabels=true&searchKey=`);
  if (data?.hasLogin === false) {
    throw new CliError('LOGIN_REQUIRED', 'Not logged in to the NJAU portal.', { hint: 'Run `njau-cli auth login`.' });
  }
  return (data?.searchResult ?? []).map(normalizeApp);
}

export default [
  {
    name: 'portal apps',
    summary: '网上办事大厅应用目录：按关键词/分类找到办事入口（请假、报修、奖助学金…）',
    requiresLogin: true,
    args: ['keyword...'],
    options: {
      category: { type: 'string', description: '分类关键字，如 学生管理 / 后勤服务' },
      all: { type: 'boolean', description: '包含当前账号无权限的应用' },
      limit: { type: 'number', default: 50, min: 1 }
    },
    examples: ['njau-cli portal apps 请假', 'njau-cli portal apps --category 后勤服务'],
    run: ({ args, options }) => withSession(async (session) => {
      const items = searchApps(await loadApps(session), { keyword: args.keyword, category: options.category, all: options.all });
      return { total: items.length, items: items.slice(0, options.limit) };
    })
  },
  {
    name: 'portal categories',
    summary: '办事大厅应用分类及数量',
    requiresLogin: true,
    run: () => withSession(async (session) => {
      const counts = new Map();
      for (const app of await loadApps(session)) {
        for (const name of app.categories) {
          counts.set(name, (counts.get(name) ?? 0) + 1);
        }
      }
      return { items: [...counts].map(([name, apps]) => ({ name, apps })).sort((a, b) => b.apps - a.apps) };
    })
  },
  {
    name: 'portal reminders',
    summary: '办事大厅个人提醒（邮件、云盘等）与未读消息数',
    requiresLogin: true,
    run: () => withSession(async (session) => {
      const view = await session.requestJson(`${PORTAL}/jsonp/personalRemind/getView.do`);
      const items = [];
      for (const entry of view?.visibleList ?? []) {
        const detail = await session.requestJson(`${PORTAL}/jsonp/personalRemind/getViewDataDetail.do?wid=${entry.wid}&mailAccount=`).catch(() => null);
        const first = Array.isArray(detail) ? detail[0] : null;
        items.push({ title: entry.title, info: first?.imptInfo ?? entry.imptInfo ?? null, link: first?.linkUrl ?? entry.linkUrl ?? null });
      }
      const messages = await session.requestJson(`${PORTAL}/jsonp/getTaskMessageCount`).catch(() => null);
      return { unreadMessages: messages?.taskSideMessageBiz?.totalSize ?? null, items };
    })
  }
];
