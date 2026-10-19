# 集成实践

这几篇记录了我在 FreeSWITCH 基础呼叫之外用到的三类能力：事件、录音与监听、脚本和外部控制。

## 事件系统（[事件系统](./events.md)）

FreeSWITCH 内部状态变化通过事件总线发布。[事件系统记录](./events.md)整理了事件结构、常用事件类、`fs_cli` 订阅、ESL 消费、`bgapi` 与 `BACKGROUND_JOB` 的配合，以及自定义事件的发送方式。

## 录音与监听（[录音与监听](./recording.md)）

呼叫中心和合规场景经常需要录音。[录音与监听记录](./recording.md)对照了三种方式（`record_session`、`uuid_record`、`record`）、路径与文件名变量、`eavesdrop` 实时监听和按键控制，以及录音文件清理策略。

## 脚本与编程接口（[脚本与编程接口](./scripting.md)）

嵌入式 Lua 是 FreeSWITCH 里轻量的胶水层。[脚本与编程接口记录](./scripting.md)包括 Lua 环境加载、四种脚本调用入口、收号转接 IVR 示例、ESL inbound/outbound 两种形态，以及纯标准库 Python ESL 客户端骨架。

---

我通常先看[事件系统](./events.md)，再按项目需要查[录音与监听](./recording.md)或[脚本与编程接口](./scripting.md)。跨系统整合的记录在[智能客服项目](../project/README.md)。

## 参考资料

- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)
- [SignalWire · FreeSWITCH 文档](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## 相关页面

- [events](events.md)
- [recording](recording.md)
- [scripting](scripting.md)
- [knowledge](/knowledge.md)
- [README](/project/README.md)
