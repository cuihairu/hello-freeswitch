# 通道 (Channel)

**通道（channel）是 FreeSWITCH 最核心的内部对象**：每一个呼叫端点——无论来自 SIP、WebRTC 还是 loopback——都是一条 channel。它有唯一 UUID、一组通道变量，并沿着确定的状态机流转。前面讲的 [会话](/concepts/session) 是它的脚本封装，[呼叫](/concepts/call) 是它之上的组合。

## 状态机

一条 channel 从创建到销毁，依次经过这些状态（`CS_*`）：

```
CS_NEW        通道刚创建，尚未开始处理
   │
CS_INIT       初始化完成，参数就绪
   │
CS_ROUTING    路由阶段：查拨号计划，决定执行什么
   │
CS_EXECUTE    执行阶段：运行 application / 脚本（通话主体在这里）
   │
CS_HANGUP     挂断：记录原因码，执行挂断钩子
   │
CS_REPORTING  上报阶段：CDR、事件
   │
CS_DESTROY    销毁，释放内存
```

要点：

- **每个状态可挂回调**（hook），二次开发常在 `CS_REPORTING` 挂 CDR 处理；
- 桥接不改变状态机——B 腿同样走 `CS_NEW → ... → CS_EXECUTE`，bridge 只是让两腿的媒体互通；
- `show channels` 输出的 `Call-State` 列就是当前状态。

## 通道变量

通道变量（channel variable）是挂在 channel 上的键值对，是 FreeSWITCH 传递信息的主要方式：

```bash
# 导出某通道全部变量
fs_cli -x "uuid_dump 5f3a...-..."

# 读写单个变量
fs_cli -x "uuid_getvar 5f3a...-... destination_number"
fs_cli -x "uuid_setvar 5f3a...-... my_flag 1"
```

来源与作用域：

| 途径 | 示例 |
| ---- | ---- |
| 用户目录注入 | `directory` 分机文件 `<variables>` 里的 `effective_caller_id_number` 等 |
| originate 参数 | `{origination_caller_id_number=1000}` 花括号批量注入 |
| 拨号计划 | `<action application="set" data="my_flag=1"/>` |
| SIP 协议映射 | SIP 头部经 profile 配置映射为变量 |
| 全局回落 | 通道上没有的 `${var}` 回落读全局 `$${var}` |

`set` 与 `export` 的区别值得记住：`set` 只影响当前通道；`export` 会把变量"带过桥"传到对端腿（常用于把 A 腿的标记传给 B 腿）。

## 观察通道

```bash
fs_cli
freeswitch@host> show channels
# UUID | Call-State | Name | ... | Codec | 断开原因等

freeswitch@host> show channels as xml   # 机器可读输出
```

排障三连：`show channels` 看腿在不在 → `uuid_dump` 看变量对不对 → `fs_cli` 日志（`/console/loglevel debug`）看每步执行。

## Loopback：把一条腿"折叠"回拨号计划

`user/1001`、`sofia/...` 是直接指向端点的拨号目标；**mod_loopback** 则提供 `loopback/<ext>/<context>` 目标——创建一条虚拟通道重新进入拨号计划。典型用途：

```bash
# 先播一段提示音，再转入 1002 的路由
fs_cli -x "originate loopback/announce &bridge(user/1002)"
```

loopback 通道在状态机里的行为与真实 SIP 通道一致，是构造复杂路由的常用积木。

## 与 SIP 事件的对应

状态机与 SIP 消息的粗略对应：

| 通道状态 | 典型 SIP 事件 |
| ---- | ---- |
| CS_NEW / CS_INIT | 收到 INVITE |
| CS_ROUTING | 查 dialplan（通常毫秒级） |
| CS_EXECUTE | 180 Ringing / 183 Session Progress → 200 OK |
| CS_HANGUP | BYE / CANCEL / 486 Busy |

## 下一步

- [会话 (Session)](/concepts/session)：channel 的脚本封装与 Lua API；
- [路由与拨号计划](/concepts/dialplan)：CS_ROUTING 阶段的规则引擎。
