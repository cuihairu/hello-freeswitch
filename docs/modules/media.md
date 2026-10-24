# Media Processing Modules

"Connected" is only the beginning of a call — the codec and transcoding of audio and video, the volume, and the recording are all decided by the media processing modules. Here are field notes on codecs and transcoding, `absolute_codec_string`, audio gain, video codecs and recording, plus mod_conference video screen sharing.

## Codecs and transcoding

### Where codecs come from

| Provider | Codecs | Notes |
| ---- | ---- | ---- |
| Core (no module needed) | PCMU/PCMA (G.711), L16 | Implemented in the core, always available |
| Core (no module needed) | VP8, VP9 | Video codecs are implemented in the core; parameters live in `autoload_configs/vpx.conf.xml` |
| `mod_spandsp` | G.711, G.722, GSM, G.726, ADPCM, LPC-10 | Also provides fax (T.38 / fax gateway) and DTMF detection and other DSP applications |
| `mod_opus` | OPUS | Parameter template in `autoload_configs/opus.conf.xml` |
| `mod_openh264` | H.264 | H.264 codec implementation |
| `mod_h26x` | H.264, H.263, H.263-1998, H.263-2000, H.261 | RTP payload pass-through only, no decoding (**removed since 1.11.0**) |
| `mod_av` | H.263/H.264 transcoding, mp4/mkv containers | Built on ffmpeg (libavformat/libavcodec) |
| `mod_yuv` | Raw YUV | For video testing and development |

Use `fs_cli -x "show codec"` to see the list of codecs actually available right now — if one isn't in the list, it's probably because the module wasn't loaded or a dependency was missing at build time.

### Codec preferences and negotiation

The preference list decides "which codecs each side offers the other"; the profile parameters are the main entry point:

```xml
<profile name="internal">
  <!-- What's offered to the inbound side; what's offered to the outbound side -->
  <param name="inbound-codec-prefs" value="$${global_codec_prefs}"/>
  <param name="outbound-codec-prefs" value="$${outbound_codec_prefs}"/>
  <!-- generous: try to accommodate the peer; greedy: prefer your own order -->
  <param name="inbound-codec-negotiation" value="generous"/>
  <!-- Enter the dialplan before deciding the codec, leaving time to adjust prefs per call -->
  <param name="inbound-late-negotiation" value="true"/>
</profile>
```

Vanilla's `vars.xml` defaults to `global_codec_prefs=OPUS,G722,PCMU,PCMA,H264,VP8` — what's listed first is what gets picked. The negotiated result is written into channel variables:

- `${read_codec}` / `${write_codec}` — the current codecs on both sides;
- `${ep_codec_string}` — the codec string the peer actually offered (check this first when debugging negotiation problems).

When the two sides of a call have different codecs, FreeSWITCH **transcodes** in the middle; when they match, it just does RTP proxy forwarding at near-zero overhead. Transcoding costs CPU and audio quality (every transcode loses something), so "get both sides speaking the same language" is the first principle of media optimization. A conference is a natural many-party transcoding point: members are unified onto the profile's `rate` for mixing (`default` 8k, `cdquality` 48k).

The profile also has a parameter directly related to transcoding — `disable-transcoding`: once enabled, the outbound leg only offers the codecs matching the calling leg, forcing the avoidance of transcoding (at the cost of a possible call failure when there is no common codec).

## Absolute codec: absolute_codec_string

`absolute_codec_string` is a channel variable; once set, **codec selection follows it exclusively** (it is read first during codec selection) and the profile's preferences are bypassed. The most typical use case is narrowing the outbound codec to G.711, avoiding a negotiated result with the gateway/carrier that would require transcoding:

```xml
<include>
  <extension name="outbound_g711_only">
    <condition field="destination_number" expression="^(1\d{10})$">
      <!-- Offer G.711 only to the gateway -->
      <action application="set" data="absolute_codec_string=PCMU,PCMA"/>
      <action application="bridge" data="sofia/gateway/carrier1/$1"/>
    </condition>
  </extension>
</include>
```

Related channel variables:

| Variable | Role |
| ---- | ---- |
| `absolute_codec_string` | Absolute codec string, highest priority; a leading `=` gives it replacement semantics |
| `codec_string` | Ordinary preference override, merged with the profile's preferences |
| `inherit_codec` | When leg A sets `inherit_codec=true`, B leg's `ep_codec_string` is written into `absolute_codec_string` — outbound follows the caller's codec, preventing accidental transcoding |

When debugging, use `fs_cli -x "uuid_dump <uuid>"` to compare `absolute_codec_string`, `ep_codec_string`, and the final `read_codec` — the negotiation chain becomes obvious at a glance.

