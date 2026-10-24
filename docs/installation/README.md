# Installing FreeSWITCH

FreeSWITCH runs mainly on Linux servers. Here I've recorded the supported platforms, the tradeoffs between the three installation methods, and the install processes for Linux and Windows.

## Supported Platforms

| Platform | Support Level | Notes |
| ---- | ---- | ---- |
| Linux (Debian/Ubuntu/CentOS etc.) | Official primary support | The first choice for production; both the package and source routes are mature |
| FreeBSD / macOS | Official support | Usable for development and special deployments |
| Windows | Usable but not the primary battleground | Official installers have lagged behind in updates in recent years; for local development you can run the Linux version via WSL2 |
| Docker | Community images | Good for a quick taste and orchestrated deployments |

## Choosing Among the Three Installation Methods

1. **Official/SignalWire software repository install** (Linux, recommended for production): you get versions in sync with upstream and the `freeswitch-*` family of packages, with module subpackages installable individually.
2. **Source build** (Linux/macOS, pick this when you need customization): you can freely trim modules (e.g., compile only the codecs and gateway modules you need), and troubleshooting and secondary development also start from here.
3. **Distribution-provided packages**: note — Debian's official repositories no longer carry a freeswitch package (you can verify this directly via [Debian package search](https://packages.debian.org/search?keywords=freeswitch)); treat older articles that rely on distribution packages with caution.

> Reference system requirements: 64-bit Linux, 2+ CPU cores, 2GB+ of memory; voice is real-time media, so in production shut down unrelated processes and configure a static IP for the NIC.

## Post-Install Verification

Whichever method you use, once installation finishes first confirm the version and that the console connects:

```bash
# Default install path for source builds; package installs use /usr/bin/fs_cli
/usr/local/freeswitch/bin/fs_cli -x "version"
```

Expected output looks like `FreeSWITCH Version 1.11.x ...` (depending on the installed version). Then use `fs_cli` to enter the console (pressing Enter brings up the `freeswitch@...>` prompt), run `status` to check the running state, and exit with `bye` or `Ctrl+D`.

## Install Record Index

- [Installing on Linux](/installation/linux): two complete routes — official repository and source build;
- [Installing on Windows](/installation/windows): installer package and WSL2 approaches.

Once installation is done, move on to [Basic FreeSWITCH Configuration](/configuration/README).

## References

- [FreeSWITCH official site](https://freeswitch.org/)
- [Files · FreeSWITCH release files](https://files.freeswitch.org/releases/freeswitch/)
- [GitHub · signalwire/freeswitch releases](https://github.com/signalwire/freeswitch/releases)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [what-is-freeswitch](/introduction/what-is-freeswitch.md)
