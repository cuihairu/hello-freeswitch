# FreeSWITCH's Basic Configuration

Everything FreeSWITCH does is driven by the XML configuration under the `conf/` directory. Understanding this configuration system is the single most important step in getting started with FreeSWITCH — it decides which modules load, how numbers get routed, and how users register.

## Where the Configuration Directory Lives

| Install method | Configuration path |
| ---- | ---- |
| Source build (default prefix) | `/usr/local/freeswitch/conf` |
| Official deb/rpm packages | `/etc/freeswitch` |
| Windows installer | `C:\Program Files\FreeSWITCH\conf` |

## The Three Main Threads of Configuration

1. **Modules and globals**: `freeswitch.xml` (the root file) + `vars.xml` (global variables) + `autoload_configs/` (per-module configuration; `modules.conf.xml` decides which modules load);
2. **User directory**: `directory/` — extension (SIP account) definitions; the default `1000-1019` and so on live under `directory/default/`;
3. **Routing and trunks**: `dialplan/` (dial plans, which decide where a number goes) + `sip_profiles/` (SIP profiles, which decide where FreeSWITCH sends and receives SIP — which address and port).

## Making Configuration Take Effect

After you edit XML, you must reload for the changes to apply:

```bash
# Re-parse and reload all XML configuration
fs_cli -x "reloadxml"

# Common per-domain reloads
fs_cli -x "reloadacl"                 # ACL lists
fs_cli -x "sofia profile internal restart"   # Restart the SIP profile (after changing sip_profiles)
fs_cli -x "reload mod_conference"     # Reload a single module (reload does the unload-then-load semantics)
```

> For `sip_profiles`, use `sofia profile <name> rescan` to do a graceful rescan; changing core parameters like the listening address or port requires `restart`.

## Configuration Record Index

- [Configuration File Structure](/configuration/config-files) — item-by-item tour of the `conf/` directory and the loading mechanism;
- [Core Configuration Files](/configuration/core-files) — a deep dive into `freeswitch.xml`, `vars.xml`, and `modules.conf.xml`;
- [Network Settings](/configuration/network) — ports, firewall, and NAT.

Once the basic configuration is in place, read [Core Concepts](/concepts/session) to understand how a call flows inside FreeSWITCH.

## References

- [SignalWire · FreeSWITCH Documentation](https://developer.signalwire.com/freeswitch/)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](/installation/README.md)
- [linux](/installation/linux.md)
- [windows](/installation/windows.md)
- [scenarios](/introduction/scenarios.md)
