# Module Overview

FreeSWITCH's core is a lean switching kernel: media bridging, channel state machines, the XML configuration engine. Capabilities like SIP, conferencing, voicemail, recording, and codec handling are provided by **modules**. The module practice notes are split across [SIP](/modules/sip), [IVR](/modules/ivr), [Conference](/modules/conference), [Gateway](/modules/gateway), and [Media Processing](/modules/media).

## What Is a Module

A module is a dynamic library compiled to `.so` (Linux) or `.dll` (Windows), installed into the `mod/` directory:

| Install method | Module directory |
| ---- | ---- |
| Source build (default prefix) | `/usr/local/freeswitch/mod` |
| Official deb/rpm packages | `/usr/lib/freeswitch/mod` |

The core loads them into the process at startup according to the configuration — **a module that isn't in the config doesn't exist: its commands, applications, and codecs are all absent.**

### modules.conf.xml: the master switch for modules

`conf/autoload_configs/modules.conf.xml` decides which modules load at startup, one module per line:

```xml
<configuration name="modules.conf" description="Modules">
  <modules>
    <!-- Logging -->
    <load module="mod_console"/>
    <load module="mod_logfile"/>
    <!-- XML interface and data -->
    <load module="mod_enum"/>
    <load module="mod_cdr_csv"/>
    <!-- Events -->
    <load module="mod_event_socket"/>
    <!-- Endpoints (SIP stack, etc.) -->
    <load module="mod_sofia"/>
    <load module="mod_loopback"/>
    <!-- Applications -->
    <load module="mod_commands"/>
    <load module="mod_conference"/>
    <load module="mod_dptools"/>
    <load module="mod_voicemail"/>
    <!-- Codecs -->
    <load module="mod_spandsp"/>
    <load module="mod_opus"/>
    <!-- Scripting -->
    <load module="mod_lua"/>
    <!-- Just comment out modules you don't need -->
    <!-- <load module="mod_fsv"/> -->
  </modules>
</configuration>
```

- Load order is the written order in the file; some modules have ordering dependencies (e.g. `mod_dptools` provides the vast majority of applications);
- Comment out a line and restart, and that module no longer loads; `autoload_configs/` also has `pre_load_modules.conf.xml` and `post_load_modules.conf.xml`, loaded before and after the main table respectively, for modules that need special timing;
- Editing this table only affects the **next startup**; use `load` / `unload` for runtime changes (see below).

The source tree root also has a `modules.conf` without the `.xml` extension — that's the **build-time** switch, deciding which modules `make` compiles; deb/rpm packages are split by `freeswitch-mod-*`, and once the files are in place you just uncomment the `<load>` in the XML.

### Interface types a module can register

A module can register multiple interfaces with the core; a single `.so` is often several of these at once:

| Interface type | Typical example | Inspect command |
| ---- | ---- | ---- |
| API command | `mod_commands` (`show`, `load`, `originate`…) | `fs_cli -x "show api"` |
| Application | `mod_dptools` (`answer`, `bridge`, `playback`…) | `fs_cli -x "show applications"` |
| Endpoint | `mod_sofia` (`sofia/`), `mod_loopback` (`loopback/`) | `fs_cli -x "show endpoint"` |
| Codec | `mod_opus`, `mod_spandsp` | `fs_cli -x "show codec"` |
| File format | `mod_sndfile` (wav), `mod_av` (mp4/mkv) | `fs_cli -x "show file"` |
| Dialplan interface | `mod_dialplan_xml`, `mod_dialplan_asterisk` | `fs_cli -x "show dialplan"` |

`fs_cli -x "show interfaces"` summarizes all registered interfaces, and `fs_cli -x "show interface_types"` lists interface types — when tracking down "why doesn't this command exist", use these first to confirm whether the module is loaded at all.

## FreeSWITCH module categories

By responsibility, the common modules fall into five categories, roughly matching the `src/mod/` directory layout in the source tree.

### Core modules

Provide the basic runtime infrastructure; nearly every scenario needs them:

| Module | Role |
| ---- | ---- |
| `mod_console` / `mod_logfile` | Console and file logging |
| `mod_commands` | A large number of API commands: `show`, `load`, `originate`, `uuid_*`, etc. |
| `mod_dptools` | Applications like `answer`, `bridge`, `playback`, `transfer`, `ivr`, `play_and_get_digits` |
| `mod_dialplan_xml` | Parses XML dialplans under `dialplan/` |
| `mod_hash` / `mod_db` / `mod_expr` | Key-value cache, flat database, expression evaluation |
| `mod_native_file` / `mod_tone_stream` / `mod_local_stream` | Native files, tone_stream, directory loop playback |
| `mod_xml_curl` | Hands off sections like dialplan/directory/configuration to an HTTP interface for dynamic returns |

### Application modules

Provide complete business functionality; load them on demand:

| Module | Role |
| ---- | ---- |
| `mod_conference` | Multi-party conferencing (the conference module) |
| `mod_voicemail` | Voicemail |
| `mod_fifo` / `mod_callcenter` | Queuing and agent seats |
| `mod_valet_parking` | Call parking |
| `mod_lcr` / `mod_distributor` | Least-cost routing and round-robin distribution |
| `mod_httapi` | HTTP-interface-driven call control |
| `mod_directory` | Extension directory dialing and voice announcements |
| `mod_esf` / `mod_spy` | Extended forwarding, call spying |
| `mod_av` / `mod_fsv` | Multimedia container read/write, native video recording (media processing modules) |

### Codec modules

- **Audio**: `mod_opus` (Opus), `mod_spandsp` (G.711/G.722/GSM/G.726, plus fax, DTMF and other DSP), `mod_g729`, `mod_g723_1`, `mod_ilbc`, `mod_silk`, `mod_amr`, `mod_codec2`;
- **Video**: `mod_openh264` (H.264 codec), `mod_h26x` (H.264/H.263 series RTP payload pass-through, removed since 1.11.0), `mod_yuv`;
- **No module needed**: PCMU/PCMA (G.711) and L16 are implemented directly in the core, and VP8/VP9 video is likewise provided by the core;
- **License-gated extensions**: `mod_com_g729`, `mod_sangoma_codec`, etc., not loaded by default (`mod_sangoma_codec` isn't shipped with the main source tree and must be obtained separately).

### Gateway and endpoint modules

Decide "where calls come in from and where they go out to":

| Module | Role |
| ---- | ---- |
| `mod_sofia` | SIP protocol stack, the internal/external profiles and all gateways (see [SIP Module](/modules/sip) and [Gateway Module](/modules/gateway)) |
| `mod_verto` | Verto protocol, browser WebRTC clients |
| `mod_rtc` | WebRTC SDP negotiation assistance |
| `mod_skinny` | Cisco SCCP protocol |
| `mod_loopback` | `loopback/` endpoint, for legs, self-testing and splitting the dialplan |

### Event modules

Emit the call process to external systems as events and CDRs:

| Module | Role |
| ---- | ---- |
| `mod_event_socket` | ESL — external programs subscribe to events and execute commands over `127.0.0.1:8021` |
| `mod_cdr_csv` / `mod_xml_cdr` | CSV CDRs and XML/HTTP CDRs |
| `mod_event_multicast` | Distribute events to multicast addresses |
| `mod_erlang_event` / `mod_snmp` | Erlang integration, SNMP monitoring |

## Inspecting modules with fs_cli

```bash
# List of loaded modules (module name, type, description)
fs_cli -x "show modules"

# Inspect each interface type separately
fs_cli -x "show codec"        # Available codecs
fs_cli -x "show applications"  # Available applications
fs_cli -x "show api"          # Available API commands
fs_cli -x "show endpoint"     # Available endpoint protocols
fs_cli -x "show interfaces"   # Full interface summary
```

If a module doesn't show up in `show modules`, or throws an error while loading, check the console output and `log/freeswitch.log` first — the most common causes are missing dependency libraries (e.g. `mod_av` needs the ffmpeg development libraries) or a version mismatch between the module files and the main binary.

## load / unload / reload

```bash
# Load: takes effect immediately, doesn't interrupt established calls
fs_cli -x "load mod_conference"

# Unload: refuses if the module still has active sessions; add -f to force when needed
fs_cli -x "unload mod_conference"
fs_cli -x "unload -f mod_conference"

# Reload: equivalent to unload then load
fs_cli -x "reload mod_conference"
```

Three things to keep in mind:

1. `load` / `unload` / `reload` only change the **runtime state**; `modules.conf.xml` is unchanged — if you want a module to keep this state across the next startup, edit the XML;
2. `reloadxml` only re-parses the XML configuration; it does **not** load or unload modules — the two are frequently confused;
3. Be careful with call-bearing modules: `unload mod_sofia` tears down all SIP sessions and extension registrations. For SIP config changes, use `sofia profile <name> rescan`; see [SIP Module](/modules/sip).

## Further reading

- [Core Configuration Files](/configuration/core-files) — field notes on `modules.conf.xml` and `vars.xml`;
- [Configuration File Structure](/configuration/config-files) — the full `conf/` directory and the loading mechanism;
- [SIP Module](/modules/sip) — the first module to look at: mod_sofia;
- [Static Dialplan](/concepts/static-dialplan) — how applications are composed into routes in the dialplan;
- [Installing on Linux](/installation/linux) — source builds, module pruning, and the `freeswitch-mod-*` package split.

## References

- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)
- [SignalWire · FreeSWITCH Docs](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related pages

- [knowledge](/knowledge.md)
- [conference](conference.md)
- [gateway](gateway.md)
- [ivr](ivr.md)
- [sip](sip.md)
