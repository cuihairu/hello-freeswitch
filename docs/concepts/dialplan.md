# Routing and Dialplan

**The dialplan is FreeSWITCH's routing rule engine**: when an inbound call enters the `CS_ROUTING` state, FreeSWITCH evaluates rules layer by layer in the order context → extension → condition, deciding whether to answer, transfer, bridge, or hang up. The question it answers is — **"When this number is dialed in, what happens next?"**

## The Three-Layer Structure

```
context (isolates a routing domain)
 └── extension (a named group for a class of numbers)
      └── condition (a PCRE regex match)
           └── action / anti-action (the action to run on hit / miss)
```

- **context**: an isolated routing domain. Internal extensions usually live in `default`, external inbound calls in `public`; the `user_context` in an extension's file determines which context it dials out through;
- **extension**: a named group of conditions; the actions run only when all conditions are satisfied;
- **condition**: a PCRE regex match against a channel variable; the most common is `destination_number` (the callee number);
- **action**: the action on a hit; **anti-action**: the action on a miss.

## The Full Routing Flow

1. A SIP INVITE arrives at a profile (e.g. `internal`);
2. If it is an inbound call from a registered extension, the caller profile is built (calling identity, originating profile, context);
3. Enter that context's dialplan and evaluate extensions top to bottom;
4. Within an extension, conditions are matched one by one (by default the extension stops at the first failing condition);
5. All hit → execute the `<action>` elements in order; rules with `break="always"` or `continue="true"` continue on to later matching;
6. No extension hit → fall through to the context's catch-all (or hang up with `NO_ROUTE_DESTINATION` directly).

## A Minimal Working Example

```xml
<include>
  <context name="default">

    <!-- Internal calling: 1001/1002 -->
    <extension name="local_extensions">
      <condition field="destination_number" expression="^(100[12])$">
        <action application="answer"/>
        <action application="bridge" data="user/$1"/>
      </condition>
    </extension>

    <!-- Hang up any unknown number -->
    <extension name="catch_all">
      <condition field="destination_number" expression="^.*$">
        <action application="hangup" data="NO_ROUTE_DESTINATION"/>
      </condition>
    </extension>

  </context>
</include>
```

When `1002` is matched: `local_extensions`' regex captures `$1=1002` and `bridge` starts the B leg `user/1002` — which is exactly the flow described in the [Call](/concepts/call) chapter.

## Action Execution Model

- actions run in **written order** during the `CS_EXECUTE` state; actions that change the call's state such as `answer`/`bridge`/`hangup` block until the result is returned;
- most actions are applications provided by mod_dptools; `fs_cli -x "show applications"` lists them all;
- for branching logic use `<anti-action>` (run when the condition fails) or transfer to a script (see [Dynamic Dialplan](/concepts/dynamic-dialplan)).

## Querying and Debugging

```bash
fs_cli -x "reloadxml"                      # required after any config change
fs_cli -x "xml_locate dialplan name default"   # view the full effective XML for the default context
```

After setting the console log level to debug, place a test call and the full routing process will be printed:

```bash
fs_cli
freeswitch@host> /log debug
# watch lines like "Processing 1001 <1001>->1002 in context default"
```

## The Two Styles: Static and Dynamic

| Style | Carrier | Best for |
| ---- | ---- | ---- |
| [Static Dialplan](/concepts/static-dialplan) | `conf/dialplan/*.xml` | rules that are relatively fixed, need to be auditable, performance first |
| [Dynamic Dialplan](/concepts/dynamic-dialplan) | Lua scripts / mod_xml_curl / ESL | rules from a database, complex logic, real-time changes by business |

Production systems usually combine both: fixed routing via XML, and business-driven routing (by user affiliation, time of day, billing) handed off to a dynamic approach.

## Related Notes

- [Static Dialplan](/concepts/static-dialplan): the field-level writing of XML rules;
- [Dynamic Dialplan](/concepts/dynamic-dialplan): taking over routing with scripts and an XML gateway.

## References

- [Wikipedia · Dial plan](https://en.wikipedia.org/wiki/Dial_plan)
- [SignalWire · Programming and Scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [channel](channel.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](/project/README.md)
