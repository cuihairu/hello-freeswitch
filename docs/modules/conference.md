# Conference Module

`mod_conference` implements a multi-party conference bridge (MCU) inside FreeSWITCH: audio is mixed at the profile's sample rate, and video can be mixed into layouts. These notes cover the config structure, how conferences are created, the control commands, and recording / bypass output.

## mod_conference Overview

- Once the module is loaded it provides the `conference` application (pulling the current call into a conference) and a same-named `conference` API command (out-of-band control);
- A conference **does not need to be created in advance**: the first arriving member triggers instantiation per profile, and the last member leaving destroys it automatically;
- A conference name can carry `@profile` to select a parameter template; `@default` is the default profile;
- Configuration lives in `conf/autoload_configs/conference.conf.xml`, with video layouts in `conf/autoload_configs/conference_layouts.conf.xml`;
- Each member can have independent key control, volume, and energy threshold; a moderator can have their own key set.

## Configuring the Conference Service

### The Structure of conference.conf.xml

```xml
<configuration name="conference.conf" description="Audio Conference">
  <advertise>
    <!-- advertise conference rooms to presence, optional -->
    <room name="3001@$${domain}" status="FreeSWITCH"/>
  </advertise>

  <caller-controls>
    <!-- when no key group is specified, members use the default group -->
    <group name="default">
      <control action="mute" digits="0"/>
      <control action="energy up" digits="9"/>
      <control action="energy dn" digits="7"/>
      <control action="vol talk up" digits="3"/>
      <control action="vol talk dn" digits="1"/>
      <control action="vol listen up" digits="6"/>
      <control action="vol listen dn" digits="4"/>
      <control action="hangup" digits="#"/>
    </group>
  </caller-controls>

  <profiles>
    <profile name="default">
      <param name="domain" value="$${domain}"/>
      <param name="rate" value="8000"/>
      <param name="interval" value="20"/>
      <param name="energy-level" value="100"/>
      <param name="muted-sound" value="conference/conf-muted.wav"/>
      <param name="unmuted-sound" value="conference/conf-unmuted.wav"/>
      <param name="alone-sound" value="conference/conf-alone.wav"/>
      <param name="moh-sound" value="$${hold_music}"/>
      <param name="enter-sound" value="tone_stream://%(200,0,500,600,700)"/>
      <param name="exit-sound" value="tone_stream://%(500,0,300,200,100,50,25)"/>
      <param name="kicked-sound" value="conference/conf-kicked.wav"/>
      <param name="locked-sound" value="conference/conf-locked.wav"/>
      <param name="pin-sound" value="conference/conf-pin.wav"/>
      <param name="bad-pin-sound" value="conference/conf-bad-pin.wav"/>
      <param name="comfort-noise" value="true"/>
    </profile>
  </profiles>
</configuration>
```

A three-layer structure:

1. `advertise` — announce conference rooms to presence (optional);
2. `caller-controls` — DTMF key groups, referenced by profiles (the group names `default` and `none` are reserved);
3. `profiles` — parameter templates; append `@<profile>` after the conference name to select one, and `default` is used when none is given.

### Common Audio Profile Parameters

| Parameter | Role |
| ---- | ---- |
| `rate` / `interval` / `channels` | Mix sample rate (8000/16000/32000/48000), frame length (ms), channel count |
| `energy-level` | Energy threshold for "currently speaking"; below it, audio isn't forwarded to other members (comfort/voice-activity suppression) |
| `caller-controls` / `moderator-controls` | Member key group / moderator key group |
| `moh-sound` / `alone-sound` | Music on hold while waiting / prompt when alone |
| `enter-sound` / `exit-sound` / `kicked-sound` | Prompts for entering, leaving, and being kicked |
| `muted-sound` / `unmuted-sound` | Prompts for muting and unmuting |
| `pin` / `moderator-pin` / `pin-retries` | Conference PIN, moderator PIN, PIN retry count |
| `max-members` | Maximum number of members |
| `member-flags` | Default flags for new members (e.g. `waste`, `mute`) |
| `comfort-noise` | Generate comfort noise during silent periods |
| `auto-record` | Record every conference automatically (see below) |
| `conference-flags` | Conference-level flags: `wait-mod`, `audio-always`, `video-bridge`, `rfc-4579`, `livearray-sync`, etc. |
| `sound-prefix` / `tts-engine` / `tts-voice` | Prompt path prefix and TTS; with TTS enabled, sound parameters starting with `say:` are read as text |
| `cdr-log-dir` | Conference CDR output directory (`auto` is the default location) |

