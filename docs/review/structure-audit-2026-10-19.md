# hello-freeswitch 文档结构审计（2026-10-19）

> 范围：本报告前半部分记录收口前的结构审计基线；末尾“收口执行记录”更新 A/B/C 的处置、证据与验收结果。不评价文档技术准确性。

> 前半部分的行数、目录映射和结论是执行前基线；导航与正文现状以末尾执行记录及当前文件为准。

## 量化事实

### `docs/` 一级主题目录

统计每个一级主题目录直接包含的 Markdown 文件（不含子目录），总行数按文件原始行计；排除 `.vitepress/`、`public/` 资源和生成产物。根级页面另列。

| 一级目录 | `.md` 数量 | 总行数 |
|---|---:|---:|
| `advanced/` | 4 | 866 |
| `appendix/` | 3 | 504 |
| `concepts/` | 6 | 721 |
| `configuration/` | 4 | 412 |
| `installation/` | 3 | 242 |
| `introduction/` | 3 | 205 |
| `modules/` | 6 | 1,272 |
| `project/` | 5 | 1,278 |
| **一级主题目录小计** | **34** | **5,500** |
| 根级页面（含 `SUMMARY.md`） | 4 | 635 |
| **内容 Markdown 合计** | **38** | **6,135** |

根级 4 页为 `docs/index.md`（25 行）、`docs/knowledge.md`（214 行）、`docs/glossary.md`（357 行）、`docs/SUMMARY.md`（39 行）。

### 当前组织机制（3 套）

| 组织机制 | 条目数 | 命名/组织规律 | 有无编号 | 编号连续性 |
|---|---:|---|---|---|
| 物理主题目录 | 8 个一级主题目录、34 篇页面 | `introduction`、`installation`、`configuration`、`concepts`、`modules`、`advanced`、`project`、`appendix`，大多小写英文目录；页面多用小写 kebab-case | 无 | 不适用；全量 Markdown 文件名数字前缀为 0 个 |
| 根级角色页 | 3 个面向读者的页面：`index`、`knowledge`、`glossary`（另有 1 份迁移目录 `SUMMARY`） | 按用途而非主题命名，承载首页、知识总纲、术语索引；与主题页并列在 `docs/` 根下 | 无 | 不适用 |
| 导航/目录映射 | 2 份：VitePress `sidebar.json`、mdBook 遗留 `SUMMARY.md` | 两份都表达章节层次；`config.mts` 引入 sidebar，且显式将 `SUMMARY.md` 排除构建 | 无 | 不适用 |

配置证据：`docs/.vitepress/config.mts:27-28` 说明 `SUMMARY.md` 是 mdBook 遗留映射底稿且不参与构建；`docs/.vitepress/config.mts:56-58` 说明当前侧边栏由 `sidebar.json` 提供。导航对照显示两份导航都覆盖主要主题，但根级“知识点总纲”“术语表”只在 VitePress 侧边栏中出现（`docs/.vitepress/sidebar.json` 开头；`docs/SUMMARY.md:3-6` 未列出）。

### 侧边栏对账与链接核验

| 检查项 | 数量 | 结果 |
|---|---:|---|
| 侧边栏配置链接 | 36 | `docs/.vitepress/sidebar.json` 共 36 个唯一链接 |
| 配置了但目标文件不存在 | 0 | 无 |
| 页面存在但未进入侧边栏 | 1 | `docs/index.md`；由侧边栏“首页” `/` 路由承载，属正常例外 |
| 本地 Markdown 链接目标缺失 | 0 | 扫描 38 份 Markdown 的本地链接，未发现缺失目标 |
| 构建 | 通过 | `npm ci` 后 `npm run docs:build` 成功，VitePress 1.6.4；构建输出无链接警告 |

侧边栏实际入口见 `docs/.vitepress/sidebar.json`；侧边栏配置入口见 `docs/.vitepress/config.mts:56-58`。`docs/index.md` 未作为单独 sidebar 项不是孤儿页，首页已由 `docs/.vitepress/config.mts:49-53` 的导航 `/` 入口覆盖。构建和本地链接扫描均已核实，不存在“未核实”的死链项目；外部网址可用性未逐一联网验证。

