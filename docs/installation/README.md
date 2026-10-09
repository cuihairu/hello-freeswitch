# FreeSWITCH 的安装

FreeSWITCH 的官方主战场是 Linux 服务器。本节介绍支持的平台、三种安装方式的取舍，并分别给出 Linux 与 Windows 的完整步骤。

## 支持平台

| 平台 | 支持程度 | 说明 |
| ---- | ---- | ---- |
| Linux（Debian/Ubuntu/CentOS 等） | 官方主支持 | 生产环境首选，包与源码两条路线都成熟 |
| FreeBSD / macOS | 官方支持 | 可用于开发与特殊部署 |
| Windows | 可用但非主战场 | 官方安装包近年更新滞后；本机开发可用 WSL2 跑 Linux 版 |
| Docker | 社区镜像 | 适合快速体验与编排部署 |

## 三种安装方式怎么选

1. **官方/SignalWire 软件仓库安装**（Linux，推荐生产）：获得与上游同步的版本和 `freeswitch-*` 系列包，可单独安装模块子包。
2. **源码编译**（Linux/macOS，需要定制时选）：可自由裁剪模块（如只编译需要的编解码和网关模块），排障与二次开发也从这里开始。
3. **发行版自带包**：注意——Debian 官方仓库当前已不再收录 freeswitch 包（可在 [Debian 包搜索](https://packages.debian.org/search?keywords=freeswitch) 直接验证），依赖发行版包的老文章需谨慎参考。

> 系统要求参考：64 位 Linux、2 核以上 CPU、2GB 以上内存；语音是实时媒体，生产环境请关闭无关进程并为网卡配置静态 IP。

## 安装后验证

无论哪种方式，安装完成后先确认版本与控制台连通：

```bash
# 源码编译的默认安装路径；包安装则为 /usr/bin/fs_cli
/usr/local/freeswitch/bin/fs_cli -x "version"
```

预期输出形如 `FreeSWITCH Version 1.11.x ...`（随安装版本）。随后用 `fs_cli` 进入控制台（回车出现 `freeswitch@...>` 提示符），执行 `status` 查看运行状态，`bye` 或按 `Ctrl+D` 退出。

## 本节内容

- [在 Linux 上安装](/installation/linux)：官方仓库与源码编译两条完整路线；
- [在 Windows 上安装](/installation/windows)：安装包与 WSL2 方案。

安装完成后，进入 [FreeSWITCH 的基本配置](/configuration/README)。
