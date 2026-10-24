# Recording & Eavesdropping

Recording (writing a call out to a file) and eavesdropping (playing a call live to a third party) both build on the media bug: a tap on the channel audio stream that can either write to a file or mix audio to a listener. Below I have written down the three ways to start recording, the path variables, real-time eavesdropping, and a cleanup script for the files.

## Three Ways to Record a Call

### The record_session application: write to disk during the call

`record_session` is an application in the dialplan. Once it runs it attaches a media bug to the current call and starts writing a file, and it cleans up automatically when the call ends:

```xml
<!-- dialplan/default/90-record.xml -->
<extension name="record_inbound">
  <condition field="destination_number" expression="^6001$">
    <action application="set" data="RECORD_STEREO=true"/>
    <action application="set" data="record_sample_rate=8000"/>
    <action application="record_session"
            data="$${recordings_dir}/${caller_id_number}-${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
    <action application="bridge" data="user/1001"/>
  </condition>
</extension>
```

The syntax is `record_session <path> [+<timeout>]`, where the optional `+<timeout>` caps the maximum recording duration in seconds. Its most useful companion variables:

| Variable | Purpose |
| ---- | ---- |
| `RECORD_STEREO=true` | Two channels: one carries the audio received, the other the audio sent, so both sides can be separated afterwards |
| `RECORD_STEREO_SWAP=true` | Same as above, but with left and right channels swapped |
| `RECORD_READ_ONLY=true` / `RECORD_WRITE_ONLY=true` | Record one direction only |
| `RECORD_APPEND=true` | Append to the file instead of overwriting it when the file already exists |
| `RECORD_ANSWER_REQ=true` | Only start recording after the call is answered |
| `RECORD_BRIDGE_REQ=true` | Only start recording after the bridge |
| `record_sample_rate` | Recording sample rate |
| `RECORD_MIN_SEC` | Files shorter than this many seconds are treated as invalid and dropped outright; default 0 (nothing is dropped). With `RECORD_APPEND` enabled the core pins this to 3 seconds |
| `RECORD_SILENCE_THRESHOLD` | Silence detection threshold |
| `RECORD_PRE_BUFFER_FRAMES` | Number of pre-buffered frames (picks up audio around the moment recording starts) |
| `RECORD_HANGUP_ON_ERROR=true` | Hang up the call when recording fails (by default it only logs it) |

The sibling applications that go with it: `stop_record_session <path>` (stop early), `record_session_pause` / `record_session_resume` (pause / resume writing), `record_session_mask` / `record_session_unmask` (replace a stretch of the recording with silence while leaving the call itself untouched — used to mask sensitive content in payment and similar scenarios).

The typical way to trigger this dynamically mid-call is to bind a key with `bind_meta_app` (in the vanilla config it is bound to `*2`), so either party can press a key during the call to start recording:

```xml
<!-- bind_meta_app syntax: <key> [a|b|ab] [a|b|o|s|i|1] <app> -->
<action application="bind_meta_app"
        data="2 b s record_session::$${recordings_dir}/${caller_id_number}.${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
```

The key sequence prefix is `*` by default; use the `bind_meta_key` variable to change it to another key.

### The uuid_record API: start/stop any live call at will

Without touching the dialplan at all, an operator or an external program (ESL, fs_cli) can act on a live call whenever it wants:

```text
freeswitch@fs01> uuid_record <uuid> start /usr/local/freeswitch/recordings/call-a.wav
+OK Success
freeswitch@fs01> uuid_record <uuid> stop /usr/local/freeswitch/recordings/call-a.wav
+OK Success
```

Full syntax:

```text
uuid_record <uuid> [start|stop|mask|unmask] <path> [<limit>] [<recording_vars>]
```

- `<limit>`: maximum duration in seconds;
- `<recording_vars>`: a variable table wrapped in `{}`, used to temporarily override the `RECORD_*` variables on the channel, e.g. `uuid_record <uuid> start /tmp/x.wav 0 {RECORD_STEREO=true}`;
- `mask` / `unmask`: write silence into this stretch of the recording (the call is unaffected) / resume writing real audio — the same use case for masking sensitive content.

Tied into the event system: `RECORD_START` / `RECORD_STOP` events fire when a recording really does start and stop, and an external system can use them to verify that each recording file actually made it to disk.