## 问题清单与判断

| # | 问题/证据 | 严重度 | 判断 |
|---|---|---|---|
| 1 | 配置文件主题分散：`docs/configuration/config-files.md:1-5` 是配置结构总览，`docs/configuration/core-files.md` 继续讲核心文件，而 `docs/appendix/configuration-files.md:1-5` 又按 vanilla 模板逐文件详解；`docs/concepts/static-dialplan.md:117-120` 也回链这几处。 | 中 | 属于同一配置主题的“概览—配置细节—参考手册”多层展开，部分重叠且跨目录，读者可能不清楚查阅入口；但三页职责并非完全相同，不能仅凭同主题就判定重复，应在深度重构时划清边界。 |
| 2 | 导航存在双份维护：`docs/.vitepress/sidebar.json` 与 `docs/SUMMARY.md:1-39` 都保存章节树；`docs/.vitepress/config.mts:27-28` 将 SUMMARY 排除，`config.mts:56-58` 另从 JSON 加载侧栏。前者另含知识总纲、术语表，后者附录入口文案/目标页也不完全相同（SUMMARY 第 37 行指向 `appendix/configuration-files.md`）。 | 中 | 当前映射无缺文件且构建正常，但后续改动须同步两份目录，存在渐进漂移风险。SUMMARY 明确标注为迁移底稿，因此它不是线上导航故障；应确认是否仍需作为源数据保留。 |
| 3 | 命名约定有少量例外：目录/普通页面通常小写 kebab-case（如 `docs/project/asr-tts.md`），各主题首页用大写 `README.md`（如 `docs/modules/README.md`），根级又有 `README.md` 与 `README.zh.md`；另有下划线大写的 `docs/SUMMARY.md`。证据：`find docs -name '*.md'` 的 38 个文件清单。 | 低 | `README.md` 是 VitePress 默认目录页约定，保留合理；双语仓库 README 也有明确用途。现状不一致主要是格式规则没有书面化，不构成用户可见故障。 |
| 4 | 数字章节检查：抽取 `docs/` 所有内容 Markdown 的文件名数字前缀（数字后接 `-`、`_`、空格或点），结果为 0 个；因此不存在编号断档、跳号或重复。 | 无问题（无需整改） | 仓库没有编号章节体系，不能把编号连续性当作当前乱象，也不建议为了“看起来整齐”新增编号。 |
| 5 | 组织轴类别核对：无名为 `api/`、`history/`、`guides/` 的独立并行目录；历史内容仅为 `docs/introduction/history.md`，编程接口位于 `docs/advanced/scripting.md`。 | 无问题（无需整改） | 这些是章节主题/页面名称，不是额外目录轴；主题归属合理。 |
| 6 | 根目录与临时文件：仓库根下 Markdown 是 `README.md`、`README.zh.md`；`docs/` 根下四页已在统计表列出；未发现 `.tmp`、`*~`、`.bak` 临时文件。根 README 双份分别是默认/中文入口，非重复副本。 | 无问题（无需整改） | 没有需要清理的根目录杂散 Markdown 或临时文档。 |

### 主题聚合观察

- 配置主题跨 `configuration/`、`appendix/` 与 `concepts/` 引用链：详见问题 1，证据为 `docs/configuration/config-files.md:1-5`、`docs/appendix/configuration-files.md:1-5`、`docs/concepts/static-dialplan.md:117-120`。
- 拨号计划本身聚合良好：总览、静态、动态三页均在 `docs/concepts/`，相互回链（`docs/concepts/dialplan.md:80-88`、`docs/concepts/static-dialplan.md:107-120`、`docs/concepts/dynamic-dialplan.md:180-182`）。SIP 作为模块主题集中在 `docs/modules/sip.md`，概念页只从协议/概念角度提及。不要把正常的跨主题引用误判为目录混乱。

## 判断与推荐

目前是 **3 套组织机制**：物理主题目录、根级角色页、并行导航映射。读者主要依赖的内容分类其实只有一套（8 个主题目录）；根级首页/术语/总纲是有用的横向入口，导航映射则是维护层的重复表达。

