# Deployment and Operations

Running on a dev box is not the same as going to production. I have organized the decisions and checks I hit when taking the intelligent customer service system live, following the order "single node -> multi node -> monitoring and alerting -> troubleshooting." Commands assume FreeSWITCH 1.11.3 with a source install prefix of `/usr/local/freeswitch` (swap in the prefix for other install methods).

## Single-Node Deployment

### Directory Layout

Directory layout after a source install (`$${...}` variables are defined in `conf/vars.xml`):

```
/usr/local/freeswitch/
├── bin/         executables such as freeswitch and fs_cli
├── conf/        all configuration (structure in Appendix A)
├── db/          core database (core db, SQLite by default)
├── log/         logs and CDR (freeswitch.log, cdr-csv/)
├── recordings/  recordings ($${recordings_dir})
├── scripts/     Lua scripts ($${script_dir})
├── sounds/      prompts and hold music
├── grammar/     speech recognition grammar files
├── htdocs/      static directory for the built-in HTTP service
└── lang/        multi-language phrases (Phrase)
```

Planning advice:

- **Store recordings separately**: recordings grow fastest, point `recordings/` at a dedicated mount (change `$${recordings_dir}`), so filling the system disk does not drag down `db/` and `log/`;
- **Put `db/` on a fast local disk**: the core db records channel state and is I/O-heavy, so do not put it on a network filesystem;
- **Put config under version control**: commit the whole `conf/` tree to Git (put passwords in a private repo or inject them at deploy time) — rollback and audit both depend on this;
- **Runtime account**: create a dedicated `freeswitch` system user, `chown -R freeswitch:freeswitch` the directories above, and do not run as root.

### systemd Service

The official source tree ships a unit template (`build/freeswitch.service`; Debian packaging also has `debian/freeswitch-systemd.freeswitch.service`). For a source install you can use it as a reference and adjust paths as needed:

```ini
# /etc/systemd/system/freeswitch.service
[Unit]
Description=FreeSWITCH
After=network.target

[Service]
# The official template defaults to foreground ( -nc -nf ); systemd can manage it with the default Type=simple;
# if you compiled with --enable-systemd, you can use Type=notify.
User=freeswitch
Group=freeswitch
EnvironmentFile=-/etc/sysconfig/freeswitch
WorkingDirectory=/run/freeswitch
ExecStart=/usr/local/freeswitch/bin/freeswitch -nc -nf $FREESWITCH_PARAMS
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
LimitNOFILE=100000
LimitNPROC=60000
LimitCORE=infinity
UMask=0007

[Install]
WantedBy=multi-user.target
```

Two small supporting pieces:

```bash
# /etc/tmpfiles.d/freeswitch.conf —— create the runtime directory before startup (see build/freeswitch-tmpfiles.conf in the source tree)
d /run/freeswitch 0750 freeswitch freeswitch -

# /etc/sysconfig/freeswitch —— centralize startup parameters
FREESWITCH_PARAMS="-nonat"
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now freeswitch
sudo systemctl status freeswitch
```

Common startup flags: `-nc` no console, `-nf` run in the foreground (with systemd), `-ncwait` daemonize and wait for startup to finish, `-nonat` disable NAT probing, `-u`/`-g` set the runtime user/group, `-conf`/`-log`/`-db`/`-run` override the default directories.

### Pre-Release Security Checklist

FreeSWITCH exposed to the network is scanned constantly. Every item below comes from a real incident:

1. **Change the default extension passwords**. In `conf/vars.xml`, `default_password=1234`, and the `password` in the extension files is also `1234` — on a public-facing machine it gets registered and used for toll fraud within minutes. Change to strong random passwords and give each handset a separate password;
2. **Change the ESL password and tighten listening**. The `password` in `autoload_configs/event_socket.conf.xml` defaults to `ClueCon`; for an internal-network deployment pin `listen-ip` to `127.0.0.1` and use SSH tunneling for remote administration; if you really need remote connections, configure an `apply-inbound-acl` allowlist;
3. **Configure ACLs**. Define trusted subnets in `autoload_configs/acl.conf.xml`, wire them up through the profile's `apply-inbound-acl` / `apply-register-acl`, and take effect with `fs_cli -x "reloadacl"` (see [Network Configuration](/configuration/network));
4. **Minimize firewall openings**. Open only the ports the business needs: 5060/UDP+TCP and the RTP port range (default 16384-32766/UDP); never open 8021 to the public internet;
5. **Clean up demo configuration**. Delete or tighten the demo extensions (1000-1019) and `public` context sample routes in the vanilla templates, and comment out unused modules in `modules.conf.xml`;
6. **Enable TLS/SRTP as needed**. The `tls` and `wss-binding` (WebRTC) parameters of the `internal` profile, paired with the certificates under `conf/tls/`;
7. **Add brute-force protection**. Use fail2ban or similar to watch the registration failure logs, or enable `log-auth-failures` on the `internal` profile to ease collection;
8. **Limit sessions and rate**. Set `max-sessions` and `sessions-per-second` in `autoload_configs/switch.conf.xml` to match capacity, so abnormal traffic cannot fill the box.

## Multi-Node Deployment

When a single node cannot meet agent count, call concurrency, or availability requirements, scale out to multiple nodes. The core questions are three: registration (who can pick up incoming calls), media (where the audio flows), and data (where CDR and recordings go).

### Registration and Directory Sharing

Let any node handle incoming calls and extensions:

- **Directory as a service (recommended)**: use `mod_xml_curl` to point the `directory` section at a business backend, with all extension accounts coming from a database — the node itself is stateless (see [Dynamic Dialplan](/concepts/dynamic-dialplan) for the syntax);
- **Shared registration store**: configure `odbc-dsn` on the profile to write registration info to a shared database (PostgreSQL/ODBC), so nodes can see each other's registrations; you can also move the core db out using `core-db-dsn` in `switch.conf.xml` (the connection string supports `pgsql://`, `mariadb://`, or `dsn:user:password`), and in a cluster you can also set `switchname` so multiple nodes share the same configuration without clobbering each other's hostnames;
- **Incoming call distribution**: the trunk side (the carrier or SBC) distributes incoming calls to the nodes by policy, rather than every node hanging off the same trunk.

### Media and Network

- Run RTP between nodes, and between nodes and agents, over the **internal network or a dedicated line** as much as possible; when crossing the public internet, use a VPN (WireGuard/IPsec) or deploy an SBC, to avoid one-way audio from NAT traversal issues;
- Nodes with a public address must configure the profile's `ext-sip-ip`/`ext-rtp-ip` correctly, and open the RTP port range in the cloud security group;
- In scenarios with an obvious media bottleneck, evaluate enabling `bypass_media` (media bypass — FreeSWITCH only controls signaling), but weigh it against recording and monitoring needs — once bypassed FreeSWITCH cannot see the media, so recording and ASR both stop working.

### Load Balancing

| Approach | How | Fits |
| ---- | ---- | ---- |
| DNS SRV | The domain returns multiple SRV records; endpoints/trunks distribute themselves | Mid-size deployments, small change footprint |
| SIP proxy in front | Kamailio/OpenSIPS as dispatcher to distribute to backend FreeSWITCH | Mid-to-large, needs health checks and stickiness |
| TCP load balancing | HAProxy/LVS forwards 5060 in TCP mode | Simple distribution; watch registration stickiness and source address |
| Application-layer assignment | The backend picks which node's ESL to `originate` through, by number range or agent group | Most direct for intelligent customer service outbound calling |

Rule of thumb: **use a front proxy to balance registration and incoming calls; have the business backend distribute outbound and agent assignment over ESL connections**. When you need to transfer across nodes, prefer landing both legs on the same node (the transfer target follows the original node) to avoid shuffling media across nodes.

### CDR and Data Sharing

- `mod_cdr_csv`: local CSV, writes to `log/cdr-csv/` by default; good for small scale plus centralized collection;
- `mod_cdr_pg_csv`: writes directly to PostgreSQL; multiple nodes share one table, and querying/aggregating is easy;
- `mod_xml_cdr`: POSTs the CDR as XML to a collector service, which stores it — most flexible;
- Name recording files by "node name + UUID" or write them straight to object storage, and correlate them with the UUID in the CDR table.

Whichever you pick, make sure **one call = one CDR = one unique UUID**, and tie cross-node transfers together with that UUID.

