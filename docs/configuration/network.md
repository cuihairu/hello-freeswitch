# Network Settings

A voice call is two streams of traffic: signaling (SIP) and media (RTP). The "registration is fine but I hear no sound" and "external callers can't get in" problems I have debugged mostly come down to network settings; here I record my configuration experience with ports, firewall, and NAT.

## Default Port List

| Port | Protocol | Purpose |
| ---- | ---- | ---- |
| 5060 | UDP/TCP | SIP (internal profile, extension registration and calls) |
| 5061 | TCP/TLS | SIP over TLS (internal, requires a certificate to enable, off by default) |
| 5066 | TCP | SIP over WebSocket (WebRTC) |
| 7443 | TCP/TLS | SIP over WSS (WebRTC encrypted) |
| 5080 | UDP/TCP | SIP (external profile, connects to carriers/gateways) |
| 5081 | TCP/TLS | SIP over TLS (external profile, off by default) |
| 8021 | TCP | ESL event socket (**local management only**) |
| 16384-32766 | UDP | RTP media port range |

Ports are defined in two places: variables like `$${internal_sip_port}` in `vars.xml`, and each profile (the `sip-port`, `ws-binding`, and so on in `sip_profiles/internal.xml`).

## Opening the Firewall

Using `ufw` as an example (iptables/firewalld work the same way; only open what you actually use):

```bash
sudo ufw allow 5060/udp
sudo ufw allow 5060/tcp
sudo ufw allow 5061/tcp
sudo ufw allow 5066/tcp     # Only open if using WebRTC
sudo ufw allow 7443/tcp     # Only open if using WebRTC
sudo ufw allow 16384:32766/udp
sudo ufw status
```

Key points:

- **Open the RTP port range in full**, and keep it consistent with `rtp-start-port`/`rtp-end-port` in `autoload_configs/switch.conf.xml` (source installs default to 16384-32766; these two parameters are commented out by default — uncomment them to narrow the range);
- **Never** expose 8021 (ESL) to the public internet; `fs_cli` is fine over a local connection, and for remote management use an SSH tunnel;
- When connecting to a carrier, open the external profile's 5080 (cleartext) / 5081 (TLS, off by default) and the peer IP whitelist as needed.

## NAT: Key Parameters for Public Deployment

When FreeSWITCH sits behind NAT (a cloud server with a public IP doesn't count, and neither does a local machine talking to a LAN client), you must give the peer a **publicly reachable address**. The core parameters in `sip_profiles/internal.xml`:

```xml
<!-- The SIP address announced externally: put the public IP, or use STUN discovery -->
<param name="ext-sip-ip" value="203.0.113.10"/>
<!-- The RTP address announced externally: put the public IP too -->
<param name="ext-rtp-ip" value="203.0.113.10"/>
```

- If the public IP is dynamic, you can write `value="stun:stun.freeswitch.org"` and let FreeSWITCH discover it (requires opening outbound UDP 3478);
- `$${external_rtp_ip}` and `$${external_sip_ip}` are defined in `vars.xml` and referenced as `$${}` in the profile — changing the public IP usually means editing vars.xml in just one place;
- Typical symptoms of media not flowing: you hear busy tone/ringback, then one-way audio or total silence after connection — check `ext-rtp-ip` and the RTP port range firewall first;
- Cloud servers (e.g. AWS/VPC) with a public IP that is mapped through NAT also need the `ext-*` parameters configured, and you must confirm the security group opens the port range.

## ACL: Who Can Connect In

`autoload_configs/acl.conf.xml` defines access control lists, and a profile attaches one with `apply-inbound-acl`. The built-in `localnet.auto` only allows the subnet the machine is on:

```xml
<list name="workphones" default="deny">
  <node type="allow" cidr="192.168.1.0/24"/>
  <node type="allow" cidr="10.8.0.0/16"/>
</list>
```

```xml
<!-- sip_profiles/internal.xml -->
<param name="apply-inbound-acl" value="workphones"/>
```

After editing, `fs_cli -x "reloadacl"` applies it. **On a machine exposed to the public internet, be sure to tighten the ACL and change the default extension passwords** — port 5060 on the public internet is continuously probed by scanners attempting registration.

## Verifying the Network Configuration

```bash
# View the profile's runtime addresses
fs_cli -x "sofia status profile internal"

# Compare these key output fields:
#   SIP-Port: 5060
#   Ext-RTP-IP / Ext-SIP-IP: should be the public address (in a NAT environment)
#   RTP-Start-Port / RTP-End-Port: should match the firewall
```

After placing a test call, use `fs_cli -x "show channels"` to observe, then on the server run `tcpdump -ni any udp portrange 16384-32766` to confirm RTP traffic is actually flowing in and out.

## Related Records

Once networking is working, move on to [Core Concepts](/concepts/session) — sessions, calls, channels, and dial plans — to understand the complete journey of a single call inside FreeSWITCH.

## References

- [RFC 3261 · SIP](https://datatracker.ietf.org/doc/html/rfc3261)
- [RFC 3263 · SIP DNS records](https://datatracker.ietf.org/doc/html/rfc3263)
- [Wikipedia · Session Initiation Protocol](https://en.wikipedia.org/wiki/Session_Initiation_Protocol)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [config-files](config-files.md)
- [core-files](core-files.md)
- [glossary](/glossary.md)
- [linux](/installation/linux.md)
- [windows](/installation/windows.md)
- [knowledge](/knowledge.md)
- [gateway](/modules/gateway.md)
- [sip](/modules/sip.md)
- [README](/project/README.md)
- [asr-tts](/project/asr-tts.md)
- [deployment](/project/deployment.md)
