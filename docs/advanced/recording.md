# 录音与监听

录音（把通话写进文件）和监听（把通话实时放给第三人听）都基于同一套底层机制——媒体流旁路（media bug）：在通道的音频流上挂一个"分接点"，一边可以写文件，一边可以混音给监听者。区别只在入口：本章按使用场景讲三种录音入口、路径变量、实时监听，最后给出文件清理的落地脚本。

## 通话录音的三种方式

### record_session 应用：边通话边写盘

`record_session` 是 dialplan 里的 application，一旦执行就在当前通话上挂媒体旁路开始写文件，通话结束自动收尾：

```xml
<!-- dialplan/default/90-record.xml -->
<extension name="record_inbound">
  <condition field="destination_number" expression="^6001$">
    <action application="set" data="RECORD_STEREO=true"/>
    <action application="set" data="record_sample_rate=8000"/>
    <action application="record_session"
            data="$${recordings_dir}/${caller_id_number}-${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
    <action application="bridge" data="user/1001"/>
  </condition>
</extension>
```

语法是 `record_session <path> [+<timeout>]`，可选的 `+<timeout>` 限定最长录音秒数。它常用的配套变量：

| 变量 | 作用 |
| ---- | ---- |
| `RECORD_STEREO=true` | 双声道：一路是收到的音频，一路是发出的音频，事后可分开还原双方 |
| `RECORD_STEREO_SWAP=true` | 同上，但交换左右声道 |
| `RECORD_READ_ONLY=true` / `RECORD_WRITE_ONLY=true` | 只录单方向 |
| `RECORD_APPEND=true` | 文件已存在时追加而不是覆盖 |
| `RECORD_ANSWER_REQ=true` | 应答之后才开始录 |
| `RECORD_BRIDGE_REQ=true` | bridge 之后才开始录 |
| `record_sample_rate` | 录音采样率 |
| `RECORD_MIN_SEC` | 短于该秒数的文件视为无效直接丢弃，默认 0（不丢弃）；开启 `RECORD_APPEND` 时核心会把它固定为 3 秒 |
| `RECORD_SILENCE_THRESHOLD` | 静音判定阈值 |
| `RECORD_PRE_BUFFER_FRAMES` | 预缓冲帧数（补录音启动瞬间的音频） |
| `RECORD_HANGUP_ON_ERROR=true` | 录音出错时挂断通话（默认只记日志） |

配套的兄弟 application：`stop_record_session <path>`（提前停止）、`record_session_pause` / `record_session_resume`（暂停/恢复写入）、`record_session_mask` / `record_session_unmask`（把这段录音替换成静音而通话本身不受影响，用于支付等场景屏蔽敏感内容）。

通话中动态触发的典型做法是用 `bind_meta_app` 绑按键（vanilla 配置里就是绑在 `*2`），通话双方在通话中按键即可开始录音：

```xml
<!-- bind_meta_app 语法：<key> [a|b|ab] [a|b|o|s|i|1] <app> -->
<action application="bind_meta_app"
        data="2 b s record_session::$${recordings_dir}/${caller_id_number}.${strftime(%Y-%m-%d-%H-%M-%S)}.wav"/>
```

按键序列的前缀默认是 `*`，可用 `bind_meta_key` 变量改成别的键。

### uuid_record API：对任意通话随时开始/停止

不进 dialplan，运维或外部程序（ESL、fs_cli）随时可以对一条活着的通话操作：

```text
freeswitch@fs01> uuid_record <uuid> start /usr/local/freeswitch/recordings/call-a.wav
+OK Success
freeswitch@fs01> uuid_record <uuid> stop /usr/local/freeswitch/recordings/call-a.wav
+OK Success
```

完整语法：

```text
uuid_record <uuid> [start|stop|mask|unmask] <path> [<limit>] [<recording_vars>]
```

- `<limit>`：最长秒数；
- `<recording_vars>`：用 `{}` 包起来的变量表，临时覆盖通道上的 `RECORD_*` 变量，例如 `uuid_record <uuid> start /tmp/x.wav 0 {RECORD_STEREO=true}`；
- `mask` / `unmask`：让这段录音里写入静音（通话不受影响）/恢复写入真实音频，同样用于屏蔽敏感内容。

