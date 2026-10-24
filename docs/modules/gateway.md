# Gateway Module

A gateway is the "line definition" that connects FreeSWITCH to the outside telephone world: a carrier SIP trunk, an enterprise SBC, or another PBX to interoperate with — each is configured as a gateway. It rides on `mod_sofia`'s external profile and is the indispensable route for outbound call termination and inbound call arrival.

## What a Gateway Does

- **Outbound termination**: the dialplan hands the outside number to the gateway — the `bridge` target is `sofia/gateway/<gateway name>/<number>` (see [Static Dialplan](/concepts/static-dialplan));
- **Inbound arrival**: the carrier dials the DID to FreeSWITCH, which lands in the external profile's `context` (vanilla: `public`);
- **Two interconnection forms**:
  - **Registered**: FreeSWITCH `REGISTER`s to the carrier like a phone, authenticated by account and password; fits small scale and dynamic IP;
  - **Unregistered**: both sides connect directly by IP (the peer identifies you by source IP); common on dedicated lines, SBC interconnects, or enterprise-owned trunks.

Gateway files live under `conf/sip_profiles/external/`; one file can hold multiple `<gateway>` elements. The `external.xml` main profile has `auth-calls=false` and `context=public` (see [SIP Module](/modules/sip)).

## Registered Gateway: A Complete Configuration Example

`conf/sip_profiles/external/carrier1.xml`:

```xml
<include>
  <!-- registered gateway: register to the carrier with account and password -->
  <gateway name="carrier1">
    <!-- registration account -->
    <param name="username" value="888001"/>
    <param name="password" value="your-password"/>
    <param name="realm" value="sip.carrier.com"/>
    <!-- From domain and user sent to the peer; defaults inherit username and realm -->
    <param name="from-user" value="888001"/>
    <param name="from-domain" value="sip.carrier.com"/>
    <!-- signaling destination address; defaults inherit realm -->
    <param name="proxy" value="sip.carrier.com"/>
    <param name="register" value="true"/>
    <param name="register-transport" value="udp"/>
    <!-- registration validity and failure retry interval (seconds) -->
    <param name="expire-seconds" value="600"/>
    <param name="retry-seconds" value="30"/>
    <!-- OPTIONS keepalive: a failure marks the gateway unavailable and triggers re-registration -->
    <param name="ping" value="25"/>
    <!-- inbound landing: when called at username, enter context under this extension; if unset, uses username -->
    <param name="extension" value="888001"/>
    <param name="context" value="public"/>
  </gateway>
</include>
```

Common parameter quick reference (all names supported by `mod_sofia` gateway parsing):

| Parameter | Role |
| ---- | ---- |
| `username` / `password` | Registration account and password; `auth-username` can specify the auth username separately |
| `realm` | Auth domain; leave empty to use the gateway name. Some carriers validate the realm — a wrong one yields persistent 403/407 |
| `proxy` | Signaling destination (can be `host:port`); leave empty to use realm |
| `register-proxy` | Specify the REGISTER destination separately |
| `outbound-proxy` | All outbound requests forward through this proxy |
| `register` | Whether to register, `true`/`false` |
| `register-transport` | Transport for registration: `udp`, `tcp`, `tls` |
| `expire-seconds` | Registration validity (seconds); auto-renews on expiry |
| `retry-seconds` | Retry interval after a registration failure or timeout |
| `ping` | OPTIONS keepalive interval (seconds); `ping-min` and `ping-max` control degradation/recovery thresholds |
| `from-user` / `from-domain` | User and domain of the outbound From header — the calling identity the peer sees |
| `caller-id-in-from` | When `true`, fills From with the channel's calling number (use when the carrier allows pass-through) |
| `extension` | Extension name matched by inbound calls (the destination_number before entering context) |
| `extension-in-contact` | Put the extension into the REGISTER's Contact |
| `contact-params` / `contact-host` | Custom Contact parameters and host part |
| `context` | Context for inbound calls to this gateway; defaults to the host profile's context |
| `gw-auth-acl` | Only accept inbound from this ACL, locking the peer IP |
| `cid-type` | Calling-number passing method (e.g. `rpid`, per carrier requirements) |
| `destination-prefix` | Add a prefix to outbound numbers |

## Unregistered Gateway: Direct SIP Trunk

For dedicated-line / intranet SBC scenarios there's no registration — just declare the peer address and lock the source:

```xml
<include>
  <!-- unregistered: direct IP trunk -->
  <gateway name="trunk2">
    <param name="username" value="fs01"/>
    <param name="password" value="unused"/>
    <param name="proxy" value="10.8.0.1:5060"/>
    <param name="register" value="false"/>
    <param name="caller-id-in-from" value="true"/>
  </gateway>
</include>
```

Key points:

- With `register=false` the gateway sends no REGISTER, and outbound calls go straight to `proxy`; specify the port on `proxy` explicitly;
- Inbound trust comes from the network layer: set `apply-inbound-acl` on the external profile to allow only the peer IP range, or bind with `gw-auth-acl` on the gateway — **do not** leave an external profile with `auth-calls=false` fully open to the public internet;
- The peer identifies you the same way, by your source IP (or configured account) — in NAT environments make sure `ext-sip-ip`/`ext-rtp-ip` are set (see [Network Settings](/configuration/network)).

## Loading and Status Queries

