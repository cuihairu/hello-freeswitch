# Scripting & Programming Interfaces

When the dialplan stops being expressive enough, I consider two "programming exits": an embedded script engine (Lua in practice), or ESL (Event Socket Library) — an external program connects on port 8021 and uses the switch as an API. Here I have written down the Lua environment, the current state of JavaScript, the shape of the ESL protocol, and a runnable inbound client that uses only the Python standard library.

## The Lua Environment

### Module and Configuration

Lua is provided by `mod_lua`. Once the module is loaded it reads `conf/autoload_configs/lua.conf.xml`:

```xml
<configuration name="lua.conf" description="LUA Configuration">
  <settings>
    <!-- Additional Lua script search directory (pre-pended to LUA_PATH) -->
    <!-- <param name="script-directory" value="$${script_dir}/?.lua"/> -->

    <!-- Resident scripts started in the background at boot; several lines can be set -->
    <!--<param name="startup-script" value="startup_script_1.lua"/>-->

    <!-- Event hooks: hand a class of events to a script (see the Event System) -->
    <!--<hook event="CUSTOM" subclass="conference::maintenance" script="catch-event.lua"/>-->
  </settings>
</configuration>
```

- `script-directory`: extra script search directories;
- `startup-script`: resident scripts that FreeSWITCH automatically starts in a background thread at boot, suitable for event listeners and scheduled jobs;
- `<hook>`: declarative event subscription that runs the named script when an event arrives;
- `xml-handler-script` / `xml-handler-bindings`: let Lua scripts serve configuration instead of static XML (such as a dynamic dialplan) — another route to [Dynamic Dialplan](/concepts/dynamic-dialplan).

### Scripts Directory and Invocation

If no absolute path is given, scripts are looked up in the directory the global `$${script_dir}` points to (for a build from source the default is `scripts/` under the installation directory); you can also add directories with `script-directory` in `lua.conf.xml`. There are four ways to invoke a script:

| Method | Usage | Scenario |
| ---- | ---- | ---- |
| dialplan application | `<action application="lua" data="demo.lua"/>` | Call-flow scripts; the session object is available automatically |
| `lua` API | `lua demo.lua [args]` in `fs_cli` | Runs synchronously; whatever the script writes with the global `stream:write()` is returned as the API result |
| `luarun` API | `luarun demo.lua [args]` in `fs_cli` | Runs in a background thread, suitable for resident scripts, returns `+OK` immediately |
| `startup-script` | `lua.conf.xml` | Resident script started together with FreeSWITCH |

When invoked with arguments they land in the script's global `argv` table: `lua demo.lua a b` gives `argv[0]='demo.lua'`, `argv[1]='a'`, `argv[2]='b'`.

### Lua Script Example: IVR Digit Collection

A complete, runnable little IVR: answer, play a prompt and collect a 1–4 digit extension number, transfer on success, play a goodbye and hang up on failure. Put the script in the directory `$${script_dir}` points to (for a build from source the default is `scripts/` under the installation directory, e.g. `/usr/local/freeswitch/scripts/`) and name it `ivr.lua`:

```lua
-- ivr.lua: place under the scripts directory (script_dir)
-- Dial 5000 to enter: play a prompt and collect an extension, # terminates, transfer once collected
session:answer()
session:sleep(500)

-- playAndGetDigits(min digits, max digits, retries, per-attempt timeout ms,
--                 terminator key, prompt, error prompt, channel variable holding the result, validation regex)
local digits = session:playAndGetDigits(
    1, 4,
    3, 5000,
    "#",
    "ivr/ivr-enter_ext.wav",
    "ivr/ivr-that_was_an_invalid_entry.wav",
    "ivr_digits",
    "\\d+")

-- the call may already be hung up; confirm before doing anything else
if not session:ready() then
    return
end

freeswitch.consoleLog("notice", "IVR received extension: " .. tostring(digits) .. "\n")

if digits and digits ~= "" then
    -- hand off to the XML dialplan to route to the matching extension
    session:transfer(digits, "XML", "default")
else
    session:playback("ivr/ivr-thank_you.wav")
    session:hangup("NORMAL_CLEARING")
end
```

The matching dialplan entry:

```xml
<extension name="ivr_demo">
  <condition field="destination_number" expression="^5000$">
    <action application="lua" data="ivr.lua"/>
  </condition>
</extension>
```

Prompt files are resolved relative to `sounds_dir` (the vanilla sound pack is the `en/us/callie` directory, whose `ivr/` and `vm/` subdirectories hold the prompts above). See [Session](/concepts/session) for the full method list on the session object.

