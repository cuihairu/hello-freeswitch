# 网络设置

语音通话 = 信令（SIP）+ 媒体（RTP）两路流量。90% 的"注册正常但听不到声音""外网打不进来"都出在网络设置上。本页讲清端口、防火墙与 NAT 三件事。

## 默认端口清单

| 端口 | 协议 | 用途 |
| ---- | ---- | ---- |
| 5060 | UDP/TCP | SIP（internal profile，分机注册与呼叫） |
| 5061 | TCP/TLS | SIP over TLS（internal，需配证书启用，默认关闭） |
| 5066 | TCP | SIP over WebSocket（WebRTC） |
| 7443 | TCP/TLS | SIP over WSS（WebRTC 加密） |
| 5080 | UDP/TCP | SIP（external profile，对接运营商/网关） |
| 5081 | TCP/TLS | SIP over TLS（external profile，默认关闭） |
| 8021 | TCP | ESL 事件套接字（**仅限本机管理**） |
| 16384-32768 | UDP | RTP 媒体端口段 |

端口在两处定义：`vars.xml` 里的 `$${internal_sip_port}` 等变量，以及各 profile（`sip_profiles/internal.xml` 的 `sip-port`、`ws-binding` 等）。

## 防火墙放行

以 `ufw` 为例（iptables/firewalld 同理，只放行实际用到的）：

```bash
sudo ufw allow 5060/udp
sudo ufw allow 5060/tcp
sudo ufw allow 5061/tcp
sudo ufw allow 5066/tcp     # 用 WebRTC 才放
sudo ufw allow 7443/tcp     # 用 WebRTC 才放
sudo ufw allow 16384:32768/udp
sudo ufw status
```

要点：

- **RTP 端口段必须整段放行**，且与 `autoload_configs/switch.conf.xml` 里的 `rtp-start-port`/`rtp-end-port` 保持一致（源码安装默认 16384-32768，这两个参数默认注释、放开即可修改收窄）；
- 8021（ESL）**永远不要**对公网放行；`fs_cli` 走本机连接即可，远程管理用 SSH 隧道；
- 对接运营商时按需放行 external profile 的 5080（明文）/5081（TLS，默认关）与对端 IP 白名单。

## NAT：公网部署的关键参数

当 FreeSWITCH 位于 NAT 之后（云服务器有公网 IP 的不算，本机与局域网客户端互通也不算），必须让对端拿到**公网可达的地址**。`sip_profiles/internal.xml` 的核心参数：

```xml
<!-- 对外宣告的 SIP 地址：写公网 IP，或用 STUN 探测 -->
<param name="ext-sip-ip" value="203.0.113.10"/>
<!-- 对外宣告的 RTP 地址：同样写公网 IP -->
<param name="ext-rtp-ip" value="203.0.113.10"/>
```

- 若公网 IP 动态，可写 `value="stun:stun.freeswitch.org"` 让 FreeSWITCH 探测（需放行出站 UDP 3478）；
- `$${external_rtp_ip}`、`$${external_sip_ip}` 在 `vars.xml` 中定义，profile 里以 `$${}` 引用——改公网 IP 通常只改 vars.xml 一处；
- 媒体不流的典型症状：能听到忙音/回铃，接通后单通或完全无声——先检查 `ext-rtp-ip` 与 RTP 端口段防火墙；
- 云服务器（如 AWS/VPC）有公网 IP 但经 NAT 映射的，同样需要配置 `ext-*` 参数，并确认安全组放行端口段。

## ACL：谁可以连进来

`autoload_configs/acl.conf.xml` 定义访问控制列表，profile 用 `apply-inbound-acl` 挂接。默认的 `localnets.auto` 只放行本机所在网段：

```xml
<list name="workphones" default="deny">
  <node type="allow" cidr="192.168.1.0/24"/>
  <node type="allow" cidr="10.8.0.0/16"/>
</list>
```

```xml
<!-- sip_profiles/internal.xml -->
<param name="apply-inbound-acl" value="workphones"/>
```

修改后 `fs_cli -x "reloadacl"` 生效。**公网机器务必收紧 ACL 并修改分机默认密码**，5060 暴露公网会被扫描器持续尝试注册。

## 验证网络配置

```bash
# 查看 profile 运行时地址
fs_cli -x "sofia status profile internal"

# 关键输出项对照：
#   SIP-Port: 5060
#   Ext-RTP-IP / Ext-SIP-IP: 应为公网地址（NAT 环境下）
#   RTP-Start-Port / RTP-End-Port: 与防火墙一致
```

打一通测试电话后用 `fs_cli -x "show channels"` 观察，再在服务器上 `tcpdump -ni any udp portrange 16384-32768` 确认 RTP 流量真实进出。

## 下一步

网络调通后，进入 [核心概念](/concepts/session)——会话、呼叫、通道与拨号计划，理解一次通话在 FreeSWITCH 内部的完整旅程。
