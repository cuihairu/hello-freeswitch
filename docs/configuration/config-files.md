# Configuration File Structure

FreeSWITCH configuration is a tree built on an XML skeleton: the root file `freeswitch.xml` uses preprocessor directives to "assemble" the other XML files, and at startup everything is parsed once into an in-memory configuration model.

This page records the configuration directory structure and the loading relationships; for the fields and operations on the commonly used files, see [Core Configuration Files](/configuration/core-files), and for a per-file reference of the vanilla template, see [Configuration File Reference](/appendix/configuration-files). The three pages emphasize different things and complement each other.

## The `conf/` Directory at a Glance

Taking a source install (prefix `/usr/local/freeswitch`) as an example:

```
conf/
├── freeswitch.xml          # Root config: assembles the other files, defines the global sections
├── vars.xml                # Global variable definitions ($${...})
├── mime.types              # File-type table for the built-in HTTP service
├── dialplan/               # Dial plans
│   ├── default.xml         # Main file for the default context
│   ├── default/            # Fragments <include>d in by default.xml (demo extensions, etc.)
│   ├── public.xml          # Public context (inbound calls from outside)
│   ├── public/             # Fragments for the public context
│   ├── features.xml        # Feature codes (call transfer and similar codes)
│   ├── skinny-patterns.xml # SCCP feature patterns
│   └── skinny-patterns/    # Fragments for SCCP feature patterns
├── directory/              # User directory (SIP extension accounts)
│   ├── default.xml         # Definition of the default domain
│   └── default/            # 1000.xml, 1001.xml ... one file per extension
├── sip_profiles/           # SIP profiles
│   ├── internal.xml        # Internal profile (default 5060, takes extension registrations)
│   ├── internal-ipv6.xml   # IPv6 variant of the internal profile
│   ├── external.xml        # External profile (default 5080, connects to carriers/gateways)
│   ├── external-ipv6.xml   # IPv6 variant of the external profile
│   ├── external/           # External gateway definitions (gw1.xml ...)
│   └── external-ipv6/      # IPv6 external gateway definitions
├── autoload_configs/       # Autoload configuration for each module
│   ├── modules.conf.xml    # ★ Decides which modules load at startup
│   ├── acl.conf.xml        # Access control lists
│   ├── conference.conf.xml # Conference parameters
│   ├── voicemail.conf.xml  # Voicemail
│   ├── lua.conf.xml        # Lua runtime
│   └── ...
├── ivr_menus/              # IVR menu definitions
├── chatplan/               # Chat plan (mod_dptools' chat application)
├── skinny_profiles/        # SCCP phone profiles (only needed with mod_skinny)
└── lang/                   # Multilingual prompt phrases (Phrase)
```

The template also ships a handful of example and template files (`config.FS0`, `extensions.conf`, `fur_elise.ttml`, `tetris.ttml`, `voicemail.tpl`, `web-vm.tpl`, and so on); they are for demonstration only and can be deleted in a production deploy. The vanilla template has no TLS certificate directory: to enable TLS/WSS, generate a self-signed certificate with `scripts/gentls_cert` and place it in the certificate directory (default `conf/tls`; configure's `--with-certsdir` can change it).

Under different install methods, some subdirectories may be absent, but the six core items — `freeswitch.xml`, `vars.xml`, `dialplan/`, `directory/`, `sip_profiles/`, `autoload_configs/` — are always present.

## Loading Mechanism: freeswitch.xml and the Preprocessor

`freeswitch.xml` is the single entry point. At startup it first goes through the preprocessor (X-PRE-PROCESS), which textually splices in the declared files, before handing the result to the XML parser:

```xml
<document type="freeswitch/xml">
  <X-PRE-PROCESS cmd="include" data="vars.xml"/>
  <section name="configuration" description="Configuration">
    <X-PRE-PROCESS cmd="include" data="autoload_configs/*.conf.xml"/>
  </section>
  <section name="dialplan" description="Dial Plan">
    <X-PRE-PROCESS cmd="include" data="dialplan/*.xml"/>
  </section>
  <section name="directory" description="Directory">
    <X-PRE-PROCESS cmd="include" data="directory/*.xml"/>
  </section>
</document>
```

Key points:

- `X-PRE-PROCESS` runs **before parsing** and supports two `cmd` values: `include` (splice in a file) and `set` (define a preprocessor variable);
- Preprocessor variables are written as `$${name}` and can be referenced at run time as `${name}` (for the difference, see [Core Configuration Files](/configuration/core-files));
- Because it is text splicing, `X-PRE-PROCESS` cannot be "commented out" by putting it inside an XML comment — it still takes effect, which is the most common trap for newcomers.

## What Each of the Three Sections Is For

| section | Contents | How changes take effect |
| ---- | ---- | ---- |
| `configuration` | Module configuration (all of autoload_configs) | `reloadxml` + reload the corresponding module |
| `dialplan` | Dial plans | `reloadxml` is enough |
| `directory` | User/extension directory | `reloadxml` (optionally `sofia profile internal rescan` for the registration cache) |

After `reloadxml`, the configuration is in memory, but **established calls are unaffected** — that is the boundary of hot updates; changing a SIP profile's listening parameters and similar still requires restarting the corresponding profile.

## How to Organize New Content Across the Directory Files

Practical conventions:

- Adding an extension: drop `1020.xml` into `directory/default/` (copy `1000.xml`, change the password/number), then `reloadxml` to apply;
- Adding a LAN gateway: add a gateway XML under `sip_profiles/external/`, then load it with `fs_cli -x "sofia profile external rescan"`;
- Adding a dialing rule: prefer a standalone fragment under `dialplan/default/` (e.g. `90-myapp.xml`) and use the filename prefix to control match order — `default.xml` merges files in the `<X-PRE-PROCESS>` include order, so a smaller number matches first.

## Related Records

- [Core Configuration Files](/configuration/core-files): field notes on the three core files;
- [Network Settings](/configuration/network): profile listening and NAT;
- [Static Dial Plan](/concepts/static-dialplan): start writing your first routing rule.

## References

- [SignalWire · FreeSWITCH Documentation](https://developer.signalwire.com/freeswitch/)
- [Wikipedia · FreeSWITCH](https://en.wikipedia.org/wiki/FreeSWITCH)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [configuration-files](/appendix/configuration-files.md)
- [README](README.md)
- [core-files](core-files.md)
- [windows](/installation/windows.md)
- [knowledge](/knowledge.md)
- [README](/modules/README.md)
- [conference](/modules/conference.md)
- [ivr](/modules/ivr.md)