### The record application: record a message

`record` captures the **input audio of the current leg only**, running until an end key, a hangup, or a timeout — that is exactly how voicemail and IVR message entry work:

```xml
<extension name="record_message">
  <condition field="destination_number" expression="^7001$">
    <action application="answer"/>
    <action application="playback" data="vm/vm-record_message.wav"/>
    <action application="record"
            data="$${recordings_dir}/msg-${caller_id_number}-${strftime(%Y-%m-%d-%H-%M-%S)}.wav 60 500 3"/>
  </condition>
</extension>
```

The argument format for `record` is `<path> [+<limit>] [<thresh>] [<silence_hits>]`:

- `<limit>`: maximum duration in seconds, may carry a `+` prefix;
- `<thresh>`: silence detection threshold;
- `<silence_hits>`: number of silence hits, at which point recording stops early (effectively "stop automatically once they are done talking").

Recording stops on an end key, `*` by default (it shares the `playback_terminators` variable with `playback`; set it to `any` to accept any key, or `none` to ignore keys). The key actually used is written into the `playback_terminator_used` variable, which makes it easy to tell later whether the recording ended by user action or naturally. Set the sample rate with the `record_rate` variable.

## Recording Formats and Path Variables

### ${uuid} and $${recordings_dir}

A recording path is built from two families of variables. Mind the difference between a single and a double `$` (see [Core Configuration Files](/configuration/core-files)):

- `${uuid}`: a **channel variable**, different for every call. Naming files with it lets them line up exactly with `Unique-ID` in events and with CDR records — the recommended approach for reconciliation and lookups:

```xml
<action application="record_session" data="$${recordings_dir}/${uuid}.wav"/>
```

- `$${recordings_dir}`: a **global variable**, defined automatically by the core (for a build from source the default is `recordings/` under the installation directory). No need to set it by hand in vars.xml. Keep the recording tree under it, split by date:

```xml
<action application="record_session"
        data="$${recordings_dir}/${strftime(%Y-%m-%d)}/${uuid}.wav"/>
```

- `${strftime(...)}`: a time template that folds the date and time into the filename, which avoids name collisions on its own.

The file format is determined by the extension; `.wav` is the most common (written out by mod_sndfile). For stereo recording (`RECORD_STEREO`), the left channel carries the audio received and the right channel the audio sent.

## Real-Time Eavesdropping (eavesdrop)

`eavesdrop` is an application provided by mod_dptools, with the syntax `eavesdrop [all | <uuid>]`: the audio of the monitored call is mixed live into the listener's call, the listener does not transmit anything themselves, and the other party has no idea.

### Eavesdropping on an extension: where the uuid comes from

Eavesdropping needs a uuid. The approach in the vanilla config is worth copying: on every incoming call, store "calling number → uuid" in a hash table, then look it up at listen time. Two steps:

Step one, register the uuid in the inbound routing (this line is already present in `Local_Extension` in the vanilla `default.xml`):

```xml
<action application="hash" data="insert/${domain_name}-spymap/${caller_id_number}/${uuid}"/>
```

Step two, when dialing `88 + extension`, look the uuid up and enter eavesdrop:

```xml
<extension name="spy_on_extension">
  <condition field="destination_number" expression="^88(\d{4})$">
    <action application="answer"/>
    <action application="eavesdrop" data="${hash(select/${domain_name}-spymap/$1$2)}"/>
  </condition>
</extension>
```

The uuid can also come from your own application: an external program first subscribes to `CHANNEL_CREATE` events and notes the `Unique-ID` of every call; when it wants to listen, it uses `execute_extension` to put the uuid into a channel variable and let the dialplan run `eavesdrop` (`eavesdrop` only exists as a dialplan application, with no matching uuid_* API).

### Eavesdropping on All Calls

The vanilla config also has an "eavesdrop on every call" example. Dial 779 to enter it, and it cycles through all current calls automatically:

```xml
<extension name="spy_all">
  <condition field="destination_number" expression="^779$">
    <action application="answer"/>
    <action application="set" data="eavesdrop_indicate_failed=tone_stream://%(500, 0, 320)"/>
    <action application="set" data="eavesdrop_indicate_new=tone_stream://%(500, 0, 620)"/>
    <action application="set" data="eavesdrop_indicate_idle=tone_stream://%(250, 0, 920)"/>
    <action application="eavesdrop" data="all"/>
  </condition>
</extension>
```

