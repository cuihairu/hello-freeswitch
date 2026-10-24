# Appendix C · Resources and References

This lists the external resources this site cites and the entry points I actually reach for. Inclusion rule: **only entries that are confirmed to exist and are likely to stay reachable long term**; third-party projects move fast, so when a link dies, treat the official site as the anchor and search again from there.

## Official documentation

| Resource | Link | Description |
| ---- | ---- | ---- |
| FreeSWITCH official site | <https://freeswitch.org/> | Project home: news, downloads, community links |
| FreeSWITCH Users Manual | <https://developer.signalwire.com/freeswitch/> | The official user manual maintained by SignalWire, split into 12 parts (Foundations, Configuration System, Call Routing, Media, Integration and Control, Module Reference, Troubleshooting, Programming, etc.); the most authoritative documentation entry point today |
| Scripting integration chapter | <https://developer.signalwire.com/freeswitch/integration/scripting> | Official write-up of the Lua/JS/Python scripting modules and the two kinds of commands, `lua`/`luarun` |
| Embedded scripting API | <https://developer.signalwire.com/freeswitch/programming/scripting-apis> | The objects and methods available to each scripting language (session, event, etc.) |
| Source release archives | <https://files.freeswitch.org/releases/freeswitch/> | Source tarballs for each version (including the 1.10 and 1.11 series; latest stable 1.11.3) |

The old wiki (freeswitch.org/confluence) has migrated to the SignalWire developer portal above; most wiki links in older material can be found for the equivalent content on the new site.

## Source repositories

| Repository | Link | Description |
| ---- | ---- | ---- |
| Official GitHub repository | <https://github.com/signalwire/freeswitch> | The main repo (maintained by SignalWire); Issues/PRs go here; the vanilla config template lives in `conf/vanilla/`, and the systemd unit in `build/` |
| Releases | <https://github.com/signalwire/freeswitch/releases> | Version releases and change records |
| Official GitLab | `gitlab.freeswitch.org` | The project's own GitLab instance; when the network is unreachable, fall back to the GitHub mirror above (hostname only, not a link, so the official entry point stays authoritative) |

Third-party repositories directly relevant to the intelligent customer service project notes:

| Project | Link | Use |
| ---- | ---- | ---- |
| drachtio-freeswitch-modules | <https://github.com/mdslaney/drachtio-freeswitch-modules> | The drachtio community's FreeSWITCH modules repo; `mod_audio_fork` lives at `modules/mod_audio_fork` (a media bug that taps the stream and sends it over a WebSocket — the reference implementation for voice AI integration; the path under the original drachtio org has died, so this mirror is the one to use now) |
| mod_audio_stream | <https://github.com/amigniter/mod_audio_stream> | Bidirectional WebSocket audio streaming module (covered in depth under speech recognition and synthesis); you build it yourself |
| Vosk | <https://github.com/alphacep/vosk-api> | Self-hostable open-source offline ASR (includes a Chinese model); often paired with the audio streaming modules |
| UniMRCP | <https://www.unimrcp.org/> | Open-source MRCP client/server framework, the underlying dependency of `mod_unimrcp`; the official site has FreeSWITCH integration material |
| SIPp | <https://github.com/SIPp/sipp> | SIP protocol-level load testing tool (the advanced option mentioned for stress testing the intelligent customer service features) |

## Community and conferences

| Channel | Link | Description |
| ---- | ---- | ---- |
| Mailing lists | <https://lists.freeswitch.org/> | Mailman list service (freeswitch-users, freeswitch-dev, etc.); the archives are full-text searchable, and the answer to many thorny problems is sitting in an old thread |
| ClueCon | <https://www.cluecon.com/> | The developer conference run by the FreeSWITCH founding team; a roadmap and hands-on talks every year, talk materials are public |
| GitHub Issues | <https://github.com/signalwire/freeswitch/issues> | Bugs and feature discussion; search the issues before asking |

General advice for asking questions: include the FreeSWITCH version (`fs_cli -x "version"`), the `sofia status profile <name>` output, a signaling trace (`siptrace`), and the relevant log snippets — most problems are pinned down in one round.

## Books

English (in order of publication):

| Title | Authors | Description |
| ---- | ---- | ---- |
| *FreeSWITCH Cookbook* (2012, Packt) | Anthony Minessale et al. | Recipe-style Q&A covering common configuration scenarios |
| *FreeSWITCH 1.2* (2013, Packt) | Anthony Minessale, Michael S. Collins, Darren Schreiber, Raymond Chandler | Early system material; some concepts are still worth consulting |
| *FreeSWITCH 1.6 Cookbook* (2015, Packt) | Anthony Minessale II, Michael S. Collins, Giovanni Maruzzelli | More hands-on, includes ESL and scripting examples |
| *Mastering FreeSWITCH* (2016, Packt) | Anthony Minessale II, Giovanni Maruzzelli | Advanced topics: clustering, security, performance |
| *FreeSWITCH 1.8* (2017, Packt) | Anthony Minessale II, Giovanni Maruzzelli | System material for a newer version |

> The English books are based on older versions; the configuration options have not changed much but the module ecosystem moves quickly, so keep the official manual as the benchmark while reading.

Chinese:

| Title | Description |
| ---- | ---- |
| 《FreeSWITCH 权威指南》 | By Du Jinfang and others; the landmark FreeSWITCH book in China, covering SIP fundamentals through ESL/scripting and production practice — the go-to systematic textbook for Chinese readers |

## Chinese-language community material

| Resource | Link | Description |
| ---- | ---- | ---- |
| FreeSWITCH Chinese community | <https://freeswitch.org.cn/> | An unofficial Chinese community site: blog, getting-started material, community events, and version news. The official freeswitch.org and freeswitch.com now both 301 to signalwire.com/freeswitch (SignalWire is the project maintainer) |
| Community open-source books | See links above | Two community co-created open-source books, 《FreeSWITCH 案例大全》 and 《FreeSWITCH 参考手册》, by Du Jinfang and the other contributors (2016-2023), readable online at book.dujinfang.com; still being written and updated, case-oriented |
| Zhihu column / WeChat official account | See links above | Chinese-language scene updates and Q&A (official account FreeSWITCH-CN) |

When I consult Chinese-language material I check the version first: community content spans a wide range (1.2 through 1.11 are all represented), and I cross-check config snippets against the vanilla template in [Appendix A](/appendix/configuration-files). The 1.11 series has breaking changes (mod_python and roughly 30 legacy modules removed, the move to PCRE2), so older material needs to be read with those differences in mind.

## Site navigation

- Intelligent customer service project notes: [Intelligent customer service overview](/project/README), [Speech recognition and synthesis](/project/asr-tts), [Natural language processing](/project/nlp), [Implementing intelligent customer service features](/project/implementation), [Deployment and operations](/project/deployment);
- Appendices: [Appendix A · Configuration file reference](/appendix/configuration-files), [Appendix B · Common commands and tools](/appendix/commands), this page.

## References

- [FreeSWITCH mailing lists](https://lists.freeswitch.org/)
- [FreeSWITCH official site](https://freeswitch.org/)
- [GitHub · signalwire/freeswitch issues](https://github.com/signalwire/freeswitch/issues)

<!-- BACKLINKS-AUTO -->
## Related pages

- [knowledge](/knowledge.md)
