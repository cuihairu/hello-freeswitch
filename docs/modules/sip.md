# SIP Module

Almost every call FreeSWITCH exchanges with the outside world goes through `mod_sofia`. These notes cover the basics of the SIP protocol, the profile structure of mod_sofia, the key parameters of internal/external, and observations from registration, authentication, and anti-scanning.

## SIP protocol primer

SIP is a text-based session control protocol; one interaction is called a **transaction**, and a call consists of several transactions. Voice content doesn't travel over SIP — SIP only handles "finding people and connecting"; media goes over RTP (see the port notes in [Network Configuration](/configuration/network)).

### The standard transactions of a call

| Message | Direction | Role |
| ---- | ---- | ---- |
| `INVITE` | Caller → callee | Initiates the call, carrying SDP (the media address and codec offer) |
| `100 Trying` | Callee → caller | Received, processing (suppresses INVITE retransmits) |
| `180 Ringing` | Callee → caller | Ringing; the caller hears ringback tone |
| `200 OK` | Callee → caller | Answered, carrying the SDP answer |
| `ACK` | Caller → callee | Confirms the 200 OK; the INVITE transaction completes and bidirectional media starts |
| `BYE` | Either side | Hangs up an established session |
| `CANCEL` | Caller | Cancels an unanswered INVITE |

Non-session transactions:

| Message | Purpose |
| ---- | ---- |
| `REGISTER` | An extension registers its contact address with FreeSWITCH |
| `OPTIONS` | Keepalive probing, capability queries |
| `SUBSCRIBE` / `NOTIFY` | Event subscriptions: presence, MWI, etc. |
| `INFO` | Pass signaling mid-call (e.g. DTMF via SIP INFO) |

### Registration: REGISTER and the 401 challenge

A REGISTER on an untrusted network must be authenticated; the flow is the standard HTTP Digest:

1. The extension sends `REGISTER`;
2. FreeSWITCH replies `401 Unauthorized`, carrying a random nonce;
3. The extension computes the digest from "username:domain:password" and resends the REGISTER with an `Authorization` header;
4. On success, FreeSWITCH replies `200 OK`; calls to that address from then on are routed to this extension.

