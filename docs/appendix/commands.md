# Appendix B · Common Commands and Tools

This collects the `fs_cli` api commands and system tools I use day to day for ops and troubleshooting. I have checked the command syntax against the FreeSWITCH 1.11.3 source (`mod_commands`, `mod_sofia`, etc.); substitute real values for your environment.

## fs_cli basics

```bash
fs_cli                                # connect to local 8021, enter interactive console
fs_cli -x "status"                    # -x runs one command then exits (script friendly)
fs_cli -H 10.0.0.5 -p ClueCon -x "sofia status"   # -H host -P port -p password
```

Built-in control commands in interactive mode (they start with `/`, they are not api commands):

| Built-in command | What it does |
| ---- | ---- |
| `/log <level>` | Adjust log display level (e.g. `/log debug`) |
| `/event <event>` | Subscribe to events (e.g. `/event CHANNEL_ANSWER`, `/event plain ALL`) |
| `/filter <condition>` | Filter console event output |
| `/help` | Help |
| `/quit` | Exit |

## Common api commands

### System and status

| Command | Description | Example |
| ---- | ---- | ---- |
| `version` | Show FreeSWITCH version | `fs_cli -x "version"` |
| `status` | Running state, session count, SPS | `fs_cli -x "status"` |
| `uptime` | Time since start | `fs_cli -x "uptime"` |
| `show channels` | All current channels | `fs_cli -x "show channels"` |
| `show channels count` | Channel count | `fs_cli -x "show channels count"` |
| `show channels like 1000` | Filter channels by condition | `fs_cli -x "show channels like 1000"` |
| `show calls` | Calls in bridge | `fs_cli -x "show calls"` |
| `show detailed_calls` | Detailed call view | `fs_cli -x "show detailed_calls"` |
| `show registrations` | Registered extensions | `fs_cli -x "show registrations"` |
| `show modules` | Loaded modules | `fs_cli -x "show modules"` |
| `show applications` | All available applications; `show application <name>` shows one in detail | `fs_cli -x "show applications"` |
| `show api` | Available api commands | `fs_cli -x "show api"` |
| `show codec` | Loaded codecs | `fs_cli -x "show codec"` |
| `show dialplan` | Dialplan in memory | `fs_cli -x "show dialplan"` |
| `show tasks` | Kernel scheduled tasks | `fs_cli -x "show tasks"` |

### Call control (uuid family)

Every `<uuid>` below can be found with `show channels`:

| Command | Syntax | Description |
| ---- | ---- | ---- |
| `uuid_kill` | `<uuid> [cause]` | Hang up the call, cause defaults to `NORMAL_CLEARING` |
| `uuid_park` | `<uuid>` | Park the call |
| `uuid_bridge` | `<uuid1> <uuid2>` | Bridge two existing channels directly |
| `uuid_transfer` | `<uuid> [-bleg\|-both] <dest-exten> [<dialplan>] [<context>]` | Transfer to an extension/number |
| `uuid_broadcast` | `<uuid> <path> [aleg\|bleg\|holdb\|both]` | Play an audio file on the call |
| `uuid_record` | `<uuid> [start\|stop\|mask\|unmask] <path> [<limit>]` | Start/stop/mask recording, limit is in seconds |
| `uuid_dump` | `<uuid> [format]` | Print all channel variables |
| `uuid_getvar` | `<uuid> <var>` | Read a single channel variable |
| `uuid_setvar` | `<uuid> <var> [value]` | Write a channel variable |
| `uuid_answer` | `<uuid>` | Answer that channel |
| `uuid_send_dtmf` | `<uuid> <dtmf_data>` | Send DTMF to the channel |
| `uuid_media` | `[off] <uuid>` | Trigger media renegotiation (re-INVITE), `off` for bypass media |
| `uuid_hold` | `[off\|toggle] <uuid> [<display>]` | Hold/resume the call |

Examples:

```bash
fs_cli -x "uuid_broadcast <uuid> /usr/local/freeswitch/sounds/reply.wav both"
fs_cli -x "uuid_record <uuid> start /usr/local/freeswitch/recordings/a.wav 300"
fs_cli -x "uuid_transfer <uuid> 1001 XML default"
fs_cli -x "uuid_kill <uuid> CALL_REJECTED"
```

### Originating calls

`originate <call url> <exten>|&<application_name>(<app_args>) [<dialplan>] [<context>] [<cid_name>] [<cid_num>] [<timeout_sec>]`:

```bash
# call an internal extension and echo test
fs_cli -x "originate user/1000 &echo()"
# call out and park (commonly used to build a leg first, then uuid_bridge)
fs_cli -x "originate user/1001 &park()"
# with caller id and variables, outbound via a gateway
fs_cli -x "originate {origination_caller_id_number=057188887777,ignore_early_media=true}sofia/gateway/gw1/13800138000 &playback(/srv/prompts/notify.wav)"
# generate load in bulk (stress test)
fs_cli -x "originate loopback/8000 &park()"
```

Companion commands: `hupall` (hang up all calls or those matching a variable, e.g. `hupall NORMAL_CLEARING`), and `show channels count` to watch the result.

### Configuration and modules

| Command | Description |
| ---- | ---- |
| `reloadxml` | Reload all XML config (required after changing dialplan/directory/vars) |
| `reloadacl` | Reload `acl.conf.xml` |
| `reload <module name>` | Reload a module (e.g. `reload mod_event_socket`) |
| `load <module name>` / `unload <module name>` | Dynamically load/unload a module |
| `global_getvar` | List all global variables; `global_getvar domain_name` shows one |
| `global_setvar` | Set a global variable (e.g. `global_setvar myflag=on`) |
| `xml_locate dialplan name default` | Inspect the merged, expanded config XML |
| `eval ${...}` | Evaluate a variable expression |

