# IVR Module

IVR (Interactive Voice Response) is the front-desk logic of "play a prompt, collect digits, branch somewhere". FreeSWITCH ships with an XML-defined **menu-based IVR** (`ivr_menus/`, executed by the `ivr` application) and a **scripted IVR** (Lua/ESL controlling digit collection and playback). This page focuses on menu-based IVR and notes how the two implementations work together.

## What IVR Is

Once an inbound call is answered, guidance audio plays and the caller picks a destination by pressing keys (DTMF): transfer to an extension, join a conference, check a balance, leave a message... Digit collection and prompt playback loop until an exit is hit. Only three things make up an IVR:

1. **Prompts**: wav files, `tone_stream://` synthesized tones, or TTS;
2. **Menu logic**: which key goes where, and what to do on timeout or a wrong input;
3. **Exit actions**: `transfer` to an extension, `bridge` an outbound call, join a conference, or go to voicemail.

FreeSWITCH's dialplan is itself a branching engine — an IVR is just a "keypress-driven dialplan".

## IVR Menu Configuration

### Menu Files and Loading

Menus are defined in `conf/ivr_menus/*.xml`, and `autoload_configs/ivr.conf.xml` assembles them into the `<menus>` section of `ivr.conf`:

```xml
<configuration name="ivr.conf" description="IVR menus">
  <menus>
    <X-PRE-PROCESS cmd="include" data="ivr_menus/*.xml"/>
  </menus>
</configuration>
```

Just create a new file in that directory — no other config changes needed; `fs_cli -x "reloadxml"` afterward to take effect.

### A Complete, Runnable Menu Example

A minimal complete configuration for a "front desk + sales submodule" (filename is up to you, e.g. `conf/ivr_menus/company.xml`):

```xml
<include>
  <!-- main menu -->
  <menu name="company_main"
      greet-long="phrase:company_main_greeting"
      greet-short="phrase:company_main_greeting"
      invalid-sound="ivr/ivr-that_was_an_invalid_entry.wav"
      exit-sound="voicemail/vm-goodbye.wav"
      timeout="10000"
      inter-digit-timeout="2000"
      max-failures="3"
      max-timeouts="3"
      digit-len="4">
    <entry action="menu-exec-app" digits="1" param="transfer 1000 XML default"/>
    <entry action="menu-exec-app" digits="2" param="transfer 1001 XML default"/>
    <entry action="menu-exec-app" digits="3" param="bridge sofia/gateway/carrier1/10086"/>
    <entry action="menu-sub" digits="4" param="company_sales"/>
    <!-- digits supports PCRE regex; reference capture groups with $1 -->
    <entry action="menu-exec-app" digits="/^(10[0-9]{2})$/" param="transfer $1 XML default"/>
    <entry action="menu-top" digits="9"/>
    <entry action="menu-exit" digits="0"/>
  </menu>

  <!-- sub menu -->
  <menu name="company_sales"
      greet-long="phrase:company_sales_greeting"
      invalid-sound="ivr/ivr-that_was_an_invalid_entry.wav"
      exit-sound="voicemail/vm-goodbye.wav"
      timeout="10000"
      max-failures="3">
    <entry action="menu-exec-app" digits="1" param="transfer 2001 XML default"/>
    <entry action="menu-back" digits="*"/>
  </menu>
</include>
```

Menu attribute quick reference (all attributes supported by `switch_ivr_menu.c`):

| Attribute | Meaning |
| ---- | ---- |
| `name` | Menu name; the `ivr` application uses it to launch |
| `greet-long` | Full greeting, played on first entry; supports `phrase:`, `say:` (TTS), and file paths |
| `greet-short` | Short prompt played on invalid input or when looping |
| `invalid-sound` | Invalid key prompt |
| `exit-sound` | Played when leaving the menu |
| `timeout` | How long to wait for the first digit (ms) |
| `inter-digit-timeout` | Timeout between digits in a multi-digit input (ms) |
| `max-failures` | Exit after this many invalid inputs |
| `max-timeouts` | Exit after this many timeouts |
| `digit-len` | Maximum number of digits collected at once |
| `confirm-macro` / `confirm-key` / `confirm-attempts` | Re-check after collection with a confirm key (e.g. confirming an extension number) |
| `tts-engine` / `tts-voice` | Specify the TTS engine and voice when using `say:` text prompts |

`<entry>` has only six actions:

| action | Semantics |
| ---- | ---- |
| `menu-exec-app` | Execute an application with its parameters (`param` is the full command string); the most common |
| `menu-sub` | Enter a sub-menu (`param` is the sub-menu name) |
| `menu-top` | Return to the main menu and replay the prompt |
| `menu-back` | Return to the previous menu level |
| `menu-play-sound` | Just play a sound (`param` is a file or `say:` text) |
| `menu-exit` | Hang up and exit |

### Invoking from the Dialplan

```xml
<include>
  <!-- conf/dialplan/default/20-ivr.xml -->
  <extension name="company_ivr">
    <condition field="destination_number" expression="^(5000)$">
      <action application="answer"/>
      <action application="sleep" data="500"/>
      <action application="ivr" data="company_main"/>
    </condition>
  </extension>
</include>
```

The `ivr` application only accepts a menu name; the menu must be findable by name under `<menus>` in `ivr.conf`, otherwise the log reports `Unable to find menu`. Routing the inbound path (a DID in the public context) into this extension completes "inbound external calls go through IVR".

Verify: after `fs_cli -x "reloadxml"`, dial 5000 and you'll see the `ivr` menu execution logs in the console; forgetting to reload after editing a menu is the most common cause of "the menu doesn't take effect".

