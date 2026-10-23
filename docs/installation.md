# 安装

## 要求

- Node.js 20 及以上
- Google Chrome 或 Microsoft Edge（没有的话可以安装 Playwright Chromium）
- 能访问南农各系统的网络：校园网，或校外 + 学校 VPN

## 安装 CLI

从 npm 安装（推荐）：

```bash
npm install --global njau-cli
```

从源码安装：

```bash
git clone https://github.com/Weichenleeeee123/njau-cli.git && cd njau-cli
npm install
npm link            # 让 njau-cli 命令在全局可用
```

同时安装 CLI 和 Agent Skill：

```bash
npx njau-cli@latest install
```

## 首次使用

```bash
njau-cli doctor              # 检查 Node、Playwright、浏览器，以及各站点能否访问
njau-cli network check       # 有站点不通时，看 advice
njau-cli auth login          # 浏览器里本人登录统一身份认证
njau-cli auth status --deep
njau-cli today --format table
```

## 浏览器选择

默认使用系统默认浏览器（Chrome 或 Edge），每种浏览器使用独立的 CLI profile。

```bash
njau-cli browser status
njau-cli browser use edge
njau-cli browser install chromium --yes   # 没有 Chrome/Edge 时使用
```

## 接入 AI Agent

- MCP：`claude mcp add njau -- njau-cli mcp`，其他客户端配置 `{"command": "njau-cli", "args": ["mcp"]}`。
- Skill：`njau-cli skill install --target claudecode`（还支持 `codex`、`workbuddy`、`ai-ide`）。
- OpenClaw 或任意自定义目录：`njau-cli skill install --target claudecode --dir ~/.openclaw/workspace/skills`。

## 代理与网络

在校内开着 Clash 等代理软件时，见 [network.md](network.md)。
