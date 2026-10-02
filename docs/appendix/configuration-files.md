# 附录 A · 配置文件详解

本附录按 FreeSWITCH 1.10 的 vanilla 配置模板（源码树 `conf/vanilla/`）逐文件梳理 `conf/` 目录：每个文件干什么、关键参数是什么、改完怎么生效。章节归属与字段细节可对照 [配置文件结构](/configuration/config-files) 与 [核心配置文件](/configuration/core-files) 两章。

## 目录总览

```
conf/
├── freeswitch.xml        根文件：装配其它文件、声明 section
├── vars.xml              全局变量（$${...}）
├── mime.types            内置 HTTP 文件类型表
├── tls/                  TLS 证书与私钥
├── autoload_configs/     各模块配置（*.conf.xml）
├── sip_profiles/         SIP profile 与网关
├── dialplan/             拨号计划
├── directory/            用户目录（分机账号）
├── ivr_menus/            IVR 菜单定义
├── lang/                 多语言提示音短语
├── chatplan/             聊天（消息）路由计划
└── skinny_profiles/      SCCP 话机 profile（用 mod_skinny 才需要）
```

## freeswitch.xml

根文件，几乎不写业务，只做两件事：

| 内容 | 作用 |
| ---- | ---- |
| `<X-PRE-PROCESS cmd="include" data="vars.xml"/>` | 预处理阶段把 vars.xml 文本拼进来 |
| `<section name="configuration">` 内 include `autoload_configs/*.conf.xml` | 装载全部模块配置 |
| `<section name="dialplan">` / `directory` / `phrases` / `chatplan` | 分别 include 对应目录 |

要点：

- 预处理在 XML 解析之前执行，`X-PRE-PROCESS` **不能靠 XML 注释注释掉**，只能整行删除；
- section 名称固定，新增配置一般是往 include 的目录里加文件，而不是改根文件。

## vars.xml

预处理阶段定义全局变量（`$${var}`，启动/`reloadxml` 时求值）。常用变量：

| 变量 | 默认值 | 说明 |
| ---- | ---- | ---- |
| `default_password` | `1234` | 分机默认注册密码，**上线必改** |
| `domain` / `domain_name` | `$${local_ip_v4}` | 默认 SIP 域 |
| `sound_prefix` | `$${sounds_dir}/en/us/callie` | 提示音前缀，中文部署指向自备目录 |
| `hold_music` | `local_stream://moh` | 等待音乐 |
| `global_codec_prefs` / `outbound_codec_prefs` | `OPUS,G722,PCMU,PCMA,H264,VP8` | 编码优先级 |
| `internal_sip_port` / `external_sip_port` | `5060` / `5070` | SIP 端口 |
| `internal_tls_port` | `5061` | SIP TLS 端口 |
| `external_rtp_ip` / `external_sip_ip` | `stun:stun.freeswitch.org` | NAT 对外宣告地址，公网部署改为公网 IP |
| `rtp_start_port` / `rtp_end_port` | `16384` / `32768` | RTP 端口段 |
| `recordings_dir` | `$${base_dir}/recordings` | 录音目录 |
| `script_dir` | `$${base_dir}/scripts` | 脚本目录 |
| `console_loglevel` | `info` | 控制台日志级别 |
| `us-ring`、`cn-ring` 等 | 回铃音定义 | 各国振铃节奏 |

查看运行值用 `fs_cli -x "global_getvar"`（单个变量加名字作参数）。

## autoload_configs/ 常用配置

文件名 = `模块名.conf.xml`。最常用的几个：

