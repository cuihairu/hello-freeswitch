# 会议模块

`mod_conference` 在 FreeSWITCH 内实现了一个多方会议桥（MCU）：音频按 profile 采样率混音，视频可按布局混屏。本章讲清配置结构、创建会议的方式、控制命令与录音/旁路输出。

## mod_conference 概述

- 模块加载后提供 `conference` application（把当前通话拉入会议）与同名 `conference` API 命令（会外控制）；
- 会议**不需要预先创建**：第一个到达的成员触发按 profile 实例化，最后一个成员离开自动销毁；
- 会议名可带 `@profile` 选择参数模板，`@default` 是缺省 profile；
- 配置在 `conf/autoload_configs/conference.conf.xml`，视频布局在 `conf/autoload_configs/conference_layouts.conf.xml`；
- 每个成员可以有独立的按键控制、音量、能量阈值，主持人可以有独立的按键组。

## 配置会议服务

### conference.conf.xml 的结构

```xml
<configuration name="conference.conf" description="Audio Conference">
  <advertise>
    <!-- 向 presence 通告会议房间，可选 -->
    <room name="3001@$${domain}" status="FreeSWITCH"/>
  </advertise>

  <caller-controls>
    <!-- 未指定按键组时成员默认使用 default 组 -->
    <group name="default">
      <control action="mute" digits="0"/>
      <control action="energy up" digits="9"/>
      <control action="energy dn" digits="7"/>
      <control action="vol talk up" digits="3"/>
      <control action="vol talk dn" digits="1"/>
      <control action="vol listen up" digits="6"/>
      <control action="vol listen dn" digits="4"/>
      <control action="hangup" digits="#"/>
    </group>
  </caller-controls>

  <profiles>
    <profile name="default">
      <param name="domain" value="$${domain}"/>
      <param name="rate" value="8000"/>
      <param name="interval" value="20"/>
      <param name="energy-level" value="100"/>
      <param name="muted-sound" value="conference/conf-muted.wav"/>
      <param name="unmuted-sound" value="conference/conf-unmuted.wav"/>
      <param name="alone-sound" value="conference/conf-alone.wav"/>
      <param name="moh-sound" value="$${hold_music}"/>
      <param name="enter-sound" value="tone_stream://%(200,0,500,600,700)"/>
      <param name="exit-sound" value="tone_stream://%(500,0,300,200,100,50,25)"/>
      <param name="kicked-sound" value="conference/conf-kicked.wav"/>
      <param name="locked-sound" value="conference/conf-locked.wav"/>
      <param name="pin-sound" value="conference/conf-pin.wav"/>
      <param name="bad-pin-sound" value="conference/conf-bad-pin.wav"/>
      <param name="comfort-noise" value="true"/>
    </profile>
  </profiles>
</configuration>
```

三层结构：

1. `advertise`——把会议房间通告给 presence（可选）；
2. `caller-controls`——DTMF 按键组，供 profile 引用（组名 `default` 与 `none` 是保留名）；
3. `profiles`——参数模板，会议名后跟 `@<profile>` 选择，未指定用 `default`。

### 音频 profile 常用参数

| 参数 | 作用 |
| ---- | ---- |
| `rate` / `interval` / `channels` | 混音采样率（8000/16000/32000/48000）、帧长（毫秒）、声道数 |
| `energy-level` | 判定「正在说话」的能量阈值，低于它不向其他成员转发（静音抑制） |
| `caller-controls` / `moderator-controls` | 成员按键组 / 主持人按键组 |
| `moh-sound` / `alone-sound` | 等待时音乐 / 独处时提示 |
| `enter-sound` / `exit-sound` / `kicked-sound` | 进出与被踢提示音 |
| `muted-sound` / `unmuted-sound` | 闭音/恢复提示音 |
| `pin` / `moderator-pin` / `pin-retries` | 会议密码、主持人密码、密码重试次数 |
| `max-members` | 会议人数上限 |
| `member-flags` | 新成员默认标志（如 `waste`、`mute`） |
| `comfort-noise` | 静默期生成舒适噪声 |
| `auto-record` | 每次会议自动录音（见下文） |
| `conference-flags` | 会议级标志：`wait-mod`、`audio-always`、`video-bridge`、`rfc-4579`、`livearray-sync` 等 |
| `sound-prefix` / `tts-engine` / `tts-voice` | 提示音路径前缀与 TTS；开了 TTS 后 `say:` 开头的声音参数按文本朗读 |
| `cdr-log-dir` | 会议 CDR 输出目录（`auto` 为默认位置） |

