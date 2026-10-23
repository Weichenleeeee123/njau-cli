# NJAU-CLI · 南京农业大学校园服务命令行

[![Node.js >=20](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](package.json)
[![npm](https://img.shields.io/npm/v/njau-cli)](https://www.npmjs.com/package/njau-cli)
[![CI](https://github.com/Weichenleeeee123/njau-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/Weichenleeeee123/njau-cli/actions/workflows/ci.yml)
[![License MIT](https://img.shields.io/badge/license-MIT-green)](LICENSE)

`njau-cli` 是面向南京农业大学网页服务的 agent-friendly CLI：把课表、成绩、考试、空教室、通知、办事入口整理成稳定命令。默认输出结构化 JSON，内置 MCP 服务器，可以直接交给 Claude Code、Cursor、Codex 等 AI Agent 调用。

- **不保存密码**：用户在 CLI 打开的浏览器窗口里自己完成统一身份认证，CLI 只复用本机的登录态。
- **只读**：不提供选课、请假、报修等写操作；这类事务给出办事大厅入口，由用户自己去办。
- **非官方**：本项目基于 [szu-cli](https://github.com/AwesomeHou/szu-cli)（MIT）改写，与学校无隶属关系，数据以学校系统为准。

## 快速开始

需要 Node.js 20 及以上，以及 Chrome 或 Edge。

```bash
npm install --global njau-cli     # 或在仓库里运行 npm install && npm link
njau-cli doctor                   # 检查环境和各南农站点的连通性
njau-cli auth login               # 在弹出的浏览器里登录统一身份认证（建议勾选“7天免登录”）
njau-cli today --format table     # 今日概览
```

> 在校内开着 Clash 等代理时，数智教务平台可能打不开，请先运行 `njau-cli network check`，再按 [docs/network.md](docs/network.md) 设置直连和校园 DNS。

## 能做什么

| 模块 | 命令示例 | 说明 |
|---|---|---|
| 今日概览 | `njau-cli today` | 今天/明天的课、下一节课、14 天内考试、本周调课、最新通知 |
| 课表 | `njau-cli course today` · `course next` · `course week --week 10` · `course list` | 根据教学校历自动换算周次 |
| 调停课 | `njau-cli course changes` | 集体调课、停课记录 |
| 导出日历 | `njau-cli course export --out njau.ics --reminder 15` | 生成 .ics，可导入手机、Outlook、Google 日历 |
| 成绩 | `njau-cli grade list` · `grade gpa` · `grade list --failed` | 按学期统计的加权 GPA 和加权平均分 |
| 考试 | `njau-cli exam list --upcoming` | 时间、地点、座位号 |
| 空教室 | `njau-cli classroom free --campus 卫岗 --building 主楼 --sections 3-4` | 按日期/周次、节次、校区、教学楼、座位数筛选 |
| 教室占用 | `njau-cli classroom usage 主楼107` | 某间教室一周的占用情况 |
| 学业达成 | `njau-cli progress summary` · `progress courses --module 专业核心课` | 各课程体系要求/已获/在修/还需学分 |
| 培养方案 | `njau-cli plan list --term 2026-2027-2` | 执行方案课程 |
| 选课结果 | `njau-cli selection list` | 本学期已选课程 |
| 学期与校历 | `njau-cli term current` · `calendar week` · `calendar show` · `calendar school` | 当前第几周、每周日期、节假日、校历 PDF |
| 通知公告（免登录） | `njau-cli notice list` · `notice search 奖学金` · `notice view <url>` · `notice download <url>` | 学校通知、学术活动预告、教务处通知、下载中心等 9 个来源 |
| 办事大厅 | `njau-cli portal apps 请假` · `portal categories` · `portal reminders` | 136 个应用的入口链接 |
| 个人信息 | `njau-cli me` | 学号、院系、专业、班级 |
| 网络诊断 | `njau-cli network check` | 识别代理 fake-ip 并给出修复建议 |

全部命令见 `njau-cli help`，或 [skills/njau-cli-skill/references/commands.md](skills/njau-cli-skill/references/commands.md)。每条命令都支持 `--help`；加 `--format table` 输出人读表格。

## 给 AI Agent 用

**方式一：MCP 服务器（推荐）**

```bash
claude mcp add njau -- njau-cli mcp
```

其他客户端（如 Cursor 的 `mcp.json`）里这样配置：

```json
{ "mcpServers": { "njau": { "command": "njau-cli", "args": ["mcp"] } } }
```

这样会暴露 37 个只读工具（`njau_today`、`njau_course_next`、`njau_classroom_free` 等）。会打开窗口或写文件的命令不会暴露。

**方式二：Skill**

```bash
njau-cli skill install --target claudecode   # 或 codex / workbuddy / ai-ide
```

Skill 告诉 Agent 怎样把自然语言映射到命令、如何处理错误，以及隐私边界。

## 输出约定

```json
{ "ok": true, "data": { ... }, "meta": { "command": "course today", "backend": "playwright" } }
{ "ok": false, "error": { "code": "LOGIN_REQUIRED", "message": "...", "hint": "Run `njau-cli auth login` ..." }, "meta": { ... } }
```

错误码和退出码见 [docs/cli-contract.md](docs/cli-contract.md)。

## 工作原理

```text
Agent / 用户
  → njau-cli（命令注册表 → JSON 输出 / MCP 工具）
  → 业务模块：szjw（强智数智教务）、portal（金智 AMP 办事大厅）、notice（WebPlus / VSB 公开站点）
  → 浏览器会话：Playwright 持久化 profile + 会话 cookie 持久化（~/.njau-cli，权限 600）
  → 南农各系统（统一身份认证 authserver.njau.edu.cn 单点登录）
```

数智教务部分直接调用教务前端自己使用的 JSON 接口（携带用户登录后的 cookie），不渲染页面，所以一般 1～3 秒就能返回。细节见 [docs/architecture.md](docs/architecture.md)。

## 目前不做的

- **图书馆馆藏查询**：馆藏系统（超星图星 LibSP）有独立账号，登录还要过滑块验证码，CLI 不绕过验证码。
- **任何写操作**：选课、请假、报修、缓考申请等。
- **校外访问数智教务**：需要学校 VPN，CLI 不负责绕过网络限制。

## 开发

```bash
npm install
node --test                          # 单元测试 + CLI 契约测试（mock 后端，合成数据）
node scripts/gen-commands-doc.mjs    # 新增命令后重新生成命令参考
node scripts/check-docs.mjs
```

测试数据全部是合成的，仓库里不保存任何从学校系统抓取的数据。调试抓取的数据放在 `scratch/`（已 gitignore）。

## 许可

MIT。原始框架来自 szu-cli contributors，见 [LICENSE](LICENSE)。
