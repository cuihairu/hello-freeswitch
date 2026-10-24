# Static Dialplan

A static dialplan refers to the XML rules written under `conf/dialplan/` and loaded via `reloadxml` — all routing logic lives in files, is auditable, is rollback-friendly, and is also FreeSWITCH's out-of-the-box default mode of operation.

## File Organization and Loading Order

```
conf/dialplan/
├── default.xml      # entry for the default context, includes the shards below
├── default/         # shard directory
│   ├── 00-internal.xml   # internal extension calling
│   ├── 50-outbound.xml   # outbound routing
│   └── 90-catchall.xml   # catch-all
├── public.xml       # public context (external inbound)
└── features.xml     # feature codes (* codes for busy transfer, do-not-disturb, etc.)
```

- extensions within a context are evaluated in **file name and written order**; use the `00-`/`50-`/`90-` prefixes to make matching precedence explicit;
- if you do not want to create new shards, you can also edit the `<include>` list in `default.xml` directly to organize loading;
- after editing, run `fs_cli -x "reloadxml"` and verify the effective result with `fs_cli -x "xml_locate dialplan name default"`.

## Rule Fields, One by One

```xml
<extension name="local_extension" continue="false">
  <condition field="destination_number" expression="^(100[1-9])$" break="on-false">
    <action application="set" data="call_timeout=25"/>
    <action application="set" data="continue_on_fail=true"/>
    <action application="bridge" data="user/$1"/>
    <anti-action application="hangup" data="NO_ROUTE_DESTINATION"/>
  </condition>
</extension>
```

| Field | Meaning |
| ---- | ---- |
| `extension@name` | Extension name, for logs and locating only |
| `extension@continue` | Whether to continue matching subsequent extensions after this one hits (default false) |
| `condition@field` | The channel variable to match; `destination_number`, `caller_id_number`, etc. are commonly available |
| `condition@expression` | A PCRE regex; capture groups can be referenced in actions as `$1`, `$2`, etc. |
| `condition@break` | Matching flow control: `always`/`never`/`on-true`/`on-false` (default on-false: the extension stops as soon as this condition fails) |
| `action@application` | The application to run (see all with `fs_cli -x "show applications"`) |
| `action@data` | The application's argument |
| `anti-action@...` | The action to run when the condition fails |

## Common Applications, Quick Reference

| application | Effect | Typical use |
| ---- | ---- | ---- |
| `answer` | Answer | Answer before playing a prompt |
| `set` | Set a channel variable | `set my_var=1` |
| `export` | Set a variable and **carry it to the other leg** | pass a caller marker, a recording flag |
| `bridge` | Bridge to another endpoint | `user/1002`, `sofia/gateway/gw1/10086` |
| `transfer` | Transfer to another extension/context | `transfer 1002 XML default` |
| `playback` | Play audio | `playback ${sound_prefix}/hello.wav` |
| `hangup` | Hang up (with a cause code) | `hangup USER_BUSY` |
| `park` | Park (hold, waiting to be picked up externally) | pick up after `park` with `uuid_transfer` |
| `sleep` | Pause execution for milliseconds | `sleep 1000` |
| `echo` | Echo test (hear yourself) | test the media path |
| `record_session` | Record the call | `record_session /tmp/${uuid}.wav` |

## Practical Patterns

### Time-of-Day Routing

```xml
<extension name="office_hours">
  <condition field="destination_number" expression="^2000$"/>
  <condition field="${strftime(%H)}" expression="^(09|10|11|13|14|15|16|17)$">
    <action application="transfer" data="2000_realtime XML default"/>
  </condition>
  <anti-action application="bridge" data="user/2000"/>
</extension>
```

Multiple conditions within the same extension are evaluated in order; the action runs only when all of them are true (the first only filters the number, the second checks whether it is working hours).

### Wildcard Outbound and Gateways

```xml
<extension name="outbound_via_gw">
  <condition field="destination_number" expression="^(\d{3,15})$">
    <action application="bridge" data="sofia/gateway/carrier_gw/$1"/>
  </condition>
</extension>
```

`sofia/gateway/<gateway-name>/<number>` — the gateway definitions live under `sip_profiles/external/`; for configuration examples see [Gateway Module Notes](/modules/gateway).

### Feature Codes: Transfer During a Call

The feature codes defined in features.xml take effect during an ongoing call (e.g. dial `*98` first to enter the feature channel, then dial the number — the specifics depend on your environment's `features.xml`); the core is how `transfer` is invoked:

```xml
<action application="transfer" data="1002 XML default"/>
```

## Validation and Debugging

1. `reloadxml` produces no error — XML parsing errors are printed directly to the console;
2. `xml_locate` confirms the rule made it into memory;
3. set `/log debug` and place a test call, watching the `Processing ... in context` line and the application execution logs;
4. when a rule does not hit, first check whether `destination_number` matches what you expect (`uuid_dump` shows the variable's real value — missing `^`/`$` anchors in the regex is the number-one pitfall).

## Related Notes

When rules written in files are no longer enough, move on to [Dynamic Dialplan](/concepts/dynamic-dialplan): hand routing to code and databases via Lua scripts, mod_xml_curl, and ESL.

## References

- [Wikipedia · Dial plan](https://en.wikipedia.org/wiki/Dial_plan)
- [SignalWire · Programming and Scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [configuration-files](/appendix/configuration-files.md)
- [call](call.md)
- [dialplan](dialplan.md)
- [config-files](/configuration/config-files.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](/modules/README.md)
- [conference](/modules/conference.md)
- [gateway](/modules/gateway.md)
- [ivr](/modules/ivr.md)
- [media](/modules/media.md)
- [sip](/modules/sip.md)
