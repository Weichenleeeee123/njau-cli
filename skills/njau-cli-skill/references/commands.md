# 命令参考

本文件由 `node scripts/gen-commands-doc.mjs` 根据命令注册表生成，请勿手改。

每条命令都支持 `--help`（以 JSON 返回参数说明）和 `--format table`（输出便于人读的表格）。“需要登录”一列为“是”的命令，要先运行 `njau-cli auth login`。

## 安装

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli install` | 全局安装 njau-cli 并把随包 skill 装到常见 AI Agent | — | 否 |

## 环境检查

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli doctor` | 检查 Node、Playwright、浏览器、登录 profile 与南农站点连通性 | `--offline` 跳过网络探测 | 否 |

## MCP 服务器

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli mcp` | 以 MCP (stdio) 服务器方式运行，把只读命令暴露为工具，供 Claude Code / Cursor 等调用 | — | 否 |

## 网络

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli network check` | 探测各南农站点是否可达，识别代理 fake-ip 并给出直连建议 | `--only <value>` 只检查指定站点：cas/portal/szjw/www/aao/lib；可重复<br>`--timeout <n>` 默认 10000 | 否 |

## 浏览器

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli browser status` | 查看当前选用的浏览器与 profile 路径 | — | 否 |
| `njau-cli browser use <browser>` | 选择 chrome / edge / chromium | — | 否 |
| `njau-cli browser install [browser]` | 下载 Playwright Chromium（需 --yes 确认） | `--yes` | 否 |

## Skill

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli skill path` | 输出随包 agent skill 的路径 | — | 否 |
| `njau-cli skill install` | 把 skill 安装到 codex / claudecode / workbuddy / ai-ide | `--target <value>` 可选 codex/ai-ide/workbuddy/claudecode；默认 codex<br>`--dir <value>`<br>`--dest <value>` | 否 |

## 登录

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli auth status` | 检查浏览器 profile 是否已登录统一身份认证 | `--deep` 同时检查数智教务平台单点登录<br>`--url <value>` | 否 |
| `njau-cli auth login` | 打开可见浏览器，由用户本人完成统一身份认证登录 | `--url <value>`<br>`--timeout <n>` 默认 300000<br>`--keep-open` 登录成功后保持窗口直到手动关闭<br>`--no-warmup` 登录后不预热各业务系统 | 否 |
| `njau-cli auth logout` | 删除 njau-cli 专用浏览器 profile（清除登录态） | — | 否 |

## 今日概览

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli today` | 今日概览：今天/明天的课、下一节课、近期考试、调课和最新通知（适合 Agent 一次调用） | `--notice-days <n>` 附带最近 N 天的公开通知，0 表示不取；默认 3 | 是 |

## 个人信息

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli me` | 当前登录学生的基本信息（学号、姓名、院系、专业、班级） | — | 是 |

## 学期

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli term list` | 列出教务系统中的学年学期 | — | 是 |
| `njau-cli term current` | 当前学期、起止日期和教学周范围，以及今天是第几周 | — | 是 |

## 校历

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli calendar show` | 教学校历：每周对应的日期与节假日 | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期<br>`--days` 输出逐日明细 | 是 |
| `njau-cli calendar week` | 某天是第几教学周、星期几（默认今天） | `--date <value>` YYYY-MM-DD / today / tomorrow / +N | 是 |
| `njau-cli calendar school` | 教务处发布的学年教学日历（校历）文件 | `--year <value>` 学年关键字，如 2026-2027；默认最新 | 否 |

## 课表

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli course sections` | 每节课的上下课时间 | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期 | 是 |
| `njau-cli course list` | 本学期个人课表（可按周次、星期筛选） | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期<br>`--week <n>`<br>`--weekday <value>` 1-7 或 周一..周日<br>`--detail` 输出完整字段 | 是 |
| `njau-cli course today` | 某天的课程（默认今天），自动换算教学周 | `--date <value>` YYYY-MM-DD / today / tomorrow / +N | 是 |
| `njau-cli course tomorrow` | 明天的课程 | — | 是 |
| `njau-cli course week` | 一周课表（默认本周），按天分组 | `--week <n>`<br>`--date <value>` 取该日期所在周<br>`--term <value>` 学年学期，如 2026-2027-1；默认当前学期 | 是 |
| `njau-cli course next` | 接下来的一节课（今天剩余或之后最近一天） | — | 是 |
| `njau-cli course changes` | 调停课 / 课表变动记录 | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期 | 是 |
| `njau-cli course export` | 把本学期课表导出为 .ics 日历文件（可导入手机/Outlook 日历） | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期<br>`--out <value>` 输出文件路径，默认 ./njau-<学期>.ics<br>`--reminder <n>` 提前 N 分钟提醒 | 是 |

