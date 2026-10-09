# 脚本与编程接口

当拨号计划的表达力不够时，FreeSWITCH 提供两个方向的"编程出口"：一是内嵌脚本引擎（首选 Lua），二是 ESL（Event Socket Library）——外部程序通过 8021 端口连进来，把整个交换机当 API 用。本章讲 Lua 环境、JavaScript 的现状、ESL 协议概貌，并给出一个只用 Python 标准库、可直接运行的 inbound 客户端。

## Lua 环境

### 模块与配置

Lua 由 `mod_lua` 提供，模块加载后读取 `conf/autoload_configs/lua.conf.xml`：

```xml
<configuration name="lua.conf" description="LUA Configuration">
  <settings>
    <!-- 追加 Lua 脚本搜索目录（会 pre-pend 到 LUA_PATH） -->
    <!-- <param name="script-directory" value="$${script_dir}/?.lua"/> -->

    <!-- 启动时后台运行的常驻脚本，可以配置多行 -->
    <!--<param name="startup-script" value="startup_script_1.lua"/>-->

    <!-- 事件钩子：把某类事件交给脚本处理（见第 10 章） -->
    <!--<hook event="CUSTOM" subclass="conference::maintenance" script="catch-event.lua"/>-->
  </settings>
</configuration>
```

- `script-directory`：额外的脚本搜索目录；
- `startup-script`：FreeSWITCH 启动时自动在后台线程跑起来的常驻脚本，适合做事件监听、定时任务；
- `<hook>`：声明式的事件订阅，事件到达时执行指定脚本；
- `xml-handler-script` / `xml-handler-bindings`：让 Lua 脚本代替静态 XML 提供配置（如动态拨号计划），是 [动态拨号计划](/concepts/dynamic-dialplan) 的又一条路线。

### 脚本目录与调用方式

不写绝对路径时，脚本从全局变量 `$${script_dir}` 指向的目录里找（编译安装默认是安装目录下的 `scripts/`），也可以在 `lua.conf.xml` 里用 `script-directory` 追加目录。调用方式有四种：

| 方式 | 用法 | 场景 |
| ---- | ---- | ---- |
| dialplan application | `<action application="lua" data="demo.lua"/>` | 通话流程脚本，session 对象自动可用 |
| `lua` API | `fs_cli` 里 `lua demo.lua [args]` | 同步执行，脚本用全局 `stream:write()` 写出的内容作为 API 结果返回 |
| `luarun` API | `fs_cli` 里 `luarun demo.lua [args]` | 在后台线程运行，适合常驻脚本，立即返回 `+OK` |
| `startup-script` | `lua.conf.xml` | 随 FreeSWITCH 启动的常驻脚本 |

带参数调用时，参数会进入脚本的全局表 `argv`：`lua demo.lua a b` 对应 `argv[0]='demo.lua'`、`argv[1]='a'`、`argv[2]='b'`。

### Lua 脚本示例：IVR 收号

一个完整可跑的小 IVR：应答后播放提示音收 1~4 位分机号，收号成功转接，失败放再见音挂断。脚本放在 `$${script_dir}` 指向的目录（编译安装默认是安装目录下的 `scripts/`，如 `/usr/local/freeswitch/scripts/`）里，取名 `ivr.lua`：

```lua
-- ivr.lua：放在脚本目录（script_dir）下
-- 拨 5000 进入：播提示音收分机号，# 结束，收齐后转接
session:answer()
session:sleep(500)

-- playAndGetDigits(最少位数, 最多位数, 重试次数, 单次超时ms,
--                 结束键, 提示音, 出错提示音, 结果存入的通道变量, 校验正则)
local digits = session:playAndGetDigits(
    1, 4,
    3, 5000,
    "#",
    "ivr/ivr-enter_ext.wav",
    "ivr/ivr-that_was_an_invalid_entry.wav",
    "ivr_digits",
    "\\d+")

-- 通话可能已挂断，先确认再继续操作
if not session:ready() then
    return
end

freeswitch.consoleLog("notice", "IVR 收到分机号: " .. tostring(digits) .. "\n")

if digits and digits ~= "" then
    -- 交给 XML 拨号计划继续路由到对应分机
    session:transfer(digits, "XML", "default")
else
    session:playback("ivr/ivr-thank_you.wav")
    session:hangup("NORMAL_CLEARING")
end
```

配套的拨号计划入口：

```xml
<extension name="ivr_demo">
  <condition field="destination_number" expression="^5000$">
    <action application="lua" data="ivr.lua"/>
  </condition>
</extension>
```

提示音文件相对 `sounds_dir` 查找（vanilla 声音包即 `en/us/callie` 目录，里面的 `ivr/`、`vm/` 子目录存放上面的提示音）。session 对象的完整方法列表见[会话 (Session)](/concepts/session)。