## Monitoring and Alerting

### `fs_cli` Patrol Commands

Daily patrol and alert collection can be built entirely on these commands:

| Command | What it shows |
| ---- | ---- |
| `status` | Uptime, current session count, SPS |
| `show channels count` | Current channel count (main source of alert thresholds) |
| `show calls count` | Number of calls currently bridged |
| `show registrations` | Number of registered extensions (basis for agent online rate) |
| `sofia status` | Whether each profile is running |
| `sofia status profile internal` | Detailed counters: SESSIONS, Registrations, failure counts, etc. |
| `show modules` | Whether key modules (event_socket, sndfile, etc.) are loaded |
| `fsctl loglevel err` | Temporarily raise the log level to reduce troubleshooting noise |

### ESL Event Monitoring Script

You can build minimal monitoring by subscribing to core heartbeat events with the standard library (protocol syntax is the same as [Dynamic Dialplan](/concepts/dynamic-dialplan)):

```python
# fs_watch.py — subscribe to HEARTBEAT, alert when thresholds are exceeded (standard library implementation)
import json
import socket
import time
import urllib.request

HOST, PORT, PASSWORD = ("127.0.0.1", 8021, "ClueCon")
ALERT_WEBHOOK = "http://ops.internal/hooks/fs-alert"
MAX_SESSIONS = 400


def read_message(f):
    headers, body = {}, b""
    line = f.readline()
    while line not in (b"\n", b"\r\n"):
        k, _, v = line.decode(errors="replace").partition(":")
        headers[k.strip().lower()] = v.strip()
        line = f.readline()
    if "content-length" in headers:
        body = f.read(int(headers["content-length"]))
    return headers, body


def alert(text):
    try:
        req = urllib.request.Request(
            ALERT_WEBHOOK,
            data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except OSError:
        pass


def main():
    while True:
        try:
            s = socket.create_connection((HOST, PORT), timeout=5)
            f = s.makefile("rwb")
            read_message(f)                                   # auth/request
            f.write(f"auth {PASSWORD}\r\n\r\n".encode()); f.flush()
            read_message(f)
            f.write(b"event plain HEARTBEAT\r\n\r\n"); f.flush()
            read_message(f)
            while True:
                headers, body = read_message(f)
                if headers.get("content-type") != "text/event-plain":
                    continue
                fields = {}
                for line in body.decode(errors="replace").splitlines():
                    k, sep, v = line.partition(": ")
                    if sep:
                        fields[k.strip()] = v.strip()
                count = int(fields.get("Session-Count", "0") or 0)
                if count > MAX_SESSIONS:
                    alert(f"FreeSWITCH session count too high: {count}")
        except OSError as exc:
            alert(f"FreeSWITCH ESL connection failed: {exc}")
        time.sleep(10)


if __name__ == "__main__":
    main()
```

The `HEARTBEAT` event is emitted periodically by the core and carries counters like `Session-Count` and `Session-Per-Sec`, which makes it ideal for non-intrusive capacity alerting; pair it with `event plain CHANNEL_HANGUP_COMPLETE` to tally call volume and you can plot a traffic curve.

### Log Rotation

Two layers working together:

- **In-module rotation**: in `autoload_configs/logfile.conf.xml`, use `rollover` (roll by byte count), `maximum-rotate` (number of copies to keep; once enabled, file names no longer carry a date stamp), and `rotate-on-hup` (roll on a HUP signal, on by default);
- **System logrotate**: split by day and compress, and in `postrotate` notify the module to reopen the file with `fsctl send_sighup` (this command triggers the same rotation logic as the HUP signal):

```
/usr/local/freeswitch/log/freeswitch.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        /usr/local/freeswitch/bin/fs_cli -x "fsctl send_sighup" >/dev/null 2>&1 || true
    endscript
}
```

CDR and recordings need rotation and archival too: package CSV/recordings by day, upload to object storage, then clean up locally; back up the `db/` directory periodically (the core db can be maintained with `fsctl`-related commands during low-traffic periods, or backed up in a no-write window).

## Common Errors and Troubleshooting

### Registration Fails

**Symptoms**: the handset keeps failing to register, and the extension does not appear in `show registrations`.

