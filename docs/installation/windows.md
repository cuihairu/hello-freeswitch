# 在 Windows 上安装

FreeSWITCH 官方以 Linux 为主战场，Windows 版长期提供安装包但更新节奏落后于 Linux。Windows 环境适合**本机体验、功能验证与开发调试**；生产部署请优先选择 Linux。

## 方案选择

| 方案 | 适合场景 | 说明 |
| ---- | ---- | ---- |
| 官方 Windows 安装包 | 快速体验、桌面集成 | 图形化安装，带 `fs_cli.exe` 控制台 |
| WSL2 + Linux 版 | 功能验证、脚本开发 | 与生产环境行为一致，**推荐** |
| 源码编译（Windows） | 深度定制 | 需要 Visual Studio 工具链，复杂度高 |

## 方案一：官方 Windows 安装包

1. 从 FreeSWITCH 官方下载页（[freeswitch.org](https://freeswitch.org/) 或 SignalWire 开发者站 [developer.signalwire.com/freeswitch](https://developer.signalwire.com/freeswitch/) 的 Download 入口）获取 Windows 安装包，注意选择与系统位数匹配的版本；
2. 运行安装程序，默认安装到 `C:\Program Files\FreeSWITCH`；
3. 安装程序可选注册 Windows 服务，勾选后开机自启；
4. 打开安装目录下的 `fs_cli.exe` 验证：

```bat
fs_cli.exe -x "version"
fs_cli.exe -x "status"
```

5. 首次运行若被 Windows 防火墙拦截，选择"允许专用网络访问"——FreeSWITCH 需要放行 **5060/udp、5060/tcp（SIP）** 与 **RTP 端口段 16384-32768/udp（媒体）**，详见 [网络设置](/configuration/network)。

### 已知限制

- 官方 Windows 构建的版本发布滞后，模块覆盖不全（TDM、部分编解码模块仅 Linux 可用）；
- 音频设备采集/播放依赖 mod_portaudio，行为与 Linux ALSA/PulseAudio 不同；
- 生产级 NAT 穿透、性能调优在 Windows 上缺乏官方实践背书。

## 方案二：WSL2（推荐）

在 Windows 10/11 上获得与 Linux 一致的 FreeSWITCH：

```powershell
# PowerShell（管理员）
wsl --install -d Ubuntu
```

进入 WSL2 的 Ubuntu 后，按 [在 Linux 上安装](/installation/linux) 的步骤执行仓库安装或源码编译。WSL2 中可直接使用 `fs_cli`、Lua 脚本、ESL 等全部功能，端口也会自动桥接到 Windows 侧（WSL2 默认 NAT，注意 SIP 信令里的 IP 需按 WSL 分配地址或使用 mirrored 网络模式配置）。

## 安装后验证

两种方案安装完成后统一验证：

```bat
fs_cli.exe -x "version"
fs_cli.exe -x "show modules"
```

控制台内执行 `status` 应看到 uptime 与活跃会话数为 0（尚未有呼叫）。

## 下一步

- [FreeSWITCH 的基本配置](/configuration/README)：配置文件体系；
- [配置文件结构](/configuration/config-files)：`conf/` 目录逐项说明；
- [网络设置](/configuration/network)：端口、防火墙与 NAT。
