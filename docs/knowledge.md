# 知识点总纲

> 本页把散在 35 篇正文与附录里的知识点收拢成一页：核心概念、依据的权威书籍与官方文档、应用场景、常见坑。每条注明来源并链接回原文；查无实据的条目标「来源未考」。本仓没有独立的调研目录，来源就是站内各页本身；书籍与官方文档的链接出自[资源与参考文献](/appendix/resources.md)。

## 核心概念

### 一通电话的内部结构：呼叫、通道、会话三层

- 呼叫是用户视角的「一通电话」，至少两条通道（channel）经 bridge 连接而成；FreeSWITCH 内部没有 call 这个单一对象，它是 channel 之上的逻辑概念。计费、录音、转接都对「腿」操作，这是理解 FreeSWITCH 行为的钥匙。见[呼叫 (Call)](/concepts/call)。
- 通道是最核心的内部对象：每个呼叫端点（SIP、WebRTC、loopback）都是一条 channel，有唯一 UUID、一组通道变量，沿状态机流转。见[通道 (Channel)](/concepts/channel)。
- 会话是脚本视角的腿：Lua/JS 里的 session 对象封装一条 channel，对 session 的每个操作最终都作用在对应的 channel 状态机上。见[会话 (Session)](/concepts/session)。
- `originate` 是外部控制呼叫的总入口（fs_cli、ESL、脚本通用），语法是 `originate [{变量=值,..}]<被叫> <接通后执行的动作>`，动作以 `&` 开头。见[呼叫 (Call)](/concepts/call)。

### 状态机与通道变量：${} 与 $${} 之别

- 一条 channel 从创建到销毁依次经过 `CS_NEW → CS_INIT → CS_ROUTING → CS_EXECUTE → CS_HANGUP → CS_REPORTING → CS_DESTROY`；每个状态可挂回调，二次开发常在 `CS_REPORTING` 挂 CDR 处理。桥接不改变状态机，B 腿同样走完整流转。见[通道 (Channel)](/concepts/channel)。
- 通道变量是 FreeSWITCH 传递信息的主要方式，来源有五条：用户目录注入、originate 花括号参数、拨号计划 `set`、SIP 协议映射、全局回落（通道上没有的 `${var}` 回落读全局 `$${var}`）。见[通道 (Channel)](/concepts/channel)。
- `set` 与 `export` 的区别值得记住：`set` 只影响当前通道；`export` 会把变量带过桥传到对端腿，常用于把 A 腿的标记传给 B 腿。见[通道 (Channel)](/concepts/channel)。
- `$${var}` 在预处理/启动时求值、全局作用域，只在 `reloadxml` 或重启时重新求值；`${var}` 在每次使用时求值、当前通道作用域，通话过程中动态生效，优先读通道变量再回落全局。这是 FreeSWITCH 配置的第一道坎。见[核心配置文件](/configuration/core-files)。
- mod_loopback 提供 `loopback/<ext>/<context>` 目标，创建一条虚拟通道重新进入拨号计划，是构造复杂路由的常用积木。见[通道 (Channel)](/concepts/channel)。

### 拨号计划：三层结构与静态动态两条路

- 三层结构：context（路由隔离域）→ extension（一类号码）→ condition（对通道变量做 PCRE 正则匹配）→ action / anti-action。它回答的问题是「这个号码打进来，接下来会发生什么」。见[路由与拨号计划 (Dialplan)](/concepts/dialplan)。
- 评估顺序：extension 从上到下逐个评估，condition 默认在首个失败处停止本 extension；`break="always"` 或 `continue="true"` 的规则继续参与后续匹配。没有任何 extension 命中则走 context 兜底或挂断 `NO_ROUTE_DESTINATION`。见[路由与拨号计划 (Dialplan)](/concepts/dialplan)、[静态拨号计划](/concepts/static-dialplan)。
- 静态写法落在 `conf/dialplan/*.xml`，可审计、可回滚，是出厂默认方式；动态化有三条路线：Lua 脚本（亚毫秒级，进程内）、mod_xml_curl（每次路由一次 HTTP 往返）、ESL 外部控制（网络往返加外部处理）。生产实践通常是 XML 承载高频固定规则，Lua 承载单号码内的逻辑分支，mod_xml_curl/ESL 承载跨系统的动态决策。见[动态拨号计划](/concepts/dynamic-dialplan)。
- 规则没命中时先查 `destination_number` 是否符合预期：正则里少写 `^`/`$` 是第一大坑，用 `uuid_dump` 看变量真实值。见[静态拨号计划](/concepts/static-dialplan)。

