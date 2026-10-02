# SIP 模块

FreeSWITCH 与外界互通的每一通电话，几乎都从 `mod_sofia` 走。本篇先补齐 SIP 协议的最小必要知识，再讲 mod_sofia 的 profile 结构、internal/external 的关键参数，以及注册认证与防扫描。

## SIP 协议简介

SIP 是基于文本的会话控制协议，一次交互叫一个**事务**（transaction），一次通话由若干事务组成。语音内容不走 SIP——SIP 只负责「找人和接通」，媒体走 RTP（见 [网络设置](/configuration/network) 的端口说明）。

### 一次呼叫的标准事务

| 报文 | 方向 | 作用 |
| ---- | ---- | ---- |
| `INVITE` | 主叫 → 被叫 | 发起呼叫，携带 SDP（媒体地址与编解码 offer） |
| `100 Trying` | 被叫 → 主叫 | 已收到、处理中（抑制 INVITE 重传） |
| `180 Ringing` | 被叫 → 主叫 | 振铃，主叫听到回铃音 |
| `200 OK` | 被叫 → 主叫 | 接听，携带 SDP answer |
| `ACK` | 主叫 → 被叫 | 确认 200 OK，INVITE 事务完成，双向媒体开始 |
| `BYE` | 任一方 | 挂断已建立的会话 |
| `CANCEL` | 主叫 | 取消尚未应答的 INVITE |

非会话类事务：

| 报文 | 用途 |
| ---- | ---- |
| `REGISTER` | 分机向 FreeSWITCH 登记联系地址（注册） |
| `OPTIONS` | 保活探测、能力查询 |
| `SUBSCRIBE` / `NOTIFY` | 呈现（presence）、MWI 等事件订阅 |
| `INFO` | 通话中传递信令（如 SIP INFO 方式的 DTMF） |

### 注册：REGISTER 与 401 挑战

裸网上的 REGISTER 必须认证，流程是标准的 HTTP Digest：

1. 分机发 `REGISTER`；
2. FreeSWITCH 回 `401 Unauthorized`，带随机数 `nonce`；
3. 分机用「用户名：域：密码」算出摘要，重发带 `Authorization` 头的 `REGISTER`；
4. 校验通过回 `200 OK`，此后到该地址的呼叫都被路由到这个分机。

`nonce` 有有效期（profile 的 `nonce-ttl`，默认 60 秒），过期后重新挑战，防止重放。

### 观察 SIP：siptrace

排障时第一步永远是看报文：

```bash
fs_cli -x "sofia global siptrace on"    # 打开全部 profile 的 SIP 报文跟踪
fs_cli -x "sofia global siptrace off"
fs_cli -x "sofia loglevel all 9"        # sofia-sip 协议栈日志（级别 0-9，调完记得降回 0）
```

## mod_sofia 概述

`mod_sofia` 基于 sofia-sip 协议栈，是 FreeSWITCH 的 SIP 端点模块。它以 **profile** 为单位监听网络，每个 profile 是一组「监听地址 + 参数」的集合，对应一个配置文件 `conf/sip_profiles/<name>.xml`。vanilla 默认配置给两个 profile：

| profile | 文件 | 职责 |
| ---- | ---- | ---- |
| `internal` | `sip_profiles/internal.xml` | 收分机注册与内呼，端口 `$${internal_sip_port}`（默认 5060） |
| `external` | `sip_profiles/external.xml` | 对接运营商/网关，端口 `$${external_sip_port}`（默认 5080），网关定义在其子目录 `sip_profiles/external/*.xml`（第 8 章） |

呼叫目标写成端点 URI，由拨号计划里的 `bridge` 使用：

- `sofia/internal/1002` —— 经 internal profile 呼分机 1002；
- `sofia/gateway/carrier1/10086` —— 经 carrier1 网关呼外线号码；
- `sofia/internal/sip:1002@192.168.1.20:5060` —— 直接指定 SIP 地址。

### 常用状态命令

```bash
fs_cli -x "sofia status"                             # profile 概览
fs_cli -x "sofia status profile internal"            # 运行参数：端口、IP、ACL、编解码
fs_cli -x "sofia status profile internal reg"        # 已注册分机列表
fs_cli -x "sofia status profile internal user 1000@pbx.example.com"
fs_cli -x "sofia status gateway carrier1"            # 网关注册状态（第 8 章）
fs_cli -x "sofia_contact 1000@pbx.example.com"       # 查分机注册的 contact 地址
```

