# FreeSWITCH 的应用场景

FreeSWITCH 不是单一产品，而是一块"通信积木"。同一套内核，通过不同的模块组合，可以覆盖从企业办公电话到智能客服的大量场景。

## 企业 IP-PBX

把 FreeSWITCH 部署在企业内网或机房，替代传统程控交换机：

- 分机注册：桌面 SIP 话机、软电话（X-Lite、Bria、Linphone）、手机 App 通过 SIP 注册到 FreeSWITCH；
- 内线互拨：拨 3~5 位分机号免费通话；
- 外线呼入呼出：经 SIP 中继或语音网关对接运营商，实现 PSTN 互通；
- 基础话务功能：呼叫转移、忙线代接、呼叫等待、语音信箱（mod_voicemail）、IVR 总机。

典型规模：几十到数千分机的中小企业。

## 联络中心（Call Center）

FreeSWITCH 是许多开源联络中心方案（如基于 ESL 的自行开发中间件、VoxBay 等方案）的通信内核：

- **自动呼叫分配（ACD）**：按技能组、排队策略把来话分给坐席；
- **IVR 自助服务**：按键导航、语音查询（对接 ASR/NLP）；
- **坐席状态管理**：ESL 控制坐席示忙/示闲、预测式外呼；
- **全程录音**：`record` 应用或 `uuid_record` 对单通通话落盘；
- **实时报表**：订阅 ESL 事件统计坐席状态、通话时长、放弃率。

## 语音网关与中继边界

- **SIP ↔ PSTN 网关**：通过语音网关卡（E1/T1、模拟线）把 FreeSWITCH 接到传统电话网；
- **协议转换**：对接只支持某种编码或私有信令的旧系统；
- **号码落地**：把来自 Web/App 的呼叫转成真实手机号码呼出。

## WebRTC 语音与视频

mod_sofia 原生支持 SIP over WebSocket（`ws-binding` 5066、`wss-binding` 7443），配合 ICE/STUN/TURN 与 H.264/VP8 编码，可实现：

- 浏览器点对点呼叫、网页电话条；
- 网页会议与在线教育互动课堂；
- 与原生 App 的音视频互通（SIP 双方均可直接注册）。

## 语音通知与批量外呼

- 结合脚本或 ESL 循环 `originate`，向用户批量推送欠费提醒、订单通知；
- 配合 TTS（mod_flite、mod_tts_stop 或对接云端 TTS）把文本转语音播出；
- 通过限速、并发控制避免被运营商封禁。

## 智能客服与 AI 通信

这是本手册后半部分的实战主线，也是 FreeSWITCH 近年最常见的新用途：

```
来电 → IVR 语音导航 → ASR 实时识别 → NLP 意图理解 → 业务系统查询
                              ↓
              坐席转接 / TTS 播报结果 → 挂断归档（录音+文本）
```

FreeSWITCH 在其中承担呼叫接入、媒体桥接、录音与事件上报，语音识别（ASR）、合成（TTS）与自然语言处理（NLP）则通过 ESL 与外部服务集成。

## 会议与多方通话

mod_conference 提供混音会议能力：多方呼入、主持人控制、会中点名、录音、直播旁路；也常用于家庭群组通话、电话会议桥。

## 下一步

场景确定后，从部署开始：

- [在 Linux 上安装](/installation/linux)——服务器环境首选；
- [在 Windows 上安装](/installation/windows)——本机体验与开发调试；
- 安装完成后回到 [FreeSWITCH 的基本配置](/configuration/) 熟悉配置体系。