### 模块体系：总闸与五类模块

- FreeSWITCH 本体只是很小的交换核心（媒体桥接、通道状态机、XML 配置引擎），SIP、会议、语音信箱、录音、编解码等所有能力都由模块提供。不在配置里的模块，对应的命令、application、编解码就都不存在。见[模块概述](/modules/README)。
- `autoload_configs/modules.conf.xml` 是模块总闸，一行一个模块，加载顺序即书写顺序；改这张表只影响下次启动，运行期增减用 `load` / `unload` / `reload`。见[模块概述](/modules/README)。
- `reloadxml` 只重新解析 XML 配置，不会加载或卸载模块，两者经常被混淆。见[模块概述](/modules/README)。
- 常用模块分五类：核心（mod_commands、mod_dptools、mod_dialplan_xml 等）、应用（mod_conference、mod_voicemail、mod_callcenter 等）、编解码（mod_opus、mod_spandsp、mod_openh264 等）、网关与端点（mod_sofia、mod_verto、mod_loopback 等）、事件（mod_event_socket、mod_cdr_csv 等）。见[模块概述](/modules/README)。
- 排查「命令为什么不存在」先用 `fs_cli -x "show interfaces"` 与 `show modules` 确认模块到底加载没有。见[模块概述](/modules/README)。

### SIP 与 mod_sofia：profile、注册认证与防扫描

- SIP 只负责「找人和接通」，语音内容不走 SIP，媒体走 RTP。一次呼叫的标准事务是 INVITE → 100 Trying → 180 Ringing → 200 OK → ACK → BYE。见[SIP 模块](/modules/sip)。
- mod_sofia 以 profile 为单位监听网络，vanilla 默认两个：internal（5060，收分机注册与内呼）与 external（5080，对接运营商/网关）。见[SIP 模块](/modules/sip)。
- 注册走标准 HTTP Digest：分机发 REGISTER，FreeSWITCH 回 401 带随机数 nonce，分机算摘要重发，校验通过回 200 OK。nonce 有有效期（`nonce-ttl` 默认 60 秒），过期重新挑战，防止重放。见[SIP 模块](/modules/sip)。
- 认证链路按序处理：ACL 准入（不通过直接拒收）→ 注册认证（REGISTER 一律走 401 Digest，除非命中 ACL 免认证）→ 来话认证（`auth-calls=true` 时 INVITE 同样要求 Digest）。见[SIP 模块](/modules/sip)。
- 5060 暴露公网会被扫描器持续尝试注册，上线前逐条核对防扫描清单：改默认密码、收紧 ACL、保留失败日志、限速、不碰 `accept-blind-reg` / `accept-blind-auth`、防火墙兜底。见[SIP 模块](/modules/sip)。
- `sofia_contact` 把「分机号」翻译成「可达地址」，返回可以直接喂给 bridge。见[SIP 模块](/modules/sip)。

### 媒体：编解码、转码与 absolute_codec_string