## JavaScript 环境

老教程里常见的 `mod_spidermonkey`（JavaScript，API 命令 `jsrun`）**在 FreeSWITCH 1.10 里已经没有了**：它只在 1.2.x 时代的源码树里发布，从 1.4 起就被移出源码，此后再未回归。所以：

- 任何 `mod_spidermonkey` / `jsrun` 的用法在 1.10 上都跑不起来，查资料时注意甄别年代；
- 内嵌脚本一律建议 Lua——这是 1.10 起唯一开箱即用的脚本引擎（mod_v8 在源码树里，但需要 V8 依赖，默认构建不启用）；
- 如果团队技术栈是 JavaScript，不要强求内嵌脚本，改用 Node.js 写 ESL 外部程序（见下文），把 FreeSWITCH 当事件源和命令通道，架构上更清晰。

1.11 系列还要多一层甄别：1.11.0 从源码树移除了 `mod_python`（`mod_python3` 保留）与约 30 个遗留模块（mod_h26x、mod_portaudio、mod_rayo 等），并把正则引擎迁移到 PCRE2，官方提示存在破坏性变更。引用 1.10 及更早教程里的模块名与正则写法时，先到官方 Release 说明确认是否还在。

## ESL 概述

ESL（Event Socket Library）是 FreeSWITCH 的事件套接字：mod_event_socket 监听一个 TCP 端口，外部程序连上后既能收全部事件，也能发 API 命令。它有两种工作模式：

### inbound：外部程序主动连接

由 `conf/autoload_configs/event_socket.conf.xml` 控制：

```xml
<configuration name="event_socket.conf" description="Socket Client">
  <settings>
    <param name="listen-ip" value="::"/>
    <param name="listen-port" value="8021"/>
    <param name="password" value="ClueCon"/>
    <!--<param name="apply-inbound-acl" value="loopback.auto"/>-->
  </settings>
</configuration>
```

默认监听 8021，密码 `ClueCon`。inbound 模式下程序连上、`auth` 认证后拥有整台交换机的控制权：订阅事件、执行 API、发起呼叫。适合做控制中心、监控网关。

### outbound：FreeSWITCH 把通话交给外部程序

dialplan 里用 `socket` application 把一条新通话"递"给你的程序：

```xml
<action application="socket" data="127.0.0.1:8084 async full"/>
```

- 第一个参数是外部程序监听的地址（可写多个地址用 `|` 分隔做主备）；
- `async`：异步模式，你的程序可以在通话过程中发命令；
- `full`：完整控制模式，可以像 inbound 一样使用全部命令。

outbound 连接免认证，且天然只针对这一通电话：程序接受连接后先发 `connect`，FreeSWITCH 会回一条序列化好的 `CHANNEL_DATA` 事件（包含该通道的全部变量），之后就能用 `sendmsg` 执行 application、应答、挂断，配合 `myevents`、`linger` 控制事件与挂断时机。适合做呼叫中心的自定义媒体流程、验证码外呼等"一通电话一个会话"的场景。

协议细节（`event`、`bgapi`、`BACKGROUND_JOB` 取异步结果、自定义事件）见第 10 章「事件系统」。

## ESL 编程示例

### 协议回顾

ESL 是简单的文本协议：一条消息由头部（`Content-Type`、`Content-Length` 等）加可选正文组成，正文长度由 `Content-Length` 给出。inbound 流程：

1. 连接后服务端发 `Content-Type: auth/request`；
2. 客户端发 `auth ClueCon`（两行：命令 + 空行）；
3. 服务端回 `command/reply`，`Reply-Text: +OK accepted` 表示通过；
4. 之后可以发 `event plain ...` 订阅事件、`api ...` 同步执行命令、`bgapi ...` 异步执行。

### Python 示例（仅标准库）

下面的脚本只用标准库 `socket`，实现认证 → `show calls` → 用 `bgapi originate` 呼起一通电话并取回结果，保存为 `esl_demo.py` 即可运行（`1001` 需是已注册的分机）：