Vanilla ships `default` (8k), `wideband` (16k), `ultrawideband` (32k), `cdquality` (48k) and several `video-mcu-stereo*` video templates — copy and tweak as needed.

### Video Profile (Overview)

Video parameters (`video-mode`, `video-layout-name`, `video-canvas-size`, `video-canvas-bgcolor`, `video-fps`, `video-codec-bandwidth`, etc.) and multi-canvas control are covered under [Media Module](/modules/media); this page deals with audio only.

## Creating a Conference

### Dialplan: the conference application

```xml
<include>
  <!-- conf/dialplan/default/20-conference.xml -->
  <extension name="conference_3000">
    <condition field="destination_number" expression="^(3000)$">
      <action application="answer"/>
      <action application="conference" data="3000@default"/>
    </condition>
  </extension>
</include>
```

The full form of `data` is `conference_name[@profile][+pin][+flags{flag|flag}]`; note that `+pin` goes after the profile:

```xml
<include>
  <!-- +pin goes after the profile -->
  <action application="conference" data="3000+4321"/>
  <!-- when specifying a profile, write it as -->
  <action application="conference" data="3000@default+4321"/>
  <!-- moderator flag -->
  <action application="conference" data="3000@default+flags{moderator}"/>
</include>
```

Common member flags: `moderator` (apply the `moderator-controls` key group), `mute` / `deaf` (mute or deaf on entry), `nomoh` (no music on hold when alone), `endconf` (end the conference when this member fully leaves), `video-bridge` (participate in video mixing). Conference-level flags can also be given via the channel variable `conference_flags` (e.g. `wait-mod`, so other members wait until the moderator arrives).

### Dialing Someone In from Outside the Conference

```bash
# dial out one leg and add it to the conference: endpoint, caller number, caller name
fs_cli -x "conference 3000 dial sofia/internal/1002 1002 Manager"
# background dial out
fs_cli -x "conference 3000 bgdial sofia/internal/1003 1003 Clerk"
```

The endpoint string for `dial` / `bgdial` is the same as for `bridge` (`sofia/internal/1002`, `sofia/gateway/carrier1/13800138000`), so this also pulls a PSTN phone on the gateway side into the conference.

## Conference Control Commands

All of these are invoked through `conference <conference name> <subcommand> [arguments]`, runnable from both `fs_cli` and ESL.

### Viewing

| Command | Syntax |
| ---- | ---- |
| List members | `conference <name> list` (optionally add `delim <string>` or `count`) |
| Member count | `conference <name> count` |
| XML/JSON view | `conference <name> xml_list` / `json_list` |
| Read parameter | `conference <name> get <parameter-name>` |

```bash
fs_cli -x "conference 3000 list"
fs_cli -x "conference 3000 count"
```

### Member Control

| Command | Syntax | Description |
| ---- | ---- | ---- |
| Kick | `kick <member_id\|all\|last\|non_moderator> [<sound file>]` | Plays a prompt then hangs up |
| Hang up | `hup <member_id\|all\|last\|non_moderator>` | Hang up directly |
| Mute | `mute <member_id\|all\|last\|non_moderator> [<quiet>]` | Add `quiet` to skip the prompt |
| Unmute | `unmute <same>` | |
| Deaf | `deaf <same>` / `undeaf <same>` | Can't hear conference audio |
| Inbound volume | `volume_in <member_id\|all\|last\|non_moderator> [<newval>]` | Volume this member sends into the conference |
| Outbound volume | `volume_out <same>` | Volume this member hears |
| Energy threshold | `energy <same> [<newval>]` | Per-member speaking-detection threshold |
| Auto gain | `agc <same> [<newval>]` | Member-level AGC |
| Directed silence | `relate <member_id> <other_member_id> [nospeak\|nohear\|clear]` | One- or two-way isolation between two people |
| Inter-conference transfer | `transfer <target conference name> <member id> [...]` | Move a member to another conference |
| Inject DTMF | `dtmf <member_id\|all> <digits>` | Inject DTMF into a member |

