# 发布流程

1. 确认工作区干净：`git status`。
2. 运行全部检查：

   ```bash
   node --test
   node scripts/gen-commands-doc.mjs --check
   node scripts/check-docs.mjs
   ```

3. 在真实账号上抽查关键命令（需要校园网或 VPN）：`auth status --deep`、`today`、`course next`、`classroom free`、`notice list`。
4. 修改 `package.json` 的版本号；同步修改 `skills/njau-cli-skill/SKILL.md` 的 `version` 和 `compatible_cli`。
5. 提交并打标签：`git tag vX.Y.Z`。
6. 发布到 npm：先用 `npm pack --dry-run` 检查打包内容（不能包含 `scratch/`、cookie 或 profile），然后 `npm publish`。

`npm publish` 是对外发布，必须由维护者本人确认后再执行。
