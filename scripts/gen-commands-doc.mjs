// Regenerates skills/njau-cli-skill/references/commands.md from the command registry.
// Usage: node scripts/gen-commands-doc.mjs [--check]
import { readFileSync, writeFileSync } from 'node:fs';

import { toKebab } from '../src/core/args.js';
import { COMMANDS } from '../src/commands/index.js';

const TARGET = new URL('../skills/njau-cli-skill/references/commands.md', import.meta.url);
const TITLES = {
  install: '安装', doctor: '环境检查', mcp: 'MCP 服务器', network: '网络', browser: '浏览器', skill: 'Skill',
  auth: '登录', today: '今日概览', me: '个人信息', term: '学期', calendar: '校历', course: '课表', grade: '成绩',
  exam: '考试', selection: '选课结果', plan: '培养方案', progress: '学业达成', classroom: '教室',
  szjw: '教务站内消息', notice: '公开通知', portal: '网上办事大厅'
};

function usage(command) {
  const args = (command.args ?? []).map((spec) => (/[?.]$/.test(spec) ? `[${spec.replace(/\?$/, '')}]` : `<${spec}>`));
  return ['njau-cli', command.name, ...args].join(' ');
}

function options(command) {
  return Object.entries(command.options ?? {}).map(([name, def]) => {
    const flag = `--${toKebab(name)}${def.type === 'boolean' ? '' : ` <${def.type === 'number' ? 'n' : 'value'}>`}`;
    const extra = [def.description, def.choices ? `可选 ${def.choices.join('/')}` : null, def.default !== undefined ? `默认 ${def.default}` : null, def.type === 'list' ? '可重复' : null].filter(Boolean).join('；');
    return `\`${flag}\`${extra ? ` ${extra}` : ''}`;
  }).join('<br>');
}

export function render() {
  const groups = new Map();
  for (const command of COMMANDS) {
    const domain = command.name.split(' ')[0];
    groups.set(domain, [...(groups.get(domain) ?? []), command]);
  }
  let out = '# 命令参考\n\n'
    + '本文件由 `node scripts/gen-commands-doc.mjs` 根据命令注册表生成，请勿手改。\n\n'
    + '每条命令都支持 `--help`（以 JSON 返回参数说明）和 `--format table`（输出便于人读的表格）。“需要登录”一列为“是”的命令，要先运行 `njau-cli auth login`。\n';
  for (const [domain, list] of groups) {
    out += `\n## ${TITLES[domain] ?? domain}\n\n| 命令 | 说明 | 选项 | 需要登录 |\n|---|---|---|---|\n`;
    for (const command of list) {
      out += `| \`${usage(command)}\` | ${command.summary.replace(/\|/g, '/')} | ${options(command) || '—'} | ${command.requiresLogin ? '是' : '否'} |\n`;
    }
  }
  return out;
}

const text = render();
if (process.argv.includes('--check')) {
  if (readFileSync(TARGET, 'utf8') !== text) {
    console.error('commands.md is stale; run `node scripts/gen-commands-doc.mjs`.');
    process.exit(1);
  }
  console.log('commands.md is up to date.');
} else {
  writeFileSync(TARGET, text);
  console.log(`Wrote ${text.split('\n').length} lines.`);
}
