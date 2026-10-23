# 错误码与处理

失败时输出 `{ "ok": false, "error": { "code", "message", "hint"?, "details"? } }`，并以对应退出码结束。

| code | 退出码 | 含义 | Agent 应该做什么 |
|---|---|---|---|
| `INVALID_ARGUMENT` / `UNKNOWN_COMMAND` | 2 | 参数或命令不对 | 看 `hint`，必要时运行 `<命令> --help` 后修正，只重试一次 |
| `BACKEND_UNAVAILABLE` | 10 | Playwright 未安装，或浏览器 profile 被占用 | 若提示 profile 已打开，请用户关闭 njau-cli 打开的浏览器窗口 |
| `LOGIN_REQUIRED` | 11 | 未登录或会话过期 | 请用户运行 `njau-cli auth login` 并自己完成登录，之后重试一次 |
| `NETWORK_REQUIRED` | 12 | 站点不可达 | 运行 `njau-cli network check`，把 `advice` 转告用户（代理直连 / 校园 DNS / 学校 VPN） |
| `PERMISSION_DENIED` | 13 | 当前账号无权访问 | 如实告知，不要尝试其他入口 |
| `BROWSER_UNAVAILABLE` | 15 | 没有可用的 Chrome / Edge | 建议安装 Edge/Chrome；安装 Chromium 须用户确认后运行 `njau-cli browser install chromium --yes` |
| `PAGE_CHANGED` | 20 | 学校系统接口变了 | 告知用户需要更新 njau-cli，不要自行抓取页面替代 |
| `NOT_FOUND` | 22 | 教学楼、教室、通知等不存在 | 读 `details.candidates`，让用户从中选择 |
| `RATE_LIMITED` | 30 | 服务器拒绝请求 | 立即停止，过一段时间再说 |
| `DOWNLOAD_UNAVAILABLE` | 31 | 通知没有可下载附件 | 如实告知 |
| `AUTH_LOGIN_TIMEOUT` | 39 | 登录窗口超时 | 请用户重新运行 `njau-cli auth login` |

## 重试原则

- `LOGIN_REQUIRED` 和 `NETWORK_REQUIRED` 各最多处理一次，处理后仍失败就停下来说明情况。
- 不要并行运行多条需要浏览器的命令，它们共用同一个 profile。
- 遇到 `PAGE_CHANGED` 时，不要改用其他方式抓取学校网页。
