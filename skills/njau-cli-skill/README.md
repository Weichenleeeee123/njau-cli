# njau-cli-skill

供 AI Agent（Claude Code、Codex、Cursor、WorkBuddy 等）使用的 Skill，教 Agent 安全地调用本地 `njau-cli`，查询南京农业大学的课表、成绩、考试、空教室、通知和办事入口。

安装：

```bash
njau-cli skill install --target claudecode   # 或 codex / workbuddy / ai-ide
```

也可以不用 Skill，直接把 `njau-cli mcp` 配置成 MCP 服务器，见仓库根目录 README。