### Sofia (SIP)

| Command | Description |
| ---- | ---- |
| `sofia status` | Overview of all profiles (whether RUNNING) |
| `sofia status profile internal` | Profile detail: port, ACL, registration count, session stats |
| `sofia status gateway gw1` | Gateway state (REGED/FAIL_WAIT, etc.) |
| `sofia profile internal rescan` | Rescan profile/gateway config (use when adding a gateway) |
| `sofia profile internal restart` | Restart a profile (drops current calls, do it off-peak) |
| `sofia profile internal siptrace on` / `off` | Toggle SIP signaling trace |
| `sofia global siptrace on` / `off` | Global signaling trace |
| `sofia loglevel all 9` | Temporarily raise Sofia log level to max |
| `sofia profile internal flush_inbound_reg <user>` | Clear a user's registration cache |
| `sofia profile internal killgw gw1` | Remove a gateway |
| `sofia xmlstatus profile internal` | Emit status as XML (friendly to programmatic collection) |

### Scripting and runtime control

| Command | Description | Example |
| ---- | ---- | ---- |
| `luarun` | Run a Lua script in a separate thread (no session) | `fs_cli -x "luarun test.lua arg1"` |
| `lua` | Run a Lua script inline and wait for it to finish | `fs_cli -x "lua test.lua"` |
| `fsctl` | Runtime control | `fsctl loglevel err`, `fsctl sps 50`, `fsctl max_sessions 500`, `fsctl send_sighup` |
| `console loglevel <level>` | Console log level (0-7 or name) | `fs_cli -x "console loglevel 3"` |
| `bgapi <command>` | Run an api in a background thread, result returned via event | `bgapi originate user/1000 &park()` |
| `getenv`, `eval`, `cond` and similar helpers | Miscellaneous | `fs_cli -x "getenv HOME"` |

## Common tools

### sngrep: SIP packet capture analysis

A terminal tool more focused on SIP than Wireshark, chaining a timeline by Call-ID; my first choice for registration and call problems:

```bash
sudo sngrep                          # live capture (defaults to the first non-loopback NIC)
sudo sngrep -d any port 5060         # specify NIC and port
sudo sngrep -r port 5060             # capture RTP too, so you can watch the media stream
sudo sngrep -O /tmp/sip.pcap port 5060        # capture and save as pcap
sngrep -I /tmp/sip.pcap              # offline analysis of a pcap
```

### tcpdump: low-level capture

```bash
# capture SIP signaling (save full packets, analyze offline with sngrep/Wireshark)
sudo tcpdump -ni any -s 0 udp port 5060 -w /tmp/sip.pcap
# quickly confirm RTP is flowing both ways
sudo tcpdump -ni any udp portrange 16384-32766 -c 100
# look at traffic from one endpoint only
sudo tcpdump -ni eth0 host 192.168.1.50 and port 5060
# read an existing pcap
sudo tcpdump -nr /tmp/sip.pcap | head
```

### sox / soxi: recording processing

The standard pair for converting prompt formats and health-checking recordings:

```bash
soxi --i recording.wav                 # show format info (sample rate/channels/duration)
soxi -D recording.wav                  # duration only (seconds)
# convert to 8k mono 16bit wav (the standard IVR prompt format)
sox input.mp3 -r 8000 -c 1 -b 16 output.wav
# mix (e.g. combine hold music with a prompt)
sox -m music.wav prompt.wav mixed.wav
# concatenate two prompts
sox welcome.wav menu.wav combined.wav
# export after a fade in/out
sox in.wav out.wav fade t 0.3 0 0.5
```

### Others

| Tool | Use | Example |
| ---- | ---- | ---- |
| `tshark` | Command-line Wireshark, supports display filters | `tshark -i eth0 -f 'port 5060' -Y 'sip.Method == REGISTER'` |
| `openssl s_client` | Verify the SIP TLS port | `openssl s_client -connect 127.0.0.1:5061` |
| `openssl s_client` (WSS) | Verify WebRTC WSS | `openssl s_client -connect 127.0.0.1:7443` |
| `ss` | Check listening ports | `ss -lntup \| grep -E '5060\|8021'` |
| `lsof` | Check a process's open files/ports | `lsof -p $(pidof freeswitch) \| grep recordings` |
| `pjsua`/`sipcmd` style CLI phones | Unattended registration/call regression tests | See each tool's own docs |

## How I like to use them

- When troubleshooting, start with `/log debug` or `sofia profile internal siptrace on`, watch the phenomenon, then back the level off; keep full debug on long term and you will fill the disk;
- `fs_cli -x` suits scripts and monitoring collection, interactive mode suits manual investigation;
- After any config change, run `reloadxml` first, then place a test call, and use `uuid_dump` to confirm the channel variables came out as expected.

## References

- [FreeSWITCH official site](https://freeswitch.org/)
- [GitHub · signalwire/freeswitch releases](https://github.com/signalwire/freeswitch/releases)
- [GitHub · signalwire/freeswitch](https://github.com/signalwire/freeswitch)

<!-- BACKLINKS-AUTO -->
## Related pages

- [resources](resources.md)
- [asr-tts](/project/asr-tts.md)