`sofia_contact` 的返回（形如 `sofia/internal/sip:1002@192.168.1.20:5060;...`）可以直接喂给 `bridge`，是把「分机号」翻译成「可达地址」的官方途径。

## internal / external profile 关键参数

参数都写在 profile 文件的 `<param name="..." value="..."/>` 里。先看一段 internal 的常用组合（完整参数见 `sip_profiles/internal.xml` 自带注释）：

```xml
<profile name="internal">
  <!-- 监听与路由 -->
  <param name="sip-port" value="$${internal_sip_port}"/>
  <param name="dialplan" value="XML"/>
  <param name="context" value="public"/>
  <!-- NAT：对外宣告的地址，公网部署必配 -->
  <param name="ext-sip-ip" value="$${external_sip_ip}"/>
  <param name="ext-rtp-ip" value="$${external_rtp_ip}"/>
  <!-- 认证 -->
  <param name="auth-calls" value="$${internal_auth_calls}"/>
  <param name="challenge-realm" value="auto_from"/>
  <param name="nonce-ttl" value="60"/>
  <param name="apply-inbound-acl" value="domains"/>
  <!-- 编解码偏好 -->
  <param name="inbound-codec-prefs" value="$${global_codec_prefs}"/>
  <param name="outbound-codec-prefs" value="$${outbound_codec_prefs}"/>
  <param name="inbound-codec-negotiation" value="generous"/>
  <param name="inbound-late-negotiation" value="true"/>
  <!-- 保活与超时 -->
  <param name="rtp-timeout-sec" value="300"/>
  <param name="rtp-hold-timeout-sec" value="1800"/>
</profile>
```

常用参数速查：

| 参数 | 作用 |
| ---- | ---- |
| `sip-port` / `dialplan` / `context` | 监听端口；拨号计划类型；未经认证的来话进入的 context |
| `sip-ip` / `rtp-ip` | 本机收发 SIP 与 RTP 的地址 |
| `ext-sip-ip` / `ext-rtp-ip` | NAT 环境对外宣告的 SIP/RTP 地址（详见[网络设置](/configuration/network)） |
| `apply-inbound-acl` / `apply-register-acl` | 入方向准入 ACL，见下文「ACL」 |
| `local-network-acl` | 判定对端是否属于内网（影响 NAT 判定），默认 `localnet.auto` |
| `auth-calls` | 来话是否要求认证；分机注册始终要求认证 |
| `challenge-realm` | 401 挑战使用的域，`auto_from` 表示取 From 头的域 |
| `nonce-ttl` | Digest nonce 有效期（秒） |
| `accept-blind-reg` / `accept-blind-auth` | 接受任意注册/认证——默认关闭，**不要打开** |
| `disable-register` | 完全关闭该 profile 的注册功能（纯中继 profile 用） |
| `log-auth-failures` | 把认证失败写入日志 |
| `max-recv-requests-per-second` | 单 profile 每秒收包限速，超速回 503（防扫描洪泛） |
| `inbound-codec-prefs` / `outbound-codec-prefs` | 收/发方向提供的编解码列表（第 9 章） |
| `inbound-codec-negotiation` | `generous` 宽松、`greedy` 严格 |
| `inbound-late-negotiation` | 先进拨号计划再定编解码，配合 `absolute_codec_string` 使用 |
| `rtp-timeout-sec` / `rtp-hold-timeout-sec` | RTP 中断多久判定掉线/保持超时 |
| `aggressive-nat-detection` | 更激进地判定 NAT |
| `ws-binding` / `wss-binding` | WebRTC 的 WebSocket 监听端口（`:5066` / `:7443`） |
| `tls` / `tls-only` | 是否启用 SIPS/TLS、是否只收 TLS |

internal 与 external 的默认分工差异：external 的 `context` 为 `public`、`auth-calls` 为 `false`（来话按 IP 与路由信任）、`manage-presence` 关闭，并且通过子目录定义网关；internal 面向分机，注册与呼叫都要求认证。

### 改完参数怎么生效

