# What Is FreeSWITCH

FreeSWITCH is an open-source softswitch platform written in C, originally released by Anthony Minessale II in 2006 at the ClueCon conference. It distills the capabilities of a traditional private branch exchange (PBX), media gateway, and voice application server into a software system that runs on an ordinary server.

## Core Positioning

At its core, FreeSWITCH is a combination of three layers of capability:

- **Signaling layer**: implements protocol stacks such as SIP (RFC 3261) to handle call setup, modification, and teardown; provides full SIP user agent (UAS/UAC) capabilities through the mod_sofia module.
- **Media layer**: handles audio and video codec transcoding, mixing, recording, and playback; has built-in support for mainstream codecs such as G.711, G.722, Opus, H.264, and VP8.
- **Application layer**: provides application programming interfaces such as dialplans, IVR, conferencing, gateways, scripting (Lua), and the event socket (ESL), so business logic can be composed freely.

## Key Features

- **Modular architecture**: nearly every feature is loaded as a dynamic module (`.so`/`.dll`), can be toggled on or off in `modules.conf.xml` as needed, keeping the core slim.
- **Multiple protocols and forms**: supports SIP over UDP/TCP/TLS, supports WebRTC (SIP over WebSocket, ports 5066/7443), and supports TDM/analog/digital trunks (through TDM-class modules such as mod_freetdm; these modules must be obtained separately and are not shipped with the main source tree).
- **Cross-platform**: officially supports Linux (the primary target platform), FreeBSD, macOS, and Windows.
- **High concurrency**: a single machine can handle thousands of concurrent calls, and signaling and media processing can scale out across multiple servers.
- **Scripting and control interfaces**: Lua scripts can be embedded directly in dialplans (early JavaScript support via mod_spidermonkey was moved out of the source tree starting in 1.4, see [Scripting and Programming Interfaces](/advanced/scripting)); ESL (Event Socket Library) allows any language such as Python, Go, or Node.js to control FreeSWITCH over TCP.
- **Open-source license**: released under MPL 1.1 (Mozilla Public License 1.1).

## A Brief Comparison with Asterisk

| Dimension | FreeSWITCH | Asterisk |
| ---- | ---- | ---- |
| Positioning | General-purpose softswitch / communications application platform | PBX-centric telephone system |
| Architecture | Strong modularity; signaling/media/application decoupled | Applications are more tightly coupled with the core |
| Default dialplan | XML dialplan + scripting, highly expressive | Extensions files and Asterisk's own DSL |
| WebRTC | Native support (mod_sofia + rtp) | Requires extra modules and specific versions |
| Scripting / external control | Lua + ESL, native | AGI/AMI/ARI |
| Configuration style | XML-based, clear hierarchy | Per-file `.conf`, with its own syntax |

Both can build enterprise telephone systems and contact centers. When a project involves complex media processing (transcoding, conferencing, recording), WebRTC gateways, or needs to be deeply controlled by external programs, FreeSWITCH's architectural advantages become more pronounced.

## Scenarios These Notes Apply To

These notes come mainly from the following requirement scenarios:

- operations and development staff who need to build their own PBX, voice gateway, or contact center;
- backend engineers who want to integrate voice capabilities into business systems (intelligent customer service, outbound notifications, conferencing);
- developers who are getting familiar with the FreeSWITCH configuration system, dialplans, and ESL programming.

I've organized common usage patterns in [Application Scenarios for FreeSWITCH](/introduction/scenarios) and installation records in [Installing FreeSWITCH](/installation/README).

## References

- FreeSWITCH official documentation and site (freeswitch.org / SignalWire developer docs) — the primary source for the concepts and configuration conventions in this repo.
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)
- [Wikipedia · Voice over IP](https://en.wikipedia.org/wiki/Voice_over_IP)
- [FreeSWITCH official site](https://freeswitch.org/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [scripting](/advanced/scripting.md)
- [README](/installation/README.md)
- [scenarios](scenarios.md)
- [knowledge](/knowledge.md)
