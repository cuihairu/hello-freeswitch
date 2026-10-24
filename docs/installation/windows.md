# Installing on Windows

FreeSWITCH official treats Linux as the primary battleground; the Windows build has long shipped as an installer package but its update cadence trails Linux. The Windows environment suits **local experimentation, feature verification, and development debugging**; for production deployment, prefer Linux.

## Choosing an Approach

| Approach | Suitable Scenarios | Notes |
| ---- | ---- | ---- |
| Official Windows installer | Quick experimentation, desktop integration | Graphical install, comes with the `fs_cli.exe` console |
| WSL2 + Linux build | Feature verification, script development | Behavior matches production, **recommended** |
| Source build (Windows) | Deep customization | Requires the Visual Studio toolchain, high complexity |

## Approach 1: Official Windows Installer

1. Get the Windows installer from the FreeSWITCH official download page ([freeswitch.org](https://freeswitch.org/) or the Download entry on the SignalWire developer site [developer.signalwire.com/freeswitch](https://developer.signalwire.com/freeswitch/)), making sure to pick the version that matches your system's bitness;
2. Run the installer; by default it installs to `C:\Program Files\FreeSWITCH`;
3. The installer can optionally register a Windows service — check the box and it will start at boot;
4. Open `fs_cli.exe` in the install directory to verify:

```bat
fs_cli.exe -x "version"
fs_cli.exe -x "status"
```

5. If the first run is blocked by Windows Firewall, choose "Allow access on private networks" — FreeSWITCH needs **5060/udp, 5060/tcp (SIP)** and the **RTP port range 16384-32766/udp (media)** allowed through; see [Network Configuration](/configuration/network) for details.

### Known Limitations

- Version releases of the official Windows build lag, and module coverage is incomplete (TDM and some codec modules are Linux-only);
- Audio device capture/playback depends on mod_portaudio (1.10 and earlier), whose behavior differs from Linux's ALSA/PulseAudio; that module was removed from the source tree starting with 1.11.0;
- Production-grade NAT traversal and performance tuning have no official practice backing on Windows.

## Approach 2: WSL2 (Recommended)

Get a FreeSWITCH on Windows 10/11 that behaves like the Linux one:

```powershell
# PowerShell (administrator)
wsl --install -d Ubuntu
```

Once inside WSL2's Ubuntu, follow the steps in [Installing on Linux](/installation/linux) to do either the repository install or the source build. Inside WSL2 you can use `fs_cli`, Lua scripts, ESL, and all the other features directly, and ports are automatically bridged to the Windows side (WSL2 defaults to NAT; note that the IP in SIP signaling must match the address WSL assigns, or use the mirrored network mode in your configuration).

## Post-Install Verification

Once either approach is installed, verify the same way:

```bat
fs_cli.exe -x "version"
fs_cli.exe -x "show modules"
```

Running `status` inside the console should show an uptime with an active session count of 0 (no calls yet).

## Related Records

- [Basic FreeSWITCH Configuration](/configuration/README): the configuration file system;
- [Configuration File Structure](/configuration/config-files): an item-by-item walkthrough of the `conf/` directory;
- [Network Configuration](/configuration/network): ports, firewall, and NAT.

## References

- [FreeSWITCH official site](https://freeswitch.org/)
- [Files · FreeSWITCH release files](https://files.freeswitch.org/releases/freeswitch/)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [linux](linux.md)
- [scenarios](/introduction/scenarios.md)
