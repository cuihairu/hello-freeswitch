# Dynamic Dialplan

When routing rules come from a **business database, real-time state, or complex logic**, static XML rules are not up to the task. FreeSWITCH offers three routes to dynamism: scripts embedded in the dialplan (Lua), mod_xml_curl pulling rules on demand, and ESL taking over with an external program.

## Route One: Lua Scripts

In the dialplan, the `lua` application invokes a script, handing the entire handling of the number to code:

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
  -- transfer to 1002 in the standard dialplan
  session:transfer("1002", "XML", "default")
else
  -- if not found, hand off to the default routing
  session:transfer(ext, "XML", "default")
end
```

Key points:

- the script directory is determined by the `lua-binding`/script path in `autoload_configs/lua.conf.xml`; by default it is `conf/scripts/`;
- `session:transfer(ext, dialplan, context)` hands control back to the XML dialplan — **dynamic entry + static landing** is the most common hybrid architecture;
- inside the script you can use the Lua standard library to connect to databases and call HTTP APIs, making routing queries truly "dynamic".

## Route Two: mod_xml_curl On-Demand Fetch

mod_xml_curl POSTs the query parameters to your HTTP endpoint every time a dialplan is needed, and the endpoint **returns XML in real time**. This is well suited to putting the entire routing table in a database or configuration center.

### Enabling

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

`<load module="mod_xml_curl"/>` loads the module and it takes effect (changing a binding requires reloading the module).

### Interface Contract

The request is `application/x-www-form-urlencoded`, with fields `section` (here `dialplan`), `key_name` (context name), `key_value` (context name). The response structure:

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

### A Working Example Endpoint with the Standard Library

```python
# dialplan_srv.py — runnable with the python3 standard library only
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
python3 dialplan_srv.py   # then fs_cli -x "reload mod_xml_curl"
```

> mod_xml_curl can also bind sections such as `directory` (dynamic user directory), `dialplan`, `phrase`, `tts_engine`, etc. — one gateway can take over multiple configuration areas.

## Route Three: ESL External Program Takeover

ESL (Event Socket Library) lets a program in any language connect directly to FreeSWITCH (default `127.0.0.1:8021`, password `ClueCon`) — **routing and call origination are handed entirely to external code**. The standard library is enough to complete authentication and command send/receive:

```python
# esl_client.py — can be run directly against a running FreeSWITCH
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
print(read_msg(f))                # api/response + current calls
s.close()
```

Once you have control, the business system can use `originate` to initiate calls, `uuid_transfer` to transfer, and subscribe to `event plain ALL` to monitor every event, becoming the routing decision-maker. For ESL details see [Scripting and Programming APIs](/advanced/scripting).

## How to Choose Between the Three Routes

| Route | Decision latency | Best for |
| ---- | ---- | ---- |
| Lua script | sub-millisecond (in-process) | complex branching logic, interacting with business APIs |
| mod_xml_curl | one HTTP round trip per routing | routing table in a database, configuration shared across hosts |
| ESL external control | network round trip + external processing | outbound platforms, ACD, deep integration with business systems |

Production practice is usually: **XML carries high-frequency fixed rules (internal calling, gateway outbound), Lua carries the logical branching within a single number, and mod_xml_curl/ESL carries cross-system dynamic decisions**.

## Related Notes

That wraps up the notes on static and dynamic routing. For Sofia, IVR, conference, and gateway configuration and commands see the [Module Notes](/modules/README); for scripting and ESL see [Scripting and Programming APIs](/advanced/scripting).

## References

- [Wikipedia · Dial plan](https://en.wikipedia.org/wiki/Dial_plan)
- [SignalWire · Programming and Scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis)
- [SignalWire · Scripting Integration](https://developer.signalwire.com/freeswitch/integration/scripting)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [events](/advanced/events.md)
- [recording](/advanced/recording.md)
- [scripting](/advanced/scripting.md)
- [dialplan](dialplan.md)
- [session](session.md)
- [static-dialplan](static-dialplan.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [ivr](/modules/ivr.md)
- [asr-tts](/project/asr-tts.md)
- [deployment](/project/deployment.md)
- [implementation](/project/implementation.md)
