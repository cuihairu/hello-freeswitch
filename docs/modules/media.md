# 媒体处理模块

通话「接通」只是开始，声音与画面怎么编、怎么转、怎么调音量、怎么录下来，都由媒体处理相关模块决定。本章覆盖编解码与转码、`absolute_codec_string`、音频增益、视频编解码与录制，以及 mod_conference 的视频混屏。

## 编解码与转码

### 编解码从哪来

| 提供方 | 编解码 | 说明 |
| ---- | ---- | ---- |
| 核心（无需模块） | PCMU/PCMA（G.711）、L16 | 核心实现，永远可用 |
| 核心（无需模块） | VP8、VP9 | 视频编解码在核心实现，参数在 `autoload_configs/vpx.conf.xml` |
| `mod_spandsp` | G.711、G.722、GSM、G.726、ADPCM、LPC-10 | 同时提供传真（T.38/传真网关）与 DTMF 检测等 DSP 应用 |
| `mod_opus` | OPUS | 参数模板在 `autoload_configs/opus.conf.xml` |
| `mod_openh264` | H.264 | H.264 编解码实现 |
| `mod_h26x` | H.264、H.263、H.263-1998、H.263-2000、H.261 | 仅 RTP 封装透传，不解码 |
| `mod_av` | H.263/H.264 转码、mp4/mkv 容器 | 基于 ffmpeg（libavformat/libavcodec） |
| `mod_yuv` | 原始 YUV | 视频测试与开发 |

用 `fs_cli -x "show codec"` 看当前实际可用的编解码清单——列表里没有，多半是模块没加载或编译时缺依赖。

### 编解码偏好与协商

每个方向给对方「提供哪些编解码」由偏好列表决定，profile 参数是主入口：

```xml
<profile name="internal">
  <!-- 收方向提供哪些；发方向提供哪些 -->
  <param name="inbound-codec-prefs" value="$${global_codec_prefs}"/>
  <param name="outbound-codec-prefs" value="$${outbound_codec_prefs}"/>
  <!-- generous：尽量照顾对端；greedy：优先自己的顺序 -->
  <param name="inbound-codec-negotiation" value="generous"/>
  <!-- 先进拨号计划再定编解码，为按呼叫改偏好留出时机 -->
  <param name="inbound-late-negotiation" value="true"/>
</profile>
```

vanilla 的 `vars.xml` 默认 `global_codec_prefs=OPUS,G722,PCMU,PCMA,H264,VP8`——排在前面的优先被选中。协商结果写在通道变量里：

- `${read_codec}` / `${write_codec}`——两侧当前编解码；
- `${ep_codec_string}`——对端实际提供的编解码串（排查协商问题先看它）。

一通电话两侧编解码不同时，FreeSWITCH 在中间**转码**；两侧相同时只做 RTP 代理转发，几乎零开销。转码消耗 CPU 与音质（每次转码都有损失），所以「让两侧说同一种话」是媒体优化的第一原则。会议是天然的多方转码点：成员被统一转到 profile 的 `rate` 混音（`default` 8k，`cdquality` 48k）。

profile 里还有一个与转码直接相关的参数 `disable-transcoding`：打开后外呼腿只提供与主叫腿一致的编解码，强行避免转码（代价是可能因无共同编解码而呼叫失败）。

## 绝对编解码 absolute_codec_string

`absolute_codec_string` 是通道变量，设置后**编解码选择完全以它为准**（在编解码选择时最先读取），profile 的偏好被绕开。最典型的用途是外呼时把编解码收窄到 G.711，避免与网关/运营商协商出需要转码的结果：

```xml
<include>
  <extension name="outbound_g711_only">
    <condition field="destination_number" expression="^(1\d{10})$">
      <!-- 只向网关提供 G.711 -->
      <action application="set" data="absolute_codec_string=PCMU,PCMA"/>
      <action application="bridge" data="sofia/gateway/carrier1/$1"/>
    </condition>
  </extension>
</include>
```

配套通道变量：

| 变量 | 作用 |
| ---- | ---- |
| `absolute_codec_string` | 绝对编解码串，优先级最高；以 `=` 开头写法可做替换语义 |
| `codec_string` | 普通偏好覆盖，与 profile 偏好合并 |
| `inherit_codec` | A 腿设 `inherit_codec=true` 时，把 B 腿的 `ep_codec_string` 写入 `absolute_codec_string`——外呼跟随主叫编解码，防止意外转码 |