## Phrases and Prompts

### Where Prompts Come From

Relative paths in `menu-*` attributes and in `menu-play-sound` (e.g. `ivr/ivr-that_was_an_invalid_entry.wav`) resolve under `sounds_dir` (vanilla default `$${base_dir}/sounds`); `$${sound_prefix}` (default `$${sounds_dir}/en/us/callie`) provides the full English prompt set. Three common sources:

- **Ready-made prompts**: `ivr/ivr-welcome_to_freeswitch.wav`, `voicemail/vm-goodbye.wav`, etc. installed with the sound package (the demo macro assembles its greeting this way);
- **Self-recorded / outsourced audio**: placed in a custom directory under `sounds_dir`, e.g. `custom/company_main.wav`;
- **Synthesized tones**: `tone_stream://%(200,0,500,600,700)` generates a short beep with no files at all.

### The phrase Macro

The same prompt often needs dynamic content spliced in (announcing numbers, reading names), and the phrase engine wraps "play a segment of audio + announce a number + play another segment" into a reusable **macro**. Macro files go in `conf/lang/en/ivr/*.xml` — `lang/en/en.xml` includes that directory wholesale into `<languages>`, so creating a new file takes effect immediately:

```xml
<include>
  <macro name="company_main_greeting">
    <input pattern="^(.*)$">
      <match>
        <action function="play-file" data="ivr/ivr-welcome_to_freeswitch.wav"/>
        <action function="play-file" data="custom/company_main.wav"/>
      </match>
    </input>
  </macro>

  <macro name="company_sales_greeting">
    <input pattern="^(.*)$">
      <match>
        <action function="play-file" data="custom/company_sales.wav"/>
        <action function="say" data="$1" method="pronounced" type="items"/>
      </match>
    </input>
  </macro>
</include>
```

- `<input pattern>` is PCRE; capture groups like `$1` are referenced in `<match>`, enabling content-based assembly of the announcement;
- `function` supports `play-file` (play a file), `say` (announce numbers, times, etc. via the say module), `sleep`;
- At the call site write `phrase:<macro name>` — both the menu's `greet-long` and `playback` recognize this prefix.

## Scripted IVR: Lua playAndGetDigits

Menu XML can't express logic like "query the database first, then decide the destination", so use a script to control digit collection and playback yourself. `session:playAndGetDigits(...)` is the core primitive (see [Dynamic Dialplan](/concepts/dynamic-dialplan) for the rest of the Lua basics):

```lua
-- conf/scripts/ivr_survey.lua
-- params: min, max, tries, timeout_ms, terminators,
--         prompt, invalid prompt, result variable name, regex, inter-digit timeout, failure transfer target
local digits = session:playAndGetDigits(1, 4, 3, 8000, "#",
    "phrase:company_main_greeting",
    "ivr/ivr-that_was_an_invalid_entry.wav",
    "choice", "\\d+", 5000, "")

if digits == "1" then
  session:transfer("1000", "XML", "default")
elseif digits == "9" then
  session:hangup()
else
  -- the collected result also lives in the channel variable choice
  session:execute("transfer", digits .. " XML default")
end
```

Key points:

- The return value is the collected digit string; a regex mismatch replays the invalid prompt and counts against `tries`;
- Once `tries` are exhausted, if the last parameter was given (e.g. `"5001 XML default"`), it automatically transfers to that target as a fallback;
- Playback uses `session:execute("playback", file)` (or `session:streamFile(file)`), answering uses `session:answer()`, and before leaving check `session:ready()` to avoid operating on a hung-up channel.

## Ideas for Dynamic IVR

A menu fixed in XML only fits static business; there are three common routes to dynamism:

1. **Interfaces for menus/phrases**: use `mod_xml_curl` to bind sections like `dialplan` and `phrase`, handing menu structure and prompts to an HTTP interface for real-time return, so menus and scripts change with the business backend (mechanism in [Dynamic Dialplan](/concepts/dynamic-dialplan));
2. **Interfaces for call control**: `mod_httapi` lets an HTTP interface drive this call directly — the interface returns an action sequence like "play this sound, collect 4 digits, transfer to 1000", with the menu logic entirely in server-side code;
3. **Scripts + database**: a Lua script queries the DB then dynamically assembles `transfer`/`bridge` targets, or the whole call is initiated and controlled from an external program via ESL (see [Scripting and Programming Interfaces](/advanced/scripting)).

Hooking in speech recognition and synthesis (modules like `mod_flite`, `mod_tts_commandline`, `mod_pocketsphinx` provide TTS/ASR and must be built and enabled separately) can upgrade "select by key" to "select by speaking", which is the bridge between IVR and intelligent voice — that gets covered in the practical parts.

## Further Reading

- [Static Dialplan](/concepts/static-dialplan) — every IVR exit ultimately lands in the dialplan;
- [Dynamic Dialplan](/concepts/dynamic-dialplan) — the three dynamic routes: Lua / mod_xml_curl / ESL;
- [Conference Module](/modules/conference) — one of the common IVR exits: transfer to a conference;
- [Configuration File Structure](/configuration/config-files) — where `ivr_menus/` and `lang/` sit in `conf/`;
- [Module Overview](/modules/README) — which module provides applications like `ivr` and `play_and_get_digits`.

## References

- [Wikipedia · Interactive voice response](https://en.wikipedia.org/wiki/Interactive_voice_response)
- [Wikipedia · Voice recognition](https://en.wikipedia.org/wiki/Voice_recognition)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [glossary](/glossary.md)
- [conference](conference.md)
- [README](/project/README.md)
- [implementation](/project/implementation.md)
