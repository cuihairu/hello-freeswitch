# 第 16 章 · 实现智能客服功能

本章把前三章的零件装成整车：IVR 接入来电、语音识别拿到文本、NLP 判定意图、机器人应答或转坐席。所有示例代码都可以直接落地（Lua 片段经 `luac -p` 校验，Python 片段经语法编译校验），并标注了每一步对应的真实命令。

## 客服流程设计

### 一次来电的处理流程

```
来电进入（中继 -> FreeSWITCH）
      |
      v
问题分类 / 工作时段判断
      |
      +-- 非工作时间 --> 播报留言信箱 --> 挂断
      |
      v
IVR 主菜单（按键优先，语音可选）
      |
      +-- 按 0 / 说"人工" -----------> 排队转坐席
      |
      v
语音识别（实时流式，或逐句录音）
      |
      v
NLP 意图识别 + 实体抽取
      |
      +-- 高置信常见问题 --> 播报答案（TTS/预合成） --> 是否已解决?
      |                                              |
      |                            +-----------------+
      |                            |
      |                     未解决 --> 转坐席
      |
      +-- 低置信/无法识别 --> 澄清一次 --> 仍失败 --> 转坐席或留言
      |
      v
挂断：录音归档 + CDR 入库 + 满意度回访
```

### 状态划分

| 状态 | 触发进入 | 典型动作 | 退出条件 |
| ---- | ---- | ---- | ---- |
| `greeting` | 通道应答 | 播欢迎语、放主菜单 | 收到按键或语音结果 |
| `collect` | 需要补充槽位 | 录音/收键、识别 | 槽位齐全或重试超限 |
| `answer` | 意图已确定 | 播报应答内容 | 播完询问是否解决 |
| `transfer` | 客户要求/低置信 | originate 坐席并桥接 | 坐席接起或超时留言 |
| `voicemail` | 坐席全忙/非工作时间 | 录留言 | 录音完成 |
| `done` | 挂断 | 归档、结算 CDR | 通道销毁 |

## IVR 集成：完整 Lua 示例

拨号计划入口（放 `dialplan/default/90-smartcc.xml`）：

```xml
<include>
  <extension name="smart_cc">
    <condition field="destination_number" expression="^(8000)$">
      <action application="answer"/>
      <action application="lua" data="smart_cc.lua"/>
    </condition>
  </extension>
</include>
```

脚本（放 `conf/scripts/smart_cc.lua`）：

```lua
-- conf/scripts/smart_cc.lua — 智能客服 IVR 主流程
-- 依赖：conf/scripts/rule_nlu 的思路在 Lua 侧以关键词表实现（见 handle_text）

local REC_DIR = "/usr/local/freeswitch/recordings"

-- 关键词 -> 动作，最简兜底（云端 NLP 接入前先跑通流程）
local KEYWORDS = {
  { "人工", "transfer" },
  { "话费", "bill" },
  { "套餐", "plan" },
  { "故障", "fault" },
}

local function pick(prompt_files)
  -- prompt_files 支持 "!" 拼接多个提示音
  return session:playAndGetDigits(1, 1, 3, 5000, "#",
    prompt_files, "ivr/ivr-that_was_an_invalid_entry.wav",
    "menu_choice", "\\d")
end

local function record_turn(seconds)
  local path = REC_DIR .. "/" .. session:getVariable("uuid") .. ".wav"
  session:streamFile("ivr/ivr-please_enter_your_number.wav")
  session:recordFile(path, seconds, 500, 3)
  return path, session:getVariable("record_seconds") or "0"
end

local function transfer_to_agent(ext)
  session:execute("set", "hangup_after_bridge=true")
  session:execute("set", "continue_on_fail=true")
  session:execute("set", "call_timeout=30")
  session:execute("bridge", "user/" .. ext)
  -- 走到这里说明桥接失败（坐席未接/全忙）：给留言机会
  if session:ready() then
    session:streamFile("ivr/ivr-busy.wav")
    local path = REC_DIR .. "/vm-" .. session:getVariable("uuid") .. ".wav"
    session:recordFile(path, 60, 500, 5)
  end
end

local function classify_text(text)
  for _, row in ipairs(KEYWORDS) do
    if string.find(text, row[1], 1, true) then
      return row[2]
    end
  end
  return "fallback"
end

-- 主流程
if not session:ready() then return end

session:answer()
session:setAutoHangup(false)
session:sleep(300)

local choice = pick("ivr/ivr-welcome.wav!ivr/ivr-main_menu.wav")

if choice == "0" then
  transfer_to_agent("1001")
elseif choice == "1" or choice == "2" then
  -- 1 查话费 / 2 办套餐：先录一句诉求（真实部署在此接入 ASR/NLP）
  local path, secs = record_turn(15)
  freeswitch.consoleLog("notice",
    string.format("smart_cc: turn recorded %s (%s s)\n", path, secs))
  -- 逐句识别路线：把录音交给后端（ESL 订阅 cc::asr_request 事件）
  local e = freeswitch.Event("custom", "cc::asr_request")
  e:addHeader("unique-id", session:getVariable("uuid"))
  e:addHeader("record-path", path)
  e:fire()
  session:streamFile("ivr/ivr-thank_you.wav")
elseif choice == "9" then
  -- 演示：直接用文本走分类（有 ASR 时替换为转写结果）
  local intent = classify_text("我的话费怎么查询")
  if intent == "bill" then
    session:streamFile("ivr/your_bill_is_ready.wav")
  end
else
  session:streamFile("ivr/ivr-goodbye.wav")
  session:hangup("NORMAL_CLEARING")
end
```

