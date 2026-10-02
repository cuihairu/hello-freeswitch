# 附录 B · 常用命令与工具

本附录汇总日常运维与排障最常用的 `fs_cli` api 命令与系统工具。命令均对照 FreeSWITCH 1.10 源码核对过语法（`mod_commands`、`mod_sofia` 等），可放心照抄后按需替换参数。

## fs_cli 基本用法

```bash
fs_cli                                # 连接本机 8021，进入交互控制台
fs_cli -x "status"                    # -x 执行单条命令后退出（脚本友好）
fs_cli -H 10.0.0.5 -p ClueCon -x "sofia status"   # -H 主机 -P 端口 -p 密码
```

交互模式下的内置控制命令（以 `/` 开头，不是 api 命令）：

| 内置命令 | 作用 |
| ---- | ---- |
| `/log <level>` | 调整日志显示级别（如 `/log debug`） |
| `/event <事件>` | 订阅事件（如 `/event CHANNEL_ANSWER`、`/event plain ALL`） |
| `/filter <条件>` | 过滤控制台事件输出 |
| `/help` | 帮助 |
| `/quit` | 退出 |

## 常用 api 命令

### 系统与状态

| 命令 | 说明 | 示例 |
| ---- | ---- | ---- |
| `version` | 查看 FreeSWITCH 版本 | `fs_cli -x "version"` |
| `status` | 运行状态、会话数、SPS | `fs_cli -x "status"` |
| `uptime` | 运行时长 | `fs_cli -x "uptime"` |
| `show channels` | 当前全部通道 | `fs_cli -x "show channels"` |
| `show channels count` | 通道计数 | `fs_cli -x "show channels count"` |
| `show channels like 1000` | 按条件过滤通道 | `fs_cli -x "show channels like 1000"` |
| `show calls` | 桥接中的通话 | `fs_cli -x "show calls"` |
| `show detailed_calls` | 通话详情视图 | `fs_cli -x "show detailed_calls"` |
| `show registrations` | 已注册分机 | `fs_cli -x "show registrations"` |
| `show modules` | 已加载模块 | `fs_cli -x "show modules"` |
| `show application` | 可用的 application（加名字查详情） | `fs_cli -x "show application"` |
| `show api` | 可用的 api 命令 | `fs_cli -x "show api"` |
| `show codec` | 已加载的编解码 | `fs_cli -x "show codec"` |
| `show dialplan` | 内存中的拨号计划 | `fs_cli -x "show dialplan"` |
| `show tasks` | 内核定时任务 | `fs_cli -x "show tasks"` |

### 呼叫控制（uuid 系列）

以下 `<uuid>` 均可用 `show channels` 查到：

| 命令 | 语法 | 说明 |
| ---- | ---- | ---- |
| `uuid_kill` | `<uuid> [cause]` | 挂断通话，cause 默认 `NORMAL_CLEARING` |
| `uuid_park` | `<uuid>` | 停驻通话 |
| `uuid_bridge` | `<uuid1> <uuid2>` | 直接桥接两条已存在通道 |
| `uuid_transfer` | `<uuid> [-bleg\|-both] <dest-exten> [<dialplan>] [<context>]` | 转接到某分机/号码 |
| `uuid_broadcast` | `<uuid> <path> [aleg\|bleg\|holdb\|both]` | 在通话上播一段音频 |
| `uuid_record` | `<uuid> [start\|stop\|mask\|unmask] <path> [<limit>]` | 开始/停止/遮蔽录音，limit 为秒数 |
| `uuid_dump` | `<uuid> [format]` | 打印全部通道变量 |
| `uuid_getvar` | `<uuid> <var>` | 读单个通道变量 |
| `uuid_setvar` | `<uuid> <var> [value]` | 写通道变量 |
| `uuid_answer` | `<uuid>` | 应答该通道 |
| `uuid_send_dtmf` | `<uuid> <dtmf_data>` | 向通道发送 DTMF |
| `uuid_media` | `[off] <uuid>` | 触发媒体重协商（re-INVITE），`off` 为旁路媒体 |
| `uuid_hold` | `[off\|toggle] <uuid> [<display>]` | 保持/恢复通话 |

示例：

```bash
fs_cli -x "uuid_broadcast <uuid> /usr/local/freeswitch/sounds/reply.wav both"
fs_cli -x "uuid_record <uuid> start /usr/local/freeswitch/recordings/a.wav 300"
fs_cli -x "uuid_transfer <uuid> 1001 XML default"
fs_cli -x "uuid_kill <uuid> CALL_REJECTED"
```

### 呼叫发起

`originate <call url> <exten>|&<application_name>(<app_args>) [<dialplan>] [<context>] [<cid_name>] [<cid_num>] [<timeout_sec>]`：

```bash
# 呼叫内部分机并回声测试
fs_cli -x "originate user/1000 &echo()"
# 呼出并停驻（常用于先建腿再 uuid_bridge）
fs_cli -x "originate user/1001 &park()"
# 带主叫与变量、经网关呼外线
fs_cli -x "originate {origination_caller_id_number=057188887777,ignore_early_media=true}sofia/gateway/gw1/13800138000 &playback(/srv/prompts/notify.wav)"
# 批量制造并发（压测）
fs_cli -x "originate loopback/8000 &park()"
```

配套命令：`hupall`（挂断全部或匹配某变量的通话，如 `hupall NORMAL_CLEARING`）、`show channels count` 观察结果。

### 配置与模块

