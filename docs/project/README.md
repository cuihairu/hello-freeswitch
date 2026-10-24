# Smart Customer Service Project Overview

Here I record the design and implementation experience of a **telephony smart customer service system**: bringing together Sofia, the dialplan, IVR, scripting, and ESL so that an incoming call is auto-answered, its speech recognized, its intent understood, and — when needed — routed to a human agent with the recording archived.

The smart customer service write-up unfolds from three questions: what the system needs to do (requirements analysis), which technologies to use for each part (technology selection), and how to combine them overall (architecture design).

## Requirements Analysis

### Core Business Flow

The complete journey of a typical inbound call:

1. The customer dials the customer service number, enters FreeSWITCH through the carrier's trunk;
2. A welcome message and IVR menu play; the customer may press keys or simply talk;
3. The spoken content is transcribed to text (ASR) and handed to NLP for intent classification;
4. Common questions are answered directly by the bot via TTS (or a pre-synthesized prompt tone);
5. When the system cannot recognize, when the customer is upset, or when the customer explicitly asks, the call is transferred to a human agent;
6. The entire call is recorded; after hangup the recording and the call log are archived for quality inspection and audit.

### Functional Requirements Breakdown

| Capability | Requirement Highlights | Primary Carrier |
| ---- | ---- | ---- |
| Inbound call access | Trunk to carrier, number onboarding, caller identification, black/white lists, time-of-day routing | FreeSWITCH (mod_sofia + dialplan) |
| IVR navigation | Multi-level menus, key collection, retry on timeout/mis-dial, routing by working hours | FreeSWITCH (the `ivr` application in mod_dptools / Lua scripts) |
| Speech-to-text (ASR) | Real-time streaming recognition as the primary path, recording-file recognition as fallback; Chinese accuracy must meet the bar | Voice service + media capture module |
| Intent recognition | Classify the customer's intent, extract entities (time/number/business type), multi-turn clarification | NLP service (cloud or self-hosted) |
| Answer playback | The bot speaks its answer, supporting dynamic text (e.g. a phone bill amount) | TTS service + FreeSWITCH playback |
| Agent transfer | Queueing, assignment, fallback on no answer, the handoff between agent and bot on the same call | FreeSWITCH (bridge/queue) + business backend |
| Recording archive | Record the whole call, name files by call UUID, upload and index after hangup | FreeSWITCH recording + business backend |

### Non-functional Requirements

- **Latency**: the bot's "listen-think-speak" round trip must stay within seconds; past two seconds the customer feels it "froze";
- **Concurrency**: estimate concurrent call count from agent headcount and traffic peaks; a single FreeSWITCH node handling hundreds of concurrent calls is routine scale, and the bottleneck is usually the ASR service rather than the switch;
- **Availability**: when the voice service fails there must be a degraded path (fall back to a pure key-press IVR) — it cannot be that "when recognition is down, calls cannot get through at all";
- **Compliance**: recordings require a notice ("this call will be recorded"), and retention periods and access permissions must be explicit.

## Technology Selection

| Layer | Choice | Rationale |
| ---- | ---- | ---- |
| Call access and media | FreeSWITCH | The most complete ecosystem among open-source softswitches: SIP/WebRTC access, dialplan, IVR, recording, conferencing, and transfer are all built in; stable on Linux with strong single-node concurrency |
| Control channel | ESL (Event Socket) | The standard channel for events upstream and commands downstream; the business backend uses it to observe every call and intervene at any time (see [Event System and ESL](/advanced/events)) |
| Scripting layer | Lua (mod_lua) | In-process execution with very low latency, ideal for logic that "runs on every call" such as IVR menus and key collection |
| ASR / TTS | Standalone voice service | Cloud vendor APIs or self-hosted engines, decoupled from the switch layer so they can scale and be replaced independently |
| NLP | Dialogflow / Rasa / homegrown rules | Intent classification and multi-turn dialogue management; the three can coexist, with rules as a fallback |
| Business backend | Python / Go / Java | Session state machine, agent scheduling, ticketing and CRM integration, recording archive |

Three selection principles are worth emphasizing:

- **Separate switching from intelligence.** FreeSWITCH only handles "pick up, play, record, transfer"; all semantic understanding lives in external services. Voice and NLP technology iterate quickly, so decoupling means swapping vendors without touching the switch layer.
- **Control plane over ESL, media plane over the media stream.** Business decisions depend on events (call inbound, answer, hangup, recording complete); interventions depend on commands (answer, play, transfer, hangup). Two channels, clean responsibilities, no cross-contamination.
- **Every intelligent step needs a fallback.** ASR down, fall back to the key menu; NLP down, play a static prompt; TTS down, fall back to pre-synthesized files. A customer service system is the company's front-line entry point and cannot be entirely unavailable because of one third-party interface.

## Overall Architecture

```
          PSTN / carrier trunk (mobile and landline calls in)
                         |
                         v
+-- FreeSWITCH node --- call access and media handling --------------------
|   mod_sofia access · dialplan/IVR · recording · transfer · RTP media
+------+------------------------------------------+----------+
       |                                          |
       | ESL control channel (TCP 8021)           | media capture (media bug)
       | events upstream / commands downstream    | L16 real-time audio stream
       v                                          v
+-- smart customer service backend -------------------------------+
|   ESL client · call state machine · agent scheduling ·          |
|   recording archive · quality-inspection interface              |
+------+---------------------+---------------------+-------+
       |                     |                     |
       v                     v                     v
  ASR / TTS service        NLP service             business system
  streaming / synthesis   Dialogflow / Rasa /     tickets / CRM / database
                          rules fallback           |
                                                  v
                                       human agent extensions
                                       (registered on FreeSWITCH)
```

The data flow, item by item:

1. **Call access**: the carrier trunk's INVITE enters FreeSWITCH (usually on the external profile or a dedicated trunk profile), hits the customer service entry in the dialplan, and is handed to the Lua IVR script or taken over by the ESL backend;
2. **Media egress**: when recognition is needed, a media bug is attached to the call channel to capture audio and push it to the ASR service (speech recognition and synthesis in detail); if "per-sentence recognition" is used instead, simply `record` and then hand the file to ASR;
3. **Events upstream**: FreeSWITCH pushes channel events (inbound call, answer, record start/stop, hangup) to the business backend over ESL, and the backend advances the state machine accordingly;
4. **Intent classification**: the text produced by ASR goes to the NLP service, yielding the intent and entities;
5. **Answer and transfer**: the answer text goes to TTS (or hits a pre-synthesized file), and the backend plays it with ESL commands; when a human is needed, `originate` the agent extension and bridge;
6. **Archive**: the hangup event triggers recording upload, CDR insertion into the database, and correlation of the call with its text record.

The mapping between each component and the corresponding manual chapter:

| Component | Dependencies | See |
| ---- | ---- | ---- |
| Call access and routing | profile, dialplan | [Dialplan](/concepts/dialplan), [Network Settings](/configuration/network) |
| IVR and key collection | IVR menu / Lua | [IVR Integration](/project/implementation) |
| Recording | record / uuid_record | [Speech Recognition and Synthesis](/project/asr-tts) |
| Control channel | ESL events and commands | [Event System and ESL](/advanced/events) |
| Agent transfer | bridge / originate | [Implementing Smart Customer Service](/project/implementation) |
| Production and operations | systemd, monitoring, troubleshooting | [Deployment and Operations](/project/deployment) |

## Project Records Index

- [Speech Recognition and Synthesis](/project/asr-tts): ASR/TTS integration paths, community audio stream modules, the general integration approach, and a selection comparison;
- [Natural Language Processing](/project/nlp): intent classification, entity extraction, dialogue management, how to connect Dialogflow and Rasa, and rules as a fallback;
- [Implementing Smart Customer Service](/project/implementation): assembling IVR, recognition, NLP, and transfer into a complete flow, with runnable Lua/Python examples and testing methods;
- [Deployment and Operations](/project/deployment): single-node and multi-node deployment, monitoring and alerting, and common fault troubleshooting.

## Related Reading

- [Event System](/advanced/events): the ESL event model and how to subscribe — the foundation of backend perception;
- [Scripting and Programming Interfaces](/advanced/scripting): the mod_lua execution model and script API;
- [Module Records · IVR](/modules/ivr): how to configure the built-in IVR menu;
- [Routing and Dialplan](/concepts/dialplan): the carrier layer for customer service entry routing.

## References

- [Wikipedia · Natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing)
- [Wikipedia · Virtual assistant](https://en.wikipedia.org/wiki/Virtual_assistant)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](/advanced/README.md)
- [resources](/appendix/resources.md)
- [knowledge](/knowledge.md)