## 成绩

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli grade list` | 课程成绩（可按学期、仅最好成绩、仅不及格筛选） | `--term <value>` 学年学期，如 2025-2026-2；默认全部<br>`--best` 同一课程只显示最好成绩<br>`--failed` 只显示不及格<br>`--keyword <value>` 课程编码/名称 | 是 |
| `njau-cli grade gpa` | 按学期和总体计算加权 GPA 与加权平均分 | `--all` 包含重修/补考的全部成绩（默认只取最好成绩） | 是 |

## 考试

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli exam list` | 考试安排（时间、地点、座位号） | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期<br>`--upcoming` 只看今天及以后的考试 | 是 |

## 选课结果

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli selection list` | 本学期选课结果 | `--term <value>` 学年学期，如 2026-2027-1；默认当前学期 | 是 |

## 培养方案

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli plan list` | 执行培养方案的课程（可按学期、课程模块筛选） | `--term <value>` 建议修读学期，如 2026-2027-2<br>`--module <value>` 课程体系关键字，如 专业核心<br>`--keyword <value>` | 是 |

## 学业达成

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli progress summary` | 学业达成情况：各课程体系要求学分 / 已获 / 在修 / 还需 | — | 是 |
| `njau-cli progress courses` | 学业达成中某课程体系下的课程明细 | `--module <value>` 课程体系名称关键字，如 公共必修课<br>`--status <value>` 按修读状态过滤，如 在修 / 未修 / 已修 | 是 |

## 教室

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli classroom buildings` | 校区与教学楼列表 | `--campus <value>` 校区名称关键字，如 卫岗 | 是 |
| `njau-cli classroom free` | 查空教室：指定日期/周次、星期和节次，返回空闲教室 | `--date <value>` 日期（自动换算周次和星期），默认今天<br>`--week <n>`<br>`--weekday <value>`<br>`--sections <value>` 节次范围，如 3-4 或 1-2,5；默认 1-12<br>`--campus <value>` 校区关键字，如 卫岗 / 浦口 / 滨江<br>`--building <value>` 教学楼关键字，如 主楼 / 教三<br>`--type <value>` 教室类型关键字，如 多媒体<br>`--min-seats <n>`<br>`--limit <n>` 默认 50 | 是 |
| `njau-cli classroom usage <room>` | 查看某间教室在某周的占用情况 | `--week <n>`<br>`--date <value>` | 是 |

## 教务站内消息

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli szjw notices` | 数智教务平台站内通知与待办 | — | 是 |

## 公开通知

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli notice sources` | 可用的公开通知来源（无需登录） | — | 否 |
| `njau-cli notice list` | 最新通知公告（学校通知、教务处等，无需登录） | `--source <value>` 来源，可重复：www / events / announce / news / focus / aao / aao-news / aao-download / aao-calendar；默认 www + aao；可重复<br>`--page <n>` 默认 1<br>`--pages <n>` 连续抓取的页数；默认 1<br>`--limit <n>` 默认 20<br>`--days <n>` 只看最近 N 天 | 否 |
| `njau-cli notice search [keyword...]` | 按标题关键词检索通知（扫描前若干页，无需登录） | `--source <value>` 来源，可重复：www / events / announce / news / focus / aao / aao-news / aao-download / aao-calendar；默认 www + aao；可重复<br>`--pages <n>` 每个来源扫描的页数；默认 5<br>`--limit <n>` 默认 30<br>`--since <value>` 起始日期，如 2026-09-01 | 否 |
| `njau-cli notice view <url>` | 读取通知正文、附件与图片链接 | — | 否 |
| `njau-cli notice download <url>` | 下载通知附件到本地目录 | `--dir <value>` 默认 downloads<br>`--index <n>` 只下载第 N 个附件 | 否 |

## 网上办事大厅

| 命令 | 说明 | 选项 | 需要登录 |
|---|---|---|---|
| `njau-cli portal apps [keyword...]` | 网上办事大厅应用目录：按关键词/分类找到办事入口（请假、报修、奖助学金…） | `--category <value>` 分类关键字，如 学生管理 / 后勤服务<br>`--all` 包含当前账号无权限的应用<br>`--limit <n>` 默认 50 | 是 |
| `njau-cli portal categories` | 办事大厅应用分类及数量 | — | 是 |
| `njau-cli portal reminders` | 办事大厅个人提醒（邮件、云盘等）与未读消息数 | — | 是 |
