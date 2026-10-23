# CLI 契约

用户和 Agent 只应依赖本文件描述的行为。

## 命令形态

```bash
njau-cli <domain> <action> [位置参数] [--选项]
njau-cli today
njau-cli help [domain]
njau-cli <domain> <action> --help
```

- 未知命令或未知选项会立即报 `INVALID_ARGUMENT` / `UNKNOWN_COMMAND`（退出码 2），不会被静默忽略。
- 选项值支持 `--name value` 和 `--name=value` 两种写法；`list` 类型的选项可以重复传（`notice` 的 `--source` 另外支持逗号分隔和 `all`）。
- 全局选项：`--format json|table`（默认 json）、`--json`（兼容参数，没有实际作用）、`--help`/`-h`、`--version`。

完整命令列表见 [skills/njau-cli-skill/references/commands.md](../skills/njau-cli-skill/references/commands.md)。

## 输出

成功：

```json
{ "ok": true, "data": { }, "meta": { "command": "course today", "backend": "playwright", "sourceUrl": "https://szjw.njau.edu.cn/xsd/" } }
```

失败：

```json
{ "ok": false, "error": { "code": "LOGIN_REQUIRED", "message": "...", "hint": "...", "details": { } }, "meta": { "command": "..." } }
```

- `data` 里列表类的结果统一放在 `items` 字段，并附带 `total`。
- 日期一律是 `YYYY-MM-DD`（北京时间），时刻是 `HH:MM`。
- 星期用 1–7 表示周一到周日；`weeks` 是周次数组，`weeksText` / `sectionsText` 是压缩后的文本，如 `4-16`。
- 学期 ID 的格式是 `2026-2027-1`。

## 错误码与退出码

| code | 退出码 | 含义 |
|---|---|---|
| `INVALID_ARGUMENT`、`UNKNOWN_COMMAND`、`HEADED_REQUIRED` | 2 | 命令或参数无效 |
| `BACKEND_UNAVAILABLE` | 10 | Playwright 缺失，或浏览器 profile 正被占用 |
| `LOGIN_REQUIRED` | 11 | 需要登录或会话已过期 |
| `NETWORK_REQUIRED` | 12 | 目标站点不可达 |
| `PERMISSION_DENIED` | 13 | 当前账号无权访问 |
| `AUTH_LOGOUT_FAILED` | 14 | 清理 profile 失败 |
| `BROWSER_UNAVAILABLE` | 15 | 浏览器不可用 |
| `BROWSER_INSTALL_CONFIRM_REQUIRED` / `_CANCELLED` / `_FAILED` | 16 / 17 / 18 | Chromium 安装相关 |
| `BROWSER_SELECTION_INVALID` | 19 | 浏览器选择无效 |
| `PAGE_CHANGED` | 20 | 学校系统的返回结构不符合预期 |
| `SKILL_NOT_FOUND` | 21 | 随包 skill 缺失 |
| `NOT_FOUND` | 22 | 教学楼、教室、通知等对象不存在（见 `details`） |
| `CONFIRM_REQUIRED` | 27 | 预留：将来的写操作需要确认 |
| `RATE_LIMITED` | 30 | 服务器拒绝请求 |
| `DOWNLOAD_UNAVAILABLE` | 31 | 没有可下载的附件 |
| `AUTH_LOGIN_TIMEOUT` | 39 | 登录窗口超时 |
| 其他 | 1 | 未知错误 |

## MCP

`njau-cli mcp` 实现 MCP 的 `initialize`、`ping`、`tools/list`、`tools/call`（协议版本 `2025-06-18`），通过 stdio 传输。

- 工具名是 `njau_` 加上命令名，空格换成下划线，例如 `njau_course_today`。参数名和 CLI 选项的驼峰写法一致（`minSeats`）。
- 成功时返回 `content[0].text`（JSON 字符串）和 `structuredContent`；失败时 `isError: true`，`text` 里是错误 payload。
- 不暴露的命令：`install`、`auth login/logout`、`browser use/install`、`skill install`、`course export`、`notice download`。

## 环境变量

| 变量 | 作用 |
|---|---|
| `NJAU_CLI_HOME` | 数据目录，默认 `~/.njau-cli` |
| `NJAU_BROWSER` | 指定 `chrome` / `edge` / `chromium` |
| `NJAU_NOW` | 固定“现在”（ISO 时间），用于测试和复现 |
| `NJAU_BROWSER_BACKEND=mock`、`NJAU_MOCK_DIR`、`NJAU_MOCK_LOGGED_OUT` | 测试用的 mock 会话 |
| `NJAU_HTTP_FIXTURES` | 测试用：公开页面从本地目录读取 |