```python
#!/usr/bin/env python3
"""最小 ESL inbound 客户端：认证 -> show calls -> bgapi originate 一通电话。

只用标准库 socket，便于看清 ESL 文本协议；生产环境建议用官方
ESL 库（FreeSWITCH 源码 libs/esl 自带多语言绑定）。
"""

import socket


class ESLClient:
    """FreeSWITCH Event Socket（inbound）极简客户端。"""

    def __init__(self, host="127.0.0.1", port=8021, password="ClueCon", timeout=10.0):
        self.sock = socket.create_connection((host, port), timeout)
        self.password = password

    # ---------- 协议底层 ----------

    def _read_line(self):
        buf = bytearray()
        while not buf.endswith(b"\n"):
            chunk = self.sock.recv(1)
            if not chunk:
                raise ConnectionError("连接被 FreeSWITCH 关闭")
            buf += chunk
        return buf.decode("utf-8", "replace").rstrip("\r\n")

    def _recv_headers(self):
        """读一串头部，遇到空行结束。"""
        headers = {}
        while True:
            line = self._read_line()
            if not line:
                break
            name, _, value = line.partition(":")
            headers[name.strip()] = value.strip()
        return headers

    def _recv_message(self):
        """收一条完整消息：头部 + 按 Content-Length 读取的正文。"""
        headers = self._recv_headers()
        length = int(headers.get("Content-Length", 0))
        body = b""
        while len(body) < length:
            chunk = self.sock.recv(length - len(body))
            if not chunk:
                raise ConnectionError("连接被 FreeSWITCH 关闭")
            body += chunk
        return headers, body.decode("utf-8", "replace")

    def _send(self, text):
        self.sock.sendall(text.encode("utf-8"))

    # ---------- 常用操作 ----------

    def authenticate(self):
        headers, _ = self._recv_message()
        if headers.get("Content-Type") != "auth/request":
            raise RuntimeError("没有等到 auth/request: %s" % headers)
        self._send("auth %s\n\n" % self.password)
        headers, _ = self._recv_message()
        if not headers.get("Reply-Text", "").startswith("+OK"):
            raise RuntimeError("认证失败: %s" % headers.get("Reply-Text"))

    def api(self, command):
        """同步执行 api 命令，返回命令输出。"""
        self._send("api %s\n\n" % command)
        headers, body = self._recv_message()
        if headers.get("Content-Type") != "api/response":
            raise RuntimeError("意外的应答: %s" % headers)
        return body

    def cmd(self, command):
        """发送 event / filter 等协议命令，返回 Reply-Text。"""
        self._send("%s\n\n" % command)
        headers, _ = self._recv_message()
        return headers.get("Reply-Text", "")

    def bgapi(self, command):
        """异步执行 api 命令，返回 Job-UUID。"""
        self._send("bgapi %s\n\n" % command)
        headers, _ = self._recv_message()
        reply = headers.get("Reply-Text", "")
        if not reply.startswith("+OK"):
            raise RuntimeError("bgapi 失败: %s" % reply)
        return reply.split("Job-UUID:", 1)[1].strip()

    def wait_event(self, name, job_uuid=None, timeout=30.0):
        """阻塞等待指定事件；给了 job_uuid 则按 Job-UUID 精确匹配。"""
        self.sock.settimeout(timeout)
        while True:
            headers, body = self._recv_message()
            if headers.get("Content-Type") != "text/event-plain":
                continue
            # plain 格式：事件头部若干行 + 空行 + 事件正文
            head, _, event_body = body.partition("\n\n")
            event = {}
            for line in head.splitlines():
                key, _, value = line.partition(":")
                if key:
                    event[key.strip()] = value.strip()
            if event.get("Event-Name") != name:
                continue
            if job_uuid is not None and event.get("Job-UUID") != job_uuid:
                continue
            return event, event_body


def main():
    esl = ESLClient(host="127.0.0.1", port=8021, password="ClueCon")
    esl.authenticate()
    print("== 认证成功 ==")

    print("\n== show calls ==")
    print(esl.api("show calls"))

    print("\n== originate ==")
    # 先订阅 BACKGROUND_JOB，再 bgapi，否则拿不到异步结果
    print(esl.cmd("event plain BACKGROUND_JOB"))
    job_uuid = esl.bgapi("originate user/1001 &echo()")
    print("Job-UUID:", job_uuid)

    event, body = esl.wait_event("BACKGROUND_JOB", job_uuid)
    print("originate 结果:", body.strip())


if __name__ == "__main__":
    main()
```

预期输出大致是：

```text
== 认证成功 ==

== show calls ==
0 total.

== originate ==
+OK event listener enabled plain
Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
originate 结果: +OK 5f2a9b0e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`originate` 返回 `+OK <uuid>` 表示 1001 已被叫起，听筒里是 `echo()` application（会把自己说话的声音回放回来）；1001 未注册时结果会是 `-ERR USER_NOT_REGISTERED`，正好用来验证事件链路。把 `&echo()` 换成 `1002 XML default` 就能桥接到第二个分机。

## 相关阅读

- [会话 (Session)](/concepts/session)：Lua 里 session 对象的方法速查；
- [动态拨号计划](/concepts/dynamic-dialplan)：Lua、mod_xml_curl、ESL 三条动态化路线的取舍；
- [核心配置文件](/configuration/core-files)：`$${script_dir}`、`autoload_configs` 与模块配置加载。
