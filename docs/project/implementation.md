# Implementing the Intelligent Customer Service Feature

This page wires up the components from the earlier notes: IVR to answer the call, speech recognition to get text, NLP to classify the intent, and then either the bot answers or the call transfers to an agent. The example code has been validated (Lua snippets checked with `luac -p`, Python snippets syntax-compiled), and the matching commands are called out.

## Customer Service Flow Design

### Handling a Single Call

```
Incoming call (trunk -> FreeSWITCH)
      |
      v
Classify the request / check working hours
      |
      +-- Outside working hours --> play voicemail prompt --> hang up
      |
      v
IVR main menu (DTMF first, voice optional)
      |
      +-- Press 0 / say "agent" -----------> queue and transfer to an agent
      |
      v
Speech recognition (real-time streaming, or one-utterance recording)
      |
      v
NLP intent recognition + entity extraction
      |
      +-- High-confidence common question --> play the answer (TTS/pre-synthesized) --> resolved?
      |                                              |
      |                            +-----------------+
      |                            |
      |                     Not resolved --> transfer to an agent
      |
      +-- Low confidence/unrecognized --> clarify once --> still fails --> transfer to agent or leave a message
      |
      v
Hangup: archive recording + log CDR + satisfaction follow-up
```

### State Breakdown

| State | Triggered by | Typical action | Exit condition |
| ---- | ---- | ---- | ---- |
| `greeting` | Channel answered | Play welcome, play the main menu | A keypress or voice result arrives |
| `collect` | A slot needs filling | Record / collect digits, recognize | All slots filled or retries exceeded |
| `answer` | Intent is determined | Play the answer content | After playing, ask whether it was resolved |
| `transfer` | Customer requests it / low confidence | `originate` an agent and bridge | Agent picks up or timeout to voicemail |
| `voicemail` | All agents busy / outside working hours | Record a message | Recording complete |
| `done` | Hangup | Archive, settle CDR | Channel destroyed |

## IVR Integration: A Complete Lua Example

Dialplan entry point (place in `dialplan/default/90-smartcc.xml`):

```xml
<include>
  <extension name="smart_cc">
    <condition field="destination_number" expression="^(8000)$">
      <action application="answer"/>
      <action application="lua" data="smart_cc.lua"/>
    </condition>
  </extension>
</include>
```

Script (place in `conf/scripts/smart_cc.lua`):

```lua
-- conf/scripts/smart_cc.lua — intelligent customer service IVR main flow
-- Dependency: the rule_nlu idea is implemented on the Lua side with a keyword table (see handle_text)

local REC_DIR = "/usr/local/freeswitch/recordings"

-- keyword -> action, the simplest fallback (get the flow running before wiring in cloud NLP)
local KEYWORDS = {
  { "agent", "transfer" },
  { "bill", "bill" },
  { "plan", "plan" },
  { "fault", "fault" },
}

local function pick(prompt_files)
  -- prompt_files supports concatenating multiple prompts with "!"
  return session:playAndGetDigits(1, 1, 3, 5000, "#",
    prompt_files, "ivr/ivr-that_was_an_invalid_entry.wav",
    "menu_choice", "\\d")
end

local function record_turn(seconds)
  local path = REC_DIR .. "/" .. session:getVariable("uuid") .. ".wav"
  session:streamFile("ivr/ivr-please_enter_your_number.wav")
  session:recordFile(path, seconds, 500, 3)
  return path, session:getVariable("record_seconds") or "0"
end

local function transfer_to_agent(ext)
  session:execute("set", "hangup_after_bridge=true")
  session:execute("set", "continue_on_fail=true")
  session:execute("set", "call_timeout=30")
  session:execute("bridge", "user/" .. ext)
  -- Reaching here means the bridge failed (agent did not answer / all busy): offer voicemail
  if session:ready() then
    session:streamFile("ivr/ivr-busy.wav")
    local path = REC_DIR .. "/vm-" .. session:getVariable("uuid") .. ".wav"
    session:recordFile(path, 60, 500, 5)
  end
end

local function classify_text(text)
  for _, row in ipairs(KEYWORDS) do
    if string.find(text, row[1], 1, true) then
      return row[2]
    end
  end
  return "fallback"
end

-- main flow
if not session:ready() then return end

session:answer()
session:setAutoHangup(false)
session:sleep(300)

local choice = pick("ivr/ivr-welcome.wav!ivr/ivr-main_menu.wav")

if choice == "0" then
  transfer_to_agent("1001")
elseif choice == "1" or choice == "2" then
  -- 1 check bill / 2 change plan: record a short request first (wire in ASR/NLP here in a real deployment)
  local path, secs = record_turn(15)
  freeswitch.consoleLog("notice",
    string.format("smart_cc: turn recorded %s (%s s)\n", path, secs))
  -- Per-utterance recognition path: hand the recording to the backend (ESL subscribes to the cc::asr_request event)
  local e = freeswitch.Event("custom", "cc::asr_request")
  e:addHeader("unique-id", session:getVariable("uuid"))
  e:addHeader("record-path", path)
  e:fire()
  session:streamFile("ivr/ivr-thank_you.wav")
elseif choice == "9" then
  -- Demo: classify straight from text (replace with the transcript when ASR is available)
  local intent = classify_text("how do I check my bill")
  if intent == "bill" then
    session:streamFile("ivr/your_bill_is_ready.wav")
  end
else
  session:streamFile("ivr/ivr-goodbye.wav")
  session:hangup("NORMAL_CLEARING")
end
```