结合第 10 章的事件：录音真正开始和结束时会有 `RECORD_START` / `RECORD_STOP` 事件，外部系统可以用它们核对每一条录音文件是否落盘。

### record 应用：录一段留言

`record` 录的是**当前这条腿的输入音频**，录到结束键、挂断或超时为止——语音留言、IVR 留言录入就是这么做的：

```xml
<extension name="record_message">
  <condition field="destination_number" expression="^7001$">
    <action application="answer"/>
    <action application="playback" data="vm/vm-record_message.wav"/>
    <action application="record"
            data="$${recordings_dir}/msg-${caller_id_number}-${strftime(%Y-%m-%d-%H-%M-%S)}.wav 60 500 3"/>
  </condition>
</extension>
```

`record` 的参数格式是 `<path> [+<limit>] [<thresh>] [<silence_hits>]`：

- `<limit>`：最长秒数，可带 `+` 前缀；
- `<thresh>`：静音判定阈值；
- `<silence_hits>`：静音命中次数，够了就提前结束（相当于"说完自动停"）。

按结束键停止录音，默认是 `*`（与 `playback` 共用 `playback_terminators` 变量，设为 `any` 表示任意键、`none` 表示不响应按键），用过的按键会写进 `playback_terminator_used` 变量，便于事后判断是主动结束还是自然结束。采样率可用 `record_rate` 变量指定。

## 录音格式与路径变量

### ${uuid} 与 $${recordings_dir}

录音路径由两个变量族拼出来，注意单双 `$` 的区别（见[核心配置文件](/configuration/core-files)）：

- `${uuid}`：**通道变量**，每通电话不同。用它命名可以和事件里的 `Unique-ID`、CDR 记录精确对上，是对账、回查的推荐做法：

```xml
<action application="record_session" data="$${recordings_dir}/${uuid}.wav"/>
```

- `$${recordings_dir}`：**全局变量**，由核心自动定义（编译安装默认是安装目录下的 `recordings/`），无需在 vars.xml 里手工设置。录音目录建议就放在它下面，再按日期分目录：

```xml
<action application="record_session"
        data="$${recordings_dir}/${strftime(%Y-%m-%d)}/${uuid}.wav"/>
```

- `${strftime(...)}`：时间模板，把年月日时分秒揉进文件名，天然避免重名。

文件格式由扩展名决定，`.wav` 最常用（由 mod_sndfile 写出）；立体声录音（`RECORD_STEREO`）左声道是收到的音频、右声道是发出的音频。

## 实时监听（eavesdrop）

`eavesdrop` 是 mod_dptools 提供的 application，语法 `eavesdrop [all | <uuid>]`：被监听通话的音频被实时混入监听者的通话里，监听者自己不发声，对方无感知。

### 按分机监听：uuid 从哪里来

监听要 uuid，vanilla 配置的做法值得抄：每通电话进来时，把"主叫号码 → uuid"存进 hash 表，监听时查表。两步配合：

第一步，在来电路由里登记 uuid（vanilla `default.xml` 的 Local_Extension 里已有这行）：

```xml
<action application="hash" data="insert/${domain_name}-spymap/${caller_id_number}/${uuid}"/>
```

第二步，拨 `88+分机号` 时查表取出 uuid 进入监听：

```xml
<extension name="spy_on_extension">
  <condition field="destination_number" expression="^88(\d{4})$">
    <action application="answer"/>
    <action application="eavesdrop" data="${hash(select/${domain_name}-spymap/$1$2)}"/>
  </condition>
</extension>
```

uuid 也可以来自你自己的业务系统：外部程序先订阅 `CHANNEL_CREATE` 事件记下每通电话的 `Unique-ID`；要监听时，通过 `execute_extension` 把 uuid 放进通道变量交给 dialplan 去执行 `eavesdrop`（`eavesdrop` 只有 dialplan application 一种形式，没有对应的 uuid_* API）。

### 监听全部通话

vanilla 里还有一段"监听所有通话"的示范，拨 779 进入后自动轮巡当前所有通话：