```bash
fs_cli -x "conference 3000 kick 3"
fs_cli -x "conference 3000 mute all"
fs_cli -x "conference 3000 volume_out 3 4"
```

`member_id` is the sequence number assigned on joining the conference, in the first column of `list` output; `all`, `last`, and `non_moderator` each select a batch at once.

### Conference-Level Control

| Command | Syntax | Description |
| ---- | ---- | ---- |
| Lock | `lock` / `unlock` | After locking, new members can't join |
| PIN | `pin <pin#>` / `nopin` | Set/clear the conference PIN at runtime |
| Play | `play <file_path> [async\|<member_id> [nomux]]` | Play a file into the conference; specifying a member plays only to that member |
| Stop | `stop <current\|all\|async\|last> [<member_id>]` | |
| Speak | `say <text>` / `saymember <member_id> <text>` | TTS announcement (requires tts-engine configured) |
| Music on hold | `moh <file_path>\|toggle\|[on\|off]` | |
| Record | `record <filename>` / `norecord <filename\|all>` / `recording [start\|stop\|check\|pause\|resume] [<filename>\|all]` / `chkrecord <confname>` | See next section |
| Record volume | `file-vol <vol#>` | Adjust recording / file playback volume |
| Prompt toggle | `enter_sound on\|off\|none\|file <filename>` / `exit_sound same` | |
| Write parameter | `set <max_members\|sound_prefix\|caller_id_name\|caller_id_number\|endconference_grace_time> <value>` | Change parameters at runtime |

Beyond key control, members can perform the common operations themselves via DTMF: `0` toggles mute, `9/7` raise/lower energy, `3/1` own talk volume, `6/4` listen volume, `#` hang up (vanilla `default` key group); a moderator just switches to the `moderator-controls` group to get their own key layout.

## Recording and Live Bypass

### Recording

```bash
# start/stop recording (path is up to you; wav is supported by mod_sndfile)
fs_cli -x "conference 3000 record /usr/local/freeswitch/recordings/3000-20260312.wav"
fs_cli -x "conference 3000 norecord /usr/local/freeswitch/recordings/3000-20260312.wav"
fs_cli -x "conference 3000 recording check"
fs_cli -x "conference 3000 recording pause /usr/local/freeswitch/recordings/3000-20260312.wav"
```

- `record` captures the **post-mix conference audio**; to record one member individually, use `record_session` on that member's channel leg (see [Static Dialplan](/concepts/static-dialplan));
- `chkrecord` / `recording check` query the current recording state;
- To have every conference record automatically, write this in the profile:

```xml
<param name="auto-record" value="$${recordings_dir}/${conference_name}_${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
```

### Live Bypass

The target of `auto-record` and `record` isn't limited to local files — it can also be a `shout://` stream URL (Icecast live broadcast):

```xml
<param name="auto-record" value="shout://user:pass@server.com/live.mp3"/>
```

This requires `mod_shout` (commented out by default in vanilla — uncomment `<load module="mod_shout"/>` and make sure the dependency libraries are in place). Another bypass approach is to use `conference <name> dial <endpoint> ...` to pull an external endpoint into the conference — dial toward a streaming gateway, or a channel sitting on `record_session`, forming a "listen-only bypass member"; such members join with `+flags{mute}` so bypass-side audio doesn't feed back into the mix.

Frame grabs (`vid-write-png`) and video recording on the conference video side are covered in [Media Module](/modules/media).

## Further Reading

- [Module Overview](/modules/README) — mod_conference is an application module; see the master config for loading;
- [Media Module](/modules/media) — conference video mixing (canvas/layouts/multi-canvas) and recording;
- [Static Dialplan](/concepts/static-dialplan) — dialplan forms for routing inbound paths into a conference;
- [IVR Module](/modules/ivr) — the typical combination of IVR menus transferring to a conference;
- [Configuration File Structure](/configuration/config-files) — where `conference.conf.xml` is loaded from.

## References

- [Wikipedia · Conference call](https://en.wikipedia.org/wiki/Conference_call)
- [RFC 3550 · RTP](https://datatracker.ietf.org/doc/html/rfc3550)
- [SignalWire · FreeSWITCH documentation](https://developer.signalwire.com/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [ivr](ivr.md)
- [media](media.md)
