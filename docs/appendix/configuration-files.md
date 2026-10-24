# Appendix A · Configuration File Reference

This note walks the `conf/` directory file by file against the FreeSWITCH 1.11.3 vanilla config template (`conf/vanilla/` in the source tree): what each file is for, its key parameters, and how changes take effect. For directory relationships and field details, also see [Configuration file structure](/configuration/config-files) and [Core configuration files](/configuration/core-files).

Use this page as a per-file lookup; for the overall directory layout and load order see [Configuration file structure](/configuration/config-files), and for fields and operational checks on the most-used files see [Core configuration files](/configuration/core-files).

## Directory overview

The full directory tree of `conf/`, load relationships, and notes on the vanilla template are covered in [Configuration file structure](/configuration/config-files). Below I record each file's purpose, parameters, and how changes take effect.

## freeswitch.xml

The root file. Almost no business logic goes here; it does just two things:

| Content | Effect |
| ---- | ---- |
| `<X-PRE-PROCESS cmd="include" data="vars.xml"/>` | Stitches the vars.xml text in during the preprocessing stage |
| `<section name="configuration">` includes `autoload_configs/*.conf.xml` | Loads all module config |
| `<section name="dialplan">` / `directory` / `phrases` / `chatplan` | Each includes its own directory |

Key points:

- Preprocessing runs before XML parsing, so `X-PRE-PROCESS` **cannot be disabled with an XML comment**; the whole line must be deleted;
- Section names are fixed. Adding config usually means dropping a file into an included directory, not touching the root file.

## vars.xml

Defines global variables at preprocessing time (`$${var}`, evaluated at startup/`reloadxml`). Common variables:

| Variable | Default | Description |
| ---- | ---- | ---- |
| `default_password` | `1234` | Default registration password for extensions, **must change before going live** |
| `domain` / `domain_name` | `$${local_ip_v4}` | Default SIP domain |
| `sound_prefix` | `$${sounds_dir}/en/us/callie` | Prompt prefix; a Chinese deployment points this at your own directory |
| `hold_music` | `local_stream://moh` | Music on hold |
| `global_codec_prefs` / `outbound_codec_prefs` | `OPUS,G722,PCMU,PCMA,H264,VP8` | Codec preference order |
| `internal_sip_port` / `external_sip_port` | `5060` / `5080` | SIP ports (internal / external profile) |
| `internal_tls_port` / `external_tls_port` | `5061` / `5081` | SIP TLS ports (`internal_ssl_enable` / `external_ssl_enable` default to false, i.e. not listening by default) |
| `external_rtp_ip` / `external_sip_ip` | `stun:stun.freeswitch.org` | Advertised NAT address; on a public deployment set this to the public IP |
| `recordings_dir` | `$${base_dir}/recordings` | Recordings directory (compile-time default; vars.xml only carries an explanatory comment) |
| `script_dir` | `$${base_dir}/scripts` | Scripts directory |
| `console_loglevel` | `info` | Console log level |
| `us-ring`, `cn-ring`, etc. | Ringback tone definitions | Per-country ring cadences |

To inspect the running values use `fs_cli -x "global_getvar"` (append the name to read a single variable).

## Common autoload_configs/ files

File name = `module_name.conf.xml`. The most-used ones:

| File | Purpose | Key parameters |
| ---- | ---- | ---- |
| `modules.conf.xml` | Which modules load at startup | One `<load module="..."/>` line per module |
| `switch.conf.xml` | Core switch parameters | See the detail table below |
| `event_socket.conf.xml` | ESL service | `listen-ip`, `listen-port` (8021), `password`, `apply-inbound-acl`, `nat-map`, `stop-on-bind-error` |
| `acl.conf.xml` | Access control lists | Under `<network-lists>`, `<list name=... default="allow/deny">` + `<node type="allow/deny" cidr="..."/>`; built-in `rfc1918.auto`, `localnet.auto`, `loopback.auto`, `nat.auto` |
| `logfile.conf.xml` | File logging | `rotate-on-hup`, `rollover` (bytes), `maximum-rotate`, `uuid` (prefix log lines with UUID), `<mappings>` defines per-file levels |
| `console.conf.xml` | Console logging | `<mappings>` level mapping |
| `lua.conf.xml` | Lua runtime | `script-directory` (appended to LUA_PATH), `module-directory` (LUA_CPATH), `startup-script` (resident startup scripts), `xml-handler-script`/`xml-handler-bindings` (Lua serving XML) |
| `sofia.conf.xml` | Sofia aggregate | `<global_settings>` global parameters + include `../sip_profiles/*.xml` |
| `timezones.conf.xml` | Timezone offset table | `<zone name="Asia/Shanghai" value="..."/>`, used by time-based conditions |
| `xml_curl.conf.xml` | Dynamic XML gateway | `<binding>`'s `gateway-url` and `bindings` (values like `dialplan`, `directory`; comma-separated for multiple bindings) |
| `cdr_csv.conf.xml` | CSV CDRs | `default-template` (which of the `<templates>` to use), `legs` (a/b/ab), `rotate-on-hup`, `log-base` |
| `cdr_pg_csv.conf.xml` | Postgres CDRs | `db-info` (connection string), `template` |
| `xml_cdr.conf.xml` | XML CDRs | `url` (POST target), `cred`, `encode` and other submission parameters |
| `conference.conf.xml` | Conferencing | `<caller-controls>` key controls, `<profiles>` conference parameters (bit rate, sample rate, dubbing) |
| `voicemail.conf.xml` | Voicemail | `<settings>`, `<profiles>`, notification email templates |
| `ivr.conf.xml` | IVR engine | References menu files under `ivr_menus/` |
| `callcenter.conf.xml` | Queues and agents (mod_callcenter) | `<queues>`, `<agents>`, `<tiers>` |
| `fifo.conf.xml` | FIFO queues | `<fifo>` definitions |
| `local_stream.conf.xml` | Local music streams | Hold-music directories and parameters |
| `post_load_modules.conf.xml` | Deferred module loading | Resolves inter-module load order problems |
| `tts_commandline.conf.xml` | Command-line TTS | `command`, may use `${text}` `${voice}` `${rate}` `${file}` |
| `pocketsphinx.conf.xml` | Offline ASR | Grammar paths and thresholds |

