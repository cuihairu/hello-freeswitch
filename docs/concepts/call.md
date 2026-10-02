# 呼叫 (Call)

**呼叫（call）是用户视角的"一通电话"**：至少两条通道（channel）——主叫腿与被叫腿——通过桥接（bridge）连接后的整体。FreeSWITCH 内部没有"call"这个单一对象，它是 channel 之上的逻辑概念。

## 一次呼叫的完整旅程

以内部分机 1001 呼叫 1002 为例：

```
1001 摘机拨号 ──INVITE──> FreeSWITCH
  1. sofia 收 INVITE，创建 A 腿 channel（1001 的来话）
  2. 进入 dialplan，匹配 1002 的 extension
  3. bridge application 发起 B 腿：向 1002 发 INVITE
  4. 1002 话机振铃（180 Ringing 传回 1001）
  5. 1002 摘机（200 OK），两腿 bridge，RTP 媒体互通
  6. 任一方挂机，两腿分别进入 CS_HANGUP，通话结束
```

A 腿与 B 腿是两条独立 channel，各自有 UUID、变量、状态机；`bridge` 只是让它们的媒体流互通。**计费、录音、转接都是对"腿"操作**，这是理解 FreeSWITCH 行为的钥匙。

## 观察一次呼叫

```bash
fs_cli
freeswitch@host> show calls      # 当前桥接中的通话（A/B 腿 UUID 对）
freeswitch@host> show channels   # 所有通道明细（含未桥接的腿）
```

`show calls` 输出的两行就是同一通电话的两条腿，`Call-State`、`CID Name`、`UUID` 一目了然。

## 用 originate 主动发起呼叫

`originate` 是外部控制呼叫的总入口（`fs_cli`、ESL、脚本通用）：

```bash
# 呼叫分机 1001，接通后执行 echo 应用
fs_cli -x "originate user/1001 &echo()"

# 呼叫 1001 并桥接到 1002（发起完整通话）
fs_cli -x "originate user/1001 &bridge(user/1002)"

# 带通道变量发起，设置主叫显示
fs_cli -x "originate {origination_caller_id_number=1000,ignore_early_media=true}user/1001 &playback(local_stream://moh)"
```

语法拆解：`originate [{变量=值,..}]<被叫> <接通后执行的动作>`，花括号紧跟在被叫拨号串之前。`user/1001` 是目录用户，`sofia/internal/1001@domain` 是等价的 profile 写法；动作以 `&` 开头（`&park()`、`&playback(...)`、`&bridge(...)`）。

## 挂断与转接

```bash
# 按原因码挂断指定通话腿
fs_cli -x "uuid_kill <uuid> NORMAL_CLEARING"

# 全部挂断
fs_cli -x "hupall NORMAL_CLEARING"

# 把通话转接到 1003（可跨 context）
fs_cli -x "uuid_transfer <uuid> 1003 XML default"
```

## 常用通道变量（呼叫维度）

| 变量 | 含义 |
| ---- | ---- |
| `caller_id_name` / `caller_id_number` | 主叫显示名/号码 |
| `destination_number` | 被叫号码（拨号计划的匹配依据） |
| `origination_uuid` | originate 时指定的腿 UUID |
| `hangup_cause` | 挂断原因码，如 `NORMAL_CLEARING`、`NO_ANSWER`、`USER_BUSY` |
| `bridge_channel` | bridge 建立后对端腿的描述 |
| `call_timeout` | 呼叫超时秒数（超时挂断） |

查看某条腿的全部变量：`fs_cli -x "uuid_dump <uuid>"`。

## 呼叫 vs 通道 vs 会话

| 概念 | 层次 | 一句话 |
| ---- | ---- | ---- |
| [通道 Channel](/concepts/channel) | 一条腿 | 一次 SIP 对话端点，有 UUID 与状态机 |
| [会话 Session](/concepts/session) | 脚本视角的腿 | channel 的脚本封装对象 |
| 呼叫 Call | 两条以上腿的组合 | bridge 起来的完整通话 |

## 下一步

- [通道 (Channel)](/concepts/channel)：深入状态机与变量；
- [静态拨号计划](/concepts/static-dialplan)：亲手写出上面这通 1001→1002 的路由。