```bash
fs_cli -x "reloadxml"                          # 先让 XML 进内存
fs_cli -x "sofia profile internal rescan"      # 平滑重扫（网关、大部分参数）
fs_cli -x "sofia profile internal restart"     # 改监听地址/端口等必须重启 profile
```

`sofia profile <name> [start | stop | restart | rescan]`；`rescan` 不中断注册，改端口、IP、TLS 这类监听参数必须 `restart`。

## 注册与认证

### 分机账号：directory

分机定义在 `conf/directory/<域名>/` 下，每分机一个文件（`1000.xml`）：

```xml
<include>
  <user id="1000">
    <params>
      <param name="password" value="$${default_password}"/>
      <param name="a1-hash" value="…"/>
      <param name="vm-password" value="1000"/>
    </params>
    <variables>
      <variable name="user_context" value="default"/>
      <variable name="toll_allow" value="domestic,international,local"/>
      <variable name="effective_caller_id_number" value="1000"/>
    </variables>
  </user>
</include>
```

- `params` 里的 `password` 就是该分机的 SIP 注册密码；更安全的做法是只存 `a1-hash`——`用户名:realm:密码` 串的 MD5 十六进制值，配置文件里不落明文：

  ```bash
  echo -n "1000:pbx.example.com:secret" | md5sum
  ```

  注意 realm 必须与注册时的挑战域一致（`challenge-realm` 为 `auto_from` 时即注册请求 From 的域）。
- `variables` 会在该分机参与的通道上生效：`user_context` 决定注册用户呼出进入哪个 context，`toll_allow` 供外呼规则判断权限。

新增/修改分机后 `fs_cli -x "reloadxml"` 生效，用 `fs_cli -x "sofia status profile internal reg"` 核对注册状态。

### 认证链路：从 ACL 到 Digest

一次 REGISTER/INVITE 进来，mod_sofia 按以下顺序处理：

1. **ACL 准入**：`apply-inbound-acl` 指定的列表不通过，直接拒收。vanilla 的 `acl.conf.xml` 定义了 `domains` 列表——`<node type="allow" domain="$${domain}"/>` 会扫描 directory 中带 `cidr=` 的用户自动生成白名单，命中的请求**免密码认证**：

   ```xml
   <list name="domains" default="deny">
     <node type="allow" domain="$${domain}"/>
   </list>
   ```

   修改后 `fs_cli -x "reloadacl"` 生效。
2. **注册认证**：`REGISTER` 一律走 401 Digest 挑战（除非命中 ACL 免认证），比对 `password` 或 `a1-hash`；
3. **来话认证**：`auth-calls=true` 时（vanilla 的 `$${internal_auth_calls}` 默认 `true`），INVITE 同样要求 Digest 认证；`inbound-reg-force-matching-username=true` 强制 `Authorization` 用户与 From 用户一致，防止冒用他人号码。

### 防扫描清单

5060 暴露公网会被扫描器持续尝试注册，上线前逐条核对：

1. **改掉默认密码**：`vars.xml` 的 `default_password` 与每个分机的 `password`——弱密码分机几分钟就会被注册成功并盗打；
2. **收紧 ACL**：`apply-inbound-acl` 只放可信网段；不需要注册的 profile（纯中继）直接 `disable-register=true`；
3. **保留失败日志**：`log-auth-failures=true`，在 `log/freeswitch.log` 里能看到扫描来源；
4. **限速**：`max-recv-requests-per-second` 抑制请求洪泛；
5. **不碰危险开关**：`accept-blind-reg`、`accept-blind-auth` 保持注释状态；
6. **网络层兜底**：防火墙只对可信地址放行 5060，`8021`（ESL）永远不要对公网开放（见[网络设置](/configuration/network)）。

验证：`fs_cli -x "sofia global siptrace on"` 后让一台分机注册，完整看一遍 401/200 流程；再看 `fs_cli -x "sofia status profile internal reg"` 确认 contact 与过期时间。

## 相关阅读

- [模块概述](/modules/README)——模块加载机制与分类总览；
- [网络设置](/configuration/network)——SIP/RTP 端口、防火墙与 NAT 参数；
- [核心配置文件](/configuration/core-files)——`directory/default/1000.xml` 分机文件详解；
- [静态拨号计划](/concepts/static-dialplan)——注册用户呼出如何路由；
- [在 Linux 上安装](/installation/linux)——装好再回来配 SIP。