```xml
<extension name="spy_all">
  <condition field="destination_number" expression="^779$">
    <action application="answer"/>
    <action application="set" data="eavesdrop_indicate_failed=tone_stream://%(500, 0, 320)"/>
    <action application="set" data="eavesdrop_indicate_new=tone_stream://%(500, 0, 620)"/>
    <action application="set" data="eavesdrop_indicate_idle=tone_stream://%(250, 0, 920)"/>
    <action application="eavesdrop" data="all"/>
  </condition>
</extension>
```

`all` 模式下：有新通话进来会先给 `eavesdrop_indicate_new` 提示音，切到下一个；没有可监听的通话时循环播放 `eavesdrop_indicate_idle`；切换失败播 `eavesdrop_indicate_failed`。

### 监听过程中的 DTMF 控制

监听者可以随时用按键控制听什么（默认开启，可用 `eavesdrop_enable_dtmf=false` 关闭）：

| 按键 | 作用 |
| ---- | ---- |
| `1` | 只听 A 腿方向（read 流，即 `eavesdrop_whisper_aleg` 对应的方向） |
| `2` | 只听 B 腿方向（write 流，即 `eavesdrop_whisper_bleg` 对应的方向） |
| `3` | 两个方向都听（默认） |
| `0` | 静音，什么都听不到 |
| `*` | 结束当前监听（`all` 模式下切到下一个通话） |

### 监听相关的通道变量

| 变量 | 作用 |
| ---- | ---- |
| `eavesdrop_enable_dtmf` | 是否允许监听者用按键切换，默认允许 |
| `eavesdrop_whisper_aleg` / `eavesdrop_whisper_bleg` | 为 true 时固定只混入对应方向的音频 |
| `eavesdrop_bridge_aleg` / `eavesdrop_bridge_bleg` | bridge 场景下选择混入哪条腿桥接的音频，默认两条都混 |
| `eavesdrop_require_group` | 只监听带相同组标记的通话 |
| `eavesdrop_indicate_new` / `eavesdrop_indicate_idle` / `eavesdrop_indicate_failed` | `all` 模式的三种提示音 |

## 录音文件管理与自动清理

录音是写盘大户，必须配上保留策略，否则磁盘迟早被吃满。

### 命名与归档建议

- 主键用 `${uuid}`，需要人工翻查时再补一份按主叫号、日期的软链接或索引表；
- 按天分目录（`${strftime(%Y-%m-%d)}`），清理时可以整目录删除，比扫大目录快得多；
- 计费、质检等下游系统以 `RECORD_START` / `RECORD_STOP` 事件或 CDR 对账，不要靠扫盘。

### 清理脚本示例

按保留天数删除过期录音并顺手清掉空目录：

```bash
#!/bin/sh
# cleanup_recordings.sh —— 删除 N 天前的录音文件
RECORD_DIR="/usr/local/freeswitch/recordings"
KEEP_DAYS=7

[ -d "$RECORD_DIR" ] || exit 1

find "$RECORD_DIR" -type f \( -name '*.wav' -o -name '*.mp3' \) -mtime +${KEEP_DAYS} -delete

# 顺手删掉日期目录留下的空壳
find "$RECORD_DIR" -mindepth 1 -type d -empty -delete
```

放进 cron，每天凌晨低峰期执行：

```text
30 3 * * * /usr/local/freeswitch/scripts/cleanup_recordings.sh >> /var/log/cleanup_recordings.log 2>&1
```

注意事项：

- `-delete` 是 GNU find 的参数，BusyBox 环境换成 `-exec rm -f {} \;`；
- 删之前先确认下游（质检、纠纷回查）真的不需要了；合规行业有最短保留年限，保留期应来自业务与法规，而不是拍脑袋的 7 天；
- 磁盘水位监控比事后清理更重要：`RECORD_STOP` 事件里可以顺带把文件时长写进库里，配合监控告警。

## 相关阅读

- [会话 (Session)](/concepts/session)：`${uuid}` 等通道变量从哪里来；
- [动态拨号计划](/concepts/dynamic-dialplan)：把录音/监听逻辑交给 Lua 脚本动态决策；
- [核心配置文件](/configuration/core-files)：`$${recordings_dir}` 等全局变量的定义与生效方式。