The nonce has a TTL (the profile's `nonce-ttl`, default 60 seconds); once expired, the challenge restarts, preventing replay.

### Observing SIP: siptrace

The first step of any SIP troubleshooting is always to look at the messages:

```bash
fs_cli -x "sofia global siptrace on"    # Turn on SIP message tracing for all profiles
fs_cli -x "sofia global siptrace off"
fs_cli -x "sofia loglevel all 9"        # sofia-sip stack logs (levels 0-9; remember to drop back to 0 after)
```

## mod_sofia overview

`mod_sofia` is built on the sofia-sip protocol stack and is FreeSWITCH's SIP endpoint module. It listens on the network in units called **profiles**; each profile is a set of "listen address + parameters", backed by a config file at `conf/sip_profiles/<name>.xml`. The vanilla default config defines two profiles:

| Profile | File | Role |
| ---- | ---- | ---- |
| `internal` | `sip_profiles/internal.xml` | Accepts extension registrations and internal calls, port `$${internal_sip_port}` (default 5060) |
| `external` | `sip_profiles/external.xml` | Connects to carriers/gateways, port `$${external_sip_port}` (default 5080); gateways are defined in its subdirectory `sip_profiles/external/*.xml` (the gateway module) |

Call targets are written as endpoint URIs, used by `bridge` in the dialplan:

- `sofia/internal/1002` — call extension 1002 via the internal profile;
- `sofia/gateway/carrier1/10086` — call an outside number via the carrier1 gateway;
- `sofia/internal/sip:1002@192.168.1.20:5060` — specify a SIP address directly.

### Common status commands

```bash
fs_cli -x "sofia status"                             # Profile overview
fs_cli -x "sofia status profile internal"            # Runtime parameters: port, IP, ACL, codecs
fs_cli -x "sofia status profile internal reg"        # List of registered extensions
fs_cli -x "sofia status profile internal user 1000@pbx.example.com"
fs_cli -x "sofia status gateway carrier1"            # Gateway registration status (gateway module)
fs_cli -x "sofia_contact 1000@pbx.example.com"       # Look up the contact address an extension registered
```

The return value of `sofia_contact` (something like `sofia/internal/sip:1002@192.168.1.20:5060;...`) can be fed straight into `bridge`; it's the official way to translate "an extension number" into "a reachable address".

## Key parameters of the internal / external profiles

All parameters are written as `<param name="..." value="..."/>` in the profile file. First, a common set for internal (see the comments bundled with `sip_profiles/internal.xml` for the full list):

```xml
<profile name="internal">
  <!-- Listening and routing -->
  <param name="sip-port" value="$${internal_sip_port}"/>
  <param name="dialplan" value="XML"/>
  <param name="context" value="public"/>
  <!-- NAT: the address advertised outward; required for public deployments -->
  <param name="ext-sip-ip" value="$${external_sip_ip}"/>
  <param name="ext-rtp-ip" value="$${external_rtp_ip}"/>
  <!-- Authentication -->
  <param name="auth-calls" value="$${internal_auth_calls}"/>
  <param name="challenge-realm" value="auto_from"/>
  <param name="nonce-ttl" value="60"/>
  <param name="apply-inbound-acl" value="domains"/>
  <!-- Codec preferences -->
  <param name="inbound-codec-prefs" value="$${global_codec_prefs}"/>
  <param name="outbound-codec-prefs" value="$${outbound_codec_prefs}"/>
  <param name="inbound-codec-negotiation" value="generous"/>
  <param name="inbound-late-negotiation" value="true"/>
  <!-- Keepalive and timeouts -->
  <param name="rtp-timeout-sec" value="300"/>
  <param name="rtp-hold-timeout-sec" value="1800"/>
</profile>
```

Quick reference for common parameters:

| Parameter | Role |
| ---- | ---- |
| `sip-port` / `dialplan` / `context` | Listen port; dialplan type; the context unauthenticated inbound calls enter |
| `sip-ip` / `rtp-ip` | This host's SIP and RTP addresses for sending/receiving |
| `ext-sip-ip` / `ext-rtp-ip` | SIP/RTP addresses advertised outward behind NAT (see [Network Configuration](/configuration/network)) |
| `apply-inbound-acl` / `apply-register-acl` | Inbound admission ACLs; see "ACL" below |
| `local-network-acl` | Determines whether the peer belongs to the local network (affects NAT detection); default `localnet.auto` |
| `auth-calls` | Whether inbound calls require authentication; extension registration always requires it |
| `challenge-realm` | The realm used for the 401 challenge; `auto_from` means take the realm from the From header |
| `nonce-ttl` | TTL of the Digest nonce (seconds) |
| `accept-blind-reg` / `accept-blind-auth` | Accept any registration/authentication — off by default, **don't turn it on** |
| `disable-register` | Disable registration for this profile entirely (for pure-trunk profiles) |
| `log-auth-failures` | Write authentication failures to the log |
| `max-recv-requests-per-second` | Per-profile receive rate limit; replies 503 when exceeded (anti-scan flood) |
| `inbound-codec-prefs` / `outbound-codec-prefs` | Codecs offered on the receive/send direction (media processing module) |
| `inbound-codec-negotiation` | `generous` is lenient, `greedy` is strict |
| `inbound-late-negotiation` | Enter the dialplan before deciding the codec; pairs with `absolute_codec_string` |
| `rtp-timeout-sec` / `rtp-hold-timeout-sec` | How long an RTP gap takes to trigger a disconnect / hold timeout |
| `aggressive-nat-detection` | More aggressive NAT detection |
| `ws-binding` / `wss-binding` | WebSocket listen ports for WebRTC (`:5066` / `:7443`) |
| `tls` / `tls-only` | Whether to enable SIPS/TLS, and whether to accept only TLS |

The default division of labor between internal and external: external has `context` set to `public`, `auth-calls` set to `false` (inbound calls are trusted by IP and routing), `manage-presence` turned off, and it defines gateways in a subdirectory; internal faces extensions, where both registration and calls require authentication.

### How to make parameter changes take effect

```bash
fs_cli -x "reloadxml"                          # First pull the XML into memory
fs_cli -x "sofia profile internal rescan"      # Smooth rescan (gateways, most parameters)
fs_cli -x "sofia profile internal restart"     # A profile restart is required when changing the listen address/port
```

`sofia profile <name> [start | stop | restart | rescan]`; `rescan` doesn't interrupt registrations, but changing listen parameters like port, IP, or TLS requires `restart`.

## Registration and authentication

### Extension accounts: directory

Extensions are defined under `conf/directory/<domain>/`, one file per extension (`1000.xml`):

```xml
<include>
  <user id="1000">
    <params>
      <param name="password" value="$${default_password}"/>
      <param name="a1-hash" value="…"/>
      <param name="vm-password" value="1000"/>
    </params>
    <variables>
      <variable name="user_context" value="default"/>
      <variable name="toll_allow" value="domestic,international,local"/>
      <variable name="effective_caller_id_number" value="1000"/>
    </variables>
  </user>
</include>
```

- The `password` in `params` is the extension's SIP registration password; the safer approach is to store only `a1-hash` — the MD5 hex value of the `username:realm:password` string — so no plaintext lands in the config file:

  ```bash
  echo -n "1000:pbx.example.com:secret" | md5sum
  ```

  Note that the realm must match the challenge realm at registration time (when `challenge-realm` is `auto_from`, this is the domain from the From header of the REGISTER request).
- `variables` take effect on channels this extension participates in: `user_context` determines which context a registered user's outbound calls enter, and `toll_allow` lets outbound rules check permissions.

After adding or modifying extensions, `fs_cli -x "reloadxml"` makes it take effect; verify registration status with `fs_cli -x "sofia status profile internal reg"`.

### The authentication chain: from ACL to Digest

When a REGISTER or INVITE arrives, mod_sofia processes it in this order:

1. **ACL admission**: if the list specified by `apply-inbound-acl` doesn't pass, the request is rejected outright. Vanilla's `acl.conf.xml` defines a `domains` list — `<node type="allow" domain="$${domain}"/>` scans the directory for users with `cidr=` and auto-generates a whitelist; requests that match are **exempt from password authentication**:

   ```xml
   <list name="domains" default="deny">
     <node type="allow" domain="$${domain}"/>
   </list>
   ```

   After changes, `fs_cli -x "reloadacl"` makes it take effect.
2. **Registration authentication**: REGISTER always goes through the 401 Digest challenge (unless exempted by ACL), comparing `password` or `a1-hash`;
3. **Inbound call authentication**: with `auth-calls=true` (vanilla's `$${internal_auth_calls}` defaults to `true`), INVITEs also require Digest authentication; `inbound-reg-force-matching-username=true` forces the `Authorization` user to match the From user, preventing impersonation of someone else's number.

### Anti-scanning checklist

Port 5060 exposed to the public internet will be continuously probed by scanners; check each of these before going live:

1. **Change the default passwords**: `default_password` in `vars.xml` and each extension's `password` — extensions with weak passwords get registered and abused within minutes;
2. **Tighten ACLs**: `apply-inbound-acl` should only allow trusted subnets; profiles that don't need registration (pure trunks) should just set `disable-register=true`;
3. **Keep failure logs**: `log-auth-failures=true` so you can see scanner sources in `log/freeswitch.log`;
4. **Rate limiting**: `max-recv-requests-per-second` to suppress request floods;
5. **Don't touch the dangerous switches**: keep `accept-blind-reg` and `accept-blind-auth` commented out;
6. **Network-layer backstop**: the firewall should only allow 5060 from trusted addresses, and `8021` (ESL) should never be opened to the public internet (see [Network Configuration](/configuration/network)).

To verify: run `fs_cli -x "sofia global siptrace on"` and have an extension register, then walk through the full 401/200 flow; then check `fs_cli -x "sofia status profile internal reg"` to confirm the contact and expiry.

## Further reading

- [Module Overview](/modules/README) — the module loading mechanism and a categorization overview;
- [Network Configuration](/configuration/network) — SIP/RTP ports, firewall, and NAT parameters;
- [Core Configuration Files](/configuration/core-files) — a detailed look at the `directory/default/1000.xml` extension file;
- [Static Dialplan](/concepts/static-dialplan) — how registered users' outbound calls are routed;
- [Installing on Linux](/installation/linux) — get it installed first, then come back to configure SIP.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [RFC 3263 · SIP DNS records](https://datatracker.ietf.org/doc/html/rfc3263)
- [Wikipedia · Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

<!-- BACKLINKS-AUTO -->
## Related pages

- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [gateway](gateway.md)
- [media](media.md)
