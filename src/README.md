# Source Layout

- `cli.js`：可执行入口。
- `main.js`：参数解析、命令分发、JSON / table 输出、错误码；`mcp` 子命令交给 `mcp.js`。
- `mcp.js`：stdio MCP 服务器，把只读命令暴露为工具。
- `commands/`：命令注册表（`system`、`dashboard`、`academic`、`notice`、`portal`）。
- `modules/szjw/`：数智教务平台（强智）的客户端、接口封装、纯函数解析器和 .ics 导出。
- `modules/notice.js`：学校主页（WebPlus）和教务处（VSB）的公开通知解析。
- `modules/auth.js`、`modules/network.js`、`modules/doctor.js`：登录、网络诊断、环境检查。
- `core/`：参数解析、错误、输出、HTTP、HTML、时间、浏览器会话与 cookie 持久化、浏览器选择、skill 安装。

设计说明见 `docs/architecture.md`。
