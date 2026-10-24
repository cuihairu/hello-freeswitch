# Integration Practice

These pages cover the three capabilities I've reached for beyond basic FreeSWITCH calling: events, recording and eavesdropping, and scripting with external control.

## Event System ([Event System](./events.md))

FreeSWITCH publishes its internal state changes over an event bus. [My notes on the event system](./events.md) lay out the event structure, the event classes worth knowing, subscribing from `fs_cli`, consuming over ESL, how `bgapi` and `BACKGROUND_JOB` work together, and how to emit your own events.

## Recording & Eavesdropping ([Recording & Eavesdropping](./recording.md))

Call centers and compliance setups tend to need recordings. [My notes on recording and eavesdropping](./recording.md) compare the three entry points (`record_session`, `uuid_record`, `record`), cover path and filename variables, real-time `eavesdrop` with DTMF control, and a retention/cleanup strategy for the files.

## Scripting & Programming Interfaces ([Scripting & Programming Interfaces](./scripting.md))

Embedded Lua is the light-weight glue layer inside FreeSWITCH. [My notes on scripting and programming interfaces](./scripting.md) cover how the Lua environment loads, the four ways to call a script, a collect-digits-and-transfer IVR example, the two ESL modes (inbound and outbound), and a Python ESL client skeleton built on the standard library only.

---

I usually start with the [Event System](./events.md), then check [Recording & Eavesdropping](./recording.md) or [Scripting & Programming Interfaces](./scripting.md) as a project needs them. Notes on gluing the whole thing to other systems are in the [Smart Customer Service project](../project/README.md).

## References

- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)
- [SignalWire · FreeSWITCH docs](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [events](events.md)
- [recording](recording.md)
- [scripting](scripting.md)
- [knowledge](/knowledge.md)
- [README](/project/README.md)