要点：

- `session:playAndGetDigits(min, max, tries, timeout, 终止键, 提示音, 错误提示音, 变量名, 正则)` 是 Lua 里做 IVR 菜单的主力 API，提示音用 `!` 拼接多段；
- `recordFile(路径, 最长秒, 静音阈值, 静音秒)` 录完后 FreeSWITCH 自动写入 `record_seconds`、`record_samples` 通道变量；
- `bridge` 前 `set hangup_after_bridge=true` 与 `continue_on_fail=true`，保证坐席挂断时整通电话结束、坐席未接时脚本还能继续走；
- 脚本里 `freeswitch.Event(...):fire()` 发出的自定义事件，就是后端 ESL 订阅的入口。

## 实时语音识别与应答

### 事件驱动的后端主循环

FreeSWITCH 是事件机器，后端的正确形态是"订阅-分发"循环，而不是"每通电话一个线程轮询"。骨架如下（协议层与 [动态拨号计划](/concepts/dynamic-dialplan) 的 `esl_client.py` 相同）：

```python
# cc_worker.py — 智能客服 ESL 后端（骨架 + 伪代码混合，伪代码处已标注）
import json
import socket

# 注意：CUSTOM 之后的词都会被当作自定义子类，因此它必须放在订阅列表最后
EVENTS = ("plain CHANNEL_ANSWER CHANNEL_HANGUP_COMPLETE "
          "BACKGROUND_JOB CUSTOM cc::asr_request")


def read_message(sock_file):
    headers, body = {}, b""
    line = sock_file.readline()
    while line not in (b"\n", b"\r\n"):
        k, _, v = line.decode(errors="replace").partition(":")
        headers[k.strip().lower()] = v.strip()
        line = sock_file.readline()
    if "content-length" in headers:
        body = sock_file.read(int(headers["content-length"]))
    return headers, body


def api(sock_file, command):
    sock_file.write(f"api {command}\r\n\r\n".encode())
    sock_file.flush()
    return read_message(sock_file)          # (响应头, 响应体)


def connect(host, port, password):
    s = socket.create_connection((host, port))
    f = s.makefile("rwb")
    read_message(f)                          # auth/request
    f.write(f"auth {password}\r\n\r\n".encode()); f.flush()
    read_message(f)                          # +OK accepted
    f.write(f"event {EVENTS}\r\n\r\n".encode()); f.flush()
    read_message(f)
    return s, f


def handle_call(conn, uuid, state):
    # 伪代码：挂在媒体 bug 推流给 ASR（已编译安装 mod_audio_stream 时）
    #   api(f, f"uuid_audio_stream {uuid} start ws://asr:9090 mixed 8k {uuid}")
    # ASR 服务回调/消息队列里拿到转写文本后：
    #   intent, reply = nlp(text, state)            # 第 15 章的 NLP 网关
    #   api(f, f"uuid_broadcast {uuid} /srv/prompts/{intent}.wav both")
    # 转人工（先发起坐席腿并停入 park，再桥接两腿）：
    #   api(f, "originate user/1001 &park()")       # 从 BACKGROUND_JOB 拿坐席腿 UUID
    #   api(f, f"uuid_bridge <agent_uuid> {uuid}")
    pass


def main():
    s, f = connect("127.0.0.1", 8021, "ClueCon")
    while True:
        headers, body = read_message(f)
        if headers.get("content-type") != "text/event-plain":
            continue
        event = {}
        for line in body.decode(errors="replace").splitlines():
            k, _, v = line.partition(": ")
            if _:
                event[k.strip()] = v.strip()
        name = event.get("Event-Name", "")
        uuid = event.get("Unique-ID", "")
        if name == "CHANNEL_ANSWER":
            handle_call(None, uuid, {"stage": "greeting"})
        elif name == "CHANNEL_HANGUP_COMPLETE":
            # 伪代码：归档录音、关闭 ASR 流、更新状态机
            pass


if __name__ == "__main__":
    main()
```

