# 附录 C · 资源与参考文献

本附录收录本手册引用与推荐的外部资源。收录原则：**只列确定存在且长期可访问的入口**；第三方项目变动频繁，遇到链接失效时以官方站点为锚点重新检索。

## 官方文档

| 资源 | 链接 | 说明 |
| ---- | ---- | ---- |
| FreeSWITCH 官网 | <https://freeswitch.org/> | 项目主站：新闻、下载入口、社区链接 |
| FreeSWITCH Users Manual | <https://developer.signalwire.com/freeswitch/> | SignalWire 维护的官方用户手册，分 12 个部分（Foundations、Configuration System、Call Routing、Media、Integration and Control、Module Reference、Troubleshooting、Programming 等），是当前最权威的文档入口 |
| 脚本集成章节 | <https://developer.signalwire.com/freeswitch/integration/scripting> | Lua/JS/Python 等脚本模块与 `lua`/`luarun` 两类命令的官方说明 |
| 嵌入式脚本 API | <https://developer.signalwire.com/freeswitch/programming/scripting-apis> | 各语言脚本可用的对象与方法（session、event 等） |
| 源码发布包 | <https://files.freeswitch.org/releases/freeswitch/> | 各版本源码压缩包（含 1.10 系列） |

旧版 wiki（freeswitch.org/confluence）已迁移至上述 SignalWire 开发者门户，老教程里的 wiki 链接大多可以在新站检索到对应内容。

## 源码仓库

| 仓库 | 链接 | 说明 |
| ---- | ---- | ---- |
| 官方 GitHub 仓库 | <https://github.com/signalwire/freeswitch> | 主仓库（SignalWire 赞助维护），Issue/PR 在此提交；vanilla 配置模板在 `conf/vanilla/`，systemd unit 在 `build/` |
| Releases | <https://github.com/signalwire/freeswitch/releases> | 版本发布与变更记录 |
| 官方 GitLab | `gitlab.freeswitch.org` | 项目自建 GitLab 实例；网络不可达时以上面 GitHub 镜像为准（此处只写主机名不作链接，以官方入口为准） |

与本手册实战篇直接相关的第三方仓库：

| 项目 | 链接 | 用途 |
| ---- | ---- | ---- |
| drachtio-freeswitch-modules | <https://github.com/mdslaney/drachtio-freeswitch-modules> | drachtio 社区的 FreeSWITCH 模块仓库，`mod_audio_fork` 位于 `modules/mod_audio_fork`（media bug 抓流送 WebSocket，语音 AI 集成的参考实现；原 drachtio 组织下的路径已失效，当前以此镜像为准） |
| mod_audio_stream | <https://github.com/amigniter/mod_audio_stream> | WebSocket 双向音频流模块（第 14 章详述），需自行编译 |
| Vosk | <https://github.com/alphacep/vosk-api> | 可自托管的开源离线 ASR（含中文模型），常与音频流模块配合 |
| UniMRCP | <https://www.unimrcp.org/> | 开源 MRCP 客户端/服务端框架，`mod_unimrcp` 的底层依赖，官网含 FreeSWITCH 集成教程 |
| SIPp | <https://github.com/SIPp/sipp> | SIP 协议级压测工具（第 16 章压测提到的进阶方案） |

## 社区与会议

| 渠道 | 链接 | 说明 |
| ---- | ---- | ---- |
| 邮件列表 | <https://lists.freeswitch.org/> | Mailman 列表服务（freeswitch-users、freeswitch-dev 等），历史归档可全文检索，很多疑难杂症的答案都在旧帖里 |
| ClueCon | <https://www.cluecon.com/> | FreeSWITCH 创始团队创办的开发者大会，每年发布路线图与实战分享，演讲材料公开 |
| GitHub Issues | <https://github.com/signalwire/freeswitch/issues> | 缺陷与特性讨论；提问前先搜历史 Issue |

提问的通用建议：附上 FreeSWITCH 版本（`fs_cli -x "version"`）、`sofia status profile <名>` 输出、信令跟踪（`siptrace`）与相关日志片段，多数问题一轮就能定位。

## 书籍

英文（按出版时间）：

| 书名 | 作者 | 说明 |
| ---- | ---- | ---- |
| *FreeSWITCH Cookbook*（2012, Packt） | Anthony Minessale 等 | 配方式问答，覆盖常见配置场景 |
| *FreeSWITCH 1.2*（2013, Packt） | Anthony Minessale, Michael S. Collins, Darren Schreiber, Raymond Chandler | 早期系统教程，概念讲解仍然适用 |
| *FreeSWITCH 1.6 Cookbook*（2015, Packt） | Anthony Minessale II, Michael S. Collins, Giovanni Maruzzelli | 偏实操，含 ESL 与脚本示例 |
| *Mastering FreeSWITCH*（2016, Packt） | Anthony Minessale II, Giovanni Maruzzelli | 进阶主题：集群、安全、性能 |
| *FreeSWITCH 1.8*（2017, Packt） | Anthony Minessale II, Giovanni Maruzzelli | 较新的一本系统教程 |

> 英文书基于的版本偏旧，配置项变化不大但模块生态更新较快，阅读时以官方手册为准绳。

中文：

| 书名 | 说明 |
| ---- | ---- |
| 《FreeSWITCH 权威指南》 | 杜金房等著，国内 FreeSWITCH 的标杆图书，从 SIP 基础到 ESL/脚本与生产实践，中文读者的首选系统教材 |

## 中文社区资料

| 资源 | 链接 | 说明 |
| ---- | ---- | ---- |
| FreeSWITCH 中文社区 | <https://freeswitch.org.cn/> | 非官方中文社区站（官方站为 freeswitch.com）：博客、入门教程、社区活动与版本动态 |
| 社区开源书 | 见上站内链接 | 《FreeSWITCH 案例大全》《FreeSWITCH 参考手册》两本社区维护的开源书，案例导向 |
| 知乎专栏 / 微信公众号 | 见上站内链接 | 中文圈动态与答疑（公众号 FreeSWITCH-CN） |

中文资料检索建议：中文社区内容版本跨度大（1.2 到 1.10 都有），引用配置片段时先确认版本，再用本手册 [附录 A](/appendix/configuration-files) 对照 vanilla 模板核实。

## 本站导航

- 实战项目篇：[第 13 章 · 项目概述](/project/)、[第 14 章 · 语音识别与合成](/project/asr-tts)、[第 15 章 · 自然语言处理](/project/nlp)、[第 16 章 · 实现智能客服功能](/project/implementation)、[第 17 章 · 部署与运维](/project/deployment)；
- 附录：[附录 A · 配置文件详解](/appendix/configuration-files)、[附录 B · 常用命令与工具](/appendix/commands)、本页。
