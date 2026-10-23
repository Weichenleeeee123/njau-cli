# njau-cli 前期调研（2026-10-23）

## 1. 参照对象：szu-cli 是怎么做的

仓库：https://github.com/AwesomeHou/szu-cli（MIT，v0.2.14，Node ≥ 20，唯一依赖 `playwright`）

- **登录方式**：`szu-cli auth login` 打开一个持久化的浏览器 profile（`~/.szu-cli/browser-profiles/<browser>/`），用户自己在网页上登录。CLI 不保存密码，后续命令以 headless 方式复用这份 profile。
- **取数方式**：不直接调用接口。先用浏览器打开业务页面，再监听 `page.on('response')`，抓取页面自己发出的 JSON 请求（例如成绩用的是 `cxxsxjxx.do`、`xscjcxtjgl.do`），交给 `*-parser.js` 规范化。
- **分层**：`cli.js / main.js`（命令路由、JSON 输出、错误码）→ `modules/<domain>.js`（打开页面、抓取响应）→ `modules/<domain>-parser.js`（纯函数，配有 fixture 单测）。
- **约定**：
  - 默认输出 JSON；
  - 错误码统一，有 `LOGIN_REQUIRED`、`PERMISSION_DENIED`、`PAGE_CHANGED`、`BACKEND_UNAVAILABLE` 等；
  - 会改动状态的命令必须支持 `--dry-run`；
  - 环境变量 `SZU_BROWSER_BACKEND=mock` 可以切到 mock 后端，测试时不需要真实登录。
- **配套**：`skills/szu-cli-skill`（教 agent 怎么调用 CLI）、`evals/`（agent 行为评测用例）、WorkBuddy 连接器。
- **可以直接复用的部分**：`browser.js`、`browser-options.js`、`auth.js`、`output.js`、`doctor.js`、`install.js`、`skill.js`、`paths.js`、`ehall-entry.js` 的思路，以及整套错误码和测试框架。和学校业务相关的大约是另一半。

## 2. 南农的系统版图

### 2.1 统一身份认证（CAS）
- `https://authserver.njau.edu.cn/authserver/login?service=...`，金智（Wisedu）IDS，主题为 `njauTheme`。
- 登录方式：账号密码（前端用 `pwdEncryptSalt` 加密）、验证码登录、微信扫码（`combinedLogin.do?type=weixin`）、App 扫码（`qrLoginForm`）。
- 结论：沿用 szu-cli 的做法，用户在可见浏览器里自己登录。不要模拟登录，也不要去碰验证码。

### 2.2 网上办事大厅 myportal（= my.njau.edu.cn）
- `https://myportal.njau.edu.cn/new/index.html`，金智 AMP 网上办事大厅，**和深大 ehall 是同一套产品**。`my.njau.edu.cn` 会 301 跳到这里。
- 未登录时直接跳 CAS。部分 EMAP 应用挂在 myportal 下面，例如：
  - `myportal.njau.edu.cn/gsapp1/sys/yjsemaphome/portal/index.do`（研究生综合服务）
  - `myportal.njau.edu.cn/psfw/sys/zxzxapp/*default/index.do`（校务信箱）
- 应用列表的 jsonp 接口（深大是 `serviceCenterData.json`）要登录后才能确认路径。

### 2.3 数智教务平台 szjw（本科教务主系统）
- 教务处 2026-09-23 的通知明确写了：2026 级个人课表在「数智教务平台」里查，入口是 my.njau.edu.cn → 搜索“数智教务平台”。
- 已知 URL：
  - `https://szjw.njau.edu.cn/xsd/`（学生端）
  - `https://szjw.njau.edu.cn/api/login/sso/cas/login?platformCode=DEF_CAS&service=https://szjw.njau.edu.cn/xkxzd`（选课端，走 CAS 单点登录）
- 前后端分离，后端在 `/api/` 下。厂商**未确认**，推测是强智科技的「数智教学微服务平台」（产品名和“教学一体化服务平台”的说法吻合），要登录后看页面版权信息才能确定。
- **在本机没访问成功**：本机走了代理（DNS 是 198.18.x 的 fake-ip，出口 IP 在香港）。HTTP 访问能拿到 307，但 HTTPS 握手成功后服务器一直不回应，应该是 szjw 只对境内或校内 IP 开放。
- 旧教务 `jw3.njau.edu.cn` 还在，同样走 CAS。

### 2.4 其他和学生相关的系统（来自 sys.njau.edu.cn 的分类导航）
| 系统 | URL | 是否需要登录 | 适合做的命令 |
|---|---|---|---|
| 学校通知公告 | `https://www.njau.edu.cn/tzgg_1094/list.htm`（博达站群，静态 HTML） | 否 | `notice` |
| 教务处通知 | `https://aao.njau.edu.cn/tzgg.htm`（正文多为 PDF） | 否 | `notice --source aao` |
| 图书馆 | `https://lib.njau.edu.cn/`（单页应用，嵌了超星组件） | 检索不需要 | `library` |
| 预约平台 | `http://order.njau.edu.cn/v2/site/index` | 是 | 先只读 |
| 流程中心 | `https://workflow.njau.edu.cn/taskcenter/...`（晚归、离校、医保等） | 是 | 只查进度，不提交 |
| 个人数据中心 | `https://grsjmh.njau.edu.cn/` | 是 | `profile` |
| 统一消息中心 | `https://msg.njau.edu.cn` | 是 | `message` |
| 网上报修 | `http://wlbx.njau.edu.cn/netrepair/` | 是 | 暂缓 |
| 课程中心（超星） | `http://njau.fy.chaoxing.com/portal` | 是 | 暂缓 |
| 秾小智 | `https://chatnau.njau.edu.cn/` | 是 | 学校官方的 AI 助手，和本项目功能有重叠 |

## 3. 还没确认的事（需要登录 + 能访问 szjw 的网络）
1. szjw 的厂商，以及课表、成绩、考试安排分别对应哪些 `/api/` 接口和返回结构。
2. szjw 的登录态是否就是 CAS 的 cookie，还是另外签发 token（存在 localStorage 还是 header）。这决定了 headless 复用 profile 能不能直接用。
3. myportal 应用列表接口的路径。
4. 电费、一卡通、体育场馆在南农分别由哪个系统负责（导航里没有直接给出）。
