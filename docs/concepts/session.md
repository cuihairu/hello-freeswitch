# Session

In FreeSWITCH, a **session is a call channel as seen from the perspective of scripts and external control** — the `session` object you get in a scripting language (Lua, etc.) is just a wrapper around a single channel, exposing methods to control it. See [Channel](/concepts/channel) for the underlying mechanics.

## The Session–Channel Relationship

- Each leg of a call (the A leg or the B leg) corresponds to one channel;
- When a script runs, FreeSWITCH wraps the current channel into a session object and passes it in;
- Every operation on the session (answer, playback, hangup) ultimately acts on the corresponding channel's state machine.

```
   A-leg phone ──SIP──> [channel A] <──wrapped──> session object (visible to script)
                                       │ bridge
   B-leg phone ──SIP──> [channel B] <──wrapped──> session object (visible to B-leg script)
```

## The Session Object in Lua

When the dialplan invokes a script with the `lua` application, the session is automatically available:

```lua
-- Invoked from conf/dialplan via <action application="lua" data="demo.lua"/>
session:answer()                                   -- answer
session:sleep(500)                                 -- wait 500ms
session:playback("tone_stream://%(1000,500,800)")  -- play an 800Hz tone for 1s
local cid = session:getVariable("caller_id_number")
session:consoleLog("info", "Caller number: " .. tostring(cid) .. "\n")
session:hangup("NORMAL_CLEARING")                  -- hangup with a cause code
```

Quick reference of common methods:

| Method | Effect |
| ---- | ---- |
| `answer()` | Answer (completes 200 OK/ACK, establishes media) |
| `ready()` | Whether the session is still usable (not hung up, no error) |
| `playback(file)` | Play an audio file or stream (`tone_stream://`, `local_stream://`, `shout://`) |
| `playAndGetDigits(...)` | Play a prompt and collect DTMF; commonly used in IVR |
| `getVariable(name)` / `setVariable(name, value)` | Read/write channel variables |
| `execute(app, data)` | Execute any dialplan application, e.g. `execute("record_session", "/tmp/1.wav")` |
| `transfer(ext, dialplan, context)` | Transfer the current session into a new dialplan flow |
| `hangup(cause)` | Hang up; cause is a Q.850/SIP cause code, e.g. `NORMAL_CLEARING`, `USER_BUSY` |
| `setHangupHook(fn)` | Register a hangup callback; put teardown cleanup here |

The standard way to collect DTMF:

```lua
-- Args: min digits, max digits, retries, timeout in ms, end char, prompt, error tone, variable to store in, validation regex
local digits = session:playAndGetDigits(1, 4, 3, 5000, "#",
    "phrase:ivr-enter_ext",          -- prompt tone
    "phrase:ivr-that_was_an_invalid_entry",
    "my_digits", "\\d+")
session:consoleLog("info", "User entered: " .. digits .. "\n")
```

## The Session View via ESL

When an external program controls FreeSWITCH via ESL (Event Socket Library), there is no scripting session object, but you can:

- **inbound connections**: send commands like `originate` and `uuid_transfer` directly to operate on any call;
- **outbound connections**: have FreeSWITCH "hand over" new calls to an external program (the socket application); inside the program you receive all of that channel's variables and lifecycle events as a stream, which is effectively a remote session handler.

For ESL programming notes, see [Scripting and Programming APIs](/advanced/scripting).

## Lifecycle and Caveats

1. The session is born when the channel enters `CS_EXECUTE` (running an application/script) and dies at `CS_HANGUP`;
2. Before any operation in a script, check `session:ready()`; operating after hangup will raise an error or fail silently;
3. The `playback` argument can be a local file (relative to `sounds_dir`), a built-in stream, or a network stream. If the file does not exist it fails silently — when debugging, watch the `INFO` log level in `fs_cli`;
4. The hangup cause code runs through billing and reporting: normal completion is `NORMAL_CLEARING`, rejection by the remote side is `CALL_REJECTED`, and no answer is `NO_ANSWER`.

## Further Reading

- [Channel](/concepts/channel): the state machine and variables behind a session;
- [Call](/concepts/call): how two sessions get bridged into a complete call;
- [Dynamic Dialplan](/concepts/dynamic-dialplan): script-driven routing in practice.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [RFC 3550 · RTP](https://datatracker.ietf.org/doc/html/rfc3550)
- [SignalWire · FreeSWITCH docs](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [events](/advanced/events.md)
- [recording](/advanced/recording.md)
- [scripting](/advanced/scripting.md)
- [call](call.md)
- [channel](channel.md)
- [README](/configuration/README.md)
- [network](/configuration/network.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
