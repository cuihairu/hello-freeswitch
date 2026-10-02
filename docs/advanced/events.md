# 事件系统

FreeSWITCH 内部是一个事件驱动的系统：通道的每一次状态迁移、每一条 API 命令的执行、每一次挂断，都会以事件（event）的形式广播出来。理解事件系统，等于拿到了观察和控制整个交换机的"旁路"——监控大屏、话单计费、录音联动、外部控制网关，全部建立在事件之上。

## 事件驱动架构

### 事件总线

核心维护着一条全局事件总线（event bus），工作方式可以概括为三步：

1. **产生**：核心状态机与各模块（mod_sofia、mod_dptools……）在运行中不断"发射"事件；
2. **分发**：总线把事件投递给所有命中的订阅者，订阅者之间互不影响；
3. **消费**：内部模块、Lua 脚本、外部 ESL 客户端都可以是订阅者。

关键性质：

- 事件是**广播**语义，同一个事件可以同时被多方收到；
- 事件分发在独立线程里进行，订阅者处理得慢不会阻塞通话主流程；
- 事件先进入订阅者的队列再异步投递，所以 `fs_cli` 里看到的顺序与实际发生顺序基本一致但不是逐帧同步。

在 `fs_cli` 里把日志级别调高（`/log debug`）后，能看到大量事件分发相关的日志，那就是事件总线在运转。

### 事件的结构

一个事件由两部分组成：

- **头部（headers）**：`Name: Value` 形式的键值对。固定有 `Event-Name`、`Core-UUID`、事件时间戳；通道相关事件必然带 `Unique-ID`（channel 的 uuid），以及一组 `Channel-*`、`Caller-*`、`Other-Leg-*` 变量；
- **正文（body）**：可选的变长内容，例如 `BACKGROUND_JOB` 事件的正文就是对应 API 命令的输出结果。

### 常用事件类

事件类定义在源码 `src/include/switch_types.h` 的 `SWITCH_EVENT_*` 枚举里，常用的有：

| 事件 | 触发时机 |
| ---- | ---- |
| `CHANNEL_CREATE` | 通道创建 |
| `CHANNEL_DESTROY` | 通道销毁 |
| `CHANNEL_STATE` | 通道状态机切换（`CS_NEW` → `CS_ROUTING` → `CS_EXECUTE` → `CS_HANGUP` → `CS_DESTROY`） |
| `CHANNEL_CALLSTATE` | 呼叫状态变化（`RINGING`、`EARLY`、`ACTIVE`、`HELD`、`HANGUP` 等） |
| `CHANNEL_ANSWER` | 通道应答 |
| `CHANNEL_PROGRESS` | 收到 180 振铃 |
| `CHANNEL_PROGRESS_MEDIA` | 收到带媒体的 183 |
| `CHANNEL_EXECUTE` / `CHANNEL_EXECUTE_COMPLETE` | 一个 application 开始/结束执行 |
| `CHANNEL_BRIDGE` / `CHANNEL_UNBRIDGE` | 两条腿桥接/解除桥接 |
| `CHANNEL_HANGUP` / `CHANNEL_HANGUP_COMPLETE` | 收到挂断/挂断处理完成 |
| `CHANNEL_PARK` | 通道被 park |
| `API` | 同步 API 命令执行完成 |
| `BACKGROUND_JOB` | `bgapi` 异步命令执行完成 |
| `DTMF` | 通道收到按键 |
| `RECORD_START` / `RECORD_STOP` | 录音开始/结束 |
| `PLAYBACK_START` / `PLAYBACK_STOP` | 放音开始/结束 |
| `CUSTOM` | 自定义事件（带 `Event-Subclass` 子类） |
| `HEARTBEAT` | 心跳 |
| `MODULE_LOAD` / `MODULE_UNLOAD` | 模块加载/卸载 |
| `RELOADXML` | `reloadxml` 执行完成 |
| `STARTUP` / `SHUTDOWN` | FreeSWITCH 启动/关闭 |

以一通 1001 呼 1002 的通话为例，通话中收到的 `CHANNEL_CALLSTATE` 事件（plain 格式，节选）：

