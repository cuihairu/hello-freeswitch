# Speech Recognition and Synthesis

For a customer service bot to "understand and speak," you cannot avoid ASR (Automatic Speech Recognition, speech-to-text) and TTS (Text To Speech, text-to-speech). In my project I mainly compared two recognition integration approaches, the integration methods on the FreeSWITCH side (community audio stream modules and a general approach), two TTS paths, and the trade-offs between commercial services and self-hosted solutions.

## Two Integration Approaches

### Media Stream Bypass (Real-time Streaming)

Attach a **media bug** (media bypass hook) to the call channel to push the raw L16 audio read from it to an ASR service in real time, with recognition results flowing back sentence by sentence. This is the mainstream form for smart customer service:

- As soon as the customer finishes half a sentence, intermediate results appear, and the bot can speak ahead into the silence;
- Naturally supports multi-turn dialogue and is a good starting point for barge-in;
- The cost: you need a "media capture + transport" channel, either via a community module or by developing a media bug module yourself.

### Per-sentence Recognition (Recognition on Recording Files)

Question-and-answer style: play a prompt tone → `record` a segment → hand the audio file to ASR after hangup or a silence timeout → get the text and then run NLP → play the answer. Every turn is a complete "play-record-recognize-answer" loop.

| Dimension | Media Stream Bypass | Per-sentence Recognition |
| ---- | ---- | ---- |
| First-sentence response latency | Low (streaming output) | High (send only after speech ends, recognize only after the upload) |
| Implementation complexity | High (needs a capture channel and a streaming interface) | Low (recording file + HTTP is enough) |
| Barge-in capability | Possible | Basically impossible |
| ASR service requirements | Streaming interface (WebSocket/MRCP) | Ordinary file recognition interface |
| Applicable stage | Production form | Prototype validation, post-call agent quality inspection |

Practical advice: **get the flow working with per-sentence recognition first, then move to real-time streaming.** The NLP, state machine, and transfer logic are fully reusable across the two paths; the only difference is "how audio enters the recognition engine."

## Media Capture: Community Modules and Official Modules

### mod_audio_stream (community, WebSocket)

