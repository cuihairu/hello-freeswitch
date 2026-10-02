# 会话 (Session)

在 FreeSWITCH 中，**会话（session）是从脚本与外部控制视角看到的一条通话通道**——脚本语言（Lua/JavaScript）里拿到的 `session` 对象，就是对一条 channel 的封装，并提供控制它的方法。底层机制见 [通道 (Channel)](/concepts/channel)。

## Session 与 Channel 的关系

- 一通电话的每一条腿（A 方或 B 方）各对应一条 channel；
- 脚本被执行时，FreeSWITCH 把当前 channel 包装成 session 对象传入；
- 对 session 的每个操作（应答、播放、挂断），最终都作用在对应的 channel 状态机上。

```
   A 方话机 ──SIP──> [channel A] <──封装──> session 对象（脚本可见）
                                            │ bridge
   B 方话机 ──SIP──> [channel B] <──封装──> session 对象（B 腿脚本可见）
```

## Lua 中的 session 对象

拨号计划里用 `lua` application 调脚本时，session 自动可用：

```lua
-- conf/dialplan 里被 <action application="lua" data="demo.lua"/> 调起
session:answer()                                   -- 应答
session:sleep(500)                                 -- 等 500ms
session:playback("tone_stream://%(1000,500,800)")  -- 播 800Hz 提示音 1s
local cid = session:getVariable("caller_id_number")
session:consoleLog("info", "来电号码: " .. tostring(cid) .. "\n")
session:hangup("NORMAL_CLEARING")                  -- 挂断并给原因码
```

常用方法速查：

| 方法 | 作用 |
| ---- | ---- |
| `answer()` | 应答（完成 200 OK/ACK，媒体建立） |
| `ready()` | 会话是否仍然可用（未挂断、未出错） |
| `playback(file)` | 播放音频文件或流（`tone_stream://`、`local_stream://`、`shout://`） |
| `playAndGetDigits(...)` | 播放提示并收 DTMF，常用于 IVR |
| `getVariable(name)` / `setVariable(name, value)` | 读写通道变量 |
| `execute(app, data)` | 执行任意 dialplan application，如 `execute("record_session", "/tmp/1.wav")` |
| `transfer(ext, dialplan, context)` | 把当前会话转到新的拨号计划流程 |
| `hangup(cause)` | 挂断，cause 为 Q.850/SIP 原因码，如 `NORMAL_CLEARING`、`USER_BUSY` |
| `setHangupHook(fn)` | 注册挂断回调，收尾清理放这里 |

收 DTMF 的标准写法：

```lua
-- 参数: 最少位, 最多位, 重试次数, 超时ms, 结束符, 提示音, 出错音, 存入变量, 校验正则
local digits = session:playAndGetDigits(1, 4, 3, 5000, "#",
    "phrase:ivr-enter_ext",          -- 提示音
    "phrase:ivr-that_was_an_invalid_entry",
    "my_digits", "\\d+")
session:consoleLog("info", "用户输入: " .. digits .. "\n")
```

## ESL 中的 session 视角

外部程序通过 ESL（Event Socket Library）控制 FreeSWITCH 时没有脚本 session 对象，但可以：

- **inbound 连接**：直接发 `originate`、`uuid_transfer` 等命令操作任意通话；
- **outbound 连接**：让 FreeSWITCH 把新通话"交给"外部程序（socket application），程序内以事件流的方式拿到该 channel 的全部变量与生命周期事件，等价于一个远程 session 处理器。

ESL 编程详见本手册高级功能篇。

## 生命周期与注意事项

1. session 随 channel 进入 `CS_EXECUTE`（执行 application/脚本）而生，随 `CS_HANGUP` 而死；
2. 脚本里任何操作前先判断 `session:ready()`，挂断后继续操作会抛错或静默失败；
3. `playback` 的参数可以是本地文件（相对 `sounds_dir`）、内置流或网络流，文件不存在会静默失败，排障时看 `fs_cli` 的日志级别 `INFO`；
4. 挂断原因码贯穿计费与报表：正常结束是 `NORMAL_CLEARING`，对端拒接是 `CALL_REJECTED`，无人接听是 `NO_ANSWER`。

## 相关阅读

- [通道 (Channel)](/concepts/channel)：session 背后的状态机与变量；
- [呼叫 (Call)](/concepts/call)：两条 session 如何被 bridge 成完整通话；
- [动态拨号计划](/concepts/dynamic-dialplan)：脚本驱动的路由实战。