vanilla 自带 `default`（8k）、`wideband`（16k）、`ultrawideband`（32k）、`cdquality`（48k）与多个 `video-mcu-stereo*` 视频模板，可直接复制改。

### 视频 profile（概述）

视频参数（`video-mode`、`video-layout-name`、`video-canvas-size`、`video-canvas-bgcolor`、`video-fps`、`video-codec-bandwidth` 等）与多画布控制统一放到 [媒体处理模块](/modules/media) 讲，本篇只处理音频。

## 创建会议

### 拨号计划：conference application

```xml
<include>
  <!-- conf/dialplan/default/20-conference.xml -->
  <extension name="conference_3000">
    <condition field="destination_number" expression="^(3000)$">
      <action application="answer"/>
      <action application="conference" data="3000@default"/>
    </condition>
  </extension>
</include>
```

`data` 的完整形态是 `会议名[@profile][+pin][+flags{标志|标志}]`，注意 `+pin` 要写在 profile 之后：

```xml
<include>
  <!-- +pin 写在 profile 之后 -->
  <action application="conference" data="3000+4321"/>
  <!-- 指定 profile 时写成 -->
  <action application="conference" data="3000@default+4321"/>
  <!-- 主持人标志 -->
  <action application="conference" data="3000@default+flags{moderator}"/>
</include>
```

常用成员标志：`moderator`（套用 `moderator-controls` 按键组）、`mute` / `deaf`（入会即闭音/闭听）、`nomoh`（独处时不放等待音乐）、`endconf`（该成员全部离开即结束会议）、`video-bridge`（参与视频混屏）。会议级标志也可以在通道变量 `conference_flags`（如 `wait-mod`，等主持人到场前其他成员先等待）里给。

### 从会议外呼人进来

```bash
# 呼出一路并加入会议：端点、主叫号、主叫名
fs_cli -x "conference 3000 dial sofia/internal/1002 1002 Manager"
# 后台呼出
fs_cli -x "conference 3000 bgdial sofia/internal/1003 1003 Clerk"
```

`dial` / `bgdial` 的端点串与 `bridge` 相同（`sofia/internal/1002`、`sofia/gateway/carrier1/13800138000`），由此也能把网关侧的 PSTN 电话拉进会议。

## 会议控制命令

以下命令都通过 `conference <会议名> <子命令> [参数]` 调用，`fs_cli` 与 ESL 均可执行。

### 查看

| 命令 | 语法 |
| ---- | ---- |
| 列出成员 | `conference <name> list`（可加 `delim <string>` 或 `count`） |
| 成员数 | `conference <name> count` |
| XML/JSON 视图 | `conference <name> xml_list` / `json_list` |
| 读参数 | `conference <name> get <parameter-name>` |

```bash
fs_cli -x "conference 3000 list"
fs_cli -x "conference 3000 count"
```

### 成员控制

| 命令 | 语法 | 说明 |
| ---- | ---- | ---- |
| 踢出 | `kick <member_id\|all\|last\|non_moderator> [<声音文件>]` | 播放提示音后挂断 |
| 挂断 | `hup <member_id\|all\|last\|non_moderator>` | 直接挂断 |
| 闭音 | `mute <member_id\|all\|last\|non_moderator> [<quiet>]` | 加 `quiet` 不播提示音 |
| 恢复 | `unmute <同上>` | |
| 闭听 | `deaf <同上>` / `undeaf <同上>` | 听不到会议声音 |
| 入向音量 | `volume_in <member_id\|all\|last\|non_moderator> [<newval>]` | 该成员送入会议的音量 |
| 出向音量 | `volume_out <同上>` | 该成员听到的音量 |
| 能量阈值 | `energy <同上> [<newval>]` | 逐成员说话检测阈值 |
| 自动增益 | `agc <同上> [<newval>]` | 成员级 AGC |
| 定向静默 | `relate <member_id> <other_member_id> [nospeak\|nohear\|clear]` | 两人之间单/双向隔离 |
| 会议间转移 | `transfer <目标会议名> <member id> [...]` | 把成员转去另一个会议 |
| 播键 | `dtmf <member_id\|all> <digits>` | 向成员注入 DTMF |