Key points:

- `session:playAndGetDigits(min, max, tries, timeout, end_key, prompt, error_prompt, variable_name, regex)` is the workhorse API for IVR menus in Lua; concatenate multiple prompts with `!`;
- `recordFile(path, max_seconds, silence_threshold, silence_seconds)` — after recording, FreeSWITCH automatically writes the `record_seconds` and `record_samples` channel variables;
- Before `bridge`, set `hangup_after_bridge=true` and `continue_on_fail=true` so the whole call ends when the agent hangs up, but the script can continue when the agent does not answer;
- Custom events fired with `freeswitch.Event(...):fire()` in the script are the entry point that the backend ESL process subscribes to.

## Real-Time Speech Recognition and Response

### An Event-Driven Backend Main Loop

FreeSWITCH is an event machine; the correct backend shape is a "subscribe-and-dispatch" loop, not "one thread per call polling." The skeleton is below (the protocol layer is the same as `esl_client.py` from [Dynamic Dialplan](/concepts/dynamic-dialplan)):

```python
# cc_worker.py — intelligent customer service ESL backend (skeleton + pseudocode, marked)
import json
import socket

# Note: every word after CUSTOM is treated as a custom sub-class, so it must go last in the subscribe list
EVENTS = ("plain CHANNEL_ANSWER CHANNEL_HANGUP_COMPLETE "
          "BACKGROUND_JOB CUSTOM cc::asr_request")


def read_message(sock_file):
    headers, body = {}, b""
    line = sock_file.readline()
    while line not in (b"\n", b"\r\n"):
        k, _, v = line.decode(errors="replace").partition(":")
        headers[k.strip().lower()] = v.strip()
        line = sock_file.readline()
    if "content-length" in headers:
        body = sock_file.read(int(headers["content-length"]))
    return headers, body


def api(sock_file, command):
    sock_file.write(f"api {command}\r\n\r\n".encode())
    sock_file.flush()
    return read_message(sock_file)          # (response headers, response body)


def connect(host, port, password):
    s = socket.create_connection((host, port))
    f = s.makefile("rwb")
    read_message(f)                          # auth/request
    f.write(f"auth {password}\r\n\r\n".encode()); f.flush()
    read_message(f)                          # +OK accepted
    f.write(f"event {EVENTS}\r\n\r\n".encode()); f.flush()
    read_message(f)
    return s, f


def handle_call(conn, uuid, state):
    # Pseudocode: attach a media bug and push the stream to ASR (when mod_audio_stream is compiled and installed)
    #   api(f, f"uuid_audio_stream {uuid} start ws://asr:9090 mixed 8k {uuid}")
    # Once the ASR service returns the transcript via callback/message queue:
    #   intent, reply = nlp(text, state)            # the NLP gateway
    #   api(f, f"uuid_broadcast {uuid} /srv/prompts/{intent}.wav both")
    # Transfer to an agent (originate the agent leg and park it first, then bridge both legs):
    #   api(f, "originate user/1001 &park()")       # get the agent leg UUID from BACKGROUND_JOB
    #   api(f, f"uuid_bridge <agent_uuid> {uuid}")
    pass


def main():
    s, f = connect("127.0.0.1", 8021, "ClueCon")
    while True:
        headers, body = read_message(f)
        if headers.get("content-type") != "text/event-plain":
            continue
        event = {}
        for line in body.decode(errors="replace").splitlines():
            k, _, v = line.partition(": ")
            if _:
                event[k.strip()] = v.strip()
        name = event.get("Event-Name", "")
        uuid = event.get("Unique-ID", "")
        if name == "CHANNEL_ANSWER":
            handle_call(None, uuid, {"stage": "greeting"})
        elif name == "CHANNEL_HANGUP_COMPLETE":
            # Pseudocode: archive the recording, close the ASR stream, update the state machine
            pass


if __name__ == "__main__":
    main()
```

