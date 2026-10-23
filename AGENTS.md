# njau-cli Agent Guide

本仓库构建 `njau-cli`：面向南京农业大学网页服务的 agent-friendly CLI，并自带 MCP 服务器和 Agent Skill。

## 产品原则

- 只读查询优先。目前没有任何写操作；以后如果加，必须支持 `--dry-run`，执行前要用户明确确认。
- 用户自己在浏览器里登录，CLI 不保存、不索取密码。
- 每条命令默认输出 JSON envelope：`{ ok, data | error, meta }`。错误码要稳定。
- 不绕过认证、验证码、VPN、限流和访问控制。

## 架构

```text
src/cli.js → src/main.js（解析参数、分发命令、输出、错误码；`mcp` 子命令交给 src/mcp.js）
src/commands/*.js     命令注册表：{ name, summary, args, options, requiresLogin, run }
src/modules/szjw/     数智教务（强智）：client（cookie + CAS SSO）、service（接口）、parsers（纯函数）、ics
src/modules/notice.js 公开站点（WebPlus / VSB）列表与正文解析
src/modules/auth.js   统一身份认证登录/状态；network.js 连通性诊断
src/core/             args、errors、output、http、html、time、session（浏览器会话）、state（cookie 持久化）、browser
```

新增功能的步骤：

1. 在 `scratch/` 里探查接口。`scratch/` 已 gitignore，抓到的真实数据只能留在这里。
2. 在 `src/modules/...` 写纯函数 parser，再写调用接口的 service。
3. 在 `src/commands/` 注册命令，声明 `requiresLogin`。
4. 在 `tests/` 用合成数据写测试；需要 fixture 时扩展 `tests/fixtures/szjw-synthetic.js`。
5. 运行 `node scripts/gen-commands-doc.mjs` 更新命令参考。

## 规则

- **仓库里不能出现任何从学校系统抓下来的真实数据**，包括脱敏后的 fixture。测试一律用合成数据。
- 输出前用 `stripSensitive` 去掉人事敏感字段（教师身份证号等）。
- Cookie、profile、HAR、截图不得提交；`~/.njau-cli` 下的文件权限设为 600。
- 学校接口可能变化：解析要防御式编写，遇到意外结构时抛 `PAGE_CHANGED`，不要静默返回错误数据。
- 时间一律按 `Asia/Shanghai` 处理（`src/core/time.js`）；测试用 `NJAU_NOW` 固定“现在”。

## 验证

- `node --test` 必须全过。
- CLI 行为改动要同时验证 JSON 和 `--format table`。
- 需要登录的命令，要在 mock 后端（`NJAU_BROWSER_BACKEND=mock`，`NJAU_MOCK_DIR`）里覆盖已登录和 `NJAU_MOCK_LOGGED_OUT=1` 两种状态。
- 改了命令注册表后，运行 `node scripts/gen-commands-doc.mjs --check`。

## 本地环境

- Windows 上 Git Bash 会把以 `/` 开头的参数改写成路径，传 SPA 路由时设 `MSYS_NO_PATHCONV=1`。
- 在校内开 Clash TUN 时，见 `docs/network.md`。
