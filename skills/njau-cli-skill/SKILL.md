---
name: njau-cli-skill
display_name: 南京农业大学—校园服务Skill
display_name_en: Nanjing Agricultural University — Campus Services Skill
description: 当用户需要查询南京农业大学（南农、NJAU）的校园事务时使用：课表、今天/明天上什么课、下一节课在哪、成绩与 GPA、考试安排、空教室、调停课、学业达成与培养方案、教学日历、学校与教务处通知、办事大厅入口。通过本地 njau-cli 只读查询；非官方工具。
description_en: Query Nanjing Agricultural University (NJAU) campus services through the local njau-cli — timetable, next class, grades/GPA, exams, free classrooms, schedule changes, degree progress, teaching calendar, school notices and portal service entries. Read-only; unofficial.
version: 0.6.0
license: MIT
metadata:
  compatible_cli: ">=0.5.0"
---

# 南京农业大学—校园服务 Skill

以本地 `njau-cli` 为唯一事实来源。本 Skill 只说明何时、如何调用 CLI，不实现网页抓取或业务逻辑。非官方工具，数据以学校系统为准。

## 开始前

```bash
node --version      # 需要 >= 20
njau-cli --version
njau-cli doctor
```

未安装时，先征得用户同意，再让用户执行 `npx njau-cli@latest install`。不要静默安装。

登录由用户本人完成：

```bash
njau-cli auth login
```

CLI 会打开浏览器窗口，用户在南农统一身份认证页面自己登录（建议勾选“7天免登录”）。**永远不要索取或代填用户的学号密码、短信验证码。**

所有命令默认输出 JSON：`{ ok, data | error, meta }`。只依据 `data` 中的字段作答。

## 工作流

1. 把请求映射到最小的只读命令（见 `references/commands.md`）。不确定参数时运行 `njau-cli <域> <动作> --help`，它会以 JSON 返回参数说明。
2. 执行命令。一次只运行一条需要浏览器的命令，等它结束再运行下一条。
3. `ok: false` 时按 `references/errors.md` 处理 `error.code`。`LOGIN_REQUIRED` 时请用户运行 `njau-cli auth login`。`NETWORK_REQUIRED` 时先运行 `njau-cli network check`，再把 `advice` 转告用户。
4. `ok: true` 时用自然语言回答，只引用用户需要的字段。

## 常见映射

- “今天/明天有什么课”“下节课在哪” → `njau-cli today`，或 `course today` / `course tomorrow` / `course next`
- “第 10 周课表”“周三有什么课” → `course week --week 10`、`course today --date <日期>`
- “我的绩点”“挂科了吗” → `grade gpa`、`grade list --failed`
- “什么时候考试、在哪考” → `exam list --upcoming`
- “现在哪里有空教室” → `classroom free --campus 卫岗 --building 主楼 --sections 3-4`，日期默认今天
- “还差多少学分毕业” → `progress summary`
- “最近有什么通知”“奖学金通知” → `notice list`、`notice search 奖学金`
- “怎么请假 / 在哪报修” → `portal apps 请假`，返回办事入口链接
- 把课表导入手机日历 → `course export --out ~/njau.ics --reminder 15`（会写文件，先告知用户路径）

相对日期（“下周三”“后天”）要先换算成 `YYYY-MM-DD` 再传给 `--date`。“上学期”这类说法要先换算成 `2025-2026-2` 形式的 `--term`。

## 规则

- 只做只读查询。CLI 不提供选课、退课、请假提交、报修提交等写操作，不要用其他方式代办这些事。
- 不绕过登录、验证码、校园网络限制或访问控制。校外访问数智教务通常需要学校 VPN。
- 遇到 `RATE_LIMITED` 立即停止；登录和网络错误最多各处理一次，不要循环重试。
- 成绩、绩点、学号、班级、考试座位号都是隐私信息，只回显用户问到的部分。
- GPA 由 CLI 按“学分×绩点/总学分”计算，回答时说明“以教务处认定为准”。
- 没有成绩或考试安排时，CLI 会返回空列表和 `message`，如实告知，不要猜。

## 按需读取

- `references/commands.md`：全部命令及参数
- `references/examples.md`：自然语言到命令的示例
- `references/errors.md`：错误码与处理方式
- `references/privacy-safety.md`：隐私与安全边界

信息冲突时，以已安装 `njau-cli` 的 `njau-cli help` 输出和 `docs/cli-contract.md` 为准。