`text/event-plain` event bodies are parsed line by line in FreeSWITCH's `Header: Value` format; `Event-Name` and `Unique-ID` are the two most commonly used headers.

### Quick Reference of Key Real Commands

Every step the backend can take on a call has a matching command you can verify by hand in `fs_cli -x` first:

| Purpose | Command |
| ---- | ---- |
| See current calls | `show channels` |
| Start streaming to ASR | `uuid_audio_stream <uuid> start ws://asr:9090 mixed 8k <tag>` (requires mod_audio_stream) |
| Record the whole call | `uuid_record <uuid> start /recordings/<uuid>.wav` |
| Play an audio file | `uuid_broadcast <uuid> /srv/prompts/reply.wav both` |
| Transfer to an extension | `uuid_transfer <uuid> 1001 XML default` |
| Dump all channel variables | `uuid_dump <uuid>` |
| Kill a call | `uuid_kill <uuid>` |

First verify with `fs_cli -x "uuid_broadcast <real_uuid> /path/x.wav both"` on a test call, then put it in backend code — this saves a lot of debugging time.

## NLP Processing and Response: A Conversation State Machine

Hook the NLP gateway onto a state machine. The core is a session table keyed by call UUID, with one handler per state:

```python
# cc_fsm.py — conversation state machine (business logic layer)
import rule_nlu                      # rule-based fallback for NLP


class Session:
    def __init__(self, uuid, caller):
        self.uuid = uuid
        self.caller = caller
        self.stage = "greeting"
        self.slots = {}              # slots required by the intent
        self.retries = 0


class Flow:
    """dispatch returns (next state, description of the action on the call)."""

    def __init__(self, nlp=rule_nlu.classify):
        self.nlp = nlp

    def dispatch(self, sess, text=None):
        if sess.stage == "greeting":
            return self._greeting(sess, text)
        if sess.stage == "collect":
            return self._collect(sess, text)
        if sess.stage == "answer":
            return self._answer(sess, text)
        return ("done", None)

    def _greeting(self, sess, text):
        if text is None:                       # just answered, play the menu first
            return ("collect", "play welcome_and_menu")
        intent, conf = self.nlp(text)
        if intent == "transfer-human":
            return ("transfer", "bridge agent group")
        if conf < 0.5:
            sess.retries += 1
            if sess.retries >= 2:
                return ("transfer", "bridge agent group")
            return ("collect", "play clarify_prompt")
        sess.slots["intent"] = intent
        missing = self._missing_slots(intent, sess.slots)
        if missing:
            sess.stage = "collect"
            return ("collect", f"play ask_{missing[0]}")
        return ("answer", f"play answer_{intent}")

    def _collect(self, sess, text):
        if text:
            sess.slots.setdefault("last_text", text)
        intent = sess.slots.get("intent", "check-bill")
        if self._missing_slots(intent, sess.slots):
            sess.retries += 1
            if sess.retries >= 3:
                return ("voicemail", "record message")
            return ("collect", f"play ask_{self._missing_slots(intent, sess.slots)[0]}")
        return ("answer", f"play answer_{intent}")

    def _answer(self, sess, text):
        if text and self.nlp(text)[0] == "transfer-human":
            return ("transfer", "bridge agent group")
        return ("done", "play satisfaction_survey")

    @staticmethod
    def _missing_slots(intent, slots):
        required = {"check-bill": ["period"], "change-plan": ["plan_name"], "report-fault": ["address"]}
        return [s for s in required.get(intent, []) if s not in slots]
```