| 命令 | 说明 |
| ---- | ---- |
| `reloadxml` | 重载全部 XML 配置（改 dialplan/directory/vars 后必做） |
| `reloadacl` | 重载 `acl.conf.xml` |
| `reload <模块名>` | 重载某模块（如 `reload mod_event_socket`） |
| `load <模块名>` / `unload <模块名>` | 动态加载/卸载模块 |
| `global_getvar` | 列出全部全局变量；`global_getvar domain_name` 查单个 |
| `global_setvar` | 设置全局变量（如 `global_setvar myflag=on`） |
| `xml_locate dialplan name default` | 查看拼接展开后的配置 XML |
| `eval ${...}` | 求值一个变量表达式 |

### Sofia（SIP）

| 命令 | 说明 |
| ---- | ---- |
| `sofia status` | 所有 profile 概览（是否 RUNNING） |
| `sofia status profile internal` | profile 详情：端口、ACL、注册数、会话统计 |
| `sofia status gateway gw1` | 网关状态（REGED/FAIL_WAIT 等） |
| `sofia profile internal rescan` | 重扫 profile/gateway 配置（新增网关用） |
| `sofia profile internal restart` | 重启 profile（会断当前通话，低峰期操作） |
| `sofia profile internal siptrace on` / `off` | 开关 SIP 信令跟踪 |
| `sofia global siptrace on` / `off` | 全局信令跟踪 |
| `sofia loglevel all 9` | Sofia 日志级别临时调到最高 |
| `sofia profile internal flush_inbound_reg <user>` | 清除某用户的注册缓存 |
| `sofia profile internal killgw gw1` | 删除某网关 |
| `sofia xmlstatus profile internal` | 以 XML 输出状态（程序采集友好） |

### 脚本与运行时控制

| 命令 | 说明 | 示例 |
| ---- | ---- | ---- |
| `luarun` | 在独立线程运行 Lua 脚本（无 session） | `fs_cli -x "luarun test.lua arg1"` |
| `lua` | 内联运行 Lua 脚本并等待结束 | `fs_cli -x "lua test.lua"` |
| `fsctl` | 运行时控制 | `fsctl loglevel err`、`fsctl sps 50`、`fsctl max_sessions 500`、`fsctl send_sighup` |
| `console loglevel <级别>` | 控制台日志级别（0-7 或名称） | `fs_cli -x "console loglevel 3"` |
| `bgapi <命令>` | 后台线程执行 api，事件返回结果 | `bgapi originate user/1000 &park()` |
| `getenv`、`eval`、`cond` 等小工具 | 杂项 | `fs_cli -x "getenv HOME"` |

## 常用工具

### sngrep：SIP 抓包分析

比 Wireshark 更聚焦 SIP 的终端工具，按 Call-ID 串联时序图，排注册/呼叫问题首选：

```bash
sudo sngrep                          # 实时抓取（默认第一个非回环网卡）
sudo sngrep -d any port 5060         # 指定网卡与端口
sudo sngrep -r port 5060             # 连 RTP 一起抓，可看媒体流
sudo sngrep -O /tmp/sip.pcap port 5060        # 抓包并存为 pcap
sngrep -I /tmp/sip.pcap              # 离线分析 pcap
```

### tcpdump：底层抓包

```bash
# 抓 SIP 信令（保存完整包，sngo/Wireshark 离线分析）
sudo tcpdump -ni any -s 0 udp port 5060 -w /tmp/sip.pcap
# 快速确认 RTP 是否双向流动
sudo tcpdump -ni any udp portrange 16384-32768 -c 100
# 只看某个终端的流量
sudo tcpdump -ni eth0 host 192.168.1.50 and port 5060
# 读取已有 pcap
sudo tcpdump -nr /tmp/sip.pcap | head
```

### sox / soxi：录音处理

提示音格式转换与录音体检的标配：

```bash
soxi --i recording.wav                 # 查看格式信息（采样率/声道/时长）
soxi -D recording.wav                  # 只看时长（秒）
# 转成 8k 单声道 16bit wav（IVR 提示音标准格式）
sox input.mp3 -r 8000 -c 1 -b 16 output.wav
# 混音（如把等待音乐与提示音合成）
sox -m music.wav prompt.wav mixed.wav
# 拼接两段提示音
sox welcome.wav menu.wav combined.wav
# 淡入淡出后导出
sox in.wav out.wav fade t 0.3 0 0.5
```

### 其它

| 工具 | 用途 | 示例 |
| ---- | ---- | ---- |
| `tshark` | 命令行 Wireshark，可用显示过滤器 | `tshark -i eth0 -f 'port 5060' -Y 'sip.Method == REGISTER'` |
| `openssl s_client` | 验证 SIP TLS 端口 | `openssl s_client -connect 127.0.0.1:5061` |
| `openssl s_client`（WSS） | 验证 WebRTC WSS | `openssl s_client -connect 127.0.0.1:7443` |
| `ss` | 查监听端口 | `ss -lntup \| grep -E '5060\|8021'` |
| `lsof` | 查进程打开的文件/端口 | `lsof -p $(pidof freeswitch) \| grep recordings` |
| `pjsua`/`sipcmd` 类命令行话机 | 无人值守的注册/呼叫回归测试 | 按工具各自文档 |

## 使用习惯建议

- 排障先 `/log debug` 或 `sofia profile internal siptrace on`，看到现象再收敛级别，避免长期全量 debug 写爆磁盘；
- `fs_cli -x` 适合脚本与监控采集，交互模式适合人工排查；
- 任何配置改动后先 `reloadxml` 再打测试电话，用 `uuid_dump` 核对通道变量是否符合预期。