### switch.conf.xml detail table

| Parameter | Default | Description |
| ---- | ---- | ---- |
| `max-sessions` | `1000` | Max concurrent sessions; the first capacity gate |
| `sessions-per-second` | `30` | Cap on new sessions per second, guards against bursts |
| `loglevel` | `debug` | Global log level |
| `core-db-dsn` | (commented) | DSN for moving the core db to ODBC/PostgreSQL; set when multiple nodes share it |
| `max-db-handles` / `db-handle-timeout` | `50` / `10` | Database connection pool |
| `rtp-start-port` / `rtp-end-port` | `16384` / `32766` (default commented) | RTP media port range; the firewall must open the whole range |
| `switchname` | (commented) | Overrides the hostname in HA clusters so multiple nodes can share one config |
| `dialplan-timestamps` | `false` | Adds timestamps to dialplan logs |
| `min-dtmf-duration` / `max-dtmf-duration` / `default-dtmf-duration` | `400` / `192000` / `2000` (milliseconds) | DTMF duration constraints |
| `mailer-app` / `mailer-app-args` | `sendmail` / `-t` | Outbound command for email notifications like voicemail |
| `dump-cores` | `yes` | Whether to produce a core on crash |
| `verbose-channel-events` | (commented) | Whether events carry the full set of channel variables |
| `<cli-keybindings>` | F1-F12 mapping | Console hotkey to command mapping |
| `<default-ptimes>` | (commented) | Override default packetization time per codec |

## dialplan/

| File | Purpose |
| ---- | ---- |
| `default.xml` | Main file of the `default` context; internally uses X-PRE-PROCESS to include fragments from the `default/` directory |
| `default/*.xml` | Individual rule fragments; the filename prefix (like `00_`, `90_`) sets the include order, which is the match priority; vanilla ships demo extension and feature-code examples |
| `public.xml` | The `public` context: inbound calls from outside (the external profile lands here by default); vanilla has only a few samples, rewrite for production as needed |
| `features.xml` | Feature-code context: codes for call transfer and similar features |
| `skinny-patterns.xml` | Number patterns for SCCP (mod_skinny) phones (only needed if you use mod_skinny) |

Key conventions:

- Extensions are evaluated top to bottom; conditions match channel variables with PCRE (most commonly `destination_number`);
- In `default.xml` the include order is the priority; putting new business rules in their own fragment file avoids conflicts best;
- For syntax details see [Static dialplan](/concepts/static-dialplan).

## directory/

| File | Purpose | Key parameters |
| ---- | ---- | ---- |
| `default.xml` | Domain definition (`<domain name="$${domain}">`) | `<params>`' `dial-string` (determines how bridge user/ lands); `<variables>` domain-level default variables; `<groups>` groups users from `default/*.xml` |
| `default/1000.xml` etc. | A single extension | `params/password` (registration password), `params/vm-password`; `variables/user_context` (outbound context), `effective_caller_id_name/number`, `toll_allow` (outbound calling permission), `accountcode` (billing identifier) |

In multi-domain deployments each domain gets its own `domain-name.xml`; combined with `mod_xml_curl`, the entire directory section can instead be returned dynamically by a backend.

## sip_profiles/

| File | Purpose |
| ---- | ---- |
| `internal.xml` | Internal profile: default 5060, takes extension registrations and calls |
| `internal/*.xml` | Additional config fragments for internal |
| `external.xml` | External profile: default 5080, faces carriers/gateways |
| `external/gw1.xml` etc. | SIP gateway definitions (for carrier interconnect) |
| `<gateways>` inside `internal.xml` | Gateways can also be written directly inside a profile |