- 编解码来源分三档：核心实现无需模块（PCMU/PCMA、L16、VP8/VP9）；mod_spandsp 提供 G.711/G.722/GSM/G.726 及传真与 DTMF 检测；mod_opus、mod_openh264、mod_h26x、mod_av 等按需加载。用 `fs_cli -x "show codec"` 看当前实际可用清单，列表里没有多半是模块没加载或编译时缺依赖。见[媒体处理模块](/modules/media)。
- 一通电话两侧编解码不同时 FreeSWITCH 在中间转码，相同时只做 RTP 代理转发、几乎零开销。转码消耗 CPU 与音质，所以「让两侧说同一种话」是媒体优化的第一原则。见[媒体处理模块](/modules/media)。
- `absolute_codec_string` 是通道变量，设置后编解码选择完全以它为准，profile 偏好被绕开。最典型用途是外呼时把编解码收窄到 G.711，避免与网关协商出需要转码的结果；`inherit_codec=true` 让外呼腿跟随主叫编解码，防止意外转码。见[媒体处理模块](/modules/media)。
- FreeSWITCH 没有名为 `volume` 的 application。通道级音量与增益的真实入口是 `uuid_audio` API（level 取值 -4 到 4）与会议内的 `volume_in` / `volume_out` 命令。见[媒体处理模块](/modules/media)。
- mod_spandsp 常被误当成「音量/滤波模块」，它实际提供的是编解码、DTMF 检测（与 mod_dptools 的 `start_dtmf` 是两套实现）与传真。音量与增益不要在这里找。见[媒体处理模块](/modules/media)。
- 会议视频混屏由 `video-mode=mux` 开启：所有成员画面按布局合成到画布再发给每个成员，这就是视频 MCU。画布尺寸、帧率、码率直接决定 CPU 用量。见[媒体处理模块](/modules/media)。

### 事件系统与 ESL

- 核心维护一条全局事件总线：产生（状态机与各模块发射）→ 分发（投递给所有命中的订阅者）→ 消费（内部模块、Lua 脚本、外部 ESL 客户端）。事件是广播语义，分发在独立线程进行，订阅者处理得慢不会阻塞通话主流程。见[事件系统](/advanced/events)。
- 一个事件由头部（`Event-Name`、`Core-UUID`、`Unique-ID` 等）与可选正文组成。监控系统的最小集合是 `CHANNEL_CREATE` + `CHANNEL_CALLSTATE` + `CHANNEL_HANGUP_COMPLETE`，足够还原每通电话的起止与过程。见[事件系统](/advanced/events)。
- fs_cli 的 `/event`、`/filter`、`/log` 是 Event Socket 协议层命令，必须带 `/` 前缀；不带斜杠的输入会被自动加上 `api ` 前缀。见[事件系统](/advanced/events)。
- `bgapi` 把命令丢到后台线程执行，立刻返回 Job-UUID，执行完成后事件总线广播一条 `BACKGROUND_JOB` 事件，正文就是命令输出。取异步结果的标准姿势是先订阅 `BACKGROUND_JOB` 再发 `bgapi`，按 Job-UUID 匹配。见[事件系统](/advanced/events)。
- ESL 有两种工作模式：inbound 是外部程序主动连 8021，认证后拥有整台交换机的控制权；outbound 是 FreeSWITCH 用 `socket` application 把一条新通话「递」给外部程序，免认证且天然只针对这一通电话。见[脚本与编程接口](/advanced/scripting)。

### 录音与监听

- 三种录音入口：`record_session` 边通话边写盘、通话结束自动收尾；`uuid_record` 不进拨号计划，运维或外部程序对任意活着的通话随时开始/停止；`record` 录当前这条腿的输入音频，用于语音留言与 IVR 留言录入。见[录音与监听](/advanced/recording)。
- `RECORD_STEREO=true` 双声道录音，左声道是收到的音频、右声道是发出的音频，事后可分开还原双方；`RECORD_MIN_SEC` 把短于该秒数的文件视为无效直接丢弃。见[录音与监听](/advanced/recording)。
- 录音文件名主键用 `${uuid}`（通道变量，每通电话不同），与事件里的 `Unique-ID`、CDR 记录精确对上，是对账、回查的推荐做法；按天分目录，清理时整目录删除。见[录音与监听](/advanced/recording)。
- `eavesdrop` 实时监听，被监听方无感知；监听者用 DTMF 按键控制听哪个方向（1 只听 A 腿、2 只听 B 腿、3 双向、0 静音）。见[录音与监听](/advanced/recording)。
- 录音是写盘大户，必须配保留策略；合规行业的最短保留年限来自业务与法规，不是拍脑袋的天数。见[录音与监听](/advanced/recording)。

### 脚本出口：Lua 与 ESL

