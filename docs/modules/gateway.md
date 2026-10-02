# 网关模块

网关（gateway）是 FreeSWITCH 与外部电话世界对接的「线路定义」：运营商 SIP 中继、企业 SBC、对接的另一套 PBX，都配置成一个网关。它由 `mod_sofia` 的 external profile 承载，是外呼落地与来话进入的必经之路。

## 网关的作用

- **外呼落地**：拨号计划把外线号码交给网关——`bridge` 的目标是 `sofia/gateway/<网关名>/<号码>`（见[静态拨号计划](/concepts/static-dialplan)）；
- **来话接入**：运营商把 DID 呼到 FreeSWITCH，进 external profile 的 `context`（vanilla 为 `public`）处理；
- **两种对接形态**：
  - **注册型**：FreeSWITCH 像一台话机一样向运营商 `REGISTER`，账号密码认证，适合小规模、动态 IP；
  - **不注册型**：双方按 IP 直连（对端以源 IP 识别你），常见于专线、SBC 互联或企业自有中继。

网关文件放在 `conf/sip_profiles/external/` 下，一个文件可含多个 `<gateway>`；`external.xml` 主 profile 的 `auth-calls=false`、`context=public`（见 [SIP 模块](/modules/sip)）。

## 注册型网关：完整配置示例

`conf/sip_profiles/external/carrier1.xml`：

```xml
<include>
  <!-- 注册型网关：账号密码向运营商注册 -->
  <gateway name="carrier1">
    <!-- 注册账号 -->
    <param name="username" value="888001"/>
    <param name="password" value="your-password"/>
    <param name="realm" value="sip.carrier.com"/>
    <!-- 发往对端的 From 域与用户，缺省沿用 username 与 realm -->
    <param name="from-user" value="888001"/>
    <param name="from-domain" value="sip.carrier.com"/>
    <!-- 信令目的地址，缺省沿用 realm -->
    <param name="proxy" value="sip.carrier.com"/>
    <param name="register" value="true"/>
    <param name="register-transport" value="udp"/>
    <!-- 注册有效期与失败重试间隔（秒） -->
    <param name="expire-seconds" value="600"/>
    <param name="retry-seconds" value="30"/>
    <!-- OPTIONS 保活：失败将标记网关不可用并触发重注册 -->
    <param name="ping" value="25"/>
    <!-- 来话落点：呼到 username 时按此分机进 context；不设则用 username -->
    <param name="extension" value="888001"/>
    <param name="context" value="public"/>
  </gateway>
</include>
```

常用参数速查（均为 `mod_sofia` 网关解析支持的名字）：

| 参数 | 作用 |
| ---- | ---- |
| `username` / `password` | 注册账号与密码；`auth-username` 可单独指定认证用的用户名 |
| `realm` | 认证域；留空则用网关名。有的运营商校验 realm，写错会一直 403/407 |
| `proxy` | 信令发送目的地（可以是 `host:port`）；留空用 realm |
| `register-proxy` | 单独指定 REGISTER 发往的地址 |
| `outbound-proxy` | 所有出向请求经此代理转发 |
| `register` | 是否注册，`true`/`false` |
| `register-transport` | 注册用传输层：`udp`、`tcp`、`tls` |
| `expire-seconds` | 注册有效期（秒），到期自动续注 |
| `retry-seconds` | 注册失败或超时后的重试间隔 |
| `ping` | OPTIONS 保活间隔（秒）；另有 `ping-min`、`ping-max` 控制降级/恢复阈值 |
| `from-user` / `from-domain` | 出向请求 From 头的用户与域，即对端看到的主叫标识 |
| `caller-id-in-from` | `true` 时用通道主叫号填充 From（运营商允许透传时用） |
| `extension` | 来话匹配的分机名（进 context 前的 destination_number） |
| `extension-in-contact` | 把 extension 放进 REGISTER 的 Contact |
| `contact-params` / `contact-host` | 自定义 Contact 参数与主机部分 |
| `context` | 该网关来话进入的 context，缺省用所在 profile 的 context |
| `gw-auth-acl` | 只接受来自该 ACL 的来话，绑死对端 IP |
| `cid-type` | 主叫号码传递方式（如 `rpid`，按运营商要求） |
| `destination-prefix` | 给外呼号码加前缀 |

## 不注册型网关：SIP 中继直连

专线/内网 SBC 场景不注册，只需声明对端地址并锁定来源：

```xml
<include>
  <!-- 不注册型：IP 直连中继 -->
  <gateway name="trunk2">
    <param name="username" value="fs01"/>
    <param name="password" value="unused"/>
    <param name="proxy" value="10.8.0.1:5060"/>
    <param name="register" value="false"/>
    <param name="caller-id-in-from" value="true"/>
  </gateway>
</include>
```

要点：

- `register=false` 时该网关不发起 REGISTER，外呼直接发到 `proxy`；`proxy` 建议写明端口；
- 来话信任靠网络层：在 external profile 上配 `apply-inbound-acl` 只放对端 IP 段，或在网关上用 `gw-auth-acl` 绑定——**不要**把 `auth-calls=false` 的 external profile 完全敞开在公网；
- 对端同样按你的源 IP（或配置的账号）识别，NAT 环境务必配好 `ext-sip-ip`/`ext-rtp-ip`（见[网络设置](/configuration/network)）。

