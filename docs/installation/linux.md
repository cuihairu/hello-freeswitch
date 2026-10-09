# 在 Linux 上安装

Linux 是 FreeSWITCH 的首选生产平台。推荐两条路线：**官方软件仓库安装**（省心、可随包管理升级）与**源码编译**（可裁剪、可二次开发）。

## 方式一：官方软件仓库安装

FreeSWITCH 官方（SignalWire）为 Debian/Ubuntu 与 RHEL 系提供 apt/yum 软件仓库，包含 `freeswitch` 主程序与 `freeswitch-mod-*` 模块分包。仓库地址与 GPG 密钥的最新写法以官方安装文档为准：[developer.signalwire.com/freeswitch](https://developer.signalwire.com/freeswitch/)（Installation 一节）。

以 Debian/Ubuntu 为例的安装流程（仓库配置步骤照官方文档抄录，勿用来路不明的第三方镜像）：

```bash
sudo apt-get update
sudo apt-get install -y freeswitch-meta-all
```

`freeswitch-meta-all` 是聚合包，包含常用模块；也可以只装核心包 `freeswitch` 再按需追加 `freeswitch-mod-*` 包（例如 `freeswitch-mod-voicemail`、`freeswitch-mod-conference`）。

启动与开机自启：

```bash
sudo systemctl enable freeswitch
sudo systemctl start freeswitch
sudo systemctl status freeswitch
```

## 方式二：源码编译

### 1. 安装构建依赖

Debian/Ubuntu：

```bash
sudo apt-get update
sudo apt-get install -y git build-essential autoconf automake libtool \
  pkg-config libssl-dev zlib1g-dev libncurses5-dev libcurl4-openssl-dev \
  libdb-dev unixodbc-dev libpq-dev libspeex-dev libspeexdsp-dev \
  libopus-dev libogg-dev libvorbis-dev libsndfile1-dev
```

### 2. 获取源码

官方仓库托管在 GitLab（SignalWire），GitHub 上有镜像：

```bash
# GitHub 镜像（可直接克隆）
git clone https://github.com/signalwire/freeswitch.git
cd freeswitch
git checkout v1.10.12   # 选择目标版本，以官方 Release 列表为准
```

### 3. 引导与配置

```bash
./bootstrap.sh -j
./configure
```

`./configure` 默认安装前缀为 `/usr/local/freeswitch`。需要裁剪模块时可加参数，例如只启用常用编解码与语音信箱：

```bash
./configure --disable-odbc --disable-xml-cdr
```

完整编译选项见 `./configure --help`。

### 4. 编译与安装

```bash
make -j$(nproc)
sudo make install
# 官方提示音/音乐保持（Holding Music）包，体积较大，可选安装
sudo make cd-sounds-install
```

### 5. 加入 PATH 与系统服务

```bash
echo 'export PATH=$PATH:/usr/local/freeswitch/bin' >> ~/.bashrc
source ~/.bashrc
```

生产环境建议写一个 systemd 单元（`/etc/systemd/system/freeswitch.service`）托管进程，`ExecStart` 指向 `/usr/local/freeswitch/bin/freeswitch -nc --nonat`，`systemctl daemon-reload && systemctl enable --now freeswitch` 生效。

## 安装后验证

```bash
# 查看版本
fs_cli -x "version"

# 进入控制台：status 查看运行状态，show modules 查看已加载模块
fs_cli
freeswitch@host> status
freeswitch@host> show modules
freeswitch@host> bye
```

常见问题排查：

- `fs_cli: connect` 失败：服务未启动，或 `fs_cli` 默认连接口（8021/tcp）被防火墙拦截，本机执行请检查服务日志 `/usr/local/freeswitch/log/`（包安装通常在 `/var/log/freeswitch/`）；
- 听不到声音：先确认 [网络设置](/configuration/network) 中的 RTP 端口段与防火墙放行；
- 8021 端口只应监听 127.0.0.1，不要暴露到公网（ESL 仅限本地管理）。

## 下一步

进入 [FreeSWITCH 的基本配置](/configuration/README)，了解配置文件体系；若你在 Windows 上体验，转到 [在 Windows 上安装](/installation/windows)。
