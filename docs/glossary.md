# Glossary

This table collects the common terms used across FreeSWITCH and the intelligent customer service project, grouped by topic. Each entry gives the term, a one-sentence definition, and an authoritative source; the related pages section links back to the on-site article.

## Protocols and Signaling

### Session Initiation Protocol (SIP)

The application-layer signaling protocol defined by the IETF for establishing, modifying, and terminating multimedia sessions; the core call-control protocol of FreeSWITCH.

**Source**: [rfc3261](https://datatracker.ietf.org/doc/html/rfc3261), [Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

**Related pages**: [Session](concepts/session.md), [SIP module](modules/sip.md)

### Session Description Protocol (SDP)

A format for describing multimedia session parameters (media type, codecs, address and port), carried in the SIP message body.

**Source**: [rfc4566](https://datatracker.ietf.org/doc/html/rfc4566), [Session Description Protocol](https://en.wikipedia.org/wiki/Session_Description_Protocol)

**Related pages**: [Session](concepts/session.md)

### Real-time Transmission Protocol (RTP)

A transport protocol for audio/video media over IP networks; the foundation of FreeSWITCH's media plane.

**Source**: [rfc3550](https://datatracker.ietf.org/doc/html/rfc3550), [RTP](https://en.wikipedia.org/wiki/RTP)

### Real-time Transport Control Protocol (RTCP)

RTP's companion control protocol, used for statistics and QoS feedback (packet loss, jitter, round-trip latency).

**Source**: [rfc3550](https://datatracker.ietf.org/doc/html/rfc3550), [Real-time Transport Control Protocol](https://en.wikipedia.org/wiki/Real-time_Transport_Control_Protocol)

### Secure RTP (SRTP)

An encryption and authentication extension for RTP, preventing media streams from being intercepted or tampered with.

**Source**: [rfc3711](https://datatracker.ietf.org/doc/html/rfc3711)

### RTP Profile for Audio and Video

Defines the default codec numbers and payload format conventions for RTP in audio/video sessions.

**Source**: [rfc3551](https://datatracker.ietf.org/doc/html/rfc3551)

### DTMF relay (RFC 2833)

Defines how DTMF tones are transported as RTP event packets out-of-band, avoiding degradation from speech codecs.

**Source**: [rfc2833](https://datatracker.ietf.org/doc/html/rfc2833)

### Telecommunications Number Mapping (ENUM)

A DNS-based record scheme that maps phone numbers to URIs (such as SIP/URI), supporting number portability.

**Source**: [rfc6116](https://datatracker.ietf.org/doc/html/rfc6116), [ENUM](https://en.wikipedia.org/wiki/ENUM)

### Session Traversal Utilities for NAT (STUN)

A protocol that helps endpoints discover their public mapped address and NAT type; the first step in NAT traversal.

**Source**: [rfc5389](https://datatracker.ietf.org/doc/html/rfc5389), [STUN](https://en.wikipedia.org/wiki/STUN)

**Related pages**: [Session](concepts/session.md)

### Traversal Using Relays around NAT (TURN)

A protocol for relaying media through a relay server under symmetric NAT or strict policies.

**Source**: [rfc6056](https://datatracker.ietf.org/doc/html/rfc6056), [TURN](https://en.wikipedia.org/wiki/TURN)

### Interactive Connectivity Establishment (ICE)

A framework combining STUN/TURN connectivity checks to select the best path among host candidates, reflexive candidates, and relay candidates.

**Source**: [rfc5245](https://datatracker.ietf.org/doc/html/rfc5245), [Interactive Connectivity Establishment](https://en.wikipedia.org/wiki/Interactive_Connectivity_Establishment)

### WebSocket

A protocol providing full-duplex communication over a single TCP connection; FreeSWITCH uses it to carry real-time signaling for browser and web applications.

**Source**: [rfc6455](https://datatracker.ietf.org/doc/html/rfc6455), [WebSocket](https://en.wikipedia.org/wiki/WebSocket)

### HTTP

FreeSWITCH's HTTP API and event callbacks are built on HTTP semantics (methods, status codes, JSON body).

**Source**: [rfc9110](https://datatracker.ietf.org/doc/html/rfc9110)

### SIP DNS (RFC 3263)

Specifies how SIP server addresses and transport protocols are resolved using SRV/NAPTR/A records.

**Source**: [rfc3263](https://datatracker.ietf.org/doc/html/rfc3263)

**Related pages**: [SIP module](modules/sip.md)

## Core Concepts

### FreeSWITCH

An open-source telephony switching platform with a softswitch architecture, handling call routing, media processing, and protocol interoperability.

**Source**: [](https://freeswitch.org/), [FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

### Channel

The internal representation of a call leg in FreeSWITCH, carrying protocol, media, and state machine.

**Source**: [](https://freeswitch.org/), [Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

**Related pages**: [Channel](concepts/channel.md)

### Session

The lifecycle object of a SIP call in FreeSWITCH, associating two channels with billing and recording state.

**Source**: [](https://freeswitch.org/)

**Related pages**: [Session](concepts/session.md)

### Call

A "phone call" from the user's perspective: the bridged pair of caller and callee legs, a logical concept above channels.

**Source**: [](https://freeswitch.org/)

**Related pages**: [Call](concepts/call.md)

### Dialplan

A set of rules (extensions, conditions, actions) that determines how calls are routed and handled.

**Source**: [Dial plan](https://en.wikipedia.org/wiki/Dial_plan), [](https://freeswitch.org/)

**Related pages**: [Dialplan](concepts/dialplan.md), [Dynamic dialplan](concepts/dynamic-dialplan.md), [Static dialplan](concepts/static-dialplan.md)

### Static Dialplan

A dialplan written in XML config files, loaded at startup.

**Source**: [Dial plan](https://en.wikipedia.org/wiki/Dial_plan)

**Related pages**: [Dialplan](concepts/dialplan.md), [Dynamic dialplan](concepts/dynamic-dialplan.md), [Static dialplan](concepts/static-dialplan.md)

### Dynamic Dialplan

A dialplan that is loaded or rewritten dynamically at runtime (e.g., queried from a database or API).

**Source**: [Dial plan](https://en.wikipedia.org/wiki/Dial_plan)

**Related pages**: [Dialplan](concepts/dialplan.md), [Dynamic dialplan](concepts/dynamic-dialplan.md), [Static dialplan](concepts/static-dialplan.md)

### Event System

FreeSWITCH's publish/subscribe event bus, through which modules and external systems exchange state and signaling events.

**Source**: [](https://freeswitch.org/), [](https://developer.signalwire.com/freeswitch/)

### Media Bypass

A mechanism where call participants exchange media directly without going through FreeSWITCH, reducing latency and load.

**Source**: [](https://freeswitch.org/)

**Related pages**: [Media module](modules/media.md)

## Media and Codecs

### Codec

An algorithm implementation for encoding and decoding audio/video; the payload format inside RTP packets is determined by negotiation.

**Source**: [Codecs](https://en.wikipedia.org/wiki/Codecs)

### G.711

A narrowband speech codec standard (64 kbps), the fallback codec for PSTN-VoIP interoperability.

**Source**: [G.711](https://en.wikipedia.org/wiki/G.711)

### G.729

An 8 kbps low-bitrate speech codec, commonly used under bandwidth constraints.

**Source**: [G.729](https://en.wikipedia.org/wiki/G.729)

### Opus

An open-source codec with low latency and switchable narrowband/wideband; mandatory default in WebRTC.

**Source**: [Opus (audio format)](https://en.wikipedia.org/wiki/Opus_(audio_format))

### Digital Signal Processor (DSP)

A processing unit for echo cancellation, gain, mixing, and other operations on audio streams.

**Source**: [Digital signal processor](https://en.wikipedia.org/wiki/Digital_signal_processor)

## Modules and Applications

### Interactive Voice Response (IVR)

A call-handling system that guides users through self-service business processes via voice/DTMF menus.

**Source**: [Interactive voice response](https://en.wikipedia.org/wiki/Interactive_voice_response)

**Related pages**: [IVR module](modules/ivr.md)

### Conference Module

A module that mixes multiple audio streams into a single session, supporting conference calling and monitoring.

**Source**: [Conference call](https://en.wikipedia.org/wiki/Conference_call)

**Related pages**: [Conference module](modules/conference.md)

### Gateway Module

The interoperability boundary between FreeSWITCH and PSTN/other SIP domains, handling protocol and codec translation.

**Source**: [rfc3261](https://datatracker.ietf.org/doc/html/rfc3261), [PSTN](https://en.wikipedia.org/wiki/PSTN)

**Related pages**: [Gateway module](modules/gateway.md)

### Automatic Speech Recognition (ASR)

Converting speech streams to text, the first step for an intelligent customer service system to understand users.

**Source**: [Voice recognition](https://en.wikipedia.org/wiki/Voice_recognition)

**Related pages**: [ASR and TTS](project/asr-tts.md)

### Text-to-Speech (TTS)

Converting text to speech for playback, the output channel for an intelligent customer service system's responses.

**Source**: [Speech synthesis](https://en.wikipedia.org/wiki/Speech_synthesis)

**Related pages**: [ASR and TTS](project/asr-tts.md)

### Direct Inward Dialing (DID)

A number allocation method where external calls are routed directly to a specified internal extension.

**Source**: [Direct inward dialing](https://en.wikipedia.org/wiki/Direct_inward_dialing)

## Deployment and Operations

### Public Switched Telephone Network (PSTN)

The traditional public switched telephone network, with which VoIP systems interoperate via gateways.

**Source**: [PSTN](https://en.wikipedia.org/wiki/PSTN)

**Related pages**: [Network settings](configuration/network.md)

### Voice over IP (VoIP)

The general term for carrying voice calls over IP networks, encompassing the SIP/RTP/WebRTC technology stack.

**Source**: [Voice over IP](https://en.wikipedia.org/wiki/Voice_over_IP)

### Softswitch

A switching system with separated control and bearer planes; FreeSWITCH is one such open-source implementation.

**Source**: [Softswitch](https://en.wikipedia.org/wiki/Softswitch)

### NAT Traversal

A collection of techniques for enabling communication between servers and endpoints behind a private network (STUN/TURN/ICE/UPnP).

**Source**: [NAT traversal](https://en.wikipedia.org/wiki/NAT_traversal)

### Network Address Translation (NAT)

A mechanism that maps private addresses to public addresses, which can impede end-to-end addressing.

**Source**: [Network address translation](https://en.wikipedia.org/wiki/Network_address_translation)

**Related pages**: [Network settings](configuration/network.md)

### Session Border Controller (SBC)

A signaling/media proxy deployed at domain boundaries, handling security, topology hiding, and NAT traversal.

**Source**: [Session Border Controller](https://en.wikipedia.org/wiki/Session_Border_Controller)

**Related pages**: [Session](concepts/session.md)

### Simple Network Management Protocol (SNMP)

A protocol for monitoring device status and metrics; FreeSWITCH can expose MIBs.

**Source**: [Simple Network Management Protocol](https://en.wikipedia.org/wiki/Simple_Network_Management_Protocol)

**Related pages**: [Network settings](configuration/network.md)

### Toll-free Number

A toll-free number range (such as 400/800 numbers), commonly used as the inbound entry point for customer service.

**Source**: [Toll-free number](https://en.wikipedia.org/wiki/Toll-free_number)

## Intelligent Customer Service Project

### Natural Language Processing (NLP)

The umbrella term for technologies that enable machines to understand and generate human language, covering tokenization, intent recognition, and dialogue management.

**Source**: [Natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing)

**Related pages**: [NLP](project/nlp.md)

### Virtual Assistant

A software system that provides services through dialogue; an intelligent customer service agent is one such example.

**Source**: [Virtual assistant](https://en.wikipedia.org/wiki/Virtual_assistant)

### JSON

A lightweight data exchange format, widely used in request/response bodies and configuration for intelligent customer service systems.

**Source**: [JSON](https://en.wikipedia.org/wiki/JSON)

### Speech-to-text Pipeline

A processing chain where ASR output is parsed by NLP into intents and slots, then drives response generation.

**Source**: [Speech to text](https://en.wikipedia.org/wiki/Speech_to_text)

## Maintenance Conventions

- New terms are registered in this table first, then used in the body text; sources only accept links that return HTTP 200 when curl-tested (RFC, Wikipedia, official docs).
- Terms without a found authoritative source are not given a source line and are marked "No authoritative source found (pending verification)".

<!-- BACKLINKS-AUTO -->
## Related pages

- [call](/concepts/call.md)
- [channel](/concepts/channel.md)
- [dialplan](/concepts/dialplan.md)
- [dynamic-dialplan](/concepts/dynamic-dialplan.md)
- [session](/concepts/session.md)
- [static-dialplan](/concepts/static-dialplan.md)
- [network](/configuration/network.md)
- [knowledge](knowledge.md)
- [conference](/modules/conference.md)
- [gateway](/modules/gateway.md)
- [ivr](/modules/ivr.md)
- [media](/modules/media.md)
- [sip](/modules/sip.md)
- [asr-tts](/project/asr-tts.md)
- [nlp](/project/nlp.md)