| 文件 | 作用 | 关键参数 |
| ---- | ---- | ---- |
| `modules.conf.xml` | 启动加载哪些模块 | 每个模块一行 `<load module="..."/>` |
| `switch.conf.xml` | 核心交换参数 | 见下文详表 |
| `event_socket.conf.xml` | ESL 服务 | `listen-ip`、`listen-port`（8021）、`password`、`apply-inbound-acl`、`nat-map`、`stop-on-bind-error` |
| `acl.conf.xml` | 访问控制列表 | `<network-lists>` 下 `<list name=... default="allow/deny">` + `<node type="allow/deny" cidr="..."/>`；内置 `rfc1918.auto`、`localnet.auto`、`loopback.auto`、`nat.auto` |
| `logfile.conf.xml` | 文件日志 | `rotate-on-hup`、`rollover`（字节）、`maximum-rotate`、`uuid`（日志行前缀 UUID）、`<mappings>` 定义各文件记录的级别 |
| `console.conf.xml` | 控制台日志 | `<mappings>` 级别映射 |
| `lua.conf.xml` | Lua 运行时 | `script-directory`（追加 LUA_PATH）、`module-directory`（LUA_CPATH）、`startup-script`（启动常驻脚本）、`xml-handler-script`/`xml-handler-bindings`（Lua 提供 XML） |
| `sofia.conf.xml` | Sofia 汇总 | `<global_settings>` 全局参数 + include `../sip_profiles/*.xml` |
| `timezones.conf.xml` | 时区偏移表 | `<zone name="Asia/Shanghai" value="..."/>`，供时间类条件使用 |
| `xml_curl.conf.xml` | 动态 XML 网关 | `<binding>` 的 `gateway-url` 与 `bindings`（取值 `dialplan`、`directory` 等，逗号分隔可多绑） |
| `cdr_csv.conf.xml` | CSV 话单 | `default-template`（选用 `<templates>` 里的哪个模板）、`legs`（a/b/ab）、`rotate-on-hup`、`log-base` |
| `cdr_pg_csv.conf.xml` | Postgres 话单 | `db-info`（连接串）、`template` |
| `xml_cdr.conf.xml` | XML 话单 | `url`（POST 目标）、`cred`、`encode` 等提交参数 |
| `conference.conf.xml` | 会议 | `<caller-controls>` 按键控制、`<profiles>` 会议参数（码率、采样率、配音） |
| `voicemail.conf.xml` | 语音信箱 | `<settings>`、`<profiles>`、通知邮件模板 |
| `ivr.conf.xml` | IVR 引擎 | 引用 `ivr_menus/` 下菜单文件 |
| `callcenter.conf.xml` | 排队坐席（mod_callcenter） | `<queues>`、`<agents>`、`<tiers>` |
| `fifo.conf.xml` | FIFO 队列 | `<fifo>` 定义 |
| `local_stream.conf.xml` | 本地音乐流 | 等待音乐目录与参数 |
| `post_load_modules.conf.xml` | 延后加载模块 | 解决模块间加载顺序问题 |
| `tts_commandline.conf.xml` | 命令行 TTS | `command`，可用 `${text}` `${voice}` `${rate}` `${file}` |
| `pocketsphinx.conf.xml` | 离线 ASR | 语法路径与阈值 |

### switch.conf.xml 详表

| 参数 | 默认 | 说明 |
| ---- | ---- | ---- |
| `max-sessions` | `1000` | 最大并发会话数，容量上限第一闸 |
| `sessions-per-second` | `30` | 每秒新建会话上限，防突发 |
| `loglevel` | `debug` | 全局日志级别 |
| `core-db-dsn` | （注释） | core db 外移到 ODBC/PostgreSQL 的 DSN，多节点共享时配置 |
| `max-db-handles` / `db-handle-timeout` | `50` / `10` | 数据库连接池 |
| `switchname` | （注释） | HA 集群环境覆盖主机名，使多节点可用同一套配置 |
| `dialplan-timestamps` | `false` | 拨号计划日志加时间戳 |
| `min-dtmf-duration` / `max-dtmf-duration` / `default-dtmf-duration` | `400` / `192000` / `2000`（毫秒） | DTMF 时长约束 |
| `mailer-app` / `mailer-app-args` | `sendmail` / `-t` | 语音信箱等邮件通知的外发命令 |
| `dump-cores` | `yes` | 崩溃时是否生成 core |
| `verbose-channel-events` | （注释） | 事件是否附带全量通道变量 |
| `<cli-keybindings>` | F1-F12 映射 | 控制台快捷键到命令的映射 |
| `<default-ptimes>` | （注释） | 按编码覆盖默认打包时长 |

## dialplan/

| 文件 | 作用 |
| ---- | ---- |
| `default.xml` | `default` context 主文件，内部用 X-PRE-PROCESS include `default/` 目录下分片 |
| `default/*.xml` | 具体规则分片，文件名前缀（如 `00_`、`90_`）决定 include 顺序即匹配优先级；vanilla 自带 demo 分机与特征码示例 |
| `public.xml` | `public` context：来自外部的来话（external profile 默认进这里），vanilla 只有少量示例，生产按需重写 |
| `features.xml` | 特征码 context：呼叫转移等功能码 |
| `lua/` | 自带 Lua 拨号脚本示例（部分模板提供） |

关键约定：

- extension 从上到下评估，condition 用 PCRE 匹配通道变量（最常见 `destination_number`）；
- `default.xml` 里 include 顺序即优先级，新增业务规则放独立分片文件最不易冲突；
- 语法细节见 [静态拨号计划](/concepts/static-dialplan)。

## directory/

| 文件 | 作用 | 关键参数 |
| ---- | ---- | ---- |
| `default.xml` | 域定义（`<domain name="$${domain}">`） | `<params>` 的 `dial-string`（决定 bridge user/ 如何落地）；`<variables>` 域级默认变量；`<groups>` 把 `default/*.xml` 的用户编组 |
| `default/1000.xml` 等 | 单个分机 | `params/password`（注册密码）、`params/vm-password`；`variables/user_context`（呼出 context）、`effective_caller_id_name/number`、`toll_allow`（外呼权限）、`accountcode`（计费标识） |

多域部署时每个域一个 `域名.xml`；配合 `mod_xml_curl` 时整个 directory section 可改为后端动态返回。

