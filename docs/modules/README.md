# 模块概述

FreeSWITCH 的本体只是一个很小的交换核心：媒体桥接、通道状态机、XML 配置引擎。SIP、会议、语音信箱、录音、编解码……所有具体能力都由**模块（module）**提供。本篇是「模块详解篇」的入口，第 5～9 章分别展开 SIP、IVR、会议、网关与媒体处理。

## 什么是模块

模块是编译成 `.so`（Linux）或 `.dll`（Windows）的动态库，安装到 `mod/` 目录：

| 安装方式 | 模块目录 |
| ---- | ---- |
| 源码编译（默认前缀） | `/usr/local/freeswitch/mod` |
| 官方 deb/rpm 包 | `/usr/lib/freeswitch/mod` |

核心在启动时按配置把它们加载进进程——**不在配置里的模块，对应的命令、application、编解码就都不存在**。

### modules.conf.xml：模块总闸

`conf/autoload_configs/modules.conf.xml` 决定启动时加载哪些模块，一行一个模块：

```xml
<configuration name="modules.conf" description="Modules">
  <modules>
    <!-- 日志 -->
    <load module="mod_console"/>
    <load module="mod_logfile"/>
    <!-- XML 接口与数据 -->
    <load module="mod_enum"/>
    <load module="mod_cdr_csv"/>
    <!-- 事件 -->
    <load module="mod_event_socket"/>
    <!-- 端点（SIP 栈等） -->
    <load module="mod_sofia"/>
    <load module="mod_loopback"/>
    <!-- 应用 -->
    <load module="mod_commands"/>
    <load module="mod_conference"/>
    <load module="mod_dptools"/>
    <load module="mod_voicemail"/>
    <!-- 编解码 -->
    <load module="mod_spandsp"/>
    <load module="mod_opus"/>
    <!-- 脚本 -->
    <load module="mod_lua"/>
    <!-- 不需要的模块注释掉即可 -->
    <!-- <load module="mod_fsv"/> -->
  </modules>
</configuration>
```

- 加载顺序即文件中的书写顺序，部分模块有先后依赖（如 `mod_dptools` 提供绝大多数 application）；
- 注释掉一行并重启，该模块不再加载；`autoload_configs/` 下还有 `pre_load_modules.conf.xml`、`post_load_modules.conf.xml` 两张表，分别在主表之前/之后加载，给需要特殊时序的模块用；
- 修改这张表只影响**下次启动**，运行期增减用 `load` / `unload`（见下文）。

源码树根目录还有一个不带 `.xml` 后缀的 `modules.conf`，那是**编译期**的开关，决定 `make` 编译哪些模块；deb/rpm 包按 `freeswitch-mod-*` 分包装，文件就位后在 XML 里放开 `<load>` 即可。

### 模块注册的接口类型

一个模块可以向核心注册多种接口，一个 `.so` 往往同时是好几样：

| 接口类型 | 典型代表 | 查看命令 |
| ---- | ---- | ---- |
| API 命令 | `mod_commands`（`show`、`load`、`originate`…） | `fs_cli -x "show api"` |
| Application | `mod_dptools`（`answer`、`bridge`、`playback`…） | `fs_cli -x "show application"` |
| 端点 | `mod_sofia`（`sofia/`）、`mod_loopback`（`loopback/`） | `fs_cli -x "show endpoint"` |
| 编解码 | `mod_opus`、`mod_spandsp` | `fs_cli -x "show codec"` |
| 文件格式 | `mod_sndfile`（wav）、`mod_av`（mp4/mkv） | `fs_cli -x "show file"` |
| 拨号计划接口 | `mod_dialplan_xml`、`mod_dialplan_asterisk` | `fs_cli -x "show dialplan"` |

`fs_cli -x "show interfaces"` 汇总全部已注册接口，`fs_cli -x "show interface_types"` 列出接口类型——排查「命令为什么不存在」时，先用它们确认模块到底加载没有。

## FreeSWITCH 模块分类

按职责可以把常用模块分成五类，与源码树 `src/mod/` 的目录划分大致对应。

### 核心模块

提供基础运行设施，几乎所有场景都需要：

| 模块 | 作用 |
| ---- | ---- |
| `mod_console` / `mod_logfile` | 控制台与文件日志 |
| `mod_commands` | `show`、`load`、`originate`、`uuid_*` 等大量 API 命令 |
| `mod_dptools` | `answer`、`bridge`、`playback`、`transfer`、`ivr`、`play_and_get_digits` 等 application |
| `mod_dialplan_xml` | 解析 `dialplan/` 下的 XML 拨号计划 |
| `mod_hash` / `mod_db` / `mod_expr` | 键值缓存、平面数据库、表达式计算 |
| `mod_native_file` / `mod_tone_stream` / `mod_local_stream` | 原生文件、tone_stream、目录循环播流 |
| `mod_xml_curl` | 把 dialplan/directory/configuration 等 section 交给 HTTP 接口动态返回 |

