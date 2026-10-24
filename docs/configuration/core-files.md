# Core Configuration Files

This page goes deep on the three files you deal with most: the root file `freeswitch.xml`, the global variables `vars.xml`, and the module load list `autoload_configs/modules.conf.xml`.

Here I record the meaning of key file fields and the checks to run after operating on them; for the `conf/` directory layout and loading relationships, see [Configuration File Structure](/configuration/config-files), and for a per-file reference of the vanilla template, see [Configuration File Reference](/appendix/configuration-files).

## freeswitch.xml: The Root of Configuration

It itself carries almost no business logic and does two things only: assemble the other files, and declare the section layout of the configuration (see [Configuration File Structure](/configuration/config-files)). Day-to-day operations rarely touch it; what gets edited most are the three parts it assembles:

- `vars.xml` — global variables;
- `autoload_configs/*.conf.xml` — module configuration;
- `dialplan/`, `directory/`, `sip_profiles/` — routing, users, and trunks.

## vars.xml: Global Variables and Two Variable Syntaxes

`vars.xml` performs a lot of `$${...}` assignments during the preprocessor phase. A typical fragment:

```xml
<X-PRE-PROCESS cmd="set" data="sound_prefix=$${sounds_dir}/en/us/callie"/>
<X-PRE-PROCESS cmd="set" data="default_password=1234"/>
<X-PRE-PROCESS cmd="set" data="domain_name=$${local_ip_v4}"/>
```

**The difference between `$${var}` and `${var}` is the first hurdle in FreeSWITCH configuration:**

| Syntax | When it evaluates | Scope | Typical use |
| ---- | ---- | ---- | ---- |
| `$${var}` | Preprocess/startup | Global | Startup constants like `sound_prefix`, `domain_name` |
| `${var}` | Every use | Current channel (channel variable) | `${destination_number}`, `${caller_id_number}` |

Key points:

- `$${}` is only re-evaluated on `reloadxml` (or restart); `${}` is evaluated dynamically during a call, reading the channel variable first and falling back to the global `$${}` value if not found;
- Channel variables can be injected by the dial plan `set`, the brace parameters of `originate`, SIP header mapping, and similar paths;
- After changing a `$${}` variable, run `reloadxml`; inside `fs_cli`, `global_getvar` lists all global variables.

## modules.conf.xml: Decides Which Modules Load

`autoload_configs/modules.conf.xml` is the master switch for modules, one line per module:

```xml
<configuration name="modules.conf" description="Modules">
  <load module="mod_console"/>
  <load module="mod_logfile"/>
  <load module="mod_event_socket"/>
  <load module="mod_sofia"/>
  <load module="mod_loopback"/>
  <load module="mod_commands"/>
  <load module="mod_dptools"/>
  <load module="mod_dialplan_xml"/>
  <!-- Comment out modules you don't need -->
  <!-- <load module="mod_voicemail"/> -->
</configuration>
```

- Comment out a `<load>` line and run `reloadxml`; the module will not load on the next start. A module that is already running can be unloaded temporarily: `fs_cli -x "unload mod_voicemail"`;
- Modules depend on each other: `mod_dptools` (the provider of many applications) and `mod_commands` (the provider of many api commands) are effectively mandatory;
- Each module's own parameters live in its own `.conf.xml` (e.g. `mod_sofia`'s profiles are under `sip_profiles/`).

## directory/default/1000.xml: What an Extension Looks Like

The extension file is the key to understanding registration and authentication (excerpts):

```xml
<include>
  <user id="1000">
    <params>
      <param name="password" value="1234"/>
      <param name="vm-password" value="1000"/>
    </params>
    <variables>
      <variable name="toll_allow" value="domestic,international,local"/>
      <variable name="accountcode" value="1000"/>
      <variable name="user_context" value="default"/>
      <variable name="effective_caller_id_name" value="Extension 1000"/>
      <variable name="effective_caller_id_number" value="1000"/>
    </variables>
  </user>
</include>
```

- `password` under `params` is the SIP registration password for that extension — **change the default `1234` before going live**; on a machine exposed to the public internet, weak-password extensions get scan-registered within minutes;
- `user_context` decides which context's dial plan that extension enters when it dials out (default `default`);
- `variables` take effect on the channel of any call the extension participates in, for the dial plan to reference.

## sip_profiles/internal.xml: The Face of SIP

Key parameters excerpted (for the full list, see [Network Settings](/configuration/network)):

```xml
<profile name="internal">
  <param name="context" value="public"/>
  <param name="sip-port" value="$${internal_sip_port}"/>   <!-- Default 5060 -->
  <param name="dialplan" value="XML"/>
  <param name="dtmf-type" value="rfc2833"/>
  <param name="local-network-acl" value="localnet.auto"/>
  <param name="apply-inbound-acl" value="domains"/>
  <param name="ws-binding" value=":5066"/>                 <!-- WebRTC WebSocket -->
  <param name="wss-binding" value=":7443"/>                <!-- WebRTC over TLS -->
</profile>
```

`context` specifies which context under `dialplan/` handles calls coming in through this profile.

## A Checklist After Editing Configuration

1. `fs_cli -x "reloadxml"` — watch the console for XML parse errors;
2. `fs_cli -x "global_getvar domain_name"` (or `global_getvar` to list all global variables) to confirm the value took effect;
3. For changes touching SIP parameters, `fs_cli -x "sofia status profile internal"` to check the running values;
4. Place a test call and `fs_cli -x "show channels"` to observe the channel variables.

## Related Records

- [Network Settings](/configuration/network): getting ports, firewall, and NAT talking;
- [Channel](/concepts/channel): understanding the channel variable model behind `${var}`.

## References

- [SignalWire · FreeSWITCH Documentation](https://developer.signalwire.com/freeswitch/)
- [FreeSWITCH Official Site](https://freeswitch.org/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [events](/advanced/events.md)
- [recording](/advanced/recording.md)
- [scripting](/advanced/scripting.md)
- [configuration-files](/appendix/configuration-files.md)
- [README](README.md)
- [config-files](config-files.md)
- [knowledge](/knowledge.md)
- [README](/modules/README.md)
- [sip](/modules/sip.md)
- [deployment](/project/deployment.md)