`text/event-plain` 事件体的解析按 FreeSWITCH 的 `Header: Value` 行格式逐行读，`Event-Name` 与 `Unique-ID` 是最常用的两个头。

### 关键真实命令速查

后端能对通话做的每一步，都对应一条可以在 `fs_cli -x` 里先手工验证的命令：

| 目的 | 命令 |
| ---- | ---- |
| 看当前通话 | `show channels` |
| 开始抓流送 ASR | `uuid_audio_stream <uuid> start ws://asr:9090 mixed 8k <tag>`（需安装 mod_audio_stream） |
| 对整通录音 | `uuid_record <uuid> start /recordings/<uuid>.wav` |
| 播一段音频 | `uuid_broadcast <uuid> /srv/prompts/reply.wav both` |
| 转接到分机 | `uuid_transfer <uuid> 1001 XML default` |
| 查全部通道变量 | `uuid_dump <uuid>` |
| 强拆通话 | `uuid_kill <uuid>` |

先用 `fs_cli -x "uuid_broadcast <真实uuid> /path/x.wav both"` 在一通测试电话上验证，再写进后端代码，能省掉大量调试时间。

## NLP 处理与响应：会话状态机

把第 15 章的 NLP 网关接到状态机上。核心是一个以通话 UUID 为键的会话表，每个状态一个处理函数：

```python
# cc_fsm.py — 会话状态机（业务逻辑层）
import rule_nlu                      # 第 15 章的规则兜底


class Session:
    def __init__(self, uuid, caller):
        self.uuid = uuid
        self.caller = caller
        self.stage = "greeting"
        self.slots = {}              # 意图所需槽位
        self.retries = 0


class Flow:
    """dispatch 返回 (下一状态, 对通话的动作描述)。"""

    def __init__(self, nlp=rule_nlu.classify):
        self.nlp = nlp

    def dispatch(self, sess, text=None):
        if sess.stage == "greeting":
            return self._greeting(sess, text)
        if sess.stage == "collect":
            return self._collect(sess, text)
        if sess.stage == "answer":
            return self._answer(sess, text)
        return ("done", None)

    def _greeting(self, sess, text):
        if text is None:                       # 刚应答，先放菜单
            return ("collect", "play welcome_and_menu")
        intent, conf = self.nlp(text)
        if intent == "转人工":
            return ("transfer", "bridge agent group")
        if conf < 0.5:
            sess.retries += 1
            if sess.retries >= 2:
                return ("transfer", "bridge agent group")
            return ("collect", "play clarify_prompt")
        sess.slots["intent"] = intent
        missing = self._missing_slots(intent, sess.slots)
        if missing:
            sess.stage = "collect"
            return ("collect", f"play ask_{missing[0]}")
        return ("answer", f"play answer_{intent}")

    def _collect(self, sess, text):
        if text:
            sess.slots.setdefault("last_text", text)
        intent = sess.slots.get("intent", "查话费")
        if self._missing_slots(intent, sess.slots):
            sess.retries += 1
            if sess.retries >= 3:
                return ("voicemail", "record message")
            return ("collect", f"play ask_{self._missing_slots(intent, sess.slots)[0]}")
        return ("answer", f"play answer_{intent}")

    def _answer(self, sess, text):
        if text and self.nlp(text)[0] == "转人工":
            return ("transfer", "bridge agent group")
        return ("done", "play satisfaction_survey")

    @staticmethod
    def _missing_slots(intent, slots):
        required = {"查话费": ["period"], "办套餐": ["plan_name"], "报故障": ["address"]}
        return [s for s in required.get(intent, []) if s not in slots]
```

