# Call

**A call is "a phone conversation" from the user's perspective**: the whole formed by at least two channels — the calling leg and the called leg — connected via bridge. FreeSWITCH has no single internal "call" object; it is a logical concept layered on top of channels.

## The Full Journey of a Call

For example, internal extension 1001 calling 1002:

```
1001 goes off-hook and dials ──INVITE──> FreeSWITCH
  1. sofia receives INVITE, creates the A-leg channel (1001's inbound call)
  2. enters the dialplan, matches 1002's extension
  3. the bridge application starts the B leg: sends INVITE to 1002
  4. 1002's phone rings (180 Ringing passed back to 1001)
  5. 1002 goes off-hook (200 OK), the two legs bridge, RTP media flows between them
  6. either side hangs up, the two legs each enter CS_HANGUP, the call ends
```

The A leg and the B leg are two independent channels, each with its own UUID, variables, and state machine; `bridge` only makes their media flows interconnect. **Billing, recording, and transfer all operate on "legs"** — this is the key to understanding FreeSWITCH's behavior.

## Observing a Call

```bash
fs_cli
freeswitch@host> show calls      # currently bridged calls (A/B leg UUID pairs)
freeswitch@host> show channels   # details of all channels (including un-bridged legs)
```

The two lines `show calls` prints are the two legs of the same phone conversation; `Call-State`, `CID Name`, and `UUID` are all at a glance.

## Initiating Calls with originate

`originate` is the main entry point for externally initiating calls (works in `fs_cli`, ESL, and scripts alike):

```bash
# Call extension 1001, run the echo app after it connects
fs_cli -x "originate user/1001 &echo()"

# Call 1001 and bridge to 1002 (initiate a complete call)
fs_cli -x "originate user/1001 &bridge(user/1002)"

# Originate with channel variables, set the caller ID display
fs_cli -x "originate {origination_caller_id_number=1000,ignore_early_media=true}user/1001 &playback(local_stream://moh)"
```

Syntax breakdown: `originate [{var=value,..}]<callee> <action to run after connect>`. The braces come immediately before the callee's dial string. `user/1001` is a directory user; `sofia/internal/1001@domain` is the equivalent profile form; actions start with `&` (e.g. `&park()`, `&playback(...)`, `&bridge(...)`).

## Hangup and Transfer

```bash
# Hang up a specific call leg with a cause code
fs_cli -x "uuid_kill <uuid> NORMAL_CLEARING"

# Hang up everything
fs_cli -x "hupall NORMAL_CLEARING"

# Transfer the call to 1003 (can cross contexts)
fs_cli -x "uuid_transfer <uuid> 1003 XML default"
```

## Common Channel Variables (Call Dimension)

| Variable | Meaning |
| ---- | ---- |
| `caller_id_name` / `caller_id_number` | Caller's displayed name/number |
| `destination_number` | Callee number (the basis for dialplan matching) |
| `origination_uuid` | The leg UUID specified at originate time |
| `hangup_cause` | Hangup cause code, e.g. `NORMAL_CLEARING`, `NO_ANSWER`, `USER_BUSY` |
| `bridge_channel` | Description of the other leg after bridge is established |
| `call_timeout` | Call timeout in seconds (hang up on timeout) |

To view all variables for a given leg: `fs_cli -x "uuid_dump <uuid>"`.

## Call vs Channel vs Session

| Concept | Layer | In one line |
| ---- | ---- | ---- |
| [Channel](/concepts/channel) | One leg | One SIP dialogue endpoint, with a UUID and a state machine |
| [Session](/concepts/session) | A leg from the script's view | The scripting wrapper object around a channel |
| Call | A combination of two or more legs | The full call formed by bridging them together |

## Related Notes

- [Channel](/concepts/channel): a deeper look at the state machine and variables;
- [Static Dialplan](/concepts/static-dialplan): hand-write the routing for that 1001→1002 call above.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [Wikipedia · Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [channel](channel.md)
- [dialplan](dialplan.md)
- [session](session.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
