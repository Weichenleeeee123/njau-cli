# 自然语言 → 命令示例

假设今天是 2026-10-23（第 8 周周五）。相对日期由 Agent 先换算好。

| 用户说 | 命令 |
|---|---|
| 今天有什么课？/ 今天的安排 | `njau-cli today` |
| 下节课在哪？ | `njau-cli course next` |
| 明天几点上课？ | `njau-cli course tomorrow` |
| 下周三的课 | `njau-cli course today --date 2026-10-28` |
| 第 10 周课表 | `njau-cli course week --week 10` |
| 这学期一共上哪些课 | `njau-cli course list` |
| 周一晚上的课 | `njau-cli course list --weekday 1`（再按 `startTime` ≥ 18:00 筛） |
| 最近有没有调课 | `njau-cli course changes` |
| 把课表导到手机日历 | `njau-cli course export --out ./njau.ics --reminder 15` |
| 现在是第几周？ | `njau-cli calendar week` |
| 国庆放几天 / 本学期校历 | `njau-cli calendar show`，PDF 原件用 `njau-cli calendar school` |
| 我的绩点是多少 | `njau-cli grade gpa` |
| 上学期成绩 | `njau-cli grade list --term 2025-2026-2` |
| 有没有挂科 | `njau-cli grade list --failed` |
| 期末考试安排 | `njau-cli exam list --upcoming` |
| 主楼现在有空教室吗 | `njau-cli classroom free --building 主楼 --sections 3-4` |
| 明天下午卫岗哪里能自习 | `njau-cli classroom free --date 2026-10-24 --campus 卫岗 --sections 6-9` |
| 主楼107 这周什么时候有人用 | `njau-cli classroom usage 主楼107` |
| 还差多少学分 | `njau-cli progress summary` |
| 专业核心课还有哪些没修 | `njau-cli progress courses --module 专业核心课` |
| 下学期要上什么课 | `njau-cli plan list --term 2026-2027-2` |
| 我选了哪些课 | `njau-cli selection list` |
| 教务处最近发了什么 | `njau-cli notice list --source aao --limit 10` |
| 有没有奖学金通知 | `njau-cli notice search 奖学金 --source all` |
| 这周有什么讲座 / 学术报告 | `njau-cli notice list --source events --days 7` |
| 打开这条通知看看 | `njau-cli notice view <url>` |
| 下载通知里的附件表格 | `njau-cli notice download <url> --dir ./downloads` |
| 怎么请假 | `njau-cli portal apps 请假` |
| 宿舍东西坏了在哪报修 | `njau-cli portal apps 报修` |
| 教务系统登不上 / 打不开 | `njau-cli network check`，然后 `njau-cli auth status --deep` |

## 回答方式

- `today` 的 `next.ongoing` 为 `true`，表示这节课正在上。
- 课程地点由 `campus` 和 `location` 组成；`location` 为空通常是体育课或由学院另行安排。
- `course list` 的 `unscheduled` 是“未排具体时间”的教学任务，要提醒用户关注学院通知。
- GPA 回答中注明“njau-cli 按学分加权计算，以教务处认定为准”。
