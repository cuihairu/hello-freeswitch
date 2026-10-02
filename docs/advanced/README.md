# 进阶应用

掌握核心概念与拨号计划之后，本章群介绍让 FreeSWITCH 从「能打电话」走向「能做业务」的三块进阶能力。

## 事件系统（[第10章](./events.md)）

FreeSWITCH 内部一切状态变化都以事件的形式发布在事件总线上。本章拆解事件的结构与常用事件类，演示如何用 `fs_cli` 订阅事件、如何通过 ESL 在外部程序中消费事件，以及如何用 `bgapi` 配合 `BACKGROUND_JOB` 事件获取异步命令结果、如何发送自定义事件。

## 录音与监听（[第11章](./recording.md)）

录音是呼叫中心与合规场景的刚需。本章覆盖三种录音方式（`record_session`、`uuid_record`、`record`）、录音路径与文件名变量的组织技巧、`eavesdrop` 实时监听与按键控制，以及录音文件的清理策略。

## 脚本与编程接口（[第12章](./scripting.md)）

嵌入式 Lua 是 FreeSWITCH 内最快的胶水：本章给出 Lua 运行环境的加载方式、四种脚本调用入口与一个可运行的收号转接 IVR 示例；同时介绍 ESL 的 inbound/outbound 两种形态，并给出纯标准库实现的 Python ESL 客户端骨架。

---

阅读顺序建议：先[事件系统](./events.md)（ESL 是与外部系统集成的基础），再按业务需要选读[录音与监听](./recording.md)与[脚本与编程接口](./scripting.md)。实战整合见[智能客服项目](../project/README.md)。
