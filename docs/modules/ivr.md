# IVR 模块

IVR（Interactive Voice Response，交互式语音应答）是「听提示音、按键、走分支」的总机逻辑。FreeSWITCH 内置两套实现：XML 定义的**菜单式 IVR**（`ivr_menus/`，由 `ivr` application 执行）与**脚本化 IVR**（Lua/ESL 自己控制收放号）。本章覆盖前者，并把两者串起来。

## 什么是 IVR

一通进线电话被接听后播放引导语音，主叫按键（DTMF）选择去向：转分机、进会议、查话费、留言……按键收集与播放提示音循环进行，直到命中某个出口。构成 IVR 只需要三样东西：

1. **提示音**：wav 文件、`tone_stream://` 合成音或 TTS；
2. **菜单逻辑**：哪个键去哪里、超时/输错怎么办；
3. **出口动作**：`transfer` 转分机、`bridge` 外呼、进会议或语音信箱。

FreeSWITCH 的拨号计划本身就是分支引擎，IVR 只是「按键驱动的拨号计划」。

## IVR 菜单配置

### 菜单文件与加载

菜单定义在 `conf/ivr_menus/*.xml`，由 `autoload_configs/ivr.conf.xml` 装配进 `ivr.conf` 的 `<menus>`：

```xml
<configuration name="ivr.conf" description="IVR menus">
  <menus>
    <X-PRE-PROCESS cmd="include" data="../ivr_menus/*.xml"/>
  </menus>
</configuration>
```

在该目录新建文件即可，无需改其它配置；写完 `fs_cli -x "reloadxml"` 生效。

### 完整可跑的菜单示例

一个「总机 + 销售子菜单」的最小完整配置（文件名随意，如 `conf/ivr_menus/company.xml`）：

```xml
<include>
  <!-- 主菜单 -->
  <menu name="company_main"
      greet-long="phrase:company_main_greeting"
      greet-short="phrase:company_main_greeting"
      invalid-sound="ivr/ivr-that_was_an_invalid_entry.wav"
      exit-sound="voicemail/vm-goodbye.wav"
      timeout="10000"
      inter-digit-timeout="2000"
      max-failures="3"
      max-timeouts="3"
      digit-len="4">
    <entry action="menu-exec-app" digits="1" param="transfer 1000 XML default"/>
    <entry action="menu-exec-app" digits="2" param="transfer 1001 XML default"/>
    <entry action="menu-exec-app" digits="3" param="bridge sofia/gateway/carrier1/10086"/>
    <entry action="menu-sub" digits="4" param="company_sales"/>
    <!-- digits 支持 PCRE 正则，捕获组用 $1 引用 -->
    <entry action="menu-exec-app" digits="/^(10[0-9]{2})$/" param="transfer $1 XML default"/>
    <entry action="menu-top" digits="9"/>
    <entry action="menu-exit" digits="0"/>
  </menu>

  <!-- 子菜单 -->
  <menu name="company_sales"
      greet-long="phrase:company_sales_greeting"
      invalid-sound="ivr/ivr-that_was_an_invalid_entry.wav"
      exit-sound="voicemail/vm-goodbye.wav"
      timeout="10000"
      max-failures="3">
    <entry action="menu-exec-app" digits="1" param="transfer 2001 XML default"/>
    <entry action="menu-back" digits="*"/>
  </menu>
</include>
```

菜单属性速查（均来自 `switch_ivr_menu.c` 支持的属性）：

| 属性 | 含义 |
| ---- | ---- |
| `name` | 菜单名，`ivr` application 用它调起 |
| `greet-long` | 完整欢迎语，首次进入播放；支持 `phrase:`、`say:`（TTS）、文件路径 |
| `greet-short` | 输错/循环时播放的短提示 |
| `invalid-sound` | 无效按键提示 |
| `exit-sound` | 离开菜单时播放 |
| `timeout` | 等待首个按键的时长（毫秒） |
| `inter-digit-timeout` | 多位数字之间的间隔超时（毫秒） |
| `max-failures` | 无效按键几次后退出 |
| `max-timeouts` | 超时几次后退出 |
| `digit-len` | 一次收号的最大位数 |
| `confirm-macro` / `confirm-key` / `confirm-attempts` | 收号后用确认键复核（如确认分机号） |
| `tts-engine` / `tts-voice` | 使用 `say:` 文本提示时指定 TTS 引擎与音色 |

`<entry>` 的动作只有六种：

| action | 语义 |
| ---- | ---- |
| `menu-exec-app` | 执行一个 application 及其参数（`param` 即完整命令串），最常用 |
| `menu-sub` | 进入子菜单（`param` 为子菜单名） |
| `menu-top` | 回到主菜单重播提示 |
| `menu-back` | 返回上一级菜单 |
| `menu-play-sound` | 只播放一段声音（`param` 为文件或 `say:` 文本） |
| `menu-exit` | 挂断退出 |

### 在拨号计划中调起

```xml
<include>
  <!-- conf/dialplan/default/20-ivr.xml -->
  <extension name="company_ivr">
    <condition field="destination_number" expression="^(5000)$">
      <action application="answer"/>
      <action application="sleep" data="500"/>
      <action application="ivr" data="company_main"/>
    </condition>
  </extension>
</include>
```

`ivr` application 只接受菜单名；菜单必须能在 `ivr.conf` 的 `<menus>` 里按名字找到，否则日志报 `Unable to find menu`。进线话路（public context 的 DID）转进这个分机即可完成「外线呼入走 IVR」。