- Lua 是 FreeSWITCH 1.10 起唯一开箱即用的脚本引擎（mod_v8 在源码树里，但默认构建不启用）。老教程里常见的 `mod_spidermonkey`（JavaScript，API 命令 `jsrun`）从 1.4 起就被移出源码，1.10 上跑不起来，查资料时注意甄别年代。1.11.0 还移除了 `mod_python`（mod_python3 保留）与约 30 个遗留模块，并把正则迁移到 PCRE2。见[脚本与编程接口](/advanced/scripting)。
- Lua 脚本有四种调用入口：dialplan application（`lua`，session 自动可用）、`lua` API（同步执行）、`luarun` API（后台线程，适合常驻脚本）、`startup-script`（随 FreeSWITCH 启动）。见[脚本与编程接口](/advanced/scripting)。
- 脚本里任何操作前先判断 `session:ready()`，挂断后继续操作会抛错或静默失败；`playback` 的文件不存在会静默失败，排障时看 fs_cli 的 INFO 级日志。见[会话 (Session)](/concepts/session)。
- ESL 是简单的文本协议：连接后服务端发 `auth/request`，客户端发 `auth ClueCon`，回 `+OK accepted` 后就能发 `event` 订阅、`api` 同步命令、`bgapi` 异步命令。只用 Python 标准库即可实现完整客户端。见[脚本与编程接口](/advanced/scripting)。

### 电话到网络电话简史

- 1876 年贝尔发明电话，1889 年斯特罗格发明自动电话交换机，开始取代人工接线员。见[电话的发展史](/introduction/history)。
- 1995 年 VocalTec 推出全球首个商用互联网电话软件 Internet Phone，VoIP 诞生；2003 年 Skype 推出，2005 年 eBay 以 26 亿美元收购；2008 年谷歌推出 Google Voice。见[电话的发展史](/introduction/history)。
- 2007 年 iPhone 发布开启智能手机时代，WhatsApp、Viber、WeChat 等移动互联网电话应用普及；2010 年代 UCaaS（Zoom、Microsoft Teams）成为现代企业通信的核心工具。见[电话的发展史](/introduction/history)。

## 权威书籍要点

站内引用与推荐的书籍如下，出处均为[资源与参考文献](/appendix/resources.md)。「对应知识点」列是整理时按该书目说明映射到本仓页面，未逐章核对原书。两本社区书的作者与出版信息原标「来源未考」，2026-10-10 自 FreeSWITCH 中文社区站书目页实测补齐。

| 书名 | 作者 / 年代 | 对应知识点 | 站内出处 |
| ---- | ---- | ---- | ---- |
| *FreeSWITCH Cookbook*（2012, Packt） | Anthony Minessale 等 | 配方式问答，覆盖常见配置场景 | [配置文件结构](/configuration/config-files) |
| *FreeSWITCH 1.2*（2013, Packt） | Anthony Minessale, Michael S. Collins, Darren Schreiber, Raymond Chandler | 早期系统教程，概念讲解仍然适用 | [核心概念](/concepts/session) |
| *FreeSWITCH 1.6 Cookbook*（2015, Packt） | Anthony Minessale II, Michael S. Collins, Giovanni Maruzzelli | 偏实操，含 ESL 与脚本示例 | [脚本与编程接口](/advanced/scripting) |
| *Mastering FreeSWITCH*（2016, Packt） | Anthony Minessale II, Giovanni Maruzzelli | 进阶主题：集群、安全、性能 | [部署与运维](/project/deployment) |
| *FreeSWITCH 1.8*（2017, Packt） | Anthony Minessale II, Giovanni Maruzzelli | 较新的一本系统教程 | [核心概念](/concepts/session) |
| 《FreeSWITCH 权威指南》 | 杜金房等著 | 国内 FreeSWITCH 的标杆图书，从 SIP 基础到 ESL/脚本与生产实践，中文读者的首选系统教材 | [资源与参考文献](/appendix/resources.md) |
| 《FreeSWITCH 案例大全》《FreeSWITCH 参考手册》 | 杜金房及各位贡献者（2016-2023，在线共创，仍在写作更新中） | 社区开源书，案例导向，在线阅读（book.dujinfang.com），无正式出版社 | [资源与参考文献](/appendix/resources.md) |

英文书基于的版本偏旧（1.2 到 1.8），配置项变化不大但模块生态更新较快，阅读时以官方手册为准绳。中文社区资料版本跨度大（1.2 到 1.11 都有），引用配置片段时先确认版本，再用 vanilla 模板核实；官方最新稳定为 1.11.3。见[资源与参考文献](/appendix/resources.md)。