### internal.xml key parameters

| Parameter | Default | Description |
| ---- | ---- | ---- |
| `context` | `public` (vanilla) | Dialplan context this profile's inbound calls enter |
| `sip-port` | `$${internal_sip_port}` | Listen port |
| `sip-ip` / `rtp-ip` | `$${local_ip_v4}` | Listen address |
| `ext-sip-ip` / `ext-rtp-ip` | `$${external_sip_ip}` / `$${external_rtp_ip}` | Advertised NAT address |
| `dialplan` | `XML` | Dialplan engine |
| `dtmf-duration` / `rfc2833-pt` | `2000` / `101` | DTMF duration and RFC2833 payload |
| `inbound-codec-prefs` / `outbound-codec-prefs` | `$${global_codec_prefs}` etc. | Codec preferences |
| `inbound-codec-negotiation` | `generous` | Codec negotiation policy (`generous`/`greedy`/`scrooge`) |
| `apply-inbound-acl` | `domains` | Inbound IP allowlist (matches a list name in acl.conf.xml) |
| `apply-nat-acl` / `local-network-acl` | `nat.auto` / `localnet.auto` | NAT detection and local-network detection |
| `apply-register-acl` | (commented) | IP allowlist for REGISTER requests |
| `challenge-realm` | `auto_from` | Realm of the 401 challenge |
| `record-path` / `record-template` | `$${recordings_dir}` / named by caller + time | Default directory and filename template for `record` on this profile |
| `ws-binding` / `wss-binding` | `:5066` / `:7443` | WebRTC WebSocket bindings |
| `tls` / `tls-only` / `tls-sip-port` | `$${internal_ssl_enable}` / `false` / `$${internal_tls_port}` | SIP TLS |
| `aggressive-nat-detection`, `nat-options-ping` | (commented) | NAT behavior toggles |
| `accept-blind-reg` | (commented, off by default) | Registration without authentication, **never enable in production** |
| `log-auth-failures` | `false` | Log auth failures, useful for brute-force monitoring collection |

### Gateway files (external/*.xml) key parameters

| Parameter | Description |
| ---- | ---- |
| `gateway name` | Gateway name, inspect with `sofia status gateway <name>` |
| `username` / `password` | Interconnect credentials |
| `realm` | Auth realm; defaults to the proxy |
| `from-user` / `from-domain` | Rewrites the From header on outbound calls |
| `proxy` | The peer SIP server |
| `register` | `true`/`false`, whether to register with the peer |
| `register-proxy` / `register-transport` | Registration target and transport |
| `expire-seconds` | Registration TTL |
| `retry-seconds` | Retry interval after registration failure |
| `ping` / `ping-min` / `ping-max` | OPTIONS keepalive and dead-detection thresholds |
| `caller-id-in-from` | Whether to replace From with the caller id |
| `extension` | Number matched on inbound (the extension inbound calls land on) |
| `context` | Context this gateway's inbound calls enter |
| `gw-auth-acl` | Gateway auth ACL, points at a list name in `acl.conf.xml` (source subnet restrictions go here; gateways have no `cidr` parameter) |

## ivr_menus/ and lang/

- `ivr_menus/*.xml`: built-in IVR menu definitions (`<menu name=... greeting=... timeout=...>` with `<entry action="menu-sub|menu-exec-app|menu-play-sound" digits="1" .../>`), loaded together with `autoload_configs/ivr.conf.xml` and invoked via the `ivr <menu-name>` application;
- `lang/`: phrase macros and prompt indexes organized per language, used by `playback phrase:`; vanilla ships eight languages (de/en/es/fr/he/pt/ru/sv); for a Chinese deployment, mirror `lang/en/` (which contains `demo/`, `dir/`, `ivr/`, `vm/`, and `en.xml`) to build your own `lang/zh/`.

## What to change and how it takes effect

| Change | How it takes effect |
| ---- | ---- |
| Dialplan, directory, vars.xml | `fs_cli -x "reloadxml"` |
| ACL lists | `fs_cli -x "reloadacl"` |
| Module config (e.g. logfile, event_socket) | `fs_cli -x "reload <module name>"` (some parameters require a module restart) |
| Adding/modifying a gateway | `fs_cli -x "sofia profile external rescan"` |
| SIP profile listen parameters | `sofia profile <name> restart` (drops that profile's current calls, pick an off-peak window) |
| IVR menus, phrases | `reloadxml` |
| Global variables `$${}` | `reloadxml` (only affects calls started afterwards) |

My habitual checks after applying: `global_getvar`, `sofia status profile <name>`, `show modules`, then one test call to verify.

## References

- [SignalWire · FreeSWITCH docs](https://developer.signalwire.com/freeswitch/)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related pages

- [resources](resources.md)
- [deployment](/project/deployment.md)