[amigniter/mod_audio_stream](https://github.com/amigniter/mod_audio_stream) is the most frequently cited audio stream module: after attaching a media bug it pushes **L16** audio over WebSocket to an external service, and it also supports receiving audio returned by the peer (base64-encoded wav/mp3/ogg JSON messages) and playing it back, so it can serve both "send for recognition" and "play the answer" at the same time. The command form given in its README:

```text
# Attach a media bug and start pushing to WebSocket
uuid_audio_stream <uuid> start <ws-url> <mix-type> <sampling-rate> <metadata>
# Pause / resume / stop
uuid_audio_stream <uuid> pause
uuid_audio_stream <uuid> resume
uuid_audio_stream <uuid> stop <metadata>
```

- `mix-type`: `mono` (only the calling side), `mixed` (both sides mixed into mono), `stereo` (separate left and right channels);
- `sampling-rate`: `8k` or `16k`; other sample rates are resampled by the module;
- Note that this is a **community third-party module, not part of the official source tree or the distribution packages**; you must compile it yourself (the README provides the dependency list and a one-click build script, and the author also publishes prebuilt packages with a concurrency limit). Follow that project's README for the exact parameters.

### mod_audio_fork (community, drachtio lineage)

`mod_audio_fork` was born in the [drachtio-freeswitch-modules](https://github.com/mdslaney/drachtio-freeswitch-modules) repository of the drachtio project (`modules/mod_audio_fork`), also taking the media bug + WebSocket + L16 path, and was originally aimed at **one-way capture** (sending for recognition), built for voice AI scenarios. The README of `mod_audio_stream` also states that it was inspired by mod_audio_fork.

You may also see names like `mod_audio_fstream` in the community (variants that push over UDP or a local socket). **This kind of repository churns frequently and has many mirrors, so before using one please confirm its public repository and maintenance status** — do not assume any of them works out of the box.

### Approach for Writing Your Own Media Bug Module

If none of the existing modules fits (say the ASR service only accepts RTP/UDP, or requires a proprietary protocol), developing one yourself is not mysterious; the core is three steps:

1. On module `load`, register an endpoint/application exposing a command like `start <uuid> <target>`;
2. When the command executes, use `switch_core_media_bug_add` to attach a media bug to the channel (callback flag `SMBF_READ_STREAM` for read, optionally `SMBF_WRITE_STREAM` for write), and `switch_media_bug_remove` when the command is removed;
3. In the callback, pack the 16-bit PCM as the ASR service requires (sample rate conversion via libspeexdsp) and send it to a socket/WebSocket.

In the official source tree, the recording implementation in `mod_dptools` and the media distribution in `mod_conference` both make heavy use of media bugs and are ready-made reference code; the community modules above solve the "capture + WebSocket transport" part directly. I recommend factoring the transport protocol out into a small library so the module only does "capture + callback."

### Related Modules in the Official Source Tree

| Module | Purpose | Notes |
| ---- | ---- | ---- |
| `mod_pocketsphinx` | Offline ASR | CMU Sphinx engine, shipped with the source tree; **suitable only for English and simple grammar recognition**, unusable for Chinese in production; the typical use is `play_and_detect_speech` to play a prompt while recognizing, writing the result into the channel variable `detect_speech_result` |
| `mod_unimrcp` | MRCP client | Connect to ASR/TTS services that support MRCP v1/v2 (many commercial voice appliances offer MRCP access); the module is not released with the main FreeSWITCH source tree and must be obtained from the UniMRCP project; its configuration is also absent from the vanilla templates — place `unimrcp.conf.xml` and an MRCP profile per the module docs, then load the module, and use it with `detect:unimrcp` and `speak` |
| `mod_tts_commandline` | Command-line TTS | Calls an external command to synthesize text into a wav and then plays it; the configuration has only one `command`, which may use the variables `${text}` `${voice}` `${rate}` `${file}`, e.g. the default `echo ${text} \| text2wave -f ${rate} > ${file}`; it is the minimal path for bringing in any "synthesizer that runs as a command" |
| `mod_flite` | Built-in TTS | English synthesis engine, useful for validating the `speak` path |

## General Integration Approach: ESL Subscription + Post-recognition on Recording Files

You can do speech recognition without installing any third-party module — this is the "per-sentence recognition" path mentioned in the smart customer service overview — and all you need is the built-in recording capability plus a background program:

1. The IVR/Lua script uses `record` (or `session:recordFile`) to record the customer's utterance; when recording ends FreeSWITCH sets the channel variables `record_seconds` and `record_samples` and fires a `RECORD_STOP` event (with headers such as `Record-Filepath`);
2. The business backend subscribes to `RECORD_STOP` / `CHANNEL_EXECUTE_COMPLETE` via ESL and retrieves the recording path;
3. The backend uploads the wav to the ASR file recognition interface and gets the text;
4. Run NLP, generate the answer, then play it with ESL commands (`uuid_broadcast` or playback on the bridged leg) and enter the next turn.

Recording a sentence on the Lua side and notifying the backend:

```lua
-- conf/scripts/asr_turn.lua — record one sentence and hand it to the backend for recognition
local uuid = session:getVariable("uuid")
local rec = "/usr/local/freeswitch/recordings/" .. uuid .. ".wav"

-- Play the question (pre-synthesized prompt tone), then record the customer's answer: up to 15 seconds, early end after 3 seconds of silence
session:streamFile("ivr/ask_account_number.wav")
session:recordFile(rec, 15, 500, 3)

-- After recording ends, fire a custom event; the ESL backend subscribes to this event and calls ASR
local e = freeswitch.Event("custom", "cc::asr_request")
e:addHeader("unique-id", uuid)
e:addHeader("record-path", rec)
e:addHeader("record-seconds", session:getVariable("record_seconds") or "0")
e:fire()
```

On the backend side (Python — the standard library is enough for ESL send/receive; see the protocol-layer code in `esl_client.py` in the [Dynamic Dialplan](/concepts/dynamic-dialplan) chapter): subscribe to `event plain CUSTOM cc::asr_request`, take out the `Record-Path` header, then upload for recognition. Recognition interfaces differ in their contracts across vendors; below is a **skeleton example** (fields follow the specific vendor's documentation):

```python
# asr_file.py — general integration skeleton for recording-file recognition
import json
import urllib.request

def transcribe(wav_path, endpoint, api_key):
    with open(wav_path, "rb") as fh:
        audio = fh.read()
    req = urllib.request.Request(
        endpoint,
        data=audio,
        headers={
            "Content-Type": "audio/wav",
            "Authorization": "Bearer " + api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())   # structure varies by vendor
```

> By default recording matches the channel sample rate (usually 8k/16k mono wav), which happens to be the format most ASR services accept; if a vendor requires a specific sample rate, set the channel variable `record_rate` (e.g. `record_rate=16000`), or transcode with sox (see [Appendix B](/appendix/commands)).

## The Two TTS Paths

### Pre-synthesized Files + Playback

Synthesize high-frequency, fixed prompt lines (welcome message, menus, common question answers) offline, convert them to 8k/16k mono wav, put them in the `sounds/` directory, and play them directly during the call:

```xml
<action application="answer"/>
<action application="playback" data="ivr/welcome_zh.wav"/>
```

The advantages are zero runtime dependencies, the lowest latency, and human-reviewable pronunciation; the downside is that dynamic content cannot be played. **In a production customer service system, 80% of announcements should be pre-synthesized files**, with TTS only as the backstop for dynamic content.

### Real-time TTS Integration

Dynamic content (balance, ticket progress) has two common paths:

- **The engine inside FreeSWITCH**: plug in `mod_flite` / `mod_unimrcp` / `mod_tts_commandline` via the TTS engine interface, set `tts_engine` and `tts_voice` on the channel, then:

  ```lua
  session:setVariable("tts_engine", "tts_commandline")
  session:setVariable("tts_voice", "zh_female")
  session:speak("Your phone bill this month is " .. amount .. " yuan")
  ```

  Under the hood, `session:speak` is the `speak` application, with the format `tts_engine|voice|text`;
- **Synthesis on the backend, FreeSWITCH only plays**: the backend calls the TTS service to get audio (file or stream), then plays it with the ESL `uuid_broadcast <uuid> <file> both` command; for latency-sensitive scenarios you can bring in the bidirectional audio stream module mentioned in the media capture section above and feed the TTS output directly back into the call.

Latency for real-time TTS deserves a dedicated benchmark: the cumulative value of synthesis + transport + playback buffering determines the customer's perception of the "bot's reaction speed."

## Commercial vs. Self-hosted Comparison

| Service | Capabilities | Deployment Form | Chinese | Common Integration |
| ---- | ---- | ---- | ---- | ---- |
| Google Cloud Speech-to-Text / Text-to-Speech | ASR + TTS | Public cloud API | Supported | REST / gRPC streaming |
| Microsoft Azure AI Speech | ASR + TTS (custom voices) | Public cloud, private deployment in some regions | Supported | REST / WebSocket SDK |
| IBM Watson Speech to Text / Text to Speech | ASR + TTS | Public cloud / cloud private deployment | Supported | REST / WebSocket |
| Amazon Transcribe / Polly | ASR / TTS | Public cloud API | Transcribe supports Chinese; Polly has limited Chinese voices | AWS SDK |
| iFlytek Open Platform | ASR + TTS (speech transcription, real-time voice stream) | Public cloud / private appliance | Strong | REST / WebSocket SDK |
| Alibaba Cloud Intelligent Speech Interaction | ASR + TTS | Public cloud / dedicated cloud | Strong | WebSocket / SDK |
| Tencent Cloud Speech Recognition / Synthesis | ASR + TTS | Public cloud | Strong | REST / WebSocket |
| Baidu Intelligent Cloud Speech Technology | ASR + TTS | Public cloud / private deployment | Strong | REST / SDK |
| Self-hosted: UniMRCP + a commercial MRCP engine | ASR + TTS | Private (MRCP protocol) | Depends on engine | `mod_unimrcp` |
| Self-hosted: Vosk, PocketSphinx and other open-source engines | ASR | Private | Vosk has Chinese models | WebSocket (paired with an audio stream module) |
| Self-hosted: `mod_pocketsphinx` | ASR | Ships with the source tree | English only | `play_and_detect_speech` |

The practical considerations in selection matter more than "whose accuracy is higher":

- **Whether private deployment is required**: finance and government scenarios often require that audio not leave the internal network, which rules out pure public cloud APIs outright;
- **Latency and per-unit concurrency price of the streaming interface**: per-sentence recognition is cheaper but the experience suffers, and streaming recognition is billed by audio duration so capacity must be estimated first;
- **Chinese hot words and industry vocabulary**: whether proper nouns in the customer service domain (plan names, device model names) can be customized to improve recognition is where Chinese projects get separated;
- **Billing and compliance**: recordings and transcribed text are personal information, so ask about retention periods and de-identification requirements up front.

This is a comparison of approaches without binding to a vendor SDK: the integration layer is consolidated in a self-developed "voice gateway" service, the switch layer only knows that gateway, and swapping vendors changes only one place.

## Related Reading

- [Recording and Monitoring](/advanced/recording): the underlying mechanism of media bugs and the three recording entry points;
- [Scripting and Programming Interfaces](/advanced/scripting): the Lua script execution model and APIs such as `session:recordFile`;
- [Event System](/advanced/events): subscribing to and parsing events such as `RECORD_STOP`;
- [Network Settings](/configuration/network): the RTP ports and firewall involved in media stream bypass;
- [Natural Language Processing](/project/nlp): intent classification and answering after the transcribed text arrives.

## References

- [Wikipedia · Speech synthesis](https://en.wikipedia.org/wiki/Speech_synthesis)
- [Wikipedia · Speech recognition](https://en.wikipedia.org/wiki/Voice_recognition)
- [GitHub · alphacep/vosk-api](https://github.com/alphacep/vosk-api)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [resources](/appendix/resources.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [nlp](nlp.md)
