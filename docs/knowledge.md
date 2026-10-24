# Knowledge Map

> This is the index I've compiled by pulling together the knowledge points scattered across my various notes and appendices: core concepts, reference books and official docs, application scenarios, and common pitfalls. Each entry cites its source and links back to the original; entries without a verifiable source are marked "source unverified." Links for books and official docs come from [Resources and references](/appendix/resources.md); term definitions and sources are in the [Glossary](/glossary).

## Core Concepts

### Anatomy of a Call: Call, Channel, and Session

- A call is a "phone call" from the user's perspective, made of at least two channels connected via bridge; FreeSWITCH has no single `call` object internally — it is a logical concept above channels. Billing, recording, and transfers all operate on "legs," and this is the key to understanding FreeSWITCH behavior. See [Call](/concepts/call).
- The channel is the most central internal object: every call endpoint (SIP, WebRTC, loopback) is a channel with a unique UUID, a set of channel variables, and a state machine it flows through. See [Channel](/concepts/channel).
- The session is the script-side view of a leg: the session object in Lua and other scripts wraps one channel, and every operation on the session ultimately acts on the corresponding channel's state machine. See [Session](/concepts/session).
- `originate` is the universal entry point for controlling calls externally (works across fs_cli, ESL, and scripts); the syntax is `originate [{var=value,..}]<callee> <action after connect>`, with the action prefixed by `&`. See [Call](/concepts/call).

### State Machine and Channel Variables: ${} vs $${}

- A channel goes through `CS_NEW → CS_INIT → CS_ROUTING → CS_EXECUTE → CS_HANGUP → CS_REPORTING → CS_DESTROY` from creation to destruction; callbacks can be attached to each state, and secondary development commonly hangs CDR processing off `CS_REPORTING`. Bridging does not change the state machine — the B leg runs the full flow too. See [Channel](/concepts/channel).
- Channel variables are FreeSWITCH's main way of passing information, with five sources: user directory injection, originate brace arguments, dialplan `set`, SIP protocol mapping, and global fallback (a `${var}` missing on the channel falls back to the global `$${var}`). See [Channel](/concepts/channel).
- The difference between `set` and `export` is worth remembering: `set` only affects the current channel; `export` carries the variable across the bridge to the far leg, commonly used to pass a marker from the A leg to the B leg. See [Channel](/concepts/channel).
- `$${var}` is evaluated at pre-processing/startup time with global scope and is only re-evaluated on `reloadxml` or restart; `${var}` is evaluated on each use with current-channel scope, takes effect dynamically during the call, reads channel variables first and falls back to global. This is the first hurdle in FreeSWITCH configuration. See [Core config files](/configuration/core-files).
- mod_loopback provides the `loopback/<ext>/<context>` target, creating a virtual channel that re-enters the dialplan — a common building block for constructing complex routing. See [Channel](/concepts/channel).

### Dialplan: Three Layers and the Static/Dynamic Split

- Three-layer structure: context (routing isolation domain) → extension (a class of numbers) → condition (PCRE regex match against channel variables) → action / anti-action. It answers the question "this number came in — what happens next." See [Dialplan](/concepts/dialplan).
- Evaluation order: extensions are evaluated top to bottom one by one, and conditions by default stop at the first failure within the extension; rules with `break="always"` or `continue="true"` keep participating in subsequent matching. If no extension matches, the context fallback applies or the call hangs up with `NO_ROUTE_DESTINATION`. See [Dialplan](/concepts/dialplan), [Static dialplan](/concepts/static-dialplan).
- The static form lives in `conf/dialplan/*.xml` — auditable and rollback-friendly, and the factory default; there are three routes to making it dynamic: Lua scripts (sub-millisecond, in-process), mod_xml_curl (one HTTP round trip per routing decision), and ESL external control (network round trip plus external processing). Production practice is usually XML carrying high-frequency fixed rules, Lua carrying logic branching within a single number, and mod_xml_curl/ESL carrying cross-system dynamic decisions. See [Dynamic dialplan](/concepts/dynamic-dialplan).
- When a rule does not match, first check that `destination_number` is what you expect: a missing `^`/`$` in the regex is the number-one pitfall — use `uuid_dump` to see the variable's actual value. See [Static dialplan](/concepts/static-dialplan).