## The JavaScript Environment

`mod_spidermonkey` (JavaScript, API command `jsrun`), which shows up a lot in older material, **is simply gone in FreeSWITCH 1.10**: it was only shipped in the source tree during the 1.2.x era, was removed from the tree at 1.4, and has never come back. Therefore:

- Any `mod_spidermonkey` / `jsrun` recipe will not run on 1.10; check the era of whatever material you are reading;
- I recommend Lua for embedded scripting in every case — it is the only script engine that works out of the box from 1.10 on (mod_v8 is in the source tree, but it needs the V8 dependency and is not enabled in default builds);
- If your team's stack is JavaScript, do not force yourself into embedded scripting. Write an ESL external program in Node.js instead (below) and treat FreeSWITCH as an event source and command channel — the architecture comes out cleaner.

The 1.11 series has version differences too: 1.11.0 removed `mod_python` (keeping `mod_python3`) and about 30 legacy modules (mod_h26x, mod_portaudio, mod_rayo, and so on) from the source tree, and migrated the regex engine to PCRE2, which the official notes flag as a breaking change. When I cite module names or regex syntax from 1.10 or earlier material, I check against the official release notes first.

## ESL Overview

ESL (Event Socket Library) is FreeSWITCH's event socket: mod_event_socket listens on a TCP port, and an external program connected to it can both receive all events and send API commands. It has two modes of operation:

### inbound: an external program connects

Controlled by `conf/autoload_configs/event_socket.conf.xml`:

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

It listens on 8021 by default, with the password `ClueCon`. In inbound mode a program that has connected and authenticated with `auth` owns the whole switch: subscribe to events, execute APIs, originate calls. A good fit for control centers and monitoring gateways.

### outbound: FreeSWITCH hands the call to an external program

In the dialplan the `socket` application "passes" a new call to your program:

```xml
<action application="socket" data="127.0.0.1:8084 async full"/>
```

- The first argument is the address your external program listens on (several addresses separated by `|` give you primary/backup);
- `async`: asynchronous mode, so your program can send commands while the call is going on;
- `full`: full control mode, where the entire command set is available just like in inbound.

An outbound connection is unauthenticated and inherently scoped to this one call: after the program accepts the connection it sends `connect`, and FreeSWITCH replies with a serialized `CHANNEL_DATA` event containing every variable on the channel. From there you can use `sendmsg` to run applications, answer, and hang up, with `myevents` and `linger` controlling event delivery and hangup timing. A good fit for custom call-center media flows, verification-code outbound calls, and any other "one session per call" scenario.

For protocol details (`event`, `bgapi`, `BACKGROUND_JOB` for async results, custom events) see the [Event System](/advanced/events).

## ESL Programming Example

### Protocol Recap

ESL is a simple text protocol: a message is a set of headers (`Content-Type`, `Content-Length`, etc.) plus an optional body whose length is given by `Content-Length`. The inbound flow:

1. After connecting, the server sends `Content-Type: auth/request`;
2. The client sends `auth ClueCon` (two lines: the command + a blank line);
3. The server replies with `command/reply`, and `Reply-Text: +OK accepted` means success;
4. From there you can send `event plain ...` to subscribe to events, `api ...` to run a command synchronously, and `bgapi ...` to run one asynchronously.

### Python Example (Standard Library Only)

The script below uses only the standard library `socket`. It authenticates → runs `show calls` → places a call with `bgapi originate` and retrieves the result. Save it as `esl_demo.py` and run it (`1001` must be a registered extension):

