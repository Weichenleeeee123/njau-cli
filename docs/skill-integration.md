# Agent 集成

njau-cli 给 Agent 提供两种接入方式，可以同时使用。

## MCP（推荐）

```bash
claude mcp add njau -- njau-cli mcp
```

```json
{ "mcpServers": { "njau": { "command": "njau-cli", "args": ["mcp"] } } }
```

- 每条只读命令对应一个工具（`njau_today`、`njau_classroom_free` 等），参数的 JSON Schema 由命令注册表自动生成。
- 服务器的 `instructions` 字段会告诉模型：遇到 `LOGIN_REQUIRED` 时让用户自己运行 `njau-cli auth login`，不要索要密码。
- 打开窗口、写文件的命令不暴露为工具。

## Skill

`skills/njau-cli-skill/` 是一份操作指南，内容包括：

- 何时使用（课表、成绩、考试、空教室、通知、办事入口）；
- 自然语言到命令的映射和相对日期的换算；
- 错误码的处理和重试上限；
- 隐私与安全边界。

安装：

```bash
njau-cli skill install --target claudecode   # ~/.claude/skills/njau-cli-skill
njau-cli skill install --target codex        # ~/.agents/skills/njau-cli-skill
njau-cli skill install --target ai-ide --dest ./NJAU-Campus.skill
```

Skill 里不写业务逻辑，只说明怎么调用 CLI。命令参考 `references/commands.md` 由 `scripts/gen-commands-doc.mjs` 生成。
