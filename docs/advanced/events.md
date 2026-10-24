# Event System

FreeSWITCH is an event-driven system internally: every channel state transition, every API command execution, every hangup gets broadcast out as an event. Understanding the event system is the same as getting a side channel for observing and controlling the whole switch — monitoring dashboards, CDR billing, recording hooks, external control gateways, everything is built on events.

## Event-Driven Architecture

### The Event Bus

The core maintains a single global event bus. Its working model reduces to three steps:

1. **Produce**: the core state machine and each module (mod_sofia, mod_dptools, …) keep "firing" events as they run;
2. **Dispatch**: the bus delivers the event to every matching subscriber, and subscribers do not affect one another;
3. **Consume**: internal modules, Lua scripts, and external ESL clients can all be subscribers.

Key properties:

- Events have **broadcast** semantics — the same event can be received by many parties at once;
- Event dispatch happens on a separate thread, so a slow subscriber does not block the main call flow;
- Events enter the subscriber's queue first and are delivered asynchronously, so the order you see in `fs_cli` broadly matches the order they actually happened, but it is not frame-synchronized.

Turn the log level up in `fs_cli` (`/log debug`) and you will see a flood of event-dispatch related log lines — that is the event bus running.

### Anatomy of an Event

An event is made of two parts:

- **Headers**: key/value pairs in `Name: Value` form. `Event-Name`, `Core-UUID`, and the event timestamp are always present; channel-related events always carry `Unique-ID` (the channel's uuid), plus a set of `Channel-*`, `Caller-*`, and `Other-Leg-*` variables;
- **Body**: optional variable-length content. For a `BACKGROUND_JOB` event the body is the output of the corresponding API command.

### Common Event Classes

Event classes are defined in the `SWITCH_EVENT_*` enum in `src/include/switch_types.h` in the source tree. The ones you reach for most:

| Event | When it fires |
| ---- | ---- |
| `CHANNEL_CREATE` | Channel created |
| `CHANNEL_DESTROY` | Channel destroyed |
| `CHANNEL_STATE` | Channel state machine transitions (`CS_NEW` → `CS_ROUTING` → `CS_EXECUTE` → `CS_HANGUP` → `CS_DESTROY`) |
| `CHANNEL_CALLSTATE` | Call state changes (`RINGING`, `EARLY`, `ACTIVE`, `HELD`, `HANGUP`, etc.) |
| `CHANNEL_ANSWER` | Channel answered |
| `CHANNEL_PROGRESS` | 180 Ringing received |
| `CHANNEL_PROGRESS_MEDIA` | 183 with media received |
| `CHANNEL_EXECUTE` / `CHANNEL_EXECUTE_COMPLETE` | An application starts / finishes executing |
| `CHANNEL_BRIDGE` / `CHANNEL_UNBRIDGE` | Two legs bridge / unbridge |
| `CHANNEL_HANGUP` / `CHANNEL_HANGUP_COMPLETE` | Hangup received / hangup handling complete |
| `CHANNEL_PARK` | Channel parked |
| `API` | Synchronous API command finished executing |
| `BACKGROUND_JOB` | `bgapi` asynchronous command finished executing |
| `DTMF` | Channel received a key press |
| `RECORD_START` / `RECORD_STOP` | Recording started / stopped |
| `PLAYBACK_START` / `PLAYBACK_STOP` | Playback started / stopped |
| `CUSTOM` | Custom event (carries an `Event-Subclass`) |
| `HEARTBEAT` | Heartbeat |
| `MODULE_LOAD` / `MODULE_UNLOAD` | Module loaded / unloaded |
| `RELOADXML` | `reloadxml` finished executing |
| `STARTUP` / `SHUTDOWN` | FreeSWITCH started / shut down |

Take a call from 1001 to 1002 as an example. A `CHANNEL_CALLSTATE` event received during the call (plain format, excerpt):

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

The minimal set for a monitoring system is usually `CHANNEL_CREATE` + `CHANNEL_CALLSTATE` + `CHANNEL_HANGUP_COMPLETE`: enough to reconstruct the start, end, and progression of every call.

## Subscribing to Events in fs_cli

`fs_cli` is itself an ESL client. A few of its commands — `/event`, `/filter`, `/log` — are sent by fs_cli to FreeSWITCH verbatim over the ESL protocol, which makes them usable for subscribing to events.

### Subscription Example

After entering `fs_cli`, type:

```text
freeswitch@fs01> /event plain CHANNEL_CALLSTATE
+OK event listener enabled plain
```

Then place a call and every channel's call state changes print out in real time:

```text
RECV EVENT
Event-Name: CHANNEL_CALLSTATE
Core-UUID: ...
Unique-ID: ...
Channel-Call-State: RINGING
...
```

When you want to stop the screen flood, use `/noevents` to stop receiving.

### Event Commands in fs_cli

| Command | What it does |
| ---- | ---- |
| `/event plain <event-name>...` | Subscribe to events in plain format (also `json` and `xml`) |
| `/event plain all` | Subscribe to all events |
| `/nixevent <event-name>...` | Remove certain events from the subscription list |
| `/noevents` | Turn off event subscription |
| `/filter <header-name> <value>` | Only receive events matching a given header, e.g. `/filter Unique-ID xxx` |
| `/log <level>` | Subscribe to log events (e.g. `/log debug`); `/nolog` turns it off |

Note: these commands must keep the `/` prefix. Anything you type in fs_cli without a slash gets an `api ` prefix automatically and is sent as an API command, whereas `event` and `filter` are Event Socket protocol-level commands, not API commands.

## Subscribing to Events over ESL

An external program connects on port 8021 using ESL (Event Socket Library, see Scripting & Programming Interfaces) and subscribes to events the same way as fs_cli, except it has to handle the protocol itself.

### Connecting and Authenticating

The raw protocol looks like this (`telnet 127.0.0.1 8021` shows it):

```text
Content-Type: auth/request

auth ClueCon

Content-Type: command/reply
Reply-Text: +OK accepted
```

### event plain and event json

The first argument to the `event` command is the output format, followed by a list of event names or `all`:

```text
event plain CHANNEL_CALLSTATE CHANNEL_HANGUP_COMPLETE

Content-Type: command/reply
Reply-Text: +OK event listener enabled plain
```

- `plain`: body is `Content-Type: text/event-plain`. The event content is "some header lines + blank line + event body" — the easiest to parse, and the most used;
- `json`: body is `Content-Type: text/event-json`. The event is serialized into a single JSON object, which is convenient for feeding straight into a program;
- `xml`: body is `Content-Type: text/event-xml`.

Two easy traps:

1. Sending just `event plain` (with no event names) returns `-ERR no keywords supplied` — you must write at least one event name;
2. Subscribing to a `CUSTOM` event requires the subclass name, e.g. `event plain CUSTOM acd::agent_state` — the dispatch logic only delivers CUSTOM events whose subclass appears in the subscription list (or that have no subclass at all). `event plain all` is of course the exception: it receives everything.

### myevents and filter

- `myevents [plain|json|xml] <uuid>`: subscribe only to channel events related to a specific uuid — good when you are processing a single call (commonly used in outbound mode);
- `filter <header-name> <value>`: adds a second, header-level filter on top of the event subscription, e.g. `filter Unique-ID 5f2a-...`. Remove it with `filter delete <header-name> <value>`.

## bgapi and BACKGROUND_JOB

The `api` command is synchronous: an ESL client sends it and then has to wait for FreeSWITCH to finish before it gets an `api/response`. Slow commands (`originate`, `show` with a large result set) will stall your event loop. That is what `bgapi` is for:

```text
bgapi originate user/1001 &echo()

Content-Type: command/reply
Reply-Text: +OK Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
Job-UUID: 7a8b1c2d-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

The command is handed to a background thread and a `Job-UUID` is returned immediately. Once execution completes, a `BACKGROUND_JOB` event is broadcast on the event bus:

- Headers: `Job-UUID`, `Job-Command` (command name), `Job-Command-Arg` (arguments);
- Body: the command output, equivalent to what you would have seen from a synchronous run.

So the standard pattern for collecting an asynchronous result is:

```text
event plain BACKGROUND_JOB
bgapi originate user/1001 &echo()
...wait for the event, match on Job-UUID...
```

This same chain appears in the Python example in [Scripting & Programming Interfaces](/advanced/scripting).

## Custom Events

The `CUSTOM` event class is reserved for application use: what really distinguishes these events is the `Event-Subclass` header. The naming convention is `module::action`, such as `sofia::register` and `conference::maintenance`; your own application can use `yourdomain::action`, e.g. `acd::agent_state`.

### Sending with sendevent (ESL protocol layer)

`sendevent` is an Event Socket protocol-level command (not an API command, so typing it directly in fs_cli tells you the command is not found — you have to send it on an ESL connection). The command line can be followed by several `Header: Value` lines, terminated by a blank line:

```text
sendevent CUSTOM
Event-Subclass: acd::agent_state
Agent: 1001
State: ready

Content-Type: command/reply
Reply-Text: +OK <event uuid>
```

Every line other than `Event-Subclass` becomes a header on the event; if a `unique-id` header is included, the event is also delivered into the corresponding channel's event queue.

### Sending from Lua

Firing events from inside a script is more convenient. mod_lua provides an `Event` object (constructor takes the event name and the subclass); after `addHeader`/`addBody`, just call `fire()`:

```lua
-- Place this in the scripts directory (script_dir, e.g. /usr/local/freeswitch/scripts/)
local event = freeswitch.Event("CUSTOM", "acd::agent_state")
event:addHeader("Agent", "1001")
event:addHeader("State", "ready")
event:addBody("agent 1001 -> ready at " .. os.date("%Y-%m-%d %H:%M:%S"))
event:fire()
```

This event lands on the event bus just like any other. Anything subscribed to `CUSTOM acd::agent_state` (or `all`) receives it — ESL clients, fs_cli, other Lua scripts.

### Consuming Events from Lua

If you do not want to stand up an ESL service, you can also keep a Lua script resident and subscribing. Two approaches:

1. Configure a `<hook>` in `autoload_configs/lua.conf.xml` to hand a class of events to a script:

```xml
<hook event="CUSTOM" subclass="acd::agent_state" script="catch-event.lua"/>
```

2. Start a resident script with `luarun` and pull events using `EventConsumer`:

```lua
-- Place this in the scripts directory (script_dir), start it with luarun watch.lua
local con = freeswitch.EventConsumer("CHANNEL_CALLSTATE")

while true do
  -- pop(1) blocks waiting for an event
  local e = con:pop(1)
  if e then
    freeswitch.consoleLog("notice",
      "call state: " .. tostring(e:getHeader("Channel-Call-State")) .. "\n")
  end
end
```

For the details of the Lua runtime (scripts directory, `luarun`, `startup-script`), see [Scripting & Programming Interfaces](/advanced/scripting).

## Further Reading

- [Session](/concepts/session): how channel variables end up in event headers, and the same state machine from the scripting perspective;
- [Dynamic Dialplan](/concepts/dynamic-dialplan): the three ways Lua/ESL and the dialplan work together;
- [Core Configuration Files](/configuration/core-files): the `autoload_configs` directory and how module configuration is loaded.

## References

- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)
- [SignalWire · FreeSWITCH documentation](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [knowledge](/knowledge.md)
- [README](/project/README.md)
- [asr-tts](/project/asr-tts.md)
- [implementation](/project/implementation.md)