### Modules: The Master Switch and Five Categories

- The FreeSWITCH core itself is only a small switching kernel (media bridging, channel state machine, XML config engine); SIP, conferencing, voicemail, recording, codecs — every capability is provided by modules. A module not present in the config means its commands, applications, and codecs simply do not exist. See [Module overview](/modules/README).
- `autoload_configs/modules.conf.xml` is the master switch for modules, one module per line, load order equals written order; changing this table only affects the next startup — use `load` / `unload` / `reload` for runtime changes. See [Module overview](/modules/README).
- `reloadxml` only re-parses XML configuration; it does not load or unload modules — the two are frequently confused. See [Module overview](/modules/README).
- Common modules fall into five categories: core (mod_commands, mod_dptools, mod_dialplan_xml, etc.), applications (mod_conference, mod_voicemail, mod_callcenter, etc.), codecs (mod_opus, mod_spandsp, mod_openh264, etc.), gateways and endpoints (mod_sofia, mod_verto, mod_loopback, etc.), and events (mod_event_socket, mod_cdr_csv, etc.). See [Module overview](/modules/README).
- To troubleshoot "why does this command not exist," first use `fs_cli -x "show interfaces"` and `show modules` to confirm whether the module is actually loaded. See [Module overview](/modules/README).

### SIP and mod_sofia: Profiles, Registration, and Anti-Scanning

- SIP only handles "finding and connecting people"; voice content does not travel over SIP — media goes over RTP. The standard transaction for one call is INVITE → 100 Trying → 180 Ringing → 200 OK → ACK → BYE. See [SIP module](/modules/sip).
- mod_sofia listens on the network per profile; vanilla ships with two: internal (5060, takes extension registrations and internal calls) and external (5080, faces carriers/gateways). See [SIP module](/modules/sip).
- Registration follows standard HTTP Digest: the extension sends REGISTER, FreeSWITCH replies 401 with a nonce, the extension computes the digest and resends, and validation passes with 200 OK. The nonce has a validity period (`nonce-ttl` defaults to 60 seconds) and expiry triggers a fresh challenge to prevent replay. See [SIP module](/modules/sip).
- The authentication chain is processed in order: ACL admission (a failure rejects the request outright) → registration auth (REGISTER always goes through 401 Digest unless it hits an ACL exemption) → inbound call auth (with `auth-calls=true`, INVITE also requires Digest). See [SIP module](/modules/sip).
- A 5060 port exposed to the public internet gets continuous registration attempts from scanners; before going live, walk the anti-scanning checklist item by item: change default passwords, tighten the ACL, keep failure logs, rate-limit, never enable `accept-blind-reg` / `accept-blind-auth`, firewall as the last line of defense. See [SIP module](/modules/sip).
- `sofia_contact` translates an "extension number" into a "reachable address," and the return value can be fed straight to bridge. See [SIP module](/modules/sip).

### Media: Codecs, Transcoding, and absolute_codec_string

