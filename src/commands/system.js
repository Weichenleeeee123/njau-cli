import { getBrowserStatus, installManagedChromium, selectBrowser } from '../core/browser.js';
import { installGlobal } from '../core/install.js';
import { getSkillPath, installSkill } from '../core/skill.js';
import { login, logout, status } from '../modules/auth.js';
import { getDoctorReport } from '../modules/doctor.js';
import { checkNetwork, NJAU_HOSTS } from '../modules/network.js';

export default [
  {
    name: 'install',
    summary: '全局安装 njau-cli 并把随包 skill 装到常见 AI Agent',
    run: ({ packageInfo }) => installGlobal({ packageName: packageInfo.name, packageVersion: packageInfo.version })
  },
  {
    name: 'doctor',
    summary: '检查 Node、Playwright、浏览器、登录 profile 与南农站点连通性',
    options: { offline: { type: 'boolean', description: '跳过网络探测' } },
    run: ({ options, packageInfo }) => getDoctorReport({ packageInfo, offline: options.offline })
  },
  {
    name: 'mcp',
    summary: '以 MCP (stdio) 服务器方式运行，把只读命令暴露为工具，供 Claude Code / Cursor 等调用',
    run: () => {
      throw new Error('`njau-cli mcp` is handled by the entry point.');
    }
  },
  {
    name: 'network check',
    summary: '探测各南农站点是否可达，识别代理 fake-ip 并给出直连建议',
    options: {
      only: { type: 'list', description: `只检查指定站点：${NJAU_HOSTS.map((host) => host.id).join('/')}` },
      timeout: { type: 'number', default: 10000, min: 1000 }
    },
    run: ({ options }) => checkNetwork({ only: options.only.length ? options.only : null, timeout: options.timeout })
  },
  {
    name: 'browser status',
    summary: '查看当前选用的浏览器与 profile 路径',
    run: () => getBrowserStatus()
  },
  {
    name: 'browser use',
    summary: '选择 chrome / edge / chromium',
    args: ['browser'],
    run: ({ args }) => selectBrowser(args.browser)
  },
  {
    name: 'browser install',
    summary: '下载 Playwright Chromium（需 --yes 确认）',
    args: ['browser?'],
    options: { yes: { type: 'boolean' } },
    run: ({ options }) => installManagedChromium({ yes: options.yes })
  },
  {
    name: 'skill path',
    summary: '输出随包 agent skill 的路径',
    run: () => getSkillPath()
  },
  {
    name: 'skill install',
    summary: '把 skill 安装到 codex / claudecode / workbuddy / ai-ide',
    options: {
      target: { type: 'string', default: 'codex', choices: ['codex', 'ai-ide', 'workbuddy', 'claudecode'] },
      dir: { type: 'string' },
      dest: { type: 'string' }
    },
    run: ({ options }) => installSkill(options)
  },
  {
    name: 'auth status',
    summary: '检查浏览器 profile 是否已登录统一身份认证',
    options: {
      deep: { type: 'boolean', description: '同时检查数智教务平台单点登录' },
      url: { type: 'string' }
    },
    run: ({ options }) => status(options)
  },
  {
    name: 'auth login',
    summary: '打开可见浏览器，由用户本人完成统一身份认证登录',
    options: {
      url: { type: 'string' },
      timeout: { type: 'number', default: 300000, min: 10000 },
      keepOpen: { type: 'boolean', description: '登录成功后保持窗口直到手动关闭' },
      noWarmup: { type: 'boolean', description: '登录后不预热各业务系统' }
    },
    run: ({ options }) => login({ ...options, warmup: !options.noWarmup })
  },
  {
    name: 'auth logout',
    summary: '删除 njau-cli 专用浏览器 profile（清除登录态）',
    run: () => logout()
  }
];