```bash
# read (or re-read) gateway definitions under external/
fs_cli -x "sofia profile external rescan"

# check gateway status (REGED means registered successfully)
fs_cli -x "sofia status gateway carrier1"

# register / unregister now (single gateway or all)
fs_cli -x "sofia profile external register carrier1"
fs_cli -x "sofia profile external unregister carrier1"

# delete a running gateway (then rescan to reload)
fs_cli -x "sofia profile external killgw trunk2"

# restart the whole profile when changes are too big (interrupts this profile's sessions)
fs_cli -x "sofia profile external restart"
```

After adding or modifying a gateway file, just `rescan` — no `reloadxml` needed (gateways aren't in the XML config's section cache; rescan re-reads the files directly).

## Key Points for PSTN Gateway Interfacing

PSTN usually lands via a carrier SIP trunk (or IMS, or an E1-to-SIP access device); align each item during interconnection:

1. **Codecs**: voice networks are almost universally G.711 (PCMU/PCMA). Set the external profile's `inbound-codec-prefs` / `outbound-codec-prefs` to `PCMU,PCMA` to avoid transcoding; for an individual call that needs a temporary codec swap use `absolute_codec_string` (see [Media Module](/modules/media));
2. **DTMF**: both sides must use the same method. RFC 2833 is mainstream, with the payload number set by the profile's `rfc2833-pt` (default 101); if the peer wants SIP INFO, set the profile's `dtmf-type` to `info`;
3. **Calling number**: carriers generally require a registered calling number — `from-user` / `from-domain` fix the default caller, then enable `caller-id-in-from` for businesses allowed pass-through; some devices require `cid-type=rpid`;
4. **NAT and addressing**: public interconnection requires `ext-sip-ip` / `ext-rtp-ip`, and the external profile's SIP port plus the RTP port range must be opened;
5. **Inbound routing**: inbound lands in the `public` context; route by called DID into a default-context extension or IVR:

```xml
<include>
  <!-- conf/dialplan/public/10_did.xml -->
  <extension name="did_inbound">
    <condition field="destination_number" expression="^(10865551212)$">
      <action application="set" data="domain_name=$${domain}"/>
      <action application="transfer" data="1000 XML default"/>
    </condition>
  </extension>
</include>
```

6. **Keepalive and failover**: set `ping` for OPTIONS probing; with multiple carriers, one gateway per line, and in the dialplan use `sofia status gateway` availability with `mod_lcr` or conditional rules to split traffic.

## Troubleshooting: Registration Failures and One-Way Audio

Turn on tracing first, then look at status — don't guess:

```bash
fs_cli -x "sofia global siptrace on"      # look at SIP messages and response codes
fs_cli -x "sofia status gateway carrier1" # look at registration status and retries
fs_cli -x "sofia status profile external" # look at listening address, codecs, session count
```

| Symptom | Common causes and fixes |
| ---- | ---- |
| Persistent 401/407 with repeated retries | Wrong username/password; a wrong `realm` causes a digest-domain mismatch; after fixing, `sofia profile external register carrier1` retries immediately |
| 403 Forbidden | Account not provisioned, calling number not registered (`from-user` wrong), or source IP not on the carrier's allowlist |
| Gateway stuck DOWN with no response | `proxy` address/port unreachable, firewall blocking SIP; test the peer port from the server with `telnet`/`nc` first |
| Registers but drops after a few minutes | `expire-seconds` too long with no keepalive: set `ping`, or shorten `expire-seconds`; under NAT confirm `ext-sip-ip` |
| Connects but **one-way audio** (only one side hears) | Classic RTP problem: the firewall hasn't opened the RTP port range, or `ext-rtp-ip` is wrong (the peer sends media to an unreachable address). Use `tcpdump` to confirm bidirectional RTP is flowing, and cross-check [Network Settings](/configuration/network) |
| Connected but totally silent or a 488 | Codec mismatch: the peer doesn't offer the codecs you declared; narrow with `absolute_codec_string=PCMU,PCMA` to verify, and enable `inbound-late-negotiation` if needed |
| Outbound works, inbound doesn't arrive | The external profile's `context` doesn't match the DID rules; use `fs_cli -x "show channels"` to see which context the inbound lands in and what the `destination_number` is |
| Inbound called number is the gateway username | `extension` not set, or the carrier's called number doesn't match your DID rules; use siptrace to check the Request-URI in the INVITE |

For media problems, `fs_cli -x "uuid_dump <uuid>"` shows the `read_codec`/`write_codec` actually negotiated on this call plus both sides' SDP addresses — the fastest evidence for telling "one-way vs. codec".

## Further Reading

- [SIP Module](/modules/sip) — profile mechanics, authentication and ACLs; the gateway runs on the external profile;
- [Media Module](/modules/media) — codec preferences, `absolute_codec_string` and transcoding;
- [Static Dialplan](/concepts/static-dialplan) — the outbound form `sofia/gateway/<gateway>/<number>`;
- [Network Settings](/configuration/network) — port allowlisting and NAT, the first stop for one-way audio;
- [Module Overview](/modules/README) — where mod_sofia sits in the module system.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [RFC 3263 · SIP DNS records](https://datatracker.ietf.org/doc/html/rfc3263)
- [Wikipedia · PSTN](https://en.wikipedia.org/wiki/PSTN)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [media](media.md)
