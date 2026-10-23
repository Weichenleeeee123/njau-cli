# 登录状态

## 存在哪里

| 路径 | 内容 |
|---|---|
| `~/.njau-cli/browser-profiles/<browser>/` | njau-cli 专用的浏览器 profile，和你日常用的浏览器分开 |
| `~/.njau-cli/state/<browser>-cookies.json` | `*.njau.edu.cn` 的 cookie 副本，文件权限 600 |
| `~/.njau-cli/browser.json` | 选中的浏览器 |

## 为什么要单独保存 cookie

南农统一身份认证（`CASTGC`）和各业务系统的会话 cookie 都是会话级的。Playwright 的持久化 profile 关闭后不会保留这类 cookie，所以只靠 profile 的话，每次命令都要重新登录。njau-cli 在登录成功后和每次命令结束时，把南农域名下的 cookie 另存一份，下次启动时注回去。只要服务器端的会话还有效，就不需要重新登录。

登录时勾选“7天免登录”，CAS 会话能保持更久。

## 生命周期

```bash
njau-cli auth login          # 打开浏览器，用户本人登录；识别登录成功后自动关窗
njau-cli auth login --keep-open
njau-cli auth status         # 检查门户登录状态，并显示已保存会话的时间
njau-cli auth status --deep  # 同时检查数智教务的单点登录
njau-cli auth logout         # 删除 profile 和 cookie 副本
```

会话过期时，命令返回 `LOGIN_REQUIRED`（退出码 11），重新运行 `auth login` 即可。

## 安全

- 这些文件等同于你的登录凭据，不要复制、上传，也不要提交到 Git。
- njau-cli 从不读取或保存密码；如果有人（或某个 Agent）向你要密码，请拒绝。
