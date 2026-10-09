# 第 14 章 · 语音识别与合成

客服机器人要"听得懂、说得出"，就绕不开 ASR（Automatic Speech Recognition，语音转文本）与 TTS（Text To Speech，文本转语音）。本章讲清三件事：识别的两种接入思路、FreeSWITCH 侧的对接手段（含社区音频流模块与不依赖第三方模块的通用对接法）、TTS 的两条落地路线，最后给出一份商用/自选型对比清单。

## 两种集成思路

### 媒体流旁路（实时流式）

在通话通道上挂一个 **media bug**（媒体旁路钩子），把读到的 L16 裸音频实时推给 ASR 服务，识别结果按句回流。这是智能客服的主流形态：

- 客户说完半句就能出中间结果，机器人可以在静音处抢先应答；
- 天然支持多轮对话与打断（barge-in）的雏形；
- 代价：需要一个"媒体抓流 + 传输"的通道，要么用社区模块，要么自行开发 media bug 模块。

### 逐句识别（录音文件后识别）

问答式：播放提示音 → `record` 录一段 → 挂断或静音超时后把音频文件交给 ASR → 拿到文本再走 NLP → 播报应答。每轮都是完整的"放-录-识-答"循环。

| 维度 | 媒体流旁路 | 逐句识别 |
| ---- | ---- | ---- |
| 首句响应时延 | 低（流式出字） | 高（说完才传、传完才识） |
| 实现复杂度 | 高（需抓流通道与流式接口） | 低（录音文件 + HTTP 即可） |
| 打断能力 | 可做 | 基本做不了 |
| ASR 服务要求 | 流式接口（WebSocket/MRCP） | 普通文件识别接口 |
| 适用阶段 | 生产形态 | 原型验证、坐席后质检 |

实践建议：**先用逐句识别把流程跑通，再切实时流式**。两条路的 NLP、状态机、转接逻辑完全复用，差别只在"音频怎么进识别引擎"。

## 媒体抓流：社区模块与官方模块

### mod_audio_stream（社区，WebSocket）

