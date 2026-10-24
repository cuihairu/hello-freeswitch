# 术语表

本表收 FreeSWITCH 与智能客服项目中的常用术语，按主题分组。每条给出中英对照、一句话定义与权威出处；站内页在「相关页」给出可点链接。

## 协议与信令

### 会话初始协议（SIP (Session Initiation Protocol)）

IETF 制定的应用层信令协议，用于建立、修改和终止多媒体会话；FreeSWITCH 的呼叫控制核心协议。

**出处**：[rfc3261](https://datatracker.ietf.org/doc/html/rfc3261)、[Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

**相关页**：[会话 (Session)](concepts/session.md)、[SIP 模块](modules/sip.md)

### 会话描述协议（SDP (Session Description Protocol)）

描述多媒体会话参数的格式（媒体类型、编解码、地址端口），在 SIP 消息体中承载。

**出处**：[rfc4566](https://datatracker.ietf.org/doc/html/rfc4566)、[Session Description Protocol](https://en.wikipedia.org/wiki/Session_Description_Protocol)

**相关页**：[会话 (Session)](concepts/session.md)

### 实时传输协议（RTP (Real-time Transmission Protocol)）

用于在 IP 网络上传输音频/视频媒体的传输协议，FreeSWITCH 媒体面承载的基础。

**出处**：[rfc3550](https://datatracker.ietf.org/doc/html/rfc3550)、[RTP](https://en.wikipedia.org/wiki/RTP)

### 实时传输控制协议（RTCP (RTP Control Protocol)）

RTP 的伴生控制协议，用于传输统计与 QoS 反馈（丢包、抖动、往返时延）。

**出处**：[rfc3550](https://datatracker.ietf.org/doc/html/rfc3550)、[Real-time Transport Control Protocol](https://en.wikipedia.org/wiki/Real-time_Transport_Control_Protocol)

### 安全实时传输协议（SRTP (Secure RTP)）

RTP 的加密与认证扩展，防止媒体流被窃听或篡改。

**出处**：[rfc3711](https://datatracker.ietf.org/doc/html/rfc3711)

### RFC 3551 配置文件（RTP Profile for Audio and Video）

定义 RTP 在音视频会话中的默认编解码编号与载荷格式约定。

**出处**：[rfc3551](https://datatracker.ietf.org/doc/html/rfc3551)

### DTMF 带内带外传输（RFC 2833 (DTMF relay)）

定义按键音（DTMF）以 RTP 事件包在带外传输的方式，避免语音编解码损伤。

**出处**：[rfc2833](https://datatracker.ietf.org/doc/html/rfc2833)

### ENUM（ENUM (Telecommunications Number Mapping)）

用 DNS 把电话号码映射成 SIP/URI 等 URI 的记录体系，支撑号码可携带。

**出处**：[rfc6116](https://datatracker.ietf.org/doc/html/rfc6116)、[ENUM](https://en.wikipedia.org/wiki/ENUM)

### STUN（STUN (Session Traversal Utilities for NAT)）

帮助终端发现自己公网映射地址与 NAT 类型的协议，是 NAT 穿透的第一步。

**出处**：[rfc5389](https://datatracker.ietf.org/doc/html/rfc5389)、[STUN](https://en.wikipedia.org/wiki/STUN)

**相关页**：[会话 (Session)](concepts/session.md)

### TURN（TURN (Traversal Using Relays around NAT)）

对称 NAT 或严格策略下通过中继转发媒体流的协议。

**出处**：[rfc6056](https://datatracker.ietf.org/doc/html/rfc6056)、[TURN](https://en.wikipedia.org/wiki/TURN)

### ICE（ICE (Interactive Connectivity Establishment)）

综合 STUN/TURN 的连通性检查框架，选出主机候选、反射候选与中继候选中的最优路径。

**出处**：[rfc5245](https://datatracker.ietf.org/doc/html/rfc5245)、[Interactive Connectivity Establishment](https://en.wikipedia.org/wiki/Interactive_Connectivity_Establishment)

### WebSocket（WebSocket）

在单个 TCP 连接上提供全双工通信的协议，FreeSWITCH 用其承载浏览器/Web 应用的实时信令。

**出处**：[rfc6455](https://datatracker.ietf.org/doc/html/rfc6455)、[WebSocket](https://en.wikipedia.org/wiki/WebSocket)

### HTTP（HTTP）

FreeSWITCH 的 HTTP API 与事件回调基于 HTTP 语义（方法、状态码、JSON 体）。

**出处**：[rfc9110](https://datatracker.ietf.org/doc/html/rfc9110)

### SIP 的 DNS 记录（RFC 3263 (SIP DNS)）

规定用 SRV/NAPTR/A 记录解析 SIP 服务器地址与传输协议。

**出处**：[rfc3263](https://datatracker.ietf.org/doc/html/rfc3263)

**相关页**：[SIP 模块](modules/sip.md)

## 核心概念

### FreeSWITCH（FreeSWITCH）

开源电话交换平台，软交换架构，承担呼叫路由、媒体处理与协议互操作。

**出处**：[](https://freeswitch.org/)、[FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

### 通道（Channel）

一条呼叫腿在 FreeSWITCH 内部的表示，承载协议、媒体与状态机。

**出处**：[](https://freeswitch.org/)、[Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

**相关页**：[通道 (Channel)](concepts/channel.md)

### 会话（Session）

一次 SIP 呼叫在 FreeSWITCH 中的生命周期对象，关联两条通道与计费/录音状态。

**出处**：[](https://freeswitch.org/)

**相关页**：[会话 (Session)](concepts/session.md)

### 呼叫（Call）

用户视角的「一通电话」：主叫腿与被叫腿桥接后的整体，是 channel 之上的逻辑概念。

**出处**：[](https://freeswitch.org/)

**相关页**：[呼叫 (Call)](concepts/call.md)

### 拨号计划（Dialplan）

决定呼叫如何被路由与处理的一组规则（extension、condition、action）。

**出处**：[Dial plan](https://en.wikipedia.org/wiki/Dial_plan)、[](https://freeswitch.org/)

**相关页**：[路由与拨号计划 (Dialplan)](concepts/dialplan.md)、[动态拨号计划](concepts/dynamic-dialplan.md)、[静态拨号计划](concepts/static-dialplan.md)

### 静态拨号计划（Static Dialplan）

写在 XML 配置文件中的拨号计划，启动时加载。

**出处**：[Dial plan](https://en.wikipedia.org/wiki/Dial_plan)

**相关页**：[路由与拨号计划 (Dialplan)](concepts/dialplan.md)、[动态拨号计划](concepts/dynamic-dialplan.md)、[静态拨号计划](concepts/static-dialplan.md)

### 动态拨号计划（Dynamic Dialplan）

拨号计划在运行期动态加载或改写（如从数据库/接口查询）。

**出处**：[Dial plan](https://en.wikipedia.org/wiki/Dial_plan)

**相关页**：[路由与拨号计划 (Dialplan)](concepts/dialplan.md)、[动态拨号计划](concepts/dynamic-dialplan.md)、[静态拨号计划](concepts/static-dialplan.md)

### 事件系统（Event System）

FreeSWITCH 的发布/订阅事件总线，模块与外部系统通过它交换状态与信令事件。

**出处**：[](https://freeswitch.org/)、[](https://developer.signalwire.com/freeswitch/)

### 媒体旁路（Media Bypass）

通话双方媒体不再经 FreeSWITCH 中转、直接互通以降低延迟与负载的机制。

**出处**：[](https://freeswitch.org/)

**相关页**：[媒体处理模块](modules/media.md)

## 媒体与编解码

### 编解码器（Codec）

对语音/视频做编码解码的算法实现，RTP 包内的载荷格式由协商确定。

**出处**：[Codecs](https://en.wikipedia.org/wiki/Codecs)

### G.711（G.711）

PCM 窄带语音编解码标准（64 kbps），PSTN 与 VoIP 互通的兜底编码。

**出处**：[G.711](https://en.wikipedia.org/wiki/G.711)

### G.729（G.729）

8 kbps 低码率语音编解码，带宽受限时常见。

**出处**：[G.729](https://en.wikipedia.org/wiki/G.729)

### Opus（Opus）

低延迟、宽窄带可切换的开源编解码，WebRTC 默认强制支持。

**出处**：[Opus (audio format)](https://en.wikipedia.org/wiki/Opus_(audio_format))

### 数字信号处理（DSP (Digital Signal Processor)）

对音频流做回声消除、增益、混音等处理的运算单元。

**出处**：[Digital signal processor](https://en.wikipedia.org/wiki/Digital_signal_processor)

## 模块与应用

### 交互式语音应答（IVR (Interactive Voice Response)）

通过语音/按键菜单引导用户完成自助业务流程的呼叫处理系统。

**出处**：[Interactive voice response](https://en.wikipedia.org/wiki/Interactive_voice_response)

**相关页**：[IVR 模块](modules/ivr.md)

### 会议模块（Conference Module）

把多路音频混入同一会话的模块，支撑电话会议与监听。

**出处**：[Conference call](https://en.wikipedia.org/wiki/Conference_call)

**相关页**：[会议模块](modules/conference.md)

### 网关模块（Gateway Module）

FreeSWITCH 与 PSTN/其他 SIP 域之间的互操作边界，负责协议与编解码转换。

**出处**：[rfc3261](https://datatracker.ietf.org/doc/html/rfc3261)、[PSTN](https://en.wikipedia.org/wiki/PSTN)

**相关页**：[网关模块](modules/gateway.md)

### 语音识别（ASR (Automatic Speech Recognition)）

把语音流转成文本，是智能客服听懂用户的第一步。

**出处**：[Voice recognition](https://en.wikipedia.org/wiki/Voice_recognition)

**相关页**：[语音识别与合成](project/asr-tts.md)

### 语音合成（TTS (Text-to-Speech)）

把文本转成语音流播放给用户，是智能客服回话的出口。

**出处**：[Speech synthesis](https://en.wikipedia.org/wiki/Speech_synthesis)

**相关页**：[语音识别与合成](project/asr-tts.md)

### 拨号音与号码分析（DID (Direct Inward Dialing)）

外部来电直接路由到指定内部分机的号码分配方式。

**出处**：[Direct inward dialing](https://en.wikipedia.org/wiki/Direct_inward_dialing)

## 部署与运维

### PSTN（PSTN (Public Switched Telephone Network)）

传统公共交换电话网，VoIP 系统经网关与之互通。

**出处**：[PSTN](https://en.wikipedia.org/wiki/PSTN)

**相关页**：[网络设置](configuration/network.md)

### VoIP（VoIP (Voice over IP)）

在 IP 网络上承载语音通话的统称，涵盖 SIP/RTP/WebRTC 等技术栈。

**出处**：[Voice over IP](https://en.wikipedia.org/wiki/Voice_over_IP)

### 软交换（Softswitch）

控制与承载分离的交换系统，FreeSWITCH 属此类开源实现。

**出处**：[Softswitch](https://en.wikipedia.org/wiki/Softswitch)

### NAT 与穿透（NAT Traversal）

让位于私有网后的终端与服务器互通的技术集合（STUN/TURN/ICE/UPnP）。

**出处**：[NAT traversal](https://en.wikipedia.org/wiki/NAT_traversal)

### NAT（NAT (Network Address Translation)）

把私网地址映射为公网地址的机制，会阻碍端到端寻址。

**出处**：[Network address translation](https://en.wikipedia.org/wiki/Network_address_translation)

**相关页**：[网络设置](configuration/network.md)

### 会话边界控制器（SBC (Session Border Controller)）

部署在域边界的信令/媒体代理，负责安全、拓扑隐藏与 NAT 穿越。

**出处**：[Session Border Controller](https://en.wikipedia.org/wiki/Session_Border_Controller)

**相关页**：[会话 (Session)](concepts/session.md)

### 网络管理协议（SNMP (Simple Network Management Protocol)）

监控设备状态与指标的协议，FreeSWITCH 可暴露 MIB。

**出处**：[Simple Network Management Protocol](https://en.wikipedia.org/wiki/Simple_Network_Management_Protocol)

**相关页**：[网络设置](configuration/network.md)

### 集群与号码（Toll-free Number）

免话费号码段（如 400/800），常用于客服呼叫入口。

**出处**：[Toll-free number](https://en.wikipedia.org/wiki/Toll-free_number)

## 智能客服项目

### 自然语言处理（NLP (Natural Language Processing)）

让机器理解与生成人类语言的技术总称，涵盖分词、意图识别与对话管理。

**出处**：[Natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing)

**相关页**：[自然语言处理](project/nlp.md)

### 虚拟助手（Virtual Assistant）

以对话方式提供服务的软件系统，智能客服即其一。

**出处**：[Virtual assistant](https://en.wikipedia.org/wiki/Virtual_assistant)

### JSON（JSON）

轻量数据交换格式，智能客服的请求/响应体与配置普遍采用。

**出处**：[JSON](https://en.wikipedia.org/wiki/JSON)

### 语音到文本管道（Speech-to-text Pipeline）

ASR 输出经 NLP 解析成意图与槽位，再驱动回复生成的处理链。

**出处**：[Speech to text](https://en.wikipedia.org/wiki/Speech_to_text)

## 维护口径

- 新术语先在本表登记，再在正文中使用；出处只收 curl 实测 200 的链接（RFC、Wikipedia、官方文档）。
- 未找到权威出处的术语不写来源，改标「未找到权威出处（待核）」。

<!-- BACKLINKS-AUTO -->
## 相关页面

- [call](/zh/concepts/call.md)
- [channel](/zh/concepts/channel.md)
- [dialplan](/zh/concepts/dialplan.md)
- [dynamic-dialplan](/zh/concepts/dynamic-dialplan.md)
- [session](/zh/concepts/session.md)
- [static-dialplan](/zh/concepts/static-dialplan.md)
- [network](/zh/configuration/network.md)
- [knowledge](knowledge.md)
- [conference](/zh/modules/conference.md)
- [gateway](/zh/modules/gateway.md)
- [ivr](/zh/modules/ivr.md)
- [media](/zh/modules/media.md)
- [sip](/zh/modules/sip.md)
- [asr-tts](/zh/project/asr-tts.md)
- [nlp](/zh/project/nlp.md)