## Audio filtering and gain

First, clear up a common misunderstanding: FreeSWITCH does **not** have an application called `volume`. The real entry points for channel-level volume and gain are the `uuid_audio` API and the in-conference volume commands.

### Channel level: uuid_audio

```bash
# Syntax
# uuid_audio <uuid> [start [read|write] [mute|level <level>]|stop]

# Raise the volume of audio received on this channel (read direction) by 2 levels (level ranges -4 to 4)
fs_cli -x "uuid_audio <uuid> start read level 2"

# Mute the read direction
fs_cli -x "uuid_audio <uuid> start read mute 0"

# Restore
fs_cli -x "uuid_audio <uuid> stop"
```

`read` is the audio coming in on this channel, `write` is the audio going out; `level` is an integer from -4 to 4 that scales the waveform step by step; a `mute` level greater than 1 substitutes comfort noise for hard silence. It acts on **this one channel leg** and doesn't affect the peer.

### Volume and gain inside a conference

mod_conference models volume as a member property, with finer granularity:

```bash
fs_cli -x "conference 3000 volume_in 3 4"    # Raise the volume of what member 3 sends into the conference
fs_cli -x "conference 3000 volume_out 3 4"   # Raise what member 3 hears
fs_cli -x "conference 3000 energy 3 200"     # This member's speech detection threshold
fs_cli -x "conference 3000 agc all"          # Automatic gain for everyone
fs_cli -x "conference 3000 file-vol 4"       # Volume for recorded/played files
```

Members can also adjust on their own phones: in the `caller-controls` keyset, `vol talk up/down/zero` adjusts your own speaking volume, `vol listen up/down/zero` adjusts the listen volume, and `energy up/dn/equ` adjusts the speech threshold (key positions in [Conference Module](/modules/conference)).

### Filtering and rate change on the playback side

- `mod_ladspa`: loads LADSPA plugins for filtering/noise reduction and similar processing; the application is `ladspa_run` (e.g. `ladspa_run r|tap_chorusflanger||`);
- `mod_soundtouch`: the `soundtouch` application, adjusts pitch/rate/tempo of the audio stream (voice change, variable-speed playback).

Both modules have been removed from the source tree since FreeSWITCH 1.11.0 and are only available in 1.10 and earlier; on 1.11, when you need filtering or rate change, use the in-conference commands (`volume_in`/`volume_out`, etc.) instead, or send media out to a dedicated audio processing service. This kind of processing works via a media bug applied live on the channel and is usually placed after `answer` and before `bridge`/`playback`.

### What mod_spandsp actually does