```text
Event-Name: CHANNEL_CALLSTATE
Core-UUID: 8f1e0c6c-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Unique-ID: 5f2a9b0e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Channel-State: CS_EXCHANGE_MEDIA
Channel-Call-State: ACTIVE
Channel-Name: sofia/internal/1001@192.168.1.10
Caller-Username: 1001
Caller-Destination-Number: 1002
Call-Direction: inbound
```

监控系统的最小集合通常是 `CHANNEL_CREATE` + `CHANNEL_CALLSTATE` + `CHANNEL_HANGUP_COMPLETE`：足够还原每通电话的起止与过程。

## fs_cli 中的事件订阅

`fs_cli` 本身就是一个 ESL 客户端。其中 `/event`、`/filter`、`/log` 等少数几条命令由 fs_cli 以 ESL 协议原样发给 FreeSWITCH，正好可以用来订阅事件。

### 订阅演示

进入 `fs_cli` 后输入：

```text
freeswitch@fs01> /event plain CHANNEL_CALLSTATE
+OK event listener enabled plain
```

然后拨一通电话，每个通道的呼叫状态变化都会实时打印出来：

```text
RECV EVENT
Event-Name: CHANNEL_CALLSTATE
Core-UUID: ...
Unique-ID: ...
Channel-Call-State: RINGING
...
```

不想刷屏时，可以用 `/noevents` 停止接收。

### fs_cli 事件相关命令

| 命令 | 作用 |
| ---- | ---- |
| `/event plain <事件名>...` | 订阅事件，plain 格式（也可 `json`、`xml`） |
| `/event plain all` | 订阅全部事件 |
| `/nixevent <事件名>...` | 从订阅列表里去掉某些事件 |
| `/noevents` | 关闭事件订阅 |
| `/filter <头名> <值>` | 只收匹配指定头的事件，如 `/filter Unique-ID xxx` |
| `/log <级别>` | 订阅日志事件（如 `/log debug`），`/nolog` 关闭 |

注意：这些命令必须带 `/` 前缀。fs_cli 里不带斜杠的输入会被自动加上 `api ` 前缀作为 API 命令发送，而 `event`、`filter` 是 Event Socket 协议层的命令，不是 API 命令。

## ESL 事件订阅

外部程序用 ESL（Event Socket Library，见第 12 章）连上 8021 端口后，订阅事件的方式与 fs_cli 相同，只是要自己处理协议。

### 连接与认证

裸协议长这样（`telnet 127.0.0.1 8021` 即可观察）：

```text
Content-Type: auth/request

auth ClueCon

Content-Type: command/reply
Reply-Text: +OK accepted
```

### event plain 与 event json

`event` 命令的第一个参数是输出格式，后面跟事件名列表或 `all`：

```text
event plain CHANNEL_CALLSTATE CHANNEL_HANGUP_COMPLETE

Content-Type: command/reply
Reply-Text: +OK event listener enabled plain
```

- `plain`：正文为 `Content-Type: text/event-plain`，事件内容是"头部若干行 + 空行 + 事件正文"，最好解析，也最常用；
- `json`：正文为 `Content-Type: text/event-json`，事件序列化成一个 JSON 对象，适合直接喂给程序；
- `xml`：正文为 `Content-Type: text/event-xml`。

两个容易踩的坑：

1. 只发 `event plain`（不带事件名）会得到 `-ERR no keywords supplied`，至少要写一个事件名；
2. 订阅 `CUSTOM` 自定义事件必须带上子类名，例如 `event plain CUSTOM acd::agent_state`——分发逻辑只把子类名出现在订阅列表里（或没有子类名）的 CUSTOM 事件投递出去。当然 `event plain all` 例外，它收一切。

### myevents 与 filter

- `myevents <uuid> [plain|json|xml]`：只订阅与某个 uuid 相关的通道事件，适合盯着一通电话处理（outbound 模式下常用）；
- `filter <头名> <值>`：在事件订阅之上再加一级头部过滤，如 `filter Unique-ID 5f2a-...`，取消用 `filter delete <头名> <值>`。

