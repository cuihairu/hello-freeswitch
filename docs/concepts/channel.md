# Channel

**A channel is FreeSWITCH's most central internal object**: every call endpoint — whether it comes from SIP, WebRTC, or loopback — is one channel. It has a unique UUID, a set of channel variables, and flows along a definite state machine. The [session](/concepts/session) discussed earlier is its scripting wrapper; a [call](/concepts/call) is the combination built on top of it.

## State Machine

A channel passes through these states in order from creation to destruction (`CS_*`):

```
CS_NEW        channel just created, not yet started processing
   │
CS_INIT       initialization done, parameters ready
   │
CS_ROUTING    routing phase: consult the dialplan, decide what to run
   │
CS_EXECUTE    execution phase: run the application / script (the call body lives here)
   │
CS_HANGUP     hangup: record the cause code, run hangup hooks
   │
CS_REPORTING  reporting phase: CDR, events
   │
CS_DESTROY    destroy, free memory
```

Key points:

- **Each state can have a callback** (hook) attached; custom development commonly hooks CDR processing on `CS_REPORTING`;
- Bridging does not change the state machine — the B leg likewise goes `CS_NEW → ... → CS_EXECUTE`; bridge only makes the two legs' media interconnect;
- The `Call-State` column in `show channels` output is the current state.

## Channel Variables

Channel variables are key-value pairs attached to a channel; they are FreeSWITCH's primary way of passing information:

```bash
# Dump all variables of a channel
fs_cli -x "uuid_dump 5f3a...-..."

# Read/write a single variable
fs_cli -x "uuid_getvar 5f3a...-... destination_number"
fs_cli -x "uuid_setvar 5f3a...-... my_flag 1"
```

Sources and scope:

| Path | Example |
| ---- | ---- |
| Directory user injection | `effective_caller_id_number` etc. in the `<variables>` block of a directory extension file |
| originate arguments | `{origination_caller_id_number=1000}` bulk injection via braces |
| Dialplan | `<action application="set" data="my_flag=1"/>` |
| SIP protocol mapping | SIP headers mapped to variables via profile configuration |
| Global fallback | A `${var}` not present on the channel falls back to reading the global `$${var}` |

The difference between `set` and `export` is worth remembering: `set` only affects the current channel; `export` "carries" the variable across the bridge to the other leg (often used to pass an A-leg marker to the B leg).

## Observing Channels

```bash
fs_cli
freeswitch@host> show channels
# UUID | Call-State | Name | ... | Codec | disconnect cause, etc.

freeswitch@host> show channels as xml   # machine-readable output
```

The debugging trio: `show channels` to check whether the leg exists → `uuid_dump` to check whether the variables are right → `fs_cli` logs (`/console/loglevel debug`) to watch each step execute.

## Loopback: "Folding" a Leg Back into the Dialplan

`user/1001` and `sofia/...` are dial targets that point directly at an endpoint; **mod_loopback** instead provides the `loopback/<ext>/<context>` target — it creates a virtual channel that re-enters the dialplan. A typical use:

```bash
# Play a prompt first, then transfer into 1002's routing
fs_cli -x "originate loopback/announce &bridge(user/1002)"
```

A loopback channel behaves in the state machine just like a real SIP channel; it is a common building block for constructing complex routing.

## Correspondence with SIP Events

A rough correspondence between the state machine and SIP messages:

| Channel state | Typical SIP event |
| ---- | ---- |
| CS_NEW / CS_INIT | INVITE received |
| CS_ROUTING | consulting the dialplan (usually milliseconds) |
| CS_EXECUTE | 180 Ringing / 183 Session Progress → 200 OK |
| CS_HANGUP | BYE / CANCEL / 486 Busy |

## Related Notes

- [Session](/concepts/session): the scripting wrapper around a channel and the Lua API;
- [Routing and Dialplan](/concepts/dialplan): the rule engine for the CS_ROUTING phase.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [SignalWire · FreeSWITCH docs](https://developer.signalwire.com/freeswitch/)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [call](call.md)
- [session](session.md)
- [core-files](/configuration/core-files.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