The state machine's coupling with FreeSWITCH happens only at the "action description" layer — an outer executor translates `play answer_check-bill` into `uuid_broadcast` and `bridge agent group` into `originate + uuid_bridge`. This way the state machine can be unit-tested independently of the switch.

## Testing and Tuning

### Test Scenario Checklist

| Scenario | Action | Expected |
| ---- | ---- | ---- |
| Main flow - DTMF | Dial 8000 → press 1 | Recording generated, `cc::asr_request` event appears |
| Main flow - voice | Dial 8000 and say "check bill" | Intent `check-bill`, plays the bill prompt |
| Clarification | Say something unrelated | Plays the clarify prompt, transfers to agent after 2 failures |
| Transfer - success | Press 0, agent answers | Both sides talk normally, CDR and recording archived after hangup |
| Transfer - failure | Log the agent out, then press 0 | 30-second timeout to voicemail |
| Barge-in | Speak during the answer playback | (streaming approach) responds within a reasonable time |
| Error - ASR timeout | Stop the ASR service | Falls back to the DTMF menu, the call is not blocked |
| Concurrency | 20 concurrent calls through the main flow | No crosstalk, no leaked channels, latency within budget |

### Concurrency Load Test: An `originate` Script

Use loopback endpoints to mass-generate calls (make sure the dialplan has the 8000 customer service entry first):

```bash
#!/usr/bin/env bash
# load_test.sh — loopback concurrency load test
# Usage: ./load_test.sh [concurrency] [interval_seconds]
set -u
COUNT=${1:-20}
INTERVAL=${2:-0.2}

for i in $(seq 1 "$COUNT"); do
  fs_cli -x "originate loopback/8000 &park()" >/dev/null
  sleep "$INTERVAL"
done

fs_cli -x "show channels count"
fs_cli -x "status"
```

During the load test, watch three things:

- Whether the channel count from `show channels count` falls back as calls hang up (if it does not fall back, there is a channel leak);
- Whether the Sessions and SPS (sessions per second) in the `status` output approach the `max-sessions` and `sessions-per-second` limits in `switch.conf.xml`;
- Server CPU and the ASR service's concurrency quota — the bottleneck is often not FreeSWITCH.

For real SIP-level load testing, use tools like [SIPp](https://github.com/SIPp/sipp) to simulate registration, calls, and RTP send/receive.

### Experience Improvements

- **Shorten the silence**: be sparing with `sleep` gaps between prompts; tune the silence detection threshold (the silence threshold of `recordFile`) to "end the utterance when the customer stops" — too sensitive and it will treat a breath as the end of the sentence;
- **Pre-synthesis first for playback**: only dynamic text goes through TTS, and TTS results are cached to files for reuse;
- **Make failure paths visible**: log every "recognition failure / transfer to agent" to the database, review high-frequency failure phrases on weekends, and add rule words and prompts;
- **Keep DTMF and voice side by side**: the menu always keeps direct DTMF selection ("press 1 to check your bill, or just say it") — voice is an efficiency boost, not the only channel;
- **Agent wait experience**: while in queue, announce the queue position or estimated wait — this is much better than an infinite loop of hold music.

## Further Reading

- [Module Notes · IVR](/modules/ivr): how to configure the built-in IVR menus (`ivr_menus/`); this is an alternative to the Lua approach here;
- [Recording and Monitoring](/advanced/recording): the recording APIs and path variables used here;
- [Scripting and Programming Interfaces](/advanced/scripting): the full set of mod_lua script APIs;
- [Event System](/advanced/events): more details on ESL event subscription and custom events;
- [Deployment and Operations](/project/deployment): running and troubleshooting this system in production.

## References

- [SignalWire · Programming and Scripting APIs](https://developer.signalwire.com/freeswitch/programming/scripting-apis)
- [SignalWire · Scripting Integration](https://developer.signalwire.com/freeswitch/integration/scripting)
- [Wikipedia · JSON](https://en.wikipedia.org/wiki/JSON)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [resources](/appendix/resources.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [nlp](nlp.md)