## bgapi 与 BACKGROUND_JOB

`api` 命令是同步的：ESL 客户端发出去后要等 FreeSWITCH 执行完才收到 `api/response`。耗时命令（如 `originate`、`show` 大结果集）会把你的事件循环卡住，这时用 `bgapi`：

```text
bgapi originate user/1001 &echo()

Content-Type: command/reply
Reply-Text: +OK Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

命令被丢到后台线程执行，立刻返回一个 `Job-UUID`。执行完成后，事件总线上会广播一条 `BACKGROUND_JOB` 事件：

- 头部：`Job-UUID`、`Job-Command`（命令名）、`Job-Command-Arg`（参数）；
- 正文：命令的输出，等价于同步执行时你将看到的结果。

所以取异步结果的标准姿势是：

```text
event plain BACKGROUND_JOB
bgapi originate user/1001 &echo()
...等待事件，按 Job-UUID 匹配...
```

第 12 章的 Python 示例完整演示了这条链路。

## 自定义事件

`CUSTOM` 事件类是留给业务的：真正区分事件的是它的 `Event-Subclass` 头，命名惯例是 `模块::动作`，如 `sofia::register`、`conference::maintenance`，自己的业务可以用 `业务::动作`，例如 `acd::agent_state`。

### 用 sendevent 发送（ESL 协议层）

`sendevent` 是 Event Socket 协议层的命令（不是 API 命令，所以在 fs_cli 里直接输入会提示找不到命令；要在 ESL 连接上发送）。命令行后面可以跟若干 `头: 值` 行，用空行结束：

```text
sendevent CUSTOM
Event-Subclass: acd::agent_state
Agent: 1001
State: ready

Content-Type: command/reply
Reply-Text: +OK <事件uuid>
```

`Event-Subclass` 之外的行都会成为事件的头部；如果带了 `unique-id` 头，事件还会被投递到对应通道的事件队列里。

### 在 Lua 里发送

脚本内发事件更方便，mod_lua 提供了 `Event` 对象（构造参数是事件名和子类），`addHeader`/`addBody` 之后 `fire()` 即可：

```lua
-- 放在脚本目录（script_dir，如 /usr/local/freeswitch/scripts/）下
local event = freeswitch.Event("CUSTOM", "acd::agent_state")
event:addHeader("Agent", "1001")
event:addHeader("State", "ready")
event:addBody("agent 1001 -> ready at " .. os.date("%Y-%m-%d %H:%M:%S"))
event:fire()
```

这个事件同样出现在事件总线上，任何订阅了 `CUSTOM acd::agent_state`（或 `all`）的消费者都能收到——ESL 客户端、fs_cli、其他 Lua 脚本皆可。

### 在 Lua 里消费事件

不想架设 ESL 服务，也可以让 Lua 常驻订阅。两种方式：

1. `autoload_configs/lua.conf.xml` 里配置 `<hook>`，把某类事件交给脚本处理：

```xml
<hook event="CUSTOM" subclass="acd::agent_state" script="catch-event.lua"/>
```

2. 用 `luarun` 启动常驻脚本，配合 `EventConsumer` 拉取事件：

```lua
-- 放在脚本目录（script_dir）下，luarun watch.lua 启动
local con = freeswitch.EventConsumer("CHANNEL_CALLSTATE")

while true do
  -- pop(参数为 1 时阻塞等待事件)
  local e = con:pop(1)
  if e then
    freeswitch.consoleLog("notice",
      "call state: " .. tostring(e:getHeader("Channel-Call-State")) .. "\n")
  end
end
```

Lua 运行环境的细节（脚本目录、`luarun`、`startup-script`）见第 12 章「脚本与编程接口」。

## 相关阅读

- [会话 (Session)](/concepts/session)：通道变量如何进入事件头，脚本视角的同一套状态机；
- [动态拨号计划](/concepts/dynamic-dialplan)：Lua/ESL 与拨号计划的三条配合路线；
- [核心配置文件](/configuration/core-files)：`autoload_configs` 目录与模块配置的加载方式。
