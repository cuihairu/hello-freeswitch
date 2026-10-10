# 什么是 FreeSWITCH

FreeSWITCH 是一个开源的软交换（Softswitch）平台，用 C 语言编写，最初由 Anthony Minessale II 于 2006 年在 ClueCon 会议上发布。它把传统的程控交换机（PBX）、媒体网关、语音应用服务器的能力，浓缩成一个可以运行在普通服务器上的软件系统。

## 核心定位

FreeSWITCH 的本质是三层能力的组合：

- **信令层**：实现 SIP（RFC 3261）等协议栈，完成呼叫的建立、修改与释放；通过 mod_sofia 模块提供完整的 SIP 用户代理（UAS/UAC）能力。
- **媒体层**：负责音频与视频的编解码转换（转码）、混音、录音、播放；内置对 G.711、G.722、Opus、H.264、VP8 等主流编解码的支持。
- **应用层**：提供拨号计划（Dialplan）、IVR、会议、网关、脚本（Lua）与事件套接字（ESL）等应用编程接口，让业务逻辑可以自由编排。

## 主要特性

- **模块化架构**：几乎所有功能都以动态模块（`.so`/`.dll`）形式加载，可在 `modules.conf.xml` 中按需开关，核心本体保持精简。
- **多协议与多形态**：支持 SIP over UDP/TCP/TLS，支持 WebRTC（SIP over WebSocket，端口 5066/7443），支持 TDM/模拟/数字中继（通过 TDM 类模块，如 mod_freetdm；这类模块需单独获取，不随主源码树发布）。
- **跨平台**：官方支持 Linux（主要目标平台）、FreeBSD、macOS 与 Windows。
- **高并发**：单机可承载数千路并发通话，信令与媒体处理可分布在多台服务器上水平扩展。
- **脚本与控制接口**：Lua 脚本可直接嵌入拨号计划（早期版本的 JavaScript 支持 mod_spidermonkey 自 1.4 起已移出源码树，见[脚本与编程接口](/advanced/scripting)）；ESL（Event Socket Library）允许 Python、Go、Node.js 等任意语言通过 TCP 控制 FreeSWITCH。
- **开源许可**：采用 MPL 1.1（Mozilla Public License 1.1）开源。

## 与 Asterisk 的简要对比

| 维度 | FreeSWITCH | Asterisk |
| ---- | ---- | ---- |
| 定位 | 通用软交换/通信应用平台 | 以 PBX 为中心的电话系统 |
| 架构 | 强模块化，信令/媒体/应用解耦 | 应用与核心耦合度较高 |
| 默认拨号计划 | XML 拨号计划 + 脚本，表达力强 | Extensions/文件与 Asterisk 专属 DSL |
| WebRTC | 原生支持（mod_sofia + rtp） | 需额外模块与版本要求 |
| 脚本/外部控制 | Lua + ESL 原生 | AGI/AMI/ARI |
| 配置风格 | XML 体系，层次清晰 | `.conf` 分文件，语法自成一派 |

两者都能搭建企业电话系统与联络中心；当项目涉及复杂媒体处理（转码、会议、录音）、WebRTC 网关或需要被外部程序深度控制时，FreeSWITCH 的架构优势更明显。

## 适合谁阅读

本手册面向：

- 需要自建 PBX、语音网关或联络中心的运维与开发人员；
- 要把语音能力集成进业务系统（智能客服、外呼通知、会议）的后端工程师；
- 希望系统学习 FreeSWITCH 配置体系、拨号计划与 ESL 编程的初学者。

阅读本章后，可继续阅读 [FreeSWITCH 的应用场景](/introduction/scenarios) 了解典型用法，或直接跳到 [FreeSWITCH 的安装](/installation/README) 动手部署。