建议最终收敛为 **1 套主分类 + 1 份权威导航数据**：以现有主题目录/章节为唯一内容分类，VitePress sidebar 作为唯一发布导航；首页、总纲、术语表可继续作为跨主题入口，不必为追求目录纯度强行搬动。`SUMMARY.md` 若没有 mdBook 导出或迁移复用需求，再归档/删除；是否保留需用户拍板。配置专题先明确“配置概览/核心文件/逐文件参考”的分工，避免机械合并丢失细节。

### 其实不乱、不用动

- 8 个主题目录整体按读者任务/知识领域划分，边界易懂；`concepts/` 中拨号计划三页的聚合尤其清楚。
- `README.md` 作为各主题目录索引符合 VitePress 默认路由习惯；不应为统一小写而随意改名。
- `docs/index.md` 经 `/` 首页路由提供服务，虽然未作为独立 sidebar 项，但不是遗漏页面。
- 根 `README.md` 与 `README.zh.md` 是有意的双语说明，不是重复 README。
- 没有编号章节，无断号/重复编号；没有独立 API/history 等并行目录；当前侧边栏目标完整，本地链接可解析，构建成功。

## 三期收口方案

| 阶段 | 动作清单 | 影响范围 | 风险（链接/搜索/外链） | 用户拍板 |
|---|---|---|---|---|
| 一期：机械整理（目标 1 小时内） | 在文档贡献约定中写明目录/文件命名规则（主题目录小写英文、普通页 kebab-case、目录首页保留 `README.md`）；保留 README 中英文对照关系；逐条校准 sidebar 与 SUMMARY 的标题/入口映射并标注 SUMMARY 为迁移底稿。若不新增规范文件，可只在维护说明中记录。 | 文件命名约定、两份目录元数据；不移动正文。 | 低；不改路由和文件路径时不影响站内链接、搜索或外链。 | 无需拍板即可执行命名约定；若要修改或删除 SUMMARY，则转二期并拍板。 |
| 二期：导航与重定向 | 决定并落实单一导航源；若保留 SUMMARY，则从其生成 sidebar；若不再支持 mdBook，则停止维护/归档 SUMMARY；按需为改名或迁页添加 VitePress redirects/兼容页，并重跑构建和链接检查。 | `docs/.vitepress/sidebar.json`、`config.mts`、`docs/SUMMARY.md`、可能新增重定向规则。 | 中；导航文案变化影响发现路径，路径变更可能影响历史搜索结果和外链；必须保留旧 URL 重定向。 | **必须用户拍板**：SUMMARY 是否仍供 mdBook/迁移使用、以哪个文件为权威导航、是否接受导航标签调整。 |
| 三期：章节深度重构 | 对配置主题三页逐节去重并定义概览/配置详解/查表的职责；若内容确有重复，再合并段落或章节；同步所有反向链接、术语相关页和导航。 | `configuration/`、`appendix/`，可能涉及 `concepts/` 引用和 URL。 | 中到高；页面合并/改名会影响站内链接、搜索索引、书签与外部引用，需保留重定向并重新核验。 | **必须用户拍板**：技术内容删并边界、保留哪些 URL、是否改变现有章节定位。 |

## 最该先做的三件事

1. 先选定导航权威来源，并说明 `SUMMARY.md` 是继续服务 mdBook，还是只保留为迁移档案；消除双份维护的不确定性。
2. 明确配置文件三页的分工（`configuration/config-files`、`configuration/core-files`、`appendix/configuration-files`），先定边界再考虑合并。
3. 固化轻量命名规则并保持现有稳定路由；首轮不改名、不加编号，因为当前没有死链或编号问题。

## 核验记录

- `npm ci`：成功，安装锁文件中的依赖；未修改 `package.json` 或锁文件。
- `npm run docs:build`：成功，VitePress 1.6.4 完成客户端/服务端构建、页面渲染和 sitemap 生成。
- 本地 Markdown 链接检查：0 个失效目标；侧边栏：36 个链接、0 个缺失目标；页面未列入 sidebar：仅首页 `docs/index.md`。
- 本次审计报告创建前 `git status` 干净；构建产物位于忽略目录 `docs/.vitepress/dist/`，不纳入提交。