`mod_spandsp` is often mistaken for a "volume/filter module". What it actually provides: G.711/G.722/GSM/G.726 codecs, DTMF detection (`spandsp_start_dtmf` / `spandsp_stop_dtmf`, a separate implementation from mod_dptools' `start_dtmf`), and fax (`rxfax`/`txfax`/T.38 gateway). For volume and gain, go back to `uuid_audio` and the conference commands — don't look for it here.

## Video codecs

| Codec | Provider | Usage notes |
| ---- | ---- | ---- |
| H.264 | `mod_openh264` (codec), `mod_h26x` (pass-through, removed since 1.11.0) | Best terminal interoperability; pass-through requires the two sides to be directly compatible |
| VP8 / VP9 | Core (tune in `vpx.conf.xml`) | The WebRTC default; commonly used for conference screen sharing |
| H.263/H.261 | `mod_h26x` pass-through (removed since 1.11.0) | For legacy video terminals |

Video preferences go in the same `inbound-codec-prefs`/`outbound-codec-prefs` (vanilla defaults include `H264,VP8`), and the negotiation rules are the same as audio. Conference video screen sharing (mux mode) is a transcoding-heavy scenario: canvas size, frame rate, and bitrate directly determine CPU usage, as described below.

## Video recording and playback

- **`mod_fsv`**: FreeSWITCH's native video format `.fsv`, applications `record_fsv` / `play_fsv` — record/play back a call with video as-is, commonly used for testing and reproducing issues;
- **`mod_av`**: provides read/write for mp4/mkv containers, so `record_session /tmp/call.mp4` can record audio and video straight into an mp4 (requires `mod_av` to be compiled with the ffmpeg libraries);
- **Conference frame snapshot**: `fs_cli -x "conference 3000 vid-write-png /tmp/canvas.png"` exports the current shared frame.

## Video conferencing: mod_conference screen sharing

mod_conference's video capability is enabled by `video-mode=mux`: all members' video is composed according to a **layout** onto a **canvas**, then sent to each member — that's the video MCU. Vanilla's `video-mcu-stereo-720` profile is a ready-made template:

```xml
<profile name="video-mcu-stereo-720">
  <param name="domain" value="$${domain}"/>
  <param name="rate" value="48000"/>
  <param name="channels" value="2"/>
  <param name="interval" value="20"/>
  <param name="energy-level" value="200"/>
  <param name="comfort-noise" value="false"/>
  <param name="conference-flags" value="livearray-json-status|json-events|video-floor-only|rfc-4579|livearray-sync|minimize-video-encoding|manage-inbound-video-bitrate|video-required-for-canvas|video-mute-exit-canvas|mute-detect"/>
  <param name="video-auto-floor-msec" value="1000"/>
  <param name="video-mode" value="mux"/>
  <param name="video-layout-name" value="3x3"/>
  <param name="video-layout-name" value="group:grid"/>
  <param name="video-canvas-size" value="1280x720"/>
  <param name="video-canvas-bgcolor" value="#333333"/>
  <param name="video-layout-bgcolor" value="#000000"/>
  <param name="video-codec-bandwidth" value="3mb"/>
  <param name="video-fps" value="30"/>
</profile>
```

| Parameter | Role |
| ---- | ---- |
| `video-mode` | `mux` is server-side screen sharing; without it, only video forwarding happens |
| `video-layout-name` | Layout name (`3x3`) or layout group (`group:grid`); multiple lines can be written as candidates |
| `video-canvas-size` | Canvas resolution (the size of the composed frame sent out to members) |
| `video-canvas-bgcolor` / `video-layout-bgcolor` | Canvas background color and layout background color |
| `video-codec-bandwidth` / `video-fps` | Output bitrate and frame rate — the main variables for screen-sharing CPU |
| `video-auto-floor-msec` | How many milliseconds a speaker holds the floor (main frame) |
| `video-codec-config-profile-name` | References a codec parameter profile in `vpx.conf.xml` (e.g. `conference`) |

Commonly used conference flags (written into `conference-flags`): `video-floor-only` (send only the floor frame, saving bandwidth), `video-required-for-canvas` (members without video don't take up a canvas slot), `manage-inbound-video-bitrate` (adjust resolution by member bandwidth), `minimize-video-encoding`, `livearray-sync` (member status synchronization with Verto).

### Layouts and multiple canvases

Layouts are defined in `conf/autoload_configs/conference_layouts.conf.xml`: `<layout name="3x3">` uses `<image x y scale>` to describe each slot; `<group name="grid">` bundles multiple layouts together (auto-picking the best fit when headcount changes), and `video-layout-name`'s `group:grid` references it.

Members can be spread across multiple canvases (multi-canvas); the control commands:

```bash
fs_cli -x "conference 3000 vid-layout group grid"          # Switch layout group
fs_cli -x "conference 3000 vid-layout 1x1 1"               # Specify a layout and canvas
fs_cli -x "conference 3000 vid-canvas 3 2"                 # Put member 3 onto canvas 2
fs_cli -x "conference 3000 vid-watching-canvas 3 1"        # Member 3 watches canvas 1
fs_cli -x "conference 3000 vid-floor 3"                    # Set member 3 as the floor
fs_cli -x "conference 3000 clear-vid-floor"                # Clear the floor
fs_cli -x "conference 3000 vid-banner 3 Welcome"           # Banner text on a member's frame
```

`vid-canvas` assigns members to different canvases, and `vid-watching-canvas` decides which canvas they watch, enabling multi-screen structures like "main room + breakout" or "presenter + co-located"; `canvas-auto-clear` controls whether empty canvases are auto-cleaned. Browser-side conference access usually goes through `mod_verto` (Verto protocol, WebRTC), and combined with the screen-sharing capability above that's the complete chain for an open-source video conference.

## Further reading

- [Conference Module](/modules/conference) — creating conferences and controlling members; this page adds the video and media side;
- [SIP Module](/modules/sip) — context for profile parameters like `inbound-codec-prefs`;
- [Gateway Module](/modules/gateway) — practical use of `absolute_codec_string` to narrow codecs on outbound calls;
- [Static Dialplan](/concepts/static-dialplan) — using applications like `record_session` and `playback`;
- [Installing on Linux](/installation/linux) — where media dependency libraries like ffmpeg get installed.

## References

- [RFC 3550 · RTP](https://datatracker.ietf.org/doc/html/rfc3550)
- [RFC 4566 · SDP](https://datatracker.ietf.org/doc/html/rfc4566)
- [Wikipedia · G.711](https://en.wikipedia.org/wiki/G.711)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [conference](conference.md)
- [gateway](gateway.md)
