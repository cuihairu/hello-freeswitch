# Installing on Linux

Linux is FreeSWITCH's preferred production platform. Two routes are recommended: **official software repository install** (hassle-free, upgrades along with the package manager) and **source build** (trimmable, open to secondary development).

## Method 1: Official Software Repository Install

FreeSWITCH official (SignalWire) provides apt/yum repositories for Debian/Ubuntu and the RHEL family, containing the `freeswitch` main program and `freeswitch-mod-*` module subpackages. For the latest repository URLs and GPG key instructions, defer to the official installation docs: [developer.signalwire.com/freeswitch](https://developer.signalwire.com/freeswitch/) (the Installation section).

The install flow, using Debian/Ubuntu as an example (the repository configuration steps are copied from the official docs — don't use third-party mirrors of unknown origin):

```bash
sudo apt-get update
sudo apt-get install -y freeswitch-meta-all
```

`freeswitch-meta-all` is an aggregate package containing the common modules; you can also install just the core package `freeswitch` and then add `freeswitch-mod-*` packages as needed (e.g., `freeswitch-mod-voicemail`, `freeswitch-mod-conference`).

Starting the service and enabling it at boot:

```bash
sudo systemctl enable freeswitch
sudo systemctl start freeswitch
sudo systemctl status freeswitch
```

## Method 2: Source Build

### 1. Install Build Dependencies

Debian/Ubuntu:

```bash
sudo apt-get update
sudo apt-get install -y git build-essential autoconf automake libtool \
  pkg-config libssl-dev zlib1g-dev libncurses5-dev libcurl4-openssl-dev \
  libdb-dev unixodbc-dev libpq-dev libspeex-dev libspeexdsp-dev \
  libopus-dev libogg-dev libvorbis-dev libsndfile1-dev
```

### 2. Get the Source

The official repository is hosted on GitLab (SignalWire), with a mirror on GitHub:

```bash
# GitHub mirror (can be cloned directly)
git clone https://github.com/signalwire/freeswitch.git
cd freeswitch
git checkout v1.11.3   # Pick the target version, per the official Release list
```

### 3. Bootstrap and Configure

```bash
./bootstrap.sh -j
./configure
```

`./configure` defaults to an install prefix of `/usr/local/freeswitch`. If you need to trim modules, add options — for example, enable only the common codecs and voicemail:

```bash
./configure --disable-odbc --disable-xml-cdr
```

The full set of build options is in `./configure --help`.

### 4. Build and Install

```bash
make -j$(nproc)
sudo make install
# Official prompts/holding music package; fairly large, optional install
sudo make cd-sounds-install
```

### 5. Add to PATH and the System Service

```bash
echo 'export PATH=$PATH:/usr/local/freeswitch/bin' >> ~/.bashrc
source ~/.bashrc
```

For production, write a systemd unit (`/etc/systemd/system/freeswitch.service`) to manage the process, with `ExecStart` pointing at `/usr/local/freeswitch/bin/freeswitch -nc --nonat`, then `systemctl daemon-reload && systemctl enable --now freeswitch` to make it take effect.

## Post-Install Verification

```bash
# Check the version
fs_cli -x "version"

# Enter the console: status shows the running state, show modules lists loaded modules
fs_cli
freeswitch@host> status
freeswitch@host> show modules
freeswitch@host> bye
```

Troubleshooting common issues:

- `fs_cli: connect` fails: the service isn't running, or `fs_cli`'s default connection port (8021/tcp) is blocked by the firewall; when running locally, check the service logs under `/usr/local/freeswitch/log/` (package installs usually use `/var/log/freeswitch/`);
- No audio: first confirm the RTP port range in [Network Configuration](/configuration/network) and that the firewall lets it through;
- Port 8021 should only ever listen on 127.0.0.1 — don't expose it to the public internet (ESL is for local administration only).

## Related Records

Move on to [Basic FreeSWITCH Configuration](/configuration/README) to learn the configuration file system; if you're trying things out on Windows, head over to [Installing on Windows](/installation/windows).

## References

- [FreeSWITCH official site](https://freeswitch.org/)
- [Files · FreeSWITCH release files](https://files.freeswitch.org/releases/freeswitch/)
- [GitHub · signalwire/freeswitch releases](https://github.com/signalwire/freeswitch/releases)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [README](README.md)
- [windows](windows.md)
- [scenarios](/introduction/scenarios.md)
- [README](/modules/README.md)
- [media](/modules/media.md)
- [sip](/modules/sip.md)
- [deployment](/project/deployment.md)