## 装载与状态查询

```bash
# 读取（或重读）external/ 下的网关定义
fs_cli -x "sofia profile external rescan"

# 查看网关状态（REGED 表示已注册成功）
fs_cli -x "sofia status gateway carrier1"

# 立即注册 / 注销（可单个网关或 all）
fs_cli -x "sofia profile external register carrier1"
fs_cli -x "sofia profile external unregister carrier1"

# 删除运行中的网关（随后 rescan 重新装载）
fs_cli -x "sofia profile external killgw trunk2"

# 改动太大时整体重启 profile（会中断该 profile 的会话）
fs_cli -x "sofia profile external restart"
```

新增/修改网关文件后 `rescan` 即可，不需要 `reloadxml`（网关不在 XML 配置的 section 缓存里，rescan 直接重读文件）。

## PSTN 网关对接要点

PSTN 通常经由运营商 SIP 中继（或 IMS、E1 转 SIP 的接入设备）落地，对接时逐项对齐：

1. **编解码**：话音网络普遍 G.711（PCMU/PCMA）。把 external profile 的 `inbound-codec-prefs` / `outbound-codec-prefs` 设为 `PCMU,PCMA` 可避免转码；个别呼叫要临时换编解码用 `absolute_codec_string`（见[媒体处理模块](/modules/media)）；
2. **DTMF**：两侧方式必须一致。RFC 2833 是主流，payload 号由 profile 的 `rfc2833-pt`（默认 101）指定；对端要 SIP INFO 则把 profile 的 `dtmf-type` 设为 `info`；
3. **主叫号码**：运营商一般要求报备过的主叫号——`from-user` / `from-domain` 定死默认主叫，允许透传的业务再开 `caller-id-in-from`；个别设备要求 `cid-type=rpid`；
4. **NAT 与地址**：公网对接必须配 `ext-sip-ip` / `ext-rtp-ip`，并放行 external profile 的 SIP 端口与 RTP 端口段；
5. **来话路由**：来话进 `public` context，按被叫 DID 转入 default context 的分机或 IVR：

```xml
<include>
  <!-- conf/dialplan/public/10_did.xml -->
  <extension name="did_inbound">
    <condition field="destination_number" expression="^(10865551212)$">
      <action application="set" data="domain_name=$${domain}"/>
      <action application="transfer" data="1000 XML default"/>
    </condition>
  </extension>
</include>
```

6. **保活与故障切换**：`ping` 配上 OPTIONS 探测；多运营商时每条线一个网关，拨号计划里按 `sofia status gateway` 的可用性用 `mod_lcr` 或条件规则分流。

## 故障排查：注册失败与单通

先开跟踪再看状态，不要靠猜：

```bash
fs_cli -x "sofia global siptrace on"      # 看 SIP 报文与响应码
fs_cli -x "sofia status gateway carrier1" # 看注册状态与重试
fs_cli -x "sofia status profile external" # 看监听地址、编解码、会话数
```

| 现象 | 常见原因与处理 |
| ---- | ---- |
| 一直 401/407 反复重试 | 用户名/密码错；`realm` 写错导致摘要域不匹配；改对后 `sofia profile external register carrier1` 立即重试 |
| 403 Forbidden | 账号未开通、主叫号未报备（`from-user` 不对）、源 IP 不在运营商白名单 |
| 网关始终 DOWN、无响应 | `proxy` 地址/端口不通、防火墙拦 SIP；先在服务器上 `telnet`/`nc` 测对端端口 |
| 注册成功但几分钟掉线 | `expire-seconds` 过长且无保活：配 `ping`，或缩短 `expire-seconds`；NAT 下确认 `ext-sip-ip` |
| 能打通但**单通**（一方听得见） | 经典 RTP 问题：防火墙没放行 RTP 端口段、`ext-rtp-ip` 不对（对端把媒体发到了不可达地址）。用 `tcpdump` 确认双向 RTP 都在流动，对照[网络设置](/configuration/network) |
| 接通后完全无声或报 488 | 编解码不匹配：对端不提供你声明的编解码，用 `absolute_codec_string=PCMU,PCMA` 收窄验证，必要时开 `inbound-late-negotiation` |
| 外呼正常、来话进不来 | external profile 的 `context` 与 DID 规则没对上；`fs_cli -x "show channels"` 看来话落在哪个 context、`destination_number` 是什么 |
| 来话被叫号是网关 username | 未配 `extension`，或运营商送的被叫与你的 DID 规则不匹配，用 siptrace 看 INVITE 里的 Request-URI |

定位媒体问题时 `fs_cli -x "uuid_dump <uuid>"` 能看到这通电话实际协商的 `read_codec`/`write_codec` 与两侧 SDP 地址，是判断「单通还是编解码」最快的证据。

## 相关阅读

- [SIP 模块](/modules/sip)——profile 机制、认证与 ACL，网关就跑在 external profile 上；
- [媒体处理模块](/modules/media)——编解码偏好、`absolute_codec_string` 与转码；
- [静态拨号计划](/concepts/static-dialplan)——`sofia/gateway/<网关>/<号码>` 的外呼写法；
- [网络设置](/configuration/network)——端口放行与 NAT，排查单通的第一站；
- [模块概述](/modules/README)——mod_sofia 在模块体系中的位置。