## 官方文档要点（带链接）

以下链接全部出自[资源与参考文献](/appendix/resources.md)的登记，旧版 wiki（freeswitch.org/confluence）已迁移至 SignalWire 开发者门户。

- [FreeSWITCH 官网](https://freeswitch.org/)：项目主站，新闻、下载入口、社区链接（现 301 至 signalwire.com/freeswitch）。
- [SignalWire 官方用户手册](https://developer.signalwire.com/freeswitch/)：分 12 个部分（Foundations、Configuration System、Call Routing、Media、Integration and Control、Module Reference、Troubleshooting、Programming 等），是当前最权威的文档入口。
- [脚本集成章节](https://developer.signalwire.com/freeswitch/integration/scripting)：Lua/JS/Python 等脚本模块与 `lua` / `luarun` 两类命令的官方说明。
- [嵌入式脚本 API](https://developer.signalwire.com/freeswitch/programming/scripting-apis)：各语言脚本可用的对象与方法（session、event 等）。
- [源码发布包](https://files.freeswitch.org/releases/freeswitch/)：各版本源码压缩包（含 1.10 与 1.11 系列，最新稳定 1.11.3）。
- [官方 GitHub 仓库](https://github.com/signalwire/freeswitch)：主仓库（SignalWire 赞助维护），Issue/PR 在此提交；vanilla 配置模板在 `conf/vanilla/`，systemd unit 在 `build/`。
- [邮件列表](https://lists.freeswitch.org/)：freeswitch-users、freeswitch-dev 等，历史归档可全文检索，很多疑难杂症的答案都在旧帖里。
- [ClueCon](https://www.cluecon.com/)：FreeSWITCH 创始团队创办的开发者大会，每年发布路线图与实战分享，演讲材料公开。
- 与实战篇直接相关的第三方仓库：[drachtio-freeswitch-modules](https://github.com/mdslaney/drachtio-freeswitch-modules)（`mod_audio_fork`，语音 AI 集成的参考实现）、[mod_audio_stream](https://github.com/amigniter/mod_audio_stream)（WebSocket 双向音频流）、[Vosk](https://github.com/alphacep/vosk-api)（可自托管的开源离线 ASR，含中文模型）、[UniMRCP](https://www.unimrcp.org/)（开源 MRCP 框架，`mod_unimrcp` 的底层依赖）、[SIPp](https://github.com/SIPp/sipp)（SIP 协议级压测工具）。
- [FreeSWITCH 中文社区](https://freeswitch.org.cn/)：非官方中文社区站，博客、入门教程与版本动态。官方站 freeswitch.org 与 freeswitch.com 现均 301 至 signalwire.com/freeswitch（SignalWire 为项目维护方）。

## 应用场景

FreeSWITCH 不是单一产品，而是一块「通信积木」，同一套内核通过不同模块组合覆盖多类场景。七类典型场景见[FreeSWITCH 的应用场景](/introduction/scenarios)：

- **企业 IP-PBX**：替代传统程控交换机，分机注册、内线互拨、外线经 SIP 中继或语音网关对接运营商，典型规模几十到数千分机的中小企业。
- **联络中心**：ACD 按技能组分配来话、IVR 自助服务、ESL 控制坐席示忙示闲、全程录音、实时报表。
- **语音网关与中继边界**：SIP ↔ PSTN 网关、协议转换、号码落地。
- **WebRTC 语音与视频**：mod_sofia 原生支持 SIP over WebSocket（`ws-binding` 5066、`wss-binding` 7443），配合 ICE/STUN/TURN 与 H.264/VP8 编码，可实现浏览器点对点呼叫、网页电话条、在线课堂。
- **语音通知与批量外呼**：脚本或 ESL 循环 `originate`，配合 TTS 把文本转语音播出，通过限速、并发控制避免被运营商封禁。
- **智能客服与 AI 通信**：FreeSWITCH 承担呼叫接入、媒体桥接、录音与事件上报，ASR/TTS/NLP 通过 ESL 与外部服务集成。
- **会议与多方通话**：mod_conference 提供混音会议，多方呼入、主持人控制、会中点名、录音、直播旁路。

实战主线（第 13-17 章）把上述零件装成一套电话智能客服系统，三条选型原则值得单独记住，见[智能客服项目概述](/project/README)：

- **交换与智能分离**。FreeSWITCH 只负责「接得住、播得出、录得下、转得动」，所有语义理解都放在外部服务。语音与 NLP 技术迭代快，解耦之后换厂商不动交换层。
- **控制面走 ESL，媒体面走媒体流**。业务决策依赖事件（来话、应答、挂断、录音完成），干预依赖命令（应答、播放、转接、挂断），两条通道职责清晰。
- **任何智能环节都要有降级**。ASR 挂了退按键菜单，NLP 挂了播静态提示，TTS 挂了退预合成文件。客服系统是企业的入口线路，不能因为一个第三方接口整体不可用。

语音接入两条路线的取舍见[语音识别与合成](/project/asr-tts)：媒体流旁路（实时流式）首句响应时延低、可做打断，但需要抓流通道；逐句识别（录音文件后识别）实现简单、适合原型验证与坐席后质检。实践建议是先用逐句识别把流程跑通，再切实时流式，两条路的 NLP、状态机、转接逻辑完全复用。生产客服系统里 80% 的播报都应该是预合成文件，TTS 只兜动态内容的底。

NLP 的三项基础能力是意图识别、实体抽取、对话管理，见[自然语言处理](/project/nlp)。轮次推进由业务后端的状态机控制，NLP 服务通常只负责「这句话是什么意思」。规则兜底方案的三条工程约定：规则文件与代码分离（运营人员能自己加词）、置信度阈值与降级话术绑定（低于阈值不硬猜）、「转人工/投诉」直达坐席的规则永远前置。

## 常见坑误区

### 配置与生效

- `X-PRE-PROCESS` 在 XML 解析之前执行，不能出现在 XML 注释里「注释掉」，它照样生效，只能整行删除。这是新手最常踩的坑。见[配置文件结构](/configuration/config-files)。
- `reloadxml` 只重新解析 XML 配置，不会加载或卸载模块；运行期增减模块用 `load` / `unload` / `reload`。见[模块概述](/modules/README)。
- 改 `sip_profiles` 用 `sofia profile <name> rescan` 可平滑重扫；改监听地址、端口等核心参数必须 `restart`，会断当前通话，选低峰期操作。见[SIP 模块](/modules/sip)。
- 新增或修改网关文件后 `rescan` 即可，不需要 `reloadxml`（网关不在 XML 配置的 section 缓存里）。见[网关模块](/modules/gateway)。
- 修改 `$${}` 全局变量后要 `reloadxml` 才重新求值；在 `fs_cli` 里用 `global_getvar` 查看全部全局变量。见[核心配置文件](/configuration/core-files)。

### 拨号计划与路由

- 正则里少写 `^` / `$` 是规则没命中的第一大坑；用 `uuid_dump` 看 `destination_number` 的真实值。见[静态拨号计划](/concepts/static-dialplan)。
- extension 按文件名与书写顺序依次评估，用 `00-` / `50-` / `90-` 前缀明确匹配优先级；新增业务规则放独立分片文件最不易冲突。见[静态拨号计划](/concepts/static-dialplan)。
- 会议 `+pin` 要写在 profile 之后：`3000@default+4321`，写在 profile 之前不生效。见[会议模块](/modules/conference)。
- 转人工的 bridge 前要 `set hangup_after_bridge=true` 与 `continue_on_fail=true`，保证坐席挂断时整通电话结束、坐席未接时脚本还能继续走（转留言）。见[实现智能客服功能](/project/implementation)。

### 网络安全

- `vars.xml` 的 `default_password` 与分机文件里的 `password` 默认都是 `1234`，公网机器上弱密码分机几分钟就会被注册成功并盗打外线。见[核心配置文件](/configuration/core-files)、[部署与运维](/project/deployment)。
- 8021（ESL）永远不要对公网放行，`fs_cli` 走本机连接即可，远程管理用 SSH 隧道。见[网络设置](/configuration/network)。
- `accept-blind-reg` / `accept-blind-auth` 保持注释状态，不要打开。见[SIP 模块](/modules/sip)。
- external profile 的 `auth-calls=false` 不要完全敞开在公网：用 `apply-inbound-acl` 只放对端 IP 段，或在网关上用 `gw-auth-acl` 绑死来源。见[网关模块](/modules/gateway)。
- ESL 默认密码 `ClueCon` 上线必改；内网部署可把 `listen-ip` 固定为 `127.0.0.1`，确需远程连接则配置 `apply-inbound-acl` 白名单。见[部署与运维](/project/deployment)。

### 媒体与录音

- 单通（一方听不到对方）是经典 RTP 问题：防火墙没放行 RTP 端口段、`ext-rtp-ip` 不对（对端把媒体发到了不可达地址）。用 `tcpdump` 确认双向 RTP 都在流动。见[网关模块](/modules/gateway)、[部署与运维](/project/deployment)。
- 能打通但完全无声或报 488，是编解码不匹配：对端不提供你声明的编解码，用 `absolute_codec_string=PCMU,PCMA` 收窄验证，必要时开 `inbound-late-negotiation`。见[网关模块](/modules/gateway)。
- 没有 `volume` 这个 application；通道级音量走 `uuid_audio`，会议内音量走 `conference volume_in` / `volume_out`。见[媒体处理模块](/modules/media)。
- 录音文件没生成或为 0 秒：先看 `record_seconds` 是否为 0（通道未应答就开始录，或对端静音被静音判定提前截断），再查权限与空间。见[部署与运维](/project/deployment)。
- 开启 `RECORD_APPEND` 时核心会把 `RECORD_MIN_SEC` 固定为 3 秒，两者一起调时注意这个交互。见[录音与监听](/advanced/recording)。
- `bypass_media`（媒体旁路）后 FreeSWITCH 看不到媒体，录音与 ASR 都会失效，启用前要与录音、监听需求权衡。见[部署与运维](/project/deployment)。

### 脚本与事件

- `mod_spidermonkey` / `jsrun` 的用法在 1.10 上都跑不起来，内嵌脚本一律建议 Lua。见[脚本与编程接口](/advanced/scripting)。
- 只发 `event plain`（不带事件名）会得到 `-ERR no keywords supplied`，至少要写一个事件名。见[事件系统](/advanced/events)。
- 订阅 `CUSTOM` 自定义事件必须带上子类名（如 `event plain CUSTOM acd::agent_state`），`event plain all` 例外，它收一切。见[事件系统](/advanced/events)。
- `bgapi` 的结果走 `BACKGROUND_JOB` 事件，先订阅再发 `bgapi`，否则拿不到异步结果。见[事件系统](/advanced/events)。
- 脚本里操作前先判断 `session:ready()`，挂断后继续操作会抛错或静默失败。见[会话 (Session)](/concepts/session)。

### 资料版本

- 英文书基于 1.2 到 1.8，配置项变化不大但模块生态更新较快，阅读时以官方手册为准绳。见[资源与参考文献](/appendix/resources.md)。
- 中文社区内容版本跨度大（1.2 到 1.11 都有），引用配置片段时先确认版本，再用 vanilla 模板核实。见[资源与参考文献](/appendix/resources.md)。
- 1.11 系列有破坏性变更：1.11.0 移除 `mod_python`（mod_python3 保留）与约 30 个遗留模块（mod_h26x、mod_portaudio、mod_rayo 等），正则引擎迁移到 PCRE2；引用 1.10 及更早教程的模块名与正则写法前，先到官方 Release 说明确认。见[脚本与编程接口](/advanced/scripting)、[资源与参考文献](/appendix/resources.md)。
- 社区音频流模块（`mod_audio_stream`、`mod_audio_fork`）不在官方源码树与发行包里，需自行编译；这类仓库更迭频繁、镜像众多，使用前先确认其公开仓库与维护状态。见[资源与参考文献](/appendix/resources.md)、[语音识别与合成](/project/asr-tts)。
- 官方站域名已迁移：freeswitch.org 与 freeswitch.com 现均 301 至 signalwire.com/freeswitch，引用旧链接时注意重定向。见[资源与参考文献](/appendix/resources.md)。