### 应用模块

提供完整业务能力，按需加载：

| 模块 | 作用 |
| ---- | ---- |
| `mod_conference` | 多方会议（第 7 章） |
| `mod_voicemail` | 语音信箱 |
| `mod_fifo` / `mod_callcenter` | 排队与坐席 |
| `mod_valet_parking` | 呼叫驻留 |
| `mod_lcr` / `mod_distributor` | 最廉价路由与轮询分发 |
| `mod_httapi` | 由 HTTP 接口驱动的呼叫控制 |
| `mod_directory` | 分机目录拨号与语音播报 |
| `mod_esf` / `mod_spy` | 扩展转发、通话监听 |
| `mod_av` / `mod_fsv` | 多媒体容器读写、原生视频录制（第 9 章） |

### 编解码模块

- **音频**：`mod_opus`（Opus）、`mod_spandsp`（G.711/G.722/GSM/G.726 及传真、DTMF 等 DSP）、`mod_g729`、`mod_g723_1`、`mod_ilbc`、`mod_silk`、`mod_amr`、`mod_codec2`；
- **视频**：`mod_openh264`（H.264 编解码）、`mod_h26x`（H.264/H.263 系列 RTP 封装透传）、`mod_yuv`；
- **无需模块**：PCMU/PCMA（G.711）与 L16 直接实现在核心中，VP8/VP9 视频同样由核心提供；
- **带授权要求的扩展**：`mod_com_g729`、`mod_sangoma_codec` 等，默认不加载。

### 网关与端点模块

决定「电话从哪里进来、到哪里出去」：

| 模块 | 作用 |
| ---- | ---- |
| `mod_sofia` | SIP 协议栈，internal/external 两个 profile 与全部网关（第 5、8 章） |
| `mod_verto` | Verto 协议，浏览器 WebRTC 客户端 |
| `mod_rtc` | WebRTC SDP 协商辅助 |
| `mod_skinny` | Cisco SCCP 协议 |
| `mod_loopback` | `loopback/` 端点，用于转腿、自测与拆分拨号计划 |

### 事件模块

把通话过程以事件与话单形式输出给外部系统：

| 模块 | 作用 |
| ---- | ---- |
| `mod_event_socket` | ESL，外部程序通过 `127.0.0.1:8021` 订阅事件、执行命令 |
| `mod_cdr_csv` / `mod_xml_cdr` | CSV 话单与 XML/HTTP 话单 |
| `mod_event_multicast` | 向多播地址分发事件 |
| `mod_erlang_event` / `mod_snmp` | Erlang 集成、SNMP 监控 |

## 用 fs_cli 查看模块

```bash
# 已加载模块清单（模块名、类型、描述）
fs_cli -x "show modules"

# 各类接口分别查看
fs_cli -x "show codec"        # 可用编解码
fs_cli -x "show application"  # 可用 application
fs_cli -x "show api"          # 可用 API 命令
fs_cli -x "show endpoint"     # 可用端点协议
fs_cli -x "show interfaces"   # 全量接口汇总
```

模块没出现在 `show modules` 里，或加载时报错，先看控制台输出与 `log/freeswitch.log`——最常见原因是依赖库缺失（如 `mod_av` 需要 ffmpeg 的开发库）或模块文件与主程序版本不一致。

## load / unload / reload

```bash
# 加载：立即生效，不打断已建立的通话
fs_cli -x "load mod_conference"

# 卸载：模块仍有活动会话时会拒绝卸载，必要时加 -f 强制
fs_cli -x "unload mod_conference"
fs_cli -x "unload -f mod_conference"

# 重载：等价于先 unload 再 load
fs_cli -x "reload mod_conference"
```

三点提醒：

1. `load` / `unload` / `reload` 只改变**运行态**，`modules.conf.xml` 没变——想让某模块下次启动也保持这个状态，要改 XML；
2. `reloadxml` 只重新解析 XML 配置，**不会**加载或卸载模块，两者经常被混淆；
3. 对承载通话的模块要谨慎：`unload mod_sofia` 会拆掉全部 SIP 会话与分机注册。SIP 配置变更请用 `sofia profile <name> rescan`，见 [SIP 模块](/modules/sip)。

## 相关阅读

- [核心配置文件](/configuration/core-files)——`modules.conf.xml`、`vars.xml` 的字段级讲解；
- [配置文件结构](/configuration/config-files)——`conf/` 目录全景与加载机制；
- [SIP 模块](/modules/sip)——第一个要看的模块：mod_sofia；
- [静态拨号计划](/concepts/static-dialplan)——application 如何在拨号计划里组合成路由；
- [在 Linux 上安装](/installation/linux)——源码编译、模块裁剪与 `freeswitch-mod-*` 分包。