- Codecs come from three tiers: core implementations need no module (PCMU/PCMA, L16, VP8/VP9); mod_spandsp provides G.711/G.722/GSM/G.726 plus fax and DTMF detection; mod_opus, mod_openh264, mod_h26x, mod_av and so on load on demand. Use `fs_cli -x "show codec"` for the actually available list — if something is missing from the list, it is usually an unloaded module or missing compile-time dependencies See [Media module](/modules/media).
- When the two sides of a call use different codecs, FreeSWITCH transcodes in the middle; when they match, it only proxies RTP forward with near-zero overhead. Transcoding costs CPU and audio quality, so "make both sides speak the same language" is the first principle of media optimization. See [Media module](/modules/media).
- `absolute_codec_string` is a channel variable; once set, codec selection follows it entirely and profile preferences are bypassed. The most typical use is narrowing codecs to G.711 on outbound calls to avoid negotiating a transcoding-requiring result with a gateway; `inherit_codec=true` makes the outbound leg follow the caller's codec and prevents accidental transcoding. See [Media module](/modules/media).
- FreeSWITCH has no application named `volume`. The real entries for channel-level volume and gain are the `uuid_audio` API (level takes -4 to 4) and the in-conference `volume_in` / `volume_out` commands. See [Media module](/modules/media).
- mod_spandsp is often mistaken for a "volume/filter module"; what it actually provides is codecs, DTMF detection (a separate implementation from mod_dptools' `start_dtmf`), and fax. Do not look here for volume and gain. See [Media module](/modules/media).
- Conference video mixing is enabled by `video-mode=mux`: all member video is composited onto a canvas per the layout and then sent to each member — this is the video MCU. Canvas size, frame rate, and bitrate directly determine CPU usage. See [Media module](/modules/media).

### Event System and ESL

- The core maintains a global event bus: production (the state machine and modules emitting) → dispatch (delivery to all matching subscribers) → consumption (internal modules, Lua scripts, external ESL clients). Events follow broadcast semantics; dispatch happens on a separate thread, so slow subscribers do not block the main call flow. See [Event system](/advanced/events), [Integration practices](/advanced/README).
- An event consists of headers (`Event-Name`, `Core-UUID`, `Unique-ID`, etc.) and an optional body. The minimal set for a monitoring system is `CHANNEL_CREATE` + `CHANNEL_CALLSTATE` + `CHANNEL_HANGUP_COMPLETE` — enough to reconstruct the start, end, and course of every call. See [Event system](/advanced/events).
- fs_cli's `/event`, `/filter`, `/log` are Event Socket protocol-layer commands and must carry the `/` prefix; input without a slash is automatically prefixed with `api `. See [Event system](/advanced/events).
- `bgapi` throws a command onto a background thread and immediately returns a Job-UUID; when execution finishes, the event bus broadcasts a `BACKGROUND_JOB` event whose body is the command output. The standard way to fetch async results is to subscribe to `BACKGROUND_JOB` first, then send `bgapi`, matching by Job-UUID. See [Event system](/advanced/events).
- ESL has two working modes: inbound is an external program actively connecting to 8021, and after auth it owns the whole switch; outbound is FreeSWITCH using the `socket` application to "hand" a new call to an external program — no auth needed and naturally scoped to that single call. See [Scripting and programming interfaces](/advanced/scripting).

### Recording and Eavesdropping

- Three recording entry points: `record_session` writes to disk while the call runs and finalizes automatically when the call ends; `uuid_record` stays outside the dialplan — ops or external programs can start/stop recording on any live call at any time; `record` records the current leg's input audio, used for voicemail and IVR message capture. See [Recording and eavesdropping](/advanced/recording), [Integration practices](/advanced/README).
- `RECORD_STEREO=true` records two channels: the left channel is received audio, the right is sent audio, so both sides can be separated and reconstructed afterwards; `RECORD_MIN_SEC` discards files shorter than that many seconds as invalid. See [Recording and eavesdropping](/advanced/recording).
- Use `${uuid}` (a channel variable, different per call) as the primary key for recording filenames; it lines up precisely with `Unique-ID` in events and with CDR records — the recommended practice for reconciliation and lookup; organize into per-day directories and delete whole directories during cleanup. See [Recording and eavesdropping](/advanced/recording).
- `eavesdrop` listens in real time without the monitored party knowing; the listener uses DTMF keys to control which direction to hear (1 A leg only, 2 B leg only, 3 both directions, 0 mute). See [Recording and eavesdropping](/advanced/recording).
- Recording is disk-write heavy and must be paired with a retention policy; the minimum retention period in regulated industries comes from business rules and regulations, not a made-up number of days. See [Recording and eavesdropping](/advanced/recording).

### Scripting Exits: Lua and ESL

- Lua is the only scripting engine that works out of the box since FreeSWITCH 1.10 (mod_v8 is in the source tree but not enabled in default builds). `mod_spidermonkey` (JavaScript, API command `jsrun`), often mentioned in older material, was removed from the source in 1.4 and does not work on 1.10 — check the age of your references when reading. 1.11.0 also removed `mod_python` (mod_python3 stays) and about 30 legacy modules, and migrated regex to PCRE2. See [Scripting and programming interfaces](/advanced/scripting) and [Integration practices](/advanced/README).
- Lua scripts have four invocation entry points: the dialplan application (`lua`, session automatically available), the `lua` API (synchronous), the `luarun` API (background thread, good for resident scripts), and `startup-script` (runs with FreeSWITCH startup). See [Scripting and programming interfaces](/advanced/scripting).
- Before any operation in a script, check `session:ready()`; operating after hangup throws an error or fails silently; a missing `playback` file fails silently — check fs_cli's INFO-level logs when troubleshooting. See [Session](/concepts/session).
- ESL is a simple text protocol: after connecting, the server sends `auth/request`, the client sends `auth ClueCon`, and once `+OK accepted` comes back you can send `event` subscriptions, `api` synchronous commands, and `bgapi` async commands. A complete client can be built with just the Python standard library. See [Scripting and programming interfaces](/advanced/scripting).

### From Telephone to VoIP: A Brief History

- 1876: Bell invents the telephone; 1889: Strowger invents the automatic telephone exchange, starting to replace human operators. See [History of the telephone](/introduction/history).
- 1995: VocalTec ships Internet Phone, the first commercial Internet telephony software — VoIP is born; 2003: Skype launches; 2005: eBay acquires it for $2.6 billion; 2009: Google launches Google Voice (successor to 2006's GrandCentral). See [History of the telephone](/introduction/history).
- 2007: the iPhone ships and opens the smartphone era; WhatsApp, Viber, WeChat and other mobile Internet calling apps spread; in the 2010s UCaaS (Zoom, Microsoft Teams) became the core toolset of modern enterprise communications. See [History of the telephone](/introduction/history).

## Authoritative Books

The books cited and recommended on this site are listed below, all sourced from [Resources and references](/appendix/resources.md). The "related knowledge" column maps to this repo's pages per the resource page's notes; I have not verified them chapter by chapter against the originals. The two community books' author and publication info was originally marked "source unverified"; on 2026-10-10 I verified and filled it in from the FreeSWITCH Chinese community site's book list page.

| Title | Author / Year | Related knowledge | On-site source |
| ---- | ---- | ---- | ---- |
| *FreeSWITCH Cookbook* (2012, Packt) | Anthony Minessale et al. | Recipe-style Q&A covering common configuration scenarios | [Config file structure](/configuration/config-files) |
| *FreeSWITCH 1.2* (2013, Packt) | Anthony Minessale, Michael S. Collins, Darren Schreiber, Raymond Chandler | Early systematic material; the concepts still hold | [Core concepts](/concepts/session) |
| *FreeSWITCH 1.6 Cookbook* (2015, Packt) | Anthony Minessale II, Michael S. Collins, Giovanni Maruzzelli | Hands-on oriented, includes ESL and scripting examples | [Scripting and programming interfaces](/advanced/scripting) |
| *Mastering FreeSWITCH* (2016, Packt) | Anthony Minessale II, Giovanni Maruzzelli | Advanced topics: clustering, security, performance | [Deployment and operations](/project/deployment) |
| *FreeSWITCH 1.8* (2017, Packt) | Anthony Minessale II, Giovanni Maruzzelli | A more recent systematic treatment | [Core concepts](/concepts/session) |
| 《FreeSWITCH 权威指南》 | Du Jinfang et al. | The benchmark FreeSWITCH book in China, running from SIP basics through ESL, scripting, and production practice | [Resources and references](/appendix/resources.md) |
| 《FreeSWITCH 案例大全》《FreeSWITCH 参考手册》 | Du Jinfang and contributors (2016-2023, written collaboratively online, still being updated) | Community open-source books, case-driven, read online (book.dujinfang.com), no formal publisher | [Resources and references](/appendix/resources.md) |

The English books target older versions (1.2 through 1.8); config items change little but the module ecosystem moves fast, so treat the official manual as the yardstick when reading. Chinese community material spans a wide version range (1.2 through 1.11); confirm the version before quoting config snippets, then verify against the vanilla templates. The latest official stable release is 1.11.3. See [Resources and references](/appendix/resources.md).

## Official Documentation Highlights (with Links)

All the links below come from the registry in [Resources and references](/appendix/resources.md); the old wiki (freeswitch.org/confluence) has migrated to the SignalWire developer portal.

- [FreeSWITCH official site](https://freeswitch.org/): project home, news, download links, community links (now 301 to signalwire.com/freeswitch).
- [SignalWire official user manual](https://developer.signalwire.com/freeswitch/): 12 parts (Foundations, Configuration System, Call Routing, Media, Integration and Control, Module Reference, Troubleshooting, Programming, etc.); the most authoritative documentation entry point today.
- [Scripting integration chapter](https://developer.signalwire.com/freeswitch/integration/scripting): official documentation for Lua/JS/Python script modules and the `lua` / `luarun` pair of commands.
- [Embedded scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis): objects and methods available to scripts in each language (session, event, etc.).
- [Source release packages](https://files.freeswitch.org/releases/freeswitch/): source tarballs for each version (including the 1.10 and 1.11 series; latest stable 1.11.3).
- [Official GitHub repository](https://github.com/signalwire/freeswitch): main repo (sponsored and maintained by SignalWire), where issues/PRs go; vanilla config templates under `conf/vanilla/`, systemd unit under `build/`.
- [Mailing lists](https://lists.freeswitch.org/): freeswitch-users, freeswitch-dev and so on; the archives are full-text searchable, and many thorny problems are answered in old threads.
- [ClueCon](https://www.cluecon.com/): the developer conference founded by the FreeSWITCH founding team; yearly roadmap announcements and battle-tested talks, with slides made public.
- Third-party repositories used in the project notes: [drachtio-freeswitch-modules](https://github.com/mdslaney/drachtio-freeswitch-modules) (`mod_audio_fork`, a reference implementation for voice AI integration), [mod_audio_stream](https://github.com/amigniter/mod_audio_stream) (bidirectional WebSocket audio streaming), [Vosk](https://github.com/alphacep/vosk-api) (self-hostable open-source offline ASR, with Chinese models), [UniMRCP](https://www.unimrcp.org/) (open-source MRCP framework, the dependency under `mod_unimrcp`), [SIPp](https://github.com/SIPp/sipp) (SIP protocol-level load testing tool).
- [FreeSWITCH Chinese community](https://freeswitch.org.cn/): unofficial Chinese community site with a blog, introductory material, and release news. The official sites freeswitch.org and freeswitch.com now both 301 to signalwire.com/freeswitch (SignalWire maintains the project).

## Application Scenarios

FreeSWITCH is not a single product but a "communications building block": one kernel covers many scenarios through different module combinations. For positioning and a scenario overview see [What is FreeSWITCH](/introduction/what-is-freeswitch); the seven typical scenarios are in [FreeSWITCH application scenarios](/introduction/scenarios):

- **Enterprise IP-PBX**: replaces a traditional PBX; extensions register, dial each other internally, and reach carriers via SIP trunks or voice gateways — typical scale is SMEs from dozens to thousands of extensions.
- **Contact center**: ACD distributes inbound calls by skill group, IVR self-service, ESL controls agent busy/idle states, full recording, real-time reporting.
- **Voice gateway and trunk border**: SIP ↔ PSTN gateway, protocol conversion, number termination.
- **WebRTC voice and video**: mod_sofia natively supports SIP over WebSocket (`ws-binding` 5066, `wss-binding` 7443); combined with ICE/STUN/TURN and H.264/VP8 codecs it enables browser-to-browser calls, web softphones, and online classrooms.
- **Voice notifications and bulk outbound**: scripts or ESL looping `originate`, with TTS turning text into spoken audio; rate limiting and concurrency control avoid carrier bans.
- **Intelligent customer service and AI communications**: FreeSWITCH handles call access, media bridging, recording, and event reporting; ASR/TTS/NLP integrate with external services over ESL.
- **Conferencing and multi-party calls**: mod_conference provides mixed-audio conferencing with multi-party dial-in, moderator control, roll call, recording, and live-stream bypass.

The intelligent customer service project notes combine the components above into a phone-based customer service system; the design trade-offs are in [Intelligent customer service project overview](/project/README):

- **Separate switching from intelligence.** FreeSWITCH only does "answer it, play it, record it, route it"; all semantic understanding lives in external services. Voice and NLP technology iterate fast — decoupled, you can swap vendors without touching the switching layer.
- **Control plane over ESL, media plane over media streaming.** Business decisions depend on events (inbound call, answer, hangup, recording done); interventions depend on commands (answer, play, transfer, hang up) — the two channels have clear responsibilities.
- **Every intelligent step needs a fallback.** If ASR fails, drop to a DTMF menu; if NLP fails, play a static prompt; if TTS fails, fall back to pre-synthesized files. A customer service system is the company's inbound line and must not go wholly dark because one third-party API did.

For the trade-offs between the two voice-access routes see [ASR and TTS](/project/asr-tts): media-stream bypass (real-time streaming) has low first-utterance latency and supports interruption, but needs a streaming-capable channel; utterance-by-utterance recognition (recognize after recording the file) is simple to implement and suits prototypes and post-call agent QA. The practical advice is to get the flow working with utterance-by-utterance first, then move to real-time streaming — the NLP, state machines, and transfer logic are fully reusable across both routes. In a production customer service system, 80% of played prompts should be pre-synthesized files, with TTS only covering dynamic content.

NLP's three foundational capabilities are intent recognition, entity extraction, and dialogue management — see [NLP](/project/nlp). Turn advancement is driven by the business backend's state machine; the NLP service usually only answers "what does this sentence mean." Three engineering rules for the rule-based fallback: keep rule files separate from code (ops staff can add keywords themselves), bind confidence thresholds to fallback phrasing (below threshold, do not force a guess), and always put the "transfer to human / complaint" rules that route straight to an agent first.

## Common Pitfalls

### Configuration and Activation

- `X-PRE-PROCESS` runs before XML parsing; you cannot "comment it out" inside an XML comment — it still takes effect, and the only fix is deleting the whole line. This is the pitfall new users hit most. See [Config file structure](/configuration/config-files).
- `reloadxml` only re-parses XML configuration and does not load or unload modules; use `load` / `unload` / `reload` for runtime module changes. See [Module overview](/modules/README).
- After changing `sip_profiles`, `sofia profile <name> rescan` rescans smoothly; changing core parameters like listen address or port requires `restart`, which drops current calls — do it off-peak. See [SIP module](/modules/sip).
- After adding or modifying gateway files, `rescan` is enough — no `reloadxml` needed (gateways are not in the XML config section cache). See [Gateway module](/modules/gateway).
- After changing `$${}` global variables you must `reloadxml` to re-evaluate; use `global_getvar` in `fs_cli` to view all global variables. See [Core config files](/configuration/core-files).

### Dialplan and Routing

- A missing `^` / `$` in a regex is the number-one reason a rule does not match; use `uuid_dump` to see the real value of `destination_number`. See [Static dialplan](/concepts/static-dialplan).
- Extensions are evaluated in filename and written order; use `00-` / `50-` / `90-` prefixes to make matching priority explicit; putting new business rules in their own fragment file avoids conflicts best. See [Static dialplan](/concepts/static-dialplan).
- The conference `+pin` must come after the profile: `3000@default+4321`; before the profile it does not take effect. See [Conference module](/modules/conference).
- Before the bridge to a human agent, `set hangup_after_bridge=true` and `continue_on_fail=true`, so the whole call ends when the agent hangs up and the script can still continue (to voicemail) when the agent does not answer. See [Implementing intelligent customer service](/project/implementation).

### Network Security

- `vars.xml`'s `default_password` and the `password` in extension files both default to `1234`; on a public-internet machine, an extension with a weak password gets registered and used for toll fraud within minutes. See [Core config files](/configuration/core-files), [Deployment and operations](/project/deployment).
- Never expose 8021 (ESL) to the public internet; `fs_cli` over a local connection is enough, and remote administration goes through an SSH tunnel. See [Network settings](/configuration/network).
- Keep `accept-blind-reg` / `accept-blind-auth` commented out; do not enable them. See [SIP module](/modules/sip).
- Do not leave the external profile's `auth-calls=false` wide open on the public internet: use `apply-inbound-acl` to admit only the peer IP range, or bind the source with `gw-auth-acl` on the gateway. See [Gateway module](/modules/gateway).
- The default ESL password `ClueCon` must be changed before going live; on an intranet deployment pin `listen-ip` to `127.0.0.1`, and if remote connections are truly needed, configure an `apply-inbound-acl` allowlist. See [Deployment and operations](/project/deployment).

### Media and Recording

- One-way audio (one side cannot hear the other) is the classic RTP problem: the firewall is not passing the RTP port range, or `ext-rtp-ip` is wrong (the peer sends media to an unreachable address). Use `tcpdump` to confirm RTP flows both ways. See [Gateway module](/modules/gateway), [Deployment and operations](/project/deployment).
- Calls connect but are fully silent or get 488 — that is a codec mismatch: the peer does not offer the codecs you advertise; narrow with `absolute_codec_string=PCMU,PCMA` to verify, and enable `inbound-late-negotiation` if needed. See [Gateway module](/modules/gateway).
- There is no `volume` application; channel-level volume goes through `uuid_audio`, in-conference volume through `conference volume_in` / `volume_out`. See [Media module](/modules/media).
- Recording file missing or 0 seconds: first check whether `record_seconds` is 0 (recording started before the channel answered, or the peer's silence triggered the early cutoff), then check permissions and disk space. See [Deployment and operations](/project/deployment).
- When `RECORD_APPEND` is on, the core pins `RECORD_MIN_SEC` to 3 seconds — mind this interaction when tuning both. See [Recording and eavesdropping](/advanced/recording).
- With `bypass_media` on, FreeSWITCH no longer sees the media; recording and ASR both stop working — weigh this against recording and monitoring needs before enabling. See [Deployment and operations](/project/deployment).

### Scripting and Events

- `mod_spidermonkey` / `jsrun` usage does not work on 1.10; for embedded scripting, use Lua across the board. See [Scripting and programming interfaces](/advanced/scripting).
- Sending just `event plain` (with no event names) gets `-ERR no keywords supplied`; you must name at least one event. See [Event system](/advanced/events).
- Subscribing to `CUSTOM` events requires the subclass name (e.g., `event plain CUSTOM acd::agent_state`); `event plain all` is the exception — it receives everything. See [Event system](/advanced/events).
- `bgapi` results come back via `BACKGROUND_JOB` events; subscribe first, then send `bgapi`, or you will not get the async result. See [Event system](/advanced/events).
- Before operating in a script, check `session:ready()`; operating after hangup throws an error or fails silently. See [Session](/concepts/session).

### Reference Material Versions

- The English books target 1.2 through 1.8; config items change little but the module ecosystem moves fast — treat the official manual as the yardstick when reading. See [Resources and references](/appendix/resources.md).
- Chinese community content spans a wide version range (1.2 through 1.11); confirm the version before quoting config snippets, then verify against the vanilla templates. See [Resources and references](/appendix/resources.md).
- The 1.11 series has breaking changes: 1.11.0 removed `mod_python` (mod_python3 stays) and about 30 legacy modules (mod_h26x, mod_portaudio, mod_rayo, etc.) and moved the regex engine to PCRE2; before quoting module names or regex syntax from 1.10-or-earlier material, confirm in the official release notes. See [Scripting and programming interfaces](/advanced/scripting), [Resources and references](/appendix/resources.md).
- Community audio-streaming modules (`mod_audio_stream`, `mod_audio_fork`) are not in the official source tree or release packages and must be compiled yourself; these repos churn fast and mirrors abound — confirm the public repo and maintenance status before use. See [Resources and references](/appendix/resources.md), [ASR and TTS](/project/asr-tts).
- The official domains have moved: freeswitch.org and freeswitch.com now both 301 to signalwire.com/freeswitch — mind the redirect when quoting old links. See [Resources and references](/appendix/resources.md).

<!-- BACKLINKS-AUTO -->
## Related pages

- [events](/advanced/events.md)
- [recording](/advanced/recording.md)
- [scripting](/advanced/scripting.md)
- [resources](/appendix/resources.md)
- [call](/concepts/call.md)
- [channel](/concepts/channel.md)
- [dialplan](/concepts/dialplan.md)
- [dynamic-dialplan](/concepts/dynamic-dialplan.md)
- [session](/concepts/session.md)
- [static-dialplan](/concepts/static-dialplan.md)
- [config-files](/configuration/config-files.md)
- [core-files](/configuration/core-files.md)
- [network](/configuration/network.md)
- [history](/introduction/history.md)
- [scenarios](/introduction/scenarios.md)
- [README](/modules/README.md)
- [conference](/modules/conference.md)
- [gateway](/modules/gateway.md)
- [media](/modules/media.md)
- [sip](/modules/sip.md)
- [README](/project/README.md)
- [asr-tts](/project/asr-tts.md)
- [deployment](/project/deployment.md)
- [implementation](/project/implementation.md)
- [nlp](/project/nlp.md)
