# 架构

```text
用户 / AI Agent
  ├─ CLI：njau-cli <domain> <action> [args] [--options]     → JSON envelope / --format table
  └─ MCP：njau-cli mcp（stdio JSON-RPC）                      → tools/list、tools/call
        │
  命令注册表 src/commands/*.js（system / dashboard / academic / notice / portal）
        │
  业务模块
  ├─ szjw     数智教务平台（强智「数智教学微服务平台」） szjw.njau.edu.cn/api/xsd
  ├─ portal   网上办事大厅（金智 AMP）                   myportal.njau.edu.cn/jsonp
  ├─ notice   公开站点：www.njau.edu.cn（WebPlus）、aao.njau.edu.cn（博达 VSB）
  └─ auth / network
        │
  会话层 src/core/session.js
  ├─ Playwright 持久化 profile：~/.njau-cli/browser-profiles/<chrome|edge|chromium>
  ├─ 会话 cookie 持久化：~/.njau-cli/state/<browser>-cookies.json（600）
  └─ APIRequestContext：直接带 cookie 调 JSON 接口，不渲染页面
```

## 命令注册表

每条命令是一个对象：

```js
{
  name: 'course today',
  summary: '某天的课程（默认今天）',
  requiresLogin: true,
  args: ['keyword...'],                                  // 位置参数，? 表示可选，... 表示吃掉剩余参数
  options: { date: { type: 'string', description: '...' } },  // string | number | boolean | list
  run: async ({ args, options, packageInfo }) => data
}
```

`main.js` 根据注册表解析参数、拒绝未知选项、生成 `help`/`--help`；`mcp.js` 根据同一张表生成 MCP 工具的 JSON Schema；`scripts/gen-commands-doc.mjs` 生成命令参考文档。三者的数据来源是同一份注册表。

## 登录与会话

1. `auth login` 用 Playwright 打开可见浏览器，跳到 `authserver.njau.edu.cn`（金智 IDS）。用户自己登录。
2. 当页面回到 `myportal.njau.edu.cn` 并识别出已登录状态后，再访问 szjw 的 CAS 入口，预热各系统的会话。
3. 南农 CAS 发的 `CASTGC` 和各系统的会话 cookie 都是会话级的，浏览器一关就丢。所以登录后、以及每次命令结束时，都会把 `*.njau.edu.cn` 的 cookie 另存到 `~/.njau-cli/state`，下次启动时注回去。
4. 每次 szjw 命令先用 `sessionUserInfo` 探测会话；失效时请求 `api/login/sso/cas/login?platformCode=DEF_CAS` 重新单点登录；CAS 也失效时返回 `LOGIN_REQUIRED`。

## 数智教务（szjw）

- 所有接口返回 `{ data, status: "200", message, variables }`，由 `client.unwrap()` 统一处理。
- 学期、校历（每天对应的周次/星期/节假日）、节次时间、个人课表、未排课任务、调停课、成绩、考试、选课、执行计划、学业达成、教室占用都有对应的 JSON 接口，见 `src/modules/szjw/service.js`。
- `parsers.js` 是纯函数：把 `kcmc`、`kkzcMx`、`jcmx` 等字段规范成 `name`、`weeks`、`sections`，同时用 `stripSensitive` 去掉教师身份证号等人事字段。
- 课表按周次和星期过滤，“今天/明天/本周”依据教学校历换算，不自己推算周次。
- 空教室：`kxjszl` 返回每间教室的 `detailsMap`，键是“星期×100+节次”，值是按类型（上课、借用、考试、锁定、调课）列出的占用及其周次。CLI 据此判断指定周次和节次是否空闲。

## 公开站点（notice）

- WebPlus：列表页是 `list.htm`、`list2.htm`…，文章 URL 自带日期（`/2026/1020/c1096a142878/page.htm`）。
- VSB：列表页是 `tzgg.htm`，往后的页面反向编号（`tzgg/82.htm` … `tzgg/1.htm`）；附件用 `download.jsp` 链接，PDF 正文用 `showVsbpdfIframe`。
- 只用 `fetch`，不启动浏览器。测试时通过 `NJAU_HTTP_FIXTURES` 指向合成 HTML。

## 测试替身

- `NJAU_BROWSER_BACKEND=mock` 会把 `withSession` 换成读取 `NJAU_MOCK_DIR`（以 `fixtureKey(url)` 命名的 JSON 文件）的假会话。`NJAU_MOCK_LOGGED_OUT=1` 模拟登录过期。
- `NJAU_NOW` 固定当前时间（北京时间换算）。
- 合成数据生成器在 `tests/fixtures/szjw-synthetic.js`。