```bash
fs_cli -x "conference 3000 kick 3"
fs_cli -x "conference 3000 mute all"
fs_cli -x "conference 3000 volume_out 3 4"
```

`member_id` 是加入会议时的序号，`list` 输出第一列；`all`、`last`、`non_moderator` 可一次圈定一批。

### 会议级控制

| 命令 | 语法 | 说明 |
| ---- | ---- | ---- |
| 锁会 | `lock` / `unlock` | 锁定后不允许新成员加入 |
| 密码 | `pin <pin#>` / `nopin` | 运行时设置/清除会议密码 |
| 播音 | `play <file_path> [async\|<member_id> [nomux]]` | 向会议播文件；指定 member 则只对该成员播 |
| 停播 | `stop <current\|all\|async\|last> [<member_id>]` | |
| 讲话 | `say <text>` / `saymember <member_id> <text>` | TTS 播报（需配置 tts-engine） |
| 等待音乐 | `moh <file_path>\|toggle\|[on\|off]` | |
| 录音 | `record <filename>` / `norecord <filename\|all>` / `recording [start\|stop\|check\|pause\|resume] [<filename>\|all]` / `chkrecord <confname>` | 见下节 |
| 录音音量 | `file-vol <vol#>` | 调整录音/播放文件音量 |
| 提示音开关 | `enter_sound on\|off\|none\|file <filename>` / `exit_sound 同` | |
| 写参数 | `set <max_members\|sound_prefix\|caller_id_name\|caller_id_number\|endconference_grace_time> <value>` | 运行时改参数 |

按键控制之外，成员自己也能用 DTMF 完成常用操作：`0` 闭音切换、`9/8/7` 能量升降、`3/2/1` 自己发言音量、`6/5/4` 收听音量、`#` 挂断（vanilla `default` 按键组），主持人换用 `moderator-controls` 组即可拥有独立键位。

## 录音与直播旁路

### 录音

```bash
# 开始/停止录音（路径随意，wav 由 mod_sndfile 支持）
fs_cli -x "conference 3000 record /usr/local/freeswitch/recordings/3000-20260312.wav"
fs_cli -x "conference 3000 norecord /usr/local/freeswitch/recordings/3000-20260312.wav"
fs_cli -x "conference 3000 recording check"
fs_cli -x "conference 3000 recording pause /usr/local/freeswitch/recordings/3000-20260312.wav"
```

- `record` 录的是**混音后的会议声**；要单独录某一成员，在该成员的通道腿上用 `record_session`（见[静态拨号计划](/concepts/static-dialplan)）；
- `chkrecord` / `recording check` 查询当前录音状态；
- 让每个会议自动录音，在 profile 里写：

```xml
<param name="auto-record" value="$${recordings_dir}/${conference_name}_${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
```

### 直播旁路

`auto-record` 与 `record` 的目标不限于本地文件，也可以是 `shout://` 推流地址（Icecast 直播）：

```xml
<param name="auto-record" value="shout://user:pass@server.com/live.mp3"/>
```

需要加载 `mod_shout`（vanilla 里默认注释，放开 `<load module="mod_shout"/>` 并保证依赖库就位）。另一条旁路思路是用 `conference <name> dial <endpoint> ...` 把一个外部端点接入会议——呼向推流网关或一路停在 `record_session` 上的通道，形成「只听不说的旁路成员」；这类成员加入时用 `+flags{mute}` 闭音，避免旁路侧的声音回进混音。

会议视频侧的画面截图（`vid-write-png`）与视频录制见 [媒体处理模块](/modules/media)。

## 相关阅读

- [模块概述](/modules/README)——mod_conference 属于应用模块，加载方式见总闸配置；
- [媒体处理模块](/modules/media)——会议视频混屏（canvas/布局/多画布）与录制；
- [静态拨号计划](/concepts/static-dialplan)——把进线话路转进会议的拨号写法；
- [IVR 模块](/modules/ivr)——IVR 菜单转会议的典型组合；
- [配置文件结构](/configuration/config-files)——`conference.conf.xml` 的加载位置。