In `all` mode: when a new call comes in it plays the `eavesdrop_indicate_new` prompt first, then switches to the next one; when there are no calls left to monitor it loops `eavesdrop_indicate_idle`; if switching fails it plays `eavesdrop_indicate_failed`.

### DTMF Control During Eavesdropping

The listener can use key presses at any time to control what they hear (enabled by default, disable with `eavesdrop_enable_dtmf=false`):

| Key | What it does |
| ---- | ---- |
| `1` | Listen to the A-leg direction only (the read stream, i.e. the direction `eavesdrop_whisper_aleg` refers to) |
| `2` | Listen to the B-leg direction only (the write stream, i.e. the direction `eavesdrop_whisper_bleg` refers to) |
| `3` | Listen to both directions (default) |
| `0` | Mute, hear nothing |
| `*` | End the current eavesdrop (in `all` mode, switch to the next call) |

### Channel Variables for Eavesdropping

| Variable | Purpose |
| ---- | ---- |
| `eavesdrop_enable_dtmf` | Whether the listener may switch with key presses; allowed by default |
| `eavesdrop_whisper_aleg` / `eavesdrop_whisper_bleg` | When true, always mix in only the corresponding direction's audio |
| `eavesdrop_bridge_aleg` / `eavesdrop_bridge_bleg` | In bridge scenarios, choose which leg's bridged audio to mix in; both legs by default |
| `eavesdrop_require_group` | Only eavesdrop on calls carrying the same group tag |
| `eavesdrop_indicate_new` / `eavesdrop_indicate_idle` / `eavesdrop_indicate_failed` | The three prompts for `all` mode |

## Recording File Management and Automatic Cleanup

Recordings are heavy on disk writes, so a retention policy is essential — otherwise the disk will fill up sooner or later.

### Naming and Archiving Advice

- Use `${uuid}` as the primary key; add symlinks or an index table keyed by calling number and date when people need to browse them by hand;
- Split directories by day (`${strftime(%Y-%m-%d)}`), so cleanup can delete whole directories — much faster than scanning one large directory;
- Downstream systems such as billing and quality assurance should reconcile against `RECORD_START` / `RECORD_STOP` events or CDRs, not against disk scans.

### Cleanup Script Example

Delete recordings older than the retention window and sweep out empty directories on the way:

```bash
#!/bin/sh
# cleanup_recordings.sh —— delete recording files older than N days
RECORD_DIR="/usr/local/freeswitch/recordings"
KEEP_DAYS=7

[ -d "$RECORD_DIR" ] || exit 1

find "$RECORD_DIR" -type f \( -name '*.wav' -o -name '*.mp3' \) -mtime +${KEEP_DAYS} -delete

# also remove the empty shells left behind by date directories
find "$RECORD_DIR" -mindepth 1 -type d -empty -delete
```

Put it in cron to run in the low-traffic window in the early morning:

```text
30 3 * * * /usr/local/freeswitch/scripts/cleanup_recordings.sh >> /var/log/cleanup_recordings.log 2>&1
```

A few things to keep in mind:

- `-delete` is a GNU find option; on BusyBox environments use `-exec rm -f {} \;` instead;
- Before deleting, confirm that downstream consumers (quality assurance, dispute lookups) really no longer need the files; regulated industries have minimum retention periods, so the retention window should come from business and legal requirements, not from a 7-day default pulled out of the air;
- Monitoring disk levels matters more than cleaning up afterwards: `RECORD_STOP` events can be used to record file durations into a database as well, paired with monitoring alerts.

## Further Reading

- [Session](/concepts/session): where channel variables like `${uuid}` come from;
- [Dynamic Dialplan](/concepts/dynamic-dialplan): hand recording/eavesdropping decisions to a Lua script at runtime;
- [Core Configuration Files](/configuration/core-files): how globals such as `$${recordings_dir}` are defined and take effect.

## References

- [RFC 3550 · RTP](https://datatracker.ietf.org/doc/html/rfc3550)
- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [knowledge](/knowledge.md)
- [asr-tts](/project/asr-tts.md)
- [implementation](/project/implementation.md)
