# 动态拨号计划

当路由规则来自**业务数据库、实时状态或复杂逻辑**时，XML 静态规则就力不从心了。FreeSWITCH 提供三条动态化路线：拨号计划内嵌脚本（Lua）、mod_xml_curl 动态拉取规则、ESL 外部程序接管。

## 路线一：Lua 脚本

拨号计划里用 `lua` application 调起脚本，把整个号码的处理交给代码：

```xml
<!-- dialplan/default/90-dynamic.xml -->
<extension name="dynamic_entry">
  <condition field="destination_number" expression="^9(\d+)$">
    <action application="lua" data="route.lua"/>
  </condition>
</extension>
```

```lua
-- conf/scripts/route.lua
local ext = session:getVariable("destination_number")

if ext == "9000" then
  session:answer()
  session:playback("tone_stream://%(1000,500,800)")
  session:hangup("NORMAL_CLEARING")
elseif ext == "9001" then
  -- 转接到标准拨号计划的 1002
  session:transfer("1002", "XML", "default")
else
  -- 查不到就交给默认路由
  session:transfer(ext, "XML", "default")
end
```

要点：

- 脚本目录由 `autoload_configs/lua.conf.xml` 的 `lua-binding`/脚本路径决定，默认在 `conf/scripts/`；
- `session:transfer(ext, dialplan, context)` 把控制权交回 XML 拨号计划——**动态入口 + 静态落地**是最常见的混合架构；
- 脚本里可用 Lua 标准库连数据库、调 HTTP 接口，路由查询真正"动态"。

## 路线二：mod_xml_curl 动态拉取

mod_xml_curl 在每次需要拨号计划时，把查询参数 POST 到你的 HTTP 接口，由接口**实时返回 XML**。适合把路由整表放到数据库/配置中心。

### 启用

```xml
<!-- autoload_configs/xml_curl.conf.xml -->
<configuration name="xml_curl.conf" description="cURL XML Gateway">
  <bindings>
    <binding name="dialplan">
      <param name="gateway-url" value="http://127.0.0.1:8000/dialplan" bindings="dialplan"/>
    </binding>
  </bindings>
</configuration>
```

`<load module="mod_xml_curl"/>` 加载模块后生效（改绑定需重载模块）。

### 接口契约

请求为 `application/x-www-form-urlencoded`，字段含 `section`（此处为 `dialplan`）、`key_name`（context 名）、`key_value`（context 名）。返回结构：

```xml
<?xml version="1.0" encoding="utf-8"?>
<document type="freeswitch/xml">
  <section name="dialplan">
    <context name="default">
      <extension name="from_db">
        <condition field="destination_number" expression="^(\d+)$">
          <action application="answer"/>
          <action application="playback" data="local_stream://moh"/>
        </condition>
      </extension>
    </context>
  </section>
</document>
```

### 用标准库写一个可跑的示例端点

```python
# dialplan_srv.py — python3 标准库即可运行
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import parse_qs

TEMPLATE = """<?xml version="1.0" encoding="utf-8"?>
<document type="freeswitch/xml">
  <section name="dialplan">
    <context name="{ctx}">
      <extension name="db_route">
        <condition field="destination_number" expression="^(\\d+)$">
          <action application="answer"/>
          <action application="bridge" data="user/$1"/>
        </condition>
      </extension>
    </context>
  </section>
</document>"""

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        form = parse_qs(body.decode())
        ctx = form.get("key_value", ["default"])[0]
        xml = TEMPLATE.format(ctx=ctx).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/xml")
        self.send_header("Content-Length", str(len(xml)))
        self.end_headers()
        self.wfile.write(xml)

HTTPServer(("127.0.0.1", 8000), Handler).serve_forever()
```

```bash
python3 dialplan_srv.py   # 然后 fs_cli -x "reload mod_xml_curl"
```

> mod_xml_curl 也可绑定 `directory`（动态用户目录）、`dialplan`、`phrase`、`tts_engine` 等 section，一个网关即可接管多项配置。

## 路线三：ESL 外部程序接管

ESL（Event Socket Library）让任意语言的程序直连 FreeSWITCH（默认 `127.0.0.1:8021`，口令 `ClueCon`）——**路由与呼叫的发起权完全交给外部代码**。标准库即可完成认证与命令收发：

```python
# esl_client.py — 对运行中的 FreeSWITCH 可直接执行
import socket

def read_msg(sock_file):
    headers = {}
    line = sock_file.readline()
    while line not in (b"\n", b"\r\n"):
        k, _, v = line.decode(errors="replace").partition(":")
        headers[k.strip().lower()] = v.strip()
        line = sock_file.readline()
    body = b""
    if "content-length" in headers:
        body = sock_file.read(int(headers["content-length"]))
    return headers, body

s = socket.create_connection(("127.0.0.1", 8021))
f = s.makefile("rwb")
read_msg(f)                       # auth/request
f.write(b"auth ClueCon\r\n\r\n"); f.flush()
print(read_msg(f))                # +OK accepted
f.write(b"api show calls\r\n\r\n"); f.flush()
print(read_msg(f))                # api/response + 当前通话
s.close()
```

拿到控制权后，`originate` 发起呼叫、`uuid_transfer` 转接、订阅 `event plain ALL` 监听全部事件——业务系统由此成为路由的真正决策者。ESL 详解见本手册高级功能篇。

## 三种路线怎么选

| 路线 | 决策延迟 | 适合 |
| ---- | ---- | ---- |
| Lua 脚本 | 亚毫秒级（进程内） | 复杂分支逻辑、与业务接口联动 |
| mod_xml_curl | 每次路由一次 HTTP 往返 | 路由表在数据库、多机共享配置 |
| ESL 外部控制 | 网络往返 + 外部处理 | 外呼平台、ACD、与业务系统深度集成 |

生产实践通常是：**XML 承载高频固定规则（内线互拨、网关外呼），Lua 承载单号码内的逻辑分支，mod_xml_curl/ESL 承载跨系统的动态决策**。

## 下一步

本章完成基础篇全部内容。模块详解篇将覆盖 Sofia/IVR/会议/网关等模块的具体配置与命令，脚本与 ESL 编程在高级功能篇深入。