1. Confirm the profile is running: `fs_cli -x "sofia status"`, then check the `Registrations` counter in `sofia status profile internal`;
2. Turn on signaling tracing and register again: `fs_cli -x "sofia profile internal siptrace on"`, and observe whether REGISTER arrives and what code is returned;
3. Locate by return code:
   - **No REGISTER received at all**: the firewall/security group is not allowing 5060, or `apply-inbound-acl` rejected the source IP (look for ACL rejection entries in the logs);
   - **Repeated 401/403**: password mismatch (`default_password` in `vars.xml` versus the `password` in the extension file), or `challenge-realm` does not match the domain configured on the handset;
   - **404**: the extension is not in the directory — you added the extension but forgot `reloadxml`, or `domain` does not match the registration domain;
4. After changing configuration, run `fs_cli -x "reloadxml"` first, and `sofia profile internal rescan` if needed;
5. If it still fails, turn on `sofia loglevel all 9` to capture full Sofia logs, and remember to turn it off after.

### One-Way Audio (one side cannot hear the other)

**Symptoms**: the call connects, but only one side hears audio, or neither side hears anything.

1. Determine direction: can the caller hear the callee, or vice versa — have each end say a sentence to confirm;
2. Capture RTP on the server: `tcpdump -ni any udp portrange 16384-32766 -c 100`, and check whether traffic flows both directions;
3. Only one direction has flow → classic NAT/firewall issue: check `Ext-RTP-IP` in `sofia status profile internal`, confirm the cloud security group allows the RTP port range, and check the NAT settings on the endpoint;
4. No RTP at all → SDP negotiation failed or codec unsupported: use `show codecs` to confirm a common codec on both sides, and check the profile's `inbound-codec-prefs`; for WebRTC interoperability with plain SIP, also confirm DTLS/SRTP-related configuration;
5. While troubleshooting, use `uuid_dump <uuid>` to check whether `read_codec`/`write_codec` and `remote_media_ip`/`remote_media_port` on the channel look reasonable.

### Recording Fails

**Symptoms**: the file is not created, or the file is 0 seconds.

1. Check channel variables: after recording, is `record_seconds` 0 (0 means almost nothing was recorded — usually recording started before the channel answered, or the other side was silent and the silence detection cut the recording short early);
2. Check permissions and space: `ls -ld /usr/local/freeswitch/recordings` to confirm the runtime user can write; `df -h` to see whether the disk is full (a full recordings directory can drag down the whole system);
3. Confirm format support: `mod_sndfile` is loaded (see `show modules`), and the file extension matches the actual format;
4. Check that variables in the path are expanded: use `uuid_dump <uuid>` to verify `record_path`-type variables — a path with an unset variable writes to the wrong place or fails outright;
5. Subscribe to the `RECORD_STOP` event (`/event RECORD_STOP` in `fs_cli`) and look at `Record-Filepath` and the error message.

### ESL Cannot Connect

**Symptoms**: `fs_cli` reports a socket error, or the backend cannot connect to 8021.

1. Confirm the module is loaded: if local `fs_cli` can connect, mod_event_socket is running; if not, look at `show modules` and the startup logs for mod_event_socket load entries;
2. Check listening: `ss -lntp | grep 8021`; when `listen-ip` is `127.0.0.1`, remote connections will never work;
3. Check the password: the client `auth` must match the `password` in `event_socket.conf.xml`, default `ClueCon`;
4. Check ACL: when `apply-inbound-acl` is configured, a source IP not on the list is rejected;
5. Port in use: with `stop-on-bind-error` enabled, a port conflict makes the module fail to start — check the logs for a bind error;
6. Firewall: open 8021 only to the internal/admin network, never to the public internet.

## Further Reading

- [Installing on Linux](/installation/linux): source install and dependencies;
- [Network Configuration](/configuration/network): ports, firewall, and NAT;
- [Core Configuration Files](/configuration/core-files): details on vars.xml and modules.conf.xml mentioned here;
- [Appendix A · Configuration File Reference](/appendix/configuration-files): file-by-file reference for the conf/ directory.

## References

- [FreeSWITCH official site](https://freeswitch.org/)
- [GitHub · signalwire/freeswitch](https://github.com/signalwire/freeswitch)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [resources](/appendix/resources.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [implementation](implementation.md)
