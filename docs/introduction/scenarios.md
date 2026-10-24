# Application Scenarios for FreeSWITCH

FreeSWITCH is not a single product — it's a set of "communications building blocks." The same kernel, combined with different modules, can cover a wide range of scenarios from enterprise office telephony to intelligent customer service.

## Enterprise IP-PBX

Deploy FreeSWITCH on the enterprise intranet or in a machine room, replacing a traditional PBX:

- Extension registration: desktop SIP handsets, softphones (X-Lite, Bria, Linphone), and mobile apps register to FreeSWITCH over SIP;
- Internal calling: dial a 3- to 5-digit extension to talk for free;
- Trunked inbound/outbound calls: connect to a carrier via a SIP trunk or voice gateway for PSTN interoperability;
- Basic call features: call forwarding, busy transfer (call pickup), call waiting, voicemail (mod_voicemail), and an IVR main menu.

Typical scale: small-to-medium enterprises with tens to thousands of extensions.

## Contact Center (Call Center)

FreeSWITCH serves as the communications kernel for many open-source contact center solutions (such as in-house middleware built on ESL, VoxBay, and similar):

- **Automatic call distribution (ACD)**: route inbound calls to agents by skill group and queue policy;
- **IVR self-service**: key-based navigation and voice queries (integrating with ASR/NLP);
- **Agent state management**: use ESL to control agent busy/idle status and predictive dialing;
- **Full-call recording**: use the `record` application or `uuid_record` to write individual calls to disk;
- **Real-time reporting**: subscribe to ESL events to track agent status, call duration, and abandonment rate.

## Voice Gateways and Trunk Boundaries

- **SIP ↔ PSTN gateway**: connect FreeSWITCH to the traditional telephone network through a voice gateway (E1/T1, analog lines);
- **Protocol translation**: interoperate with legacy systems that only support a particular codec or proprietary signaling;
- **Number breakout**: convert calls from a web app into outbound calls to real mobile numbers.

## WebRTC Voice and Video

mod_sofia natively supports SIP over WebSocket (`ws-binding` 5066, `wss-binding` 7443), which combined with ICE/STUN/TURN and H.264/VP8 codecs can deliver:

- browser peer-to-peer calling and a web-based phone bar;
- web conferencing and interactive online education classrooms;
- audio/video interoperability with native apps (both sides of the SIP call can register directly).

## Voice Notifications and Bulk Outbound Dialing

- Combine scripting or ESL loops calling `originate` to push bulk notifications to users, such as overdue bills and order updates;
- Use TTS (mod_flite, mod_tts_commandline, or a cloud TTS integration) to convert text to speech and play it out;
- Apply rate limiting and concurrency control to avoid being blocked by carriers.

## Intelligent Customer Service and AI Communications

Intelligent customer service is the main thread of the later project notes, and it's also a new use case for FreeSWITCH in recent years:

```
Incoming call → IVR voice navigation → ASR real-time recognition → NLP intent understanding → business system query
                              ↓
              agent transfer / TTS result playback → hang up and archive (recording + transcript)
```

Within that, FreeSWITCH handles call access, media bridging, recording, and event reporting, while speech recognition (ASR), synthesis (TTS), and natural language processing (NLP) are integrated with external services via ESL.

## Conferencing and Multi-party Calls

mod_conference provides mixing-based conferencing: multi-party dial-in, host controls, roll-call, recording, and live side-streaming. It's also commonly used for family group calls and telephone conference bridges.

## Related Records

Once the scenario is settled, start from deployment:

- [Install on Linux](/installation/linux) — the first choice for server environments;
- [Install on Windows](/installation/windows) — for local hands-on experience and development debugging;
- After installation, come back to [Basic FreeSWITCH Configuration](/configuration/README) to get familiar with the configuration system.

## References

- [Wikipedia · Voice over IP](https://en.wikipedia.org/wiki/Voice_over_IP)
- [Wikipedia · Call center](https://en.wikipedia.org/wiki/Call_center)
- [Wikipedia · Softswitch](https://en.wikipedia.org/wiki/Softswitch)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [what-is-freeswitch](what-is-freeswitch.md)
- [knowledge](/knowledge.md)