验证：`fs_cli -x "reloadxml"` 后拨打 5000，控制台能看到 `ivr` 菜单的执行日志；改菜单后忘了 reload 是最常见的「菜单不生效」原因。

## phrase 与提示音

### 提示音从哪来

`menu-*` 属性与 `menu-play-sound` 里的相对路径（如 `ivr/ivr-that_was_an_invalid_entry.wav`）会到 `sounds_dir`（vanilla 默认 `$${base_dir}/sounds`）下解析；`$${sound_prefix}`（默认 `$${sounds_dir}/en/us/callie`）提供了英文提示音全集。常用三种来源：

- **现成提示音**：`ivr/ivr-welcome_to_freeswitch.wav`、`voicemail/vm-goodbye.wav` 等随声音包安装（demo 宏即这样拼 greeting）；
- **自录/外包音频**：放到 `sounds_dir` 下的自定义目录，如 `custom/company_main.wav`；
- **合成音**：`tone_stream://%(200,0,500,600,700)` 生成一个短 beep，无需任何文件。

### phrase 宏

同一句提示往往要拼接动态内容（报数字、报名字），phrase 引擎把「播一段音频 + 报数字 + 再播一段」封装成可复用的**宏**。宏文件放在 `conf/lang/en/ivr/*.xml`——`lang/en/en.xml` 会把该目录整体 include 进 `<languages>`，新建文件即可生效：

```xml
<include>
  <macro name="company_main_greeting">
    <input pattern="^(.*)$">
      <match>
        <action function="play-file" data="ivr/ivr-welcome_to_freeswitch.wav"/>
        <action function="play-file" data="custom/company_main.wav"/>
      </match>
    </input>
  </macro>

  <macro name="company_sales_greeting">
    <input pattern="^(.*)$">
      <match>
        <action function="play-file" data="custom/company_sales.wav"/>
        <action function="say" data="$1" method="pronounced" type="items"/>
      </match>
    </input>
  </macro>
</include>
```

- `<input pattern>` 是 PCRE，`$1` 等捕获组在 `<match>` 里引用，实现按内容拼接播报；
- `function` 支持 `play-file`（放文件）、`say`（数字/时间等经 say 模块播报）、`sleep`；
- 引用处写 `phrase:<宏名>`——菜单的 `greet-long`、`playback` 都认这个前缀。

## 脚本化 IVR：Lua playAndGetDigits

菜单 XML 表达不了「先查数据库再决定去向」这类逻辑，此时用脚本自己控制收放号。`session:playAndGetDigits(...)` 是最核心的一个原语（其余 Lua 基础见 [动态拨号计划](/concepts/dynamic-dialplan)）：

```lua
-- conf/scripts/ivr_survey.lua
-- 参数：min, max, tries, timeout_ms, terminators,
--       提示音, 无效提示音, 正则, 结果变量名, 位间超时, 失败转接目标
local digits = session:playAndGetDigits(1, 4, 3, 8000, "#",
    "phrase:company_main_greeting",
    "ivr/ivr-that_was_an_invalid_entry.wav",
    "\\d+", "choice", 5000, "")

if digits == "1" then
  session:transfer("1000", "XML", "default")
elseif digits == "9" then
  session:hangup()
else
  -- 收号结果同时存在于通道变量 choice 中
  session:execute("transfer", digits .. " XML default")
end
```

要点：

- 返回值即收到的按键串；正则不匹配会重播无效提示音并计入 `tries`；
- `tries` 次用尽后，若给了最后一个参数（如 `"5001 XML default"`），会自动转接到该目标兜底；
- 播放用 `session:execute("playback", file)`（或 `session:streamFile(file)`），应答用 `session:answer()`，离开前判断 `session:ready()` 避免对已挂断通道继续操作。

## 动态 IVR 思路

菜单固定在 XML 里只适合静态业务，动态化有三条常见路线：

1. **菜单/短语接口化**：用 `mod_xml_curl` 绑定 `dialplan`、`phrase` 等 section，把菜单结构与提示语交给 HTTP 接口实时返回，菜单与话术随业务后台变更（机制见[动态拨号计划](/concepts/dynamic-dialplan)）；
2. **呼叫控制接口化**：`mod_httapi` 让 HTTP 接口直接驱动这通电话——接口返回「放这段音、收 4 位号、转 1000」的动作序列，菜单逻辑完全在服务端代码里；
3. **脚本 + 数据库**：Lua 脚本查库后动态拼 `transfer`/`bridge` 目标，或整通电话用 ESL 从外部程序发起与操控（见本手册高级功能篇）。

语音识别与合成接入（`mod_flite`、`mod_tts_commandline`、`mod_pocketsphinx` 等模块提供 TTS/ASR 能力，需另行构建启用）可以把「按键选择」升级为「说话选择」，属于 IVR 与智能语音的衔接，实战部分再展开。

## 相关阅读

- [静态拨号计划](/concepts/static-dialplan)——IVR 各出口最终落到拨号计划；
- [动态拨号计划](/concepts/dynamic-dialplan)——Lua/mod_xml_curl/ESL 三条动态化路线；
- [会议模块](/modules/conference)——IVR 常见的出口之一：转会议；
- [配置文件结构](/configuration/config-files)——`ivr_menus/`、`lang/` 在 `conf/` 中的位置；
- [模块概述](/modules/README)——`ivr`、`play_and_get_digits` 这些 application 由哪个模块提供。