```python
#!/usr/bin/env python3
"""Minimal ESL inbound client: authenticate -> show calls -> bgapi originate a call.

Uses only the standard library socket, so the ESL text protocol stays visible;
for production prefer the official ESL library (FreeSWITCH libs/esl ships bindings).
"""

import socket


class ESLClient:
    """Minimal FreeSWITCH Event Socket (inbound) client."""

    def __init__(self, host="127.0.0.1", port=8021, password="ClueCon", timeout=10.0):
        self.sock = socket.create_connection((host, port), timeout)
        self.password = password

    # ---------- protocol layer ----------

    def _read_line(self):
        buf = bytearray()
        while not buf.endswith(b"\n"):
            chunk = self.sock.recv(1)
            if not chunk:
                raise ConnectionError("connection closed by FreeSWITCH")
            buf += chunk
        return buf.decode("utf-8", "replace").rstrip("\r\n")

    def _recv_headers(self):
        """Read a run of headers, stopping at a blank line."""
        headers = {}
        while True:
            line = self._read_line()
            if not line:
                break
            name, _, value = line.partition(":")
            headers[name.strip()] = value.strip()
        return headers

    def _recv_message(self):
        """Receive one full message: headers + a body sized by Content-Length."""
        headers = self._recv_headers()
        length = int(headers.get("Content-Length", 0))
        body = b""
        while len(body) < length:
            chunk = self.sock.recv(length - len(body))
            if not chunk:
                raise ConnectionError("connection closed by FreeSWITCH")
            body += chunk
        return headers, body.decode("utf-8", "replace")

    def _send(self, text):
        self.sock.sendall(text.encode("utf-8"))

    # ---------- common operations ----------

    def authenticate(self):
        headers, _ = self._recv_message()
        if headers.get("Content-Type") != "auth/request":
            raise RuntimeError("never got auth/request: %s" % headers)
        self._send("auth %s\n\n" % self.password)
        headers, _ = self._recv_message()
        if not headers.get("Reply-Text", "").startswith("+OK"):
            raise RuntimeError("authentication failed: %s" % headers.get("Reply-Text"))

    def api(self, command):
        """Run an api command synchronously and return the command output."""
        self._send("api %s\n\n" % command)
        headers, body = self._recv_message()
        if headers.get("Content-Type") != "api/response":
            raise RuntimeError("unexpected reply: %s" % headers)
        return body

    def cmd(self, command):
        """Send a protocol command such as event / filter and return Reply-Text."""
        self._send("%s\n\n" % command)
        headers, _ = self._recv_message()
        return headers.get("Reply-Text", "")

    def bgapi(self, command):
        """Run an api command asynchronously and return the Job-UUID."""
        self._send("bgapi %s\n\n" % command)
        headers, _ = self._recv_message()
        reply = headers.get("Reply-Text", "")
        if not reply.startswith("+OK"):
            raise RuntimeError("bgapi failed: %s" % reply)
        return reply.split("Job-UUID:", 1)[1].strip()

    def wait_event(self, name, job_uuid=None, timeout=30.0):
        """Block waiting for a named event; if job_uuid is given, match Job-UUID exactly."""
        self.sock.settimeout(timeout)
        while True:
            headers, body = self._recv_message()
            if headers.get("Content-Type") != "text/event-plain":
                continue
            # plain format: some event header lines + blank line + event body
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
    print("== authenticated ==")

    print("\n== show calls ==")
    print(esl.api("show calls"))

    print("\n== originate ==")
    # subscribe to BACKGROUND_JOB before bgapi, otherwise the async result is lost
    print(esl.cmd("event plain BACKGROUND_JOB"))
    job_uuid = esl.bgapi("originate user/1001 &echo()")
    print("Job-UUID:", job_uuid)

    event, body = esl.wait_event("BACKGROUND_JOB", job_uuid)
    print("originate result:", body.strip())


if __name__ == "__main__":
    main()
```

The expected output looks roughly like this:

```text
== authenticated ==

== show calls ==
0 total.

== originate ==
+OK event listener enabled plain
Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
originate result: +OK 5f2a9b0e-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

`originate` returning `+OK <uuid>` means 1001 has been rung and the handset is playing the `echo()` application (which plays back whatever you say to yourself). If 1001 is not registered the result is `-ERR USER_NOT_REGISTERED`, which is a convenient way to verify the event chain. Swap `&echo()` for `1002 XML default` to bridge to a second extension.

## Further Reading

- [Session](/concepts/session): a quick reference of the session object's methods in Lua;
- [Dynamic Dialplan](/concepts/dynamic-dialplan): the trade-offs between Lua, mod_xml_curl, and ESL as dynamic dialplan routes;
- [Core Configuration Files](/configuration/core-files): `$${script_dir}`, `autoload_configs`, and how module configuration is loaded.

## References

- [SignalWire · Programming and scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis)
- [SignalWire · Scripting integration](https://developer.signalwire.com/freeswitch/integration/scripting)
- [Wikipedia · JSON](https://en.wikipedia.org/wiki/JSON)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [what-is-freeswitch](/introduction/what-is-freeswitch.md)
- [knowledge](/knowledge.md)
- [README](/project/README.md)
- [asr-tts](/project/asr-tts.md)
- [implementation](/project/implementation.md)
- [nlp](/project/nlp.md)