状态机与 FreeSWITCH 的耦合只发生在"动作描述"这一层——由外层执行器把 `play answer_查话费` 翻译成 `uuid_broadcast`、把 `bridge agent group` 翻译成 `originate + uuid_bridge`。这样状态机可以脱离交换机单测。

## 测试与调优

### 测试场景清单

| 场景 | 操作 | 预期 |
| ---- | ---- | ---- |
| 主流程-按键 | 拨 8000 → 按 1 | 录音生成、`cc::asr_request` 事件出现 |
| 主流程-语音 | 拨 8000 说"查话费" | 意图 `查话费`，播报话费提示 |
| 澄清 | 说不相关的话 | 播澄清提示，2 次失败转坐席 |
| 转坐席-成功 | 按 0，坐席应答 | 双方通话正常，挂断后 CDR 与录音归档 |
| 转坐席-失败 | 坐席注销后按 0 | 30 秒超时转留言 |
| 打断 | 应答播报中说话 | （流式方案）能在合理时间内响应 |
| 异常-ASR 超时 | 停掉 ASR 服务 | 降级到按键菜单，呼叫不受阻 |
| 并发 | 并发 20 路跑主流程 | 无串音、无泄漏通道、时延达标 |

### 并发压测：originate 脚本

用 loopback 端点批量制造通话（先确保拨号计划里有 8000 这个客服入口）：

```bash
#!/usr/bin/env bash
# load_test.sh — loopback 并发压测
# 用法: ./load_test.sh [并发数] [间隔秒]
set -u
COUNT=${1:-20}
INTERVAL=${2:-0.2}

for i in $(seq 1 "$COUNT"); do
  fs_cli -x "originate loopback/8000 &park()" >/dev/null
  sleep "$INTERVAL"
done

fs_cli -x "show channels count"
fs_cli -x "status"
```

压测时观察三处：

- `show channels count` 的通道数是否随挂断回落（不回落即有通道泄漏）；
- `status` 输出的 Sessions 与 SPS（每秒会话数）是否逼近 `switch.conf.xml` 里 `max-sessions`、`sessions-per-second` 的限制；
- 服务器 CPU 与 ASR 服务的并发配额——瓶颈往往不在 FreeSWITCH。

真实的 SIP 级压测再上 [SIPp](https://github.com/SIPp/sipp) 之类的工具，模拟注册、呼叫与 RTP 收发。

### 体验改进点

- **缩短静默**：提示音之间加 `sleep` 间隔要克制；静音判定阈值（`recordFile` 的 silence threshold）调到"客户停下就收句"，太灵敏会把换气当句尾；
- **播报优先预合成**：动态文本才走 TTS，且 TTS 结果缓存成文件复用；
- **失败路径可视化**：每一次"识别失败/转人工"都落库，周末复盘高频失败话术，补规则词与提示音；
- **按键与语音并存**：菜单永远保留按键直选（"查话费请按 1，也可以直接说"），语音只是效率增强，不是唯一通道；
- **坐席等待体验**：排队时播报队列位置或预计等待，比无限循环等待音乐体验好得多。

## 相关阅读

- [模块详解篇 · IVR](/modules/ivr)：内置 IVR 菜单（`ivr_menus/`）的配置写法，可与本章 Lua 方案二选一；
- [录音与监听](/advanced/recording)：本章用到的录音 API 与路径变量完整说明；
- [脚本与编程接口](/advanced/scripting)：mod_lua 脚本 API 全集；
- [事件系统](/advanced/events)：ESL 事件订阅、自定义事件的更多细节；
- [第 17 章 · 部署与运维](/project/deployment)：这套系统上线后的运行与排障。