排障时用 `fs_cli -x "uuid_dump <uuid>"` 对照 `absolute_codec_string`、`ep_codec_string` 与最终 `read_codec`，协商链路一目了然。

## 音频过滤与增益

先澄清一个常见误解：FreeSWITCH **没有**名为 `volume` 的 application。通道级音量与增益的真实入口是 `uuid_audio` API 与会议内的音量命令。

### 通道级：uuid_audio

```bash
# 语法
# uuid_audio <uuid> [start [read|write] [mute|level <level>]|stop]

# 把该通道收到的声音（read 方向）音量升 2 级（level 取值 -4 到 4）
fs_cli -x "uuid_audio <uuid> start read level 2"

# 读方向静音
fs_cli -x "uuid_audio <uuid> start read mute 0"

# 恢复
fs_cli -x "uuid_audio <uuid> stop"
```

`read` 是该通道收进来的音频，`write` 是发出去的音频；`level` 为 -4～4 的整数，逐级缩放波形；`mute` 的级别大于 1 时用舒适噪声替代硬静音。它作用于**这一条通道腿**，不影响对端。

### 会议内的音量与增益

mod_conference 把音量做成成员属性，粒度更细：

```bash
fs_cli -x "conference 3000 volume_in 3 4"    # 成员 3 送入会议的声音调大
fs_cli -x "conference 3000 volume_out 3 4"   # 成员 3 听到的音量调大
fs_cli -x "conference 3000 energy 3 200"     # 该成员说话检测阈值
fs_cli -x "conference 3000 agc all"          # 全员自动增益
fs_cli -x "conference 3000 file-vol 4"       # 录音/播放文件音量
```

成员还可以在手机上自助调节：`caller-controls` 按键组里 `vol talk up/down/zero` 调自己发言音量、`vol listen up/down/zero` 调收听音量、`energy up/dn/equ` 调说话阈值（键位见 [会议模块](/modules/conference)）。

### 播放侧的滤波与变速

- `mod_ladspa`：加载 LADSPA 插件做滤波/降噪/降噪门等处理，application 是 `ladspa_run`（vanilla 自带示例拨号 `dialplan/default/00_ladspa.xml`），例如 `ladspa_run r|tap_chorusflanger||`；
- `mod_soundtouch`：application `soundtouch`，调整音频流的 pitch/rate/tempo（变声、变速播放）。

这两类处理基于 media bug 在通道上实时生效，通常放在 `answer` 之后、`bridge`/`playback` 之前。

### mod_spandsp 的真实角色

`mod_spandsp` 常被误当成「音量/滤波模块」。它实际提供的是：G.711/G.722/GSM/G.726 等编解码、DTMF 检测（`spandsp_start_dtmf` / `spandsp_stop_dtmf`，与 mod_dptools 的 `start_dtmf` 是两套实现）、传真（`rxfax`/`txfax`/T.38 网关）。音量与增益请回到 `uuid_audio` 与会议命令，不要在这里找。

## 视频编解码

| 编解码 | 提供方 | 用法要点 |
| ---- | ---- | ---- |
| H.264 | `mod_openh264`（编解码）、`mod_h26x`（透传） | 终端互通性最好；透传要求两侧直接兼容 |
| VP8 / VP9 | 核心（`vpx.conf.xml` 调参） | WebRTC 默认；会议混屏常用 |
| H.263/H.261 | `mod_h26x` 透传 | 老视频终端 |

视频偏好同样写在 `inbound-codec-prefs`/`outbound-codec-prefs` 里（vanilla 默认含 `H264,VP8`），协商规则与音频一致。会议视频混屏（mux 模式）是转码重负载场景：画布尺寸、帧率、码率直接决定 CPU 用量，见下文。

## 视频录制与播放

- **`mod_fsv`**：FreeSWITCH 原生视频格式 `.fsv`，application `record_fsv` / `play_fsv`——把带视频的通话原样录下/回放，常用于测试与问题复现；
- **`mod_av`**：提供 mp4/mkv 容器的读写，因此 `record_session /tmp/call.mp4` 可以直接把音视频录进 mp4（需要 `mod_av` 编译时带上 ffmpeg 库）；
- **会议画面截图**：`fs_cli -x "conference 3000 vid-write-png /tmp/canvas.png"` 导出当前混屏画面。

## 视频会议：mod_conference 的视频混屏