## sip_profiles/

| 文件 | 作用 |
| ---- | ---- |
| `internal.xml` | 内部 profile：默认 5060，收分机注册与呼叫 |
| `internal/*.xml` | internal 的附加配置分片 |
| `external.xml` | 外部 profile：默认 5070，对接运营商/网关 |
| `external/gw1.xml` 等 | SIP 网关定义（对接运营商） |
| `internal.xml` 里的 `<gateways>` | 也可直接在 profile 内写网关 |

### internal.xml 关键参数

| 参数 | 默认 | 说明 |
| ---- | ---- | ---- |
| `context` | `public`（vanilla） | 该 profile 来话进入的拨号计划 context |
| `sip-port` | `$${internal_sip_port}` | 监听端口 |
| `sip-ip` / `rtp-ip` | `$${local_ip_v4}` | 监听地址 |
| `ext-sip-ip` / `ext-rtp-ip` | `$${external_sip_ip}` / `$${external_rtp_ip}` | NAT 对外宣告地址 |
| `dialplan` | `XML` | 拨号计划引擎 |
| `dtmf-duration` / `rfc2833-pt` | `2000` / `101` | DTMF 时长与 RFC2833 payload |
| `inbound-codec-prefs` / `outbound-codec-prefs` | `$${global_codec_prefs}` 等 | 编码偏好 |
| `inbound-codec-negotiation` | `generous` | 编码协商策略（`generous`/`greedy`/`scrooge`） |
| `apply-inbound-acl` | `domains` | 来话 IP 白名单（对应 acl.conf.xml 列表名） |
| `apply-nat-acl` / `local-network-acl` | `nat.auto` / `localnet.auto` | NAT 判定与本地网段判定 |
| `apply-register-acl` | （注释） | 注册请求的 IP 白名单 |
| `challenge-realm` | `auto_from` | 401 挑战的 realm |
| `record-path` / `record-template` | `$${recordings_dir}` / 按主叫+时间命名 | 该 profile 上 `record` 的默认目录与文件名模板 |
| `ws-binding` / `wss-binding` | `:5066` / `:7443` | WebRTC WebSocket 绑定 |
| `tls` / `tls-only` / `tls-sip-port` | `$${internal_ssl_enable}` / `false` / `$${internal_tls_port}` | SIP TLS |
| `aggressive-nat-detection`、`nat-options-ping` | （注释） | NAT 相关行为开关 |
| `accept-blind-reg` | （注释，默认关） | 免鉴权注册，**生产禁止打开** |
| `log-auth-failures` | `false` | 记录鉴权失败，便于防爆破采集 |

### 网关文件（external/*.xml）关键参数

| 参数 | 说明 |
| ---- | ---- |
| `gateway name` | 网关名，`sofia status gateway <name>` 查看 |
| `username` / `password` | 对接认证 |
| `realm` | 认证域，缺省取 proxy |
| `from-user` / `from-domain` | 出话时 From 头的替换 |
| `proxy` | 对端 SIP 服务器 |
| `register` | `true`/`false` 是否注册到对端 |
| `register-proxy` / `register-transport` | 注册目标与传输协议 |
| `expire-seconds` | 注册有效期 |
| `retry-seconds` | 注册失败重试间隔 |
| `ping` / `ping-min` / `ping-max` | OPTIONS 保活与判死阈值 |
| `caller-id-in-from` | 是否用主叫号替换 From |
| `extension` | 来话匹配的号码（对端呼入时落到的分机） |
| `context` | 该网关来话进入的 context |
| `cidr` | 网关来源网段 |

## ivr_menus/ 与 lang/

- `ivr_menus/*.xml`：内置 IVR 菜单定义（`<menu name=... greeting=... timeout=...>` 与 `<entry action="menu-sub|menu-exec-app|menu-play-sound" digits="1" .../>`），配合 `autoload_configs/ivr.conf.xml` 加载，`ivr <菜单名>` application 调用；
- `lang/`：按语言组织的短语（Phrase）宏与提示音索引，`playback phrase:` 时使用；中文部署可仿照 `en/us` 结构自建 `zh/cn`。

## 改什么、怎么生效

| 改动 | 生效方式 |
| ---- | ---- |
| 拨号计划、目录、vars.xml | `fs_cli -x "reloadxml"` |
| ACL 列表 | `fs_cli -x "reloadacl"` |
| 模块配置（如 logfile、event_socket） | `fs_cli -x "reload <模块名>"`（部分参数需重启模块） |
| 新增/修改网关 | `fs_cli -x "sofia profile external rescan"` |
| SIP profile 监听参数 | `sofia profile <名> restart`（会断当前该 profile 通话，选低峰期） |
| IVR 菜单、短语 | `reloadxml` |
| 全局变量 `$${}` | `reloadxml`（只影响之后的新呼叫） |

核查生效值的习惯动作：`global_getvar`、`sofia status profile <名>`、`show modules`，再打一通测试电话验证。