## 收口执行记录（2026-10-19）

### A：导航单一真源

- 权威源定为 VitePress 的 `docs/.vitepress/sidebar.json`；维护规则写入 `docs/SUMMARY.md:1-5`，保留文件但将手写目录改成指向真源的说明页。VitePress 排除规则与唯一真源注释见 `docs/.vitepress/config.mts:27-28,56-57`。
- 同一侧栏的重复路由数为 **0**（36 个链接、36 个唯一链接）；无需移除条目。跨侧栏复用不计重复。

### B：跨轴内容逐组判定

| 组 | 分类 | 两处文本对比证据 | 处置 |
|---|---|---|---|
| `configuration/config-files.md` 与 `appendix/configuration-files.md` 的配置目录总览 | **真重复，1 组**：两处分别都列出 `freeswitch.xml`、`vars.xml`、`autoload_configs/`、`sip_profiles/`、`dialplan/`、`directory/` 等同一组目录；原附录还重复 vanilla 模板文件与 TLS 证书目录说明。执行前原文可在父提交的 `docs/appendix/configuration-files.md:7-24` 对照；权威页对应 `docs/configuration/config-files.md:7-49`。 | 配置结构页是完整目录树与加载说明的权威页；附录改为“目录树、加载关系及 vanilla 模板说明统一见[配置文件结构]”摘要链接，见 `docs/appendix/configuration-files.md:7-9`。文件和 URL 均保留。 |
| 配置结构、核心配置文件、附录逐文件参考 | **不同角度，保留 1 组**。文本证据：结构页“从目录结构和加载关系理解配置”（`docs/configuration/config-files.md:5`）；核心页“深入三个最常打交道的文件”并聚焦字段（`docs/configuration/core-files.md:3-5`）；附录“按 vanilla 配置模板逐文件梳理”（`docs/appendix/configuration-files.md:3-5`）。 | 三页保留原内容并互链，明确结构/加载、关键文件操作、模板逐文件查阅三种角度；不硬并。 |

### C：口径与实际状态

- README 英文和中文现在说明这是个人学习笔记、心得与开发经验分享（`README.md:22`、`README.zh.md:16,22`）；首页与站点描述同步口径（`docs/index.md:6-7,17-23`、`docs/.vitepress/config.mts:8`）。
- 移除总纲不准确的“35 篇”统计，改为“各篇笔记与附录”，见 `docs/knowledge.md:3`。目录结构审计中的执行前数量仅作为基线保留。
- 移除正文中的“第 N 章”编号骨架，改为页面名称互引；示例见 `docs/modules/README.md:3,118`、`docs/advanced/README.md:5,9,13`、`docs/project/README.md:1,3,104-107`、`docs/project/asr-tts.md:1,75,187`、`docs/project/nlp.md:1,26,161,219-220`、`docs/project/implementation.md:1,208,260,264,391`、`docs/project/deployment.md:1`、`docs/advanced/events.md:115,180,243`、`docs/advanced/scripting.md:20,138`、`docs/advanced/recording.md:73`、`docs/modules/sip.md:58,73,124`、`docs/glossary.md:233,241,315`、`docs/appendix/resources.md:25,30,33,77`。
- 侧栏配置注释不再声称从旧 SUMMARY 映射，也不再保留分组数字；见 `docs/.vitepress/config.mts:56-57`。核对未发现 sidebar 死条目；知识总纲和术语表已列在 sidebar，见 `docs/.vitepress/sidebar.json:7-12`。README 未列出不存在的目录。

### 验收

- `pnpm docs:build`：通过，VitePress 1.6.4 构建完成。
- 本地 Markdown 链接扫描：**521 个链接，缺失 0**；侧边栏扫描：**36 个目标，缺失 0**；侧边栏重复链接：**0**。
- `git diff --diff-filter=D --name-only | wc -l`：**0**（Markdown 删除数也为 0）。
- 本次检查的外部网址可用性未逐一联网验证。
