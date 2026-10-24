# 结构改动内容复核（2026-10-19）

## 复核范围

先执行 `git fetch origin && git pull --rebase origin main`，结果为 `Already up to date`，工作区初始干净。按实际历史复核最近四个提交（`HEAD~4..HEAD`）：

- `dbaf150` Align docs with personal notes voice（C：定位与口径）
- `48e31d0` Clarify configuration reference angles（B：配置参考页面去重与分工）
- `5b1c678` Clarify sidebar navigation source（A：导航真源及 SUMMARY）
- `4bf7d69` docs: add structure audit report（既有结构审计报告）

范围统计：23 个文件变更，195 行增加、111 行删除（含新增结构审计报告）。不改动上述提交历史。本次另有修复提交 `00c88b9`。

## 四项核查

### 1. 内容丢失

**结论：未发现已删除的独有技术内容；一处删除属于迁移至权威页。**

- `docs/appendix/configuration-files.md:7-9`：原目录树、vanilla 示例文件说明及 TLS/WSS 证书说明从附录的“目录总览”移除，改为指向配置结构页。原提交前版本位于该文件第 7-24 行。
- `docs/configuration/config-files.md:11-47`：目前保留完整目录树（第 11-45 行）及示例文件、`scripts/gentls_cert`、`conf/tls`、`--with-certsdir` 说明（第 47 行）。被移除信息均可在此找到；附录逐文件内容仍从 `docs/appendix/configuration-files.md:11` 开始。
- `docs/SUMMARY.md:1-5`：原 39 行目录改为导航维护说明；站点导航由 `docs/.vitepress/sidebar.json` 提供，配置在 `docs/.vitepress/config.mts:27-28,56-57` 排除 SUMMARY 并载入 sidebar。新 SUMMARY 明确说明不再承载目录；未发现被删的正文性条目。

### 2. 表述被改错

**结论：正文技术含义未见反转；发现并修复一处英文定位口径残留。**

- `README.md:16,22`：C 提交把正文定位改为个人学习笔记，但第 16 行仍写 “FreeSWITCH Knowledge Handbook”，与第 22 行及 `README.zh.md:16,22` 的个人笔记口径不一致。已将第 16 行改为 “FreeSWITCH Learning Notes”，修复提交 `00c88b9`（同一 URL 保持不变）。
- 数量核对：README 与首页改动处没有声称具体篇数或目录数。仓库当前 `docs/` 下有 9 个一级目录（含 `review/` 审计目录）、39 个 Markdown 文件；此前结构审计的 8 个主题目录/38 个内容 Markdown 是其执行前基线，且该报告注明为基线，不应视作当前计数。
- 对改写句逐项查看：章节编号/“知识手册”定位改为页面名称、笔记/经验定位；例如 `docs/project/README.md:3` 仍描述接入、识别、理解、转人工及录音归档流程，`docs/project/asr-tts.md:75` 仍明确逐句识别可用内置录音能力和后台程序。未发现把技术支持/不支持关系改反。

### 3. 链接与导航

**结论：未发现侧栏缺失目标或明显主题错链。**

- 人工检查 `docs/.vitepress/sidebar.json` 中的分组和代表性条目：配置文件结构→`/configuration/config-files`，事件系统→`/advanced/events`，智能客服项目页面→`/project/*`，主题与目标一致。
- 逐个解析 sidebar 的 Markdown 路由目标：36 个链接、36 个唯一链接，缺失目标 0。比如 `/appendix/configuration-files` 对应逐文件参考页，`/configuration/config-files` 对应目录结构与加载关系页；虽都谈配置，查阅角度不同且页面互链（`docs/configuration/config-files.md:5`、`docs/appendix/configuration-files.md:3-5`）。
- 本次差异中的章节名称互引均落到对应主题页；路径未见被改到仅仅存在但内容不符的页面。

### 4. 复核边界与未核实项

**结论：站内改动可核验；外部资源实时可用性未核实。**

- 外部网址（包括 README 在线站点、资源表中的第三方项目地址）未逐一联网检查；本次结构改动未修改这些目标 URL。
- 本报告未重新运行站点构建或测试；本次侧栏目标核验为直接解析 JSON 并检查对应文件，结构审计报告中既有构建记录不作为本轮新运行结果。

## 发现的问题清单

| 问题 | 严重度 | 证据 | 处理 |
|---|---|---|---|
| README 英文短标题仍称 “Knowledge Handbook”，与新定位冲突 | 低（口径不一致） | 修复前 `README.md:16`；正文 `README.md:22` 已是个人学习笔记 | 已修为 “Learning Notes”；`00c88b9`，已推送 |

内容丢失、技术含义改错、数字错误或链接错指：**未发现**。

## 验收结论

已发现的问题已修复并单独提交。复核范围内未发现内容丢失、技术含义反转、错误数量口径或站内导航目标问题；可将这批结构改动视为**已验收（含 `00c88b9` 口径修复）**。外部链接可用性未核实。