mod_conference 的视频能力由 `video-mode=mux` 开启：所有成员画面按**布局**合成到**画布（canvas）**上，再发给每个成员——这就是视频 MCU。vanilla 的 `video-mcu-stereo-720` profile 是现成模板：

```xml
<profile name="video-mcu-stereo-720">
  <param name="domain" value="$${domain}"/>
  <param name="rate" value="48000"/>
  <param name="channels" value="2"/>
  <param name="interval" value="20"/>
  <param name="energy-level" value="200"/>
  <param name="comfort-noise" value="false"/>
  <param name="conference-flags" value="livearray-json-status|json-events|video-floor-only|rfc-4579|livearray-sync|minimize-video-encoding|manage-inbound-video-bitrate|video-required-for-canvas|video-mute-exit-canvas|mute-detect"/>
  <param name="video-auto-floor-msec" value="1000"/>
  <param name="video-mode" value="mux"/>
  <param name="video-layout-name" value="3x3"/>
  <param name="video-layout-name" value="group:grid"/>
  <param name="video-canvas-size" value="1280x720"/>
  <param name="video-canvas-bgcolor" value="#333333"/>
  <param name="video-layout-bgcolor" value="#000000"/>
  <param name="video-codec-bandwidth" value="3mb"/>
  <param name="video-fps" value="30"/>
</profile>
```

| 参数 | 作用 |
| ---- | ---- |
| `video-mode` | `mux` 为服务端混屏；不开则只做视频转发 |
| `video-layout-name` | 布局名（`3x3`）或布局组（`group:grid`），可写多行作为候选 |
| `video-canvas-size` | 画布分辨率（输出给成员的合成画面尺寸） |
| `video-canvas-bgcolor` / `video-layout-bgcolor` | 画布底色与布局底色 |
| `video-codec-bandwidth` / `video-fps` | 输出码率与帧率，混屏 CPU 的主要变量 |
| `video-auto-floor-msec` | 说话者抢占主画面（floor）的保持毫秒数 |
| `video-codec-config-profile-name` | 引用 `vpx.conf.xml` 里的编码参数 profile（如 `conference`） |

常用的会议标志（写在 `conference-flags`）：`video-floor-only`（只发主画面，省带宽）、`video-required-for-canvas`（无视频的成员不占画布格）、`manage-inbound-video-bitrate`（按成员带宽调分辨率）、`minimize-video-encoding`、`livearray-sync`（配合 Verto 的成员状态同步）。

### 布局与多画布

布局定义在 `conf/autoload_configs/conference_layouts.conf.xml`：`<layout name="3x3">` 用 `<image x y scale>` 描述每个格位；`<group name="grid">` 把多档布局（人数变化时自动挑最合适的）打包，`video-layout-name` 的 `group:grid` 即引用它。

成员可以分布在多个画布上（multi-canvas），控制命令：

```bash
fs_cli -x "conference 3000 vid-layout group grid"          # 切布局组
fs_cli -x "conference 3000 vid-layout 1x1 1"               # 指定布局与画布
fs_cli -x "conference 3000 vid-canvas 3 2"                 # 把成员 3 放到画布 2
fs_cli -x "conference 3000 vid-watching-canvas 3 1"        # 成员 3 观看画布 1
fs_cli -x "conference 3000 vid-floor 3"                    # 设成员 3 为主画面
fs_cli -x "conference 3000 clear-vid-floor"                # 清除主画面
fs_cli -x "conference 3000 vid-banner 3 Welcome"           # 成员画面横幅文字
```

`vid-canvas` 把成员指派到不同画布、`vid-watching-canvas` 决定他看哪块画布，即可实现「主会场 + 分会场」或「主讲 + 同席」的多画面结构；`canvas-auto-clear` 控制空画布是否自动清理。浏览器侧接入会议通常走 `mod_verto`（Verto 协议，WebRTC），与上述混屏能力配合即为开源视频会议的完整链路。

## 相关阅读

- [会议模块](/modules/conference)——会议的创建与成员控制，本章是其视频与媒体侧的延伸；
- [SIP 模块](/modules/sip)——`inbound-codec-prefs` 等 profile 参数的上下文；
- [网关模块](/modules/gateway)——外呼时用 `absolute_codec_string` 收窄编解码的实战；
- [静态拨号计划](/concepts/static-dialplan)——`record_session`、`playback` 等 application 用法；
- [在 Linux 上安装](/installation/linux)——ffmpeg 等媒体依赖库的安装位置。