[amigniter/mod_audio_stream](https://github.com/amigniter/mod_audio_stream) 是目前最常被引用的音频流模块：挂载 media bug 后把 **L16** 音频通过 WebSocket 推给外部服务，也支持接收对端返回的音频（base64 编码的 wav/mp3/ogg JSON 消息）回放，因此可以同时承担"送识别 + 播应答"。其 README 给出的命令形态：

```text
# 挂载媒体 bug 并开始向 WebSocket 推流
uuid_audio_stream <uuid> start <ws-url> <mix-type> <sampling-rate> <metadata>
# 暂停 / 恢复 / 停止
uuid_audio_stream <uuid> pause
uuid_audio_stream <uuid> resume
uuid_audio_stream <uuid> stop <metadata>
```

- `mix-type`：`mono`（只取主叫）、`mixed`（双方混音单声道）、`stereo`（双声道分开左右）；
- `sampling-rate`：`8k` 或 `16k`，其它采样率由模块重采样；
- 注意它是**社区第三方模块，不在官方源码树与发行包里**，需自行编译（README 提供依赖清单与一键构建脚本，也有作者发布的带并发数限制的预编译包）。具体参数以该项目 README 为准。

### mod_audio_fork（社区，drachtio 系）

`mod_audio_fork` 诞生于 drachtio 项目的 [drachtio-freeswitch-modules](https://github.com/mdslaney/drachtio-freeswitch-modules) 仓库（`modules/mod_audio_fork`），同样是 media bug + WebSocket + L16 的路线，最初主要做**单向抓流**（送识别），为语音 AI 场景而生。`mod_audio_stream` 的 README 也说明它受 mod_audio_fork 启发。

社区里还能见到 `mod_audio_fstream` 这类名字（UDP/本地套接字推流的变体）。**这类仓库更迭频繁、镜像众多，使用前请先确认其公开仓库与维护状态**，不要假设任何一个开箱即用。

### 自己写一个 media bug 模块的思路

若现有模块都不合用（比如 ASR 服务只收 RTP/UDP，或要求私有协议），自行开发并不神秘，核心就是三步：

1. 在模块 `load` 时注册 endpoint/application，暴露类似 `start <uuid> <目标>` 的命令；
2. 命令执行时用 `switch_core_media_bug_add` 在通道上挂一个 media bug（回调标志 `SMBF_READ_STREAM` 读流，可选 `SMBF_WRITE_STREAM` 写流），命令卸载时 `switch_media_bug_remove`；
3. 回调里把 16bit PCM 按 ASR 要求打包（采样率转换可用 libspeexdsp）送到 socket/WebSocket。

官方源码树里 `mod_dptools` 的录音实现、`mod_conference` 的媒体分发都大量使用 media bug，是现成的参考代码；社区的上述模块则直接解决"抓流 + WebSocket 传输"这一段。建议把传输协议独立成小库，模块只做"抓流 + 回调"。

### 官方源码树内的相关模块

| 模块 | 作用 | 说明 |
| ---- | ---- | ---- |
| `mod_pocketsphinx` | 离线 ASR | CMU Sphinx 引擎，随源码树提供；**只适合英文与简单语法识别**，中文生产不可用；典型用法是 `play_and_detect_speech` 播提示音同时识别，结果写入通道变量 `detect_speech_result` |
| `mod_unimrcp` | MRCP 客户端 | 通过 MRCP v1/v2 协议对接支持 MRCP 的 ASR/TTS 服务（不少商用语音一体机都提供 MRCP 接入）；模块不随 FreeSWITCH 主源码树发布，需从 UniMRCP 项目获取；配置文件也不在 vanilla 模板中，需按模块文档放置 `unimrcp.conf.xml` 与 MRCP profile 后加载模块，配合 `detect:unimrcp` 与 `speak` 使用 |
| `mod_tts_commandline` | 命令行 TTS | 调一个外部命令把文本合成为 wav 再播放，配置只有一条 `command`，可用变量 `${text}` `${voice}` `${rate}` `${file}`，例如默认的 `echo ${text} \| text2wave -f ${rate} > ${file}`；是把任意"能跑命令的合成器"接进来的最小通路 |
| `mod_flite` | 内置 TTS | 英文合成引擎，验证 `speak` 通路时有用 |

## 通用对接法：ESL 订阅 + 录音文件后识别

不装任何第三方模块也能做语音识别，这就是第 13 章说的"逐句识别"路线，只需要官方自带的录音能力加一个后台程序：

1. IVR/Lua 脚本用 `record`（或 `session:recordFile`）录下客户这句话，录音结束后 FreeSWITCH 会设置通道变量 `record_seconds`、`record_samples`，并触发 `RECORD_STOP` 事件（带 `Record-Filepath` 等头）；
2. 业务后端通过 ESL 订阅 `RECORD_STOP` / `CHANNEL_EXECUTE_COMPLETE`，拿到录音路径；
3. 后端把 wav 上传给 ASR 的文件识别接口，拿到文本；
4. 走 NLP、生成应答，再用 ESL 命令播放（`uuid_broadcast` 或桥接腿播放），进入下一轮。

Lua 侧录一句并通知后端：

```lua
-- conf/scripts/asr_turn.lua — 录一句话并交给后端识别
local uuid = session:getVariable("uuid")
local rec = "/usr/local/freeswitch/recordings/" .. uuid .. ".wav"

-- 播放提问（预合成提示音），然后录客户回答：最长 15 秒，静音 3 秒提前结束
session:streamFile("ivr/ask_account_number.wav")
session:recordFile(rec, 15, 500, 3)

-- 录音结束后发自定义事件，ESL 后端订阅该事件去调 ASR
local e = freeswitch.Event("custom", "cc::asr_request")
e:addHeader("unique-id", uuid)
e:addHeader("record-path", rec)
e:addHeader("record-seconds", session:getVariable("record_seconds") or "0")
e:fire()
```

后端侧（Python，标准库即可完成 ESL 收发，协议层写法见 [动态拨号计划](/concepts/dynamic-dialplan) 一章的 `esl_client.py`）：订阅 `event plain CUSTOM cc::asr_request`，取出 `Record-Path` 头后上传识别。识别接口各家契约不同，下面是一个**骨架示例**（字段以具体厂商文档为准）：

```python
# asr_file.py — 录音文件识别的通用对接骨架
import json
import urllib.request

def transcribe(wav_path, endpoint, api_key):
    with open(wav_path, "rb") as fh:
        audio = fh.read()
    req = urllib.request.Request(
        endpoint,
        data=audio,
        headers={
            "Content-Type": "audio/wav",
            "Authorization": "Bearer " + api_key,
        },
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode())   # 结构随厂商而异
```

> 录音默认跟通道采样率一致（一般 8k/16k 单声道 wav），恰是主流 ASR 接受的格式；若厂商要求特定采样率，可设通道变量 `record_rate`（如 `record_rate=16000`），或用 sox 转码（见 [附录 B](/appendix/commands)）。

## TTS 的两条路线

### 预合成文件 + playback

把高频固定的提示语（欢迎语、菜单、常见问题答案）离线合成好，转成 8k/16k 单声道 wav 放进 `sounds/` 目录，通话里直接播放：

```xml
<action application="answer"/>
<action application="playback" data="ivr/welcome_zh.wav"/>
```

优点是零运行时依赖、延迟最低、发音可人工审校；缺点是无法播动态内容。**生产客服系统里 80% 的播报都应该是预合成文件**，TTS 只兜动态内容的底。

### 实时 TTS 对接

动态内容（余额、工单进度）有两条常见通路：

- **引擎在 FreeSWITCH 内**：通过 TTS engine 接口接入 `mod_flite` / `mod_unimrcp` / `mod_tts_commandline`，通道上设好 `tts_engine`、`tts_voice`，然后：

  ```lua
  session:setVariable("tts_engine", "tts_commandline")
  session:setVariable("tts_voice", "zh_female")
  session:speak("您本月话费为" .. amount .. "元")
  ```

  `session:speak` 底层就是 `speak` application，格式为 `tts_engine|voice|text`；
- **合成在后端，FreeSWITCH 只负责播**：后端调 TTS 服务得到音频（文件或流），再用 ESL `uuid_broadcast <uuid> <文件> both` 播放；对延迟敏感的场景可以引入本章"媒体抓流"一节的双向音频流模块，把 TTS 输出直接回灌到通话。

实时 TTS 的时延要单独压测：合成 + 传输 + 播放缓冲的累计值，决定客户听感的"机器人反应速度"。

## 商用与自选型对比

| 服务 | 能力 | 部署形态 | 中文 | 常见接入方式 |
| ---- | ---- | ---- | ---- | ---- |
| Google Cloud Speech-to-Text / Text-to-Speech | ASR + TTS | 公有云 API | 支持 | REST / gRPC 流式 |
| Microsoft Azure AI Speech | ASR + TTS（可自定义语音） | 公有云，部分区域私有化 | 支持 | REST / WebSocket SDK |
| IBM Watson Speech to Text / Text to Speech | ASR + TTS | 公有云 / 云私有化 | 支持 | REST / WebSocket |
| Amazon Transcribe / Polly | ASR / TTS | 公有云 API | Transcribe 中文支持、Polly 中文音色有限 | AWS SDK |
| 科大讯飞开放平台 | ASR + TTS（语音转写、实时语音流） | 公有云 / 私有化一体机 | 强 | REST / WebSocket SDK |
| 阿里云智能语音交互 | ASR + TTS | 公有云 / 专有云 | 强 | WebSocket / SDK |
| 腾讯云语音识别 / 语音合成 | ASR + TTS | 公有云 | 强 | REST / WebSocket |
| 百度智能云语音技术 | ASR + TTS | 公有云 / 私有化 | 强 | REST / SDK |
| 自托管：UniMRCP + 商用 MRCP 引擎 | ASR + TTS | 私有化（MRCP 协议） | 视引擎 | `mod_unimrcp` |
| 自托管：Vosk、PocketSphinx 等开源引擎 | ASR | 私有化 | Vosk 有中文模型 | WebSocket（配合音频流模块） |
| 自托管：`mod_pocketsphinx` | ASR | 随源码树 | 仅英文 | `play_and_detect_speech` |

选型时的实际考量，比"谁家准确率高"更重要：

- **是否需要私有化**：金融、政务场景往往要求音频不出内网，直接排除纯公有云 API；
- **流式接口的时延与并发单价**：逐句识别便宜但体验差，流式识别按音频时长计费要先做容量测算；
- **中文热词与行业词表**：客服场景的专有名词（套餐名、机型名）能否自定义提升识别率，是中文项目拉开差距的点；
- **计费与合规**：录音与转写文本属于个人信息，存储期限与脱敏要求先问清楚。

本章只做对比，不绑定任何厂商的具体 SDK 调用——接入层统一收口在自行开发的"语音网关"服务里，交换层只认识这个网关，换厂商只改一处。

## 相关阅读

- [录音与监听](/advanced/recording)：media bug 的底层机制与三种录音入口；
- [脚本与编程接口](/advanced/scripting)：Lua 脚本的执行模型与 `session:recordFile` 等 API；
- [事件系统](/advanced/events)：`RECORD_STOP` 等事件的订阅与解析；
- [网络设置](/configuration/network)：媒体流旁路涉及的 RTP 端口与防火墙；
- [第 15 章 · 自然语言处理](/project/nlp)：拿到转写文本之后的意图识别与应答。
