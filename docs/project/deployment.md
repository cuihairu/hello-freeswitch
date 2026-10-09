# 第 17 章 · 部署与运维

开发机能跑通不等于能上线。本章按"单节点 → 多节点 → 监控告警 → 故障排查"的顺序，把智能客服系统投产要做的决策与检查清一遍。命令均基于 FreeSWITCH 1.11.3 与源码安装前缀 `/usr/local/freeswitch`（其它安装方式替换前缀即可）。

## 单节点部署

### 目录规划

源码安装后的目录布局（`$${...}` 变量在 `conf/vars.xml` 中定义）：

```
/usr/local/freeswitch/
├── bin/         freeswitch、fs_cli 等可执行文件
├── conf/        全部配置（结构见附录 A）
├── db/          核心数据库（core db，默认 SQLite）
├── log/         日志与 CDR（freeswitch.log、cdr-csv/）
├── recordings/  录音（$${recordings_dir}）
├── scripts/     Lua/JS 脚本（$${script_dir}）
├── sounds/      提示音与等待音乐
├── grammar/     语音识别语法文件
├── htdocs/      内置 HTTP 服务的静态目录
└── lang/        多语言短语（Phrase）
```

规划建议：

- **录音独立存放**：录音增长最快，把 `recordings/` 指到独立挂载点（改 `$${recordings_dir}`），避免写满系统盘拖垮 `db/` 与 `log/`；
- **db/ 用本地快速盘**：core db 记录通道状态，I/O 频繁，不要放网络文件系统；
- **配置纳入版本管理**：`conf/` 全目录进 Git（密码用私有仓库或部署时注入），回滚与审计都靠它；
- **运行账号**：创建专用的 `freeswitch` 系统用户，`chown -R freeswitch:freeswitch` 上述目录，不以 root 运行。

### systemd 服务

官方源码树自带 unit 模板（`build/freeswitch.service`，Debian 打包另有 `debian/freeswitch-systemd.freeswitch.service`）。源码安装时可参考它写一份，按需调整路径：

```ini
# /etc/systemd/system/freeswitch.service
[Unit]
Description=FreeSWITCH
After=network.target

[Service]
# 官方模板默认前台运行（-nc -nf），systemd 按默认 Type=simple 管理即可；
# 若编译时加了 --enable-systemd，可用 Type=notify。
User=freeswitch
Group=freeswitch
EnvironmentFile=-/etc/sysconfig/freeswitch
WorkingDirectory=/run/freeswitch
ExecStart=/usr/local/freeswitch/bin/freeswitch -nc -nf $FREESWITCH_PARAMS
ExecReload=/bin/kill -HUP $MAINPID
Restart=always
RestartSec=5
LimitNOFILE=100000
LimitNPROC=60000
LimitCORE=infinity
UMask=0007

[Install]
WantedBy=multi-user.target
```

配套两件小事：

```bash
# /etc/tmpfiles.d/freeswitch.conf —— 启动前建好运行目录（参考源码树 build/freeswitch-tmpfiles.conf）
d /run/freeswitch 0750 freeswitch freeswitch -

# /etc/sysconfig/freeswitch —— 启动参数集中管理
FREESWITCH_PARAMS="-nonat"
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable --now freeswitch
sudo systemctl status freeswitch
```

常用启动参数：`-nc` 不开控制台、`-nf` 前台运行（配合 systemd）、`-ncwait` 守护模式并等待启动完成、`-nonat` 关闭 NAT 探测、`-u`/`-g` 指定运行用户/组、`-conf`/`-log`/`-db`/`-run` 覆盖默认目录。

### 上线前安全清单

FreeSWITCH 暴露在网络上会被持续扫描，以下每条都是真实事故的教训：

1. **改掉分机默认密码**。`conf/vars.xml` 里 `default_password=1234`，分机文件里的 `password` 也是 `1234`——公网机器上几分钟就会被注册成功并盗打外线。改为强随机密码，并给每台话机单独密码；
2. **改掉 ESL 密码并收紧监听**。`autoload_configs/event_socket.conf.xml` 中 `password` 默认 `ClueCon`；内网部署可把 `listen-ip` 固定为 `127.0.0.1`，远程管理走 SSH 隧道；确需远程连接则配置 `apply-inbound-acl` 白名单；
3. **配置 ACL**。`autoload_configs/acl.conf.xml` 定义可信网段，profile 的 `apply-inbound-acl` / `apply-register-acl` 挂接，`fs_cli -x "reloadacl"` 生效（详见 [网络设置](/configuration/network)）；
4. **防火墙最小化放行**。只放行业务需要的端口：5060/UDP+TCP、RTP 端口段（默认 16384-32768/UDP）；8021 永远不对公网放行；
5. **清理演示配置**。vanilla 模板里的演示分机（1000-1019）、`public` context 示例路由按需删除或收紧，`modules.conf.xml` 注释掉用不到的模块；
6. **按需启用 TLS/SRTP**。`internal` profile 的 `tls`、`wss-binding`（WebRTC）相关参数，配合 `conf/tls/` 下的证书；
7. **配套防爆破**。用 fail2ban 之类工具盯注册失败日志，或在 `internal` profile 上开启 `log-auth-failures` 便于采集；
8. **限制会话与速率**。`autoload_configs/switch.conf.xml` 的 `max-sessions`、`sessions-per-second` 按容量设定，防止被异常话务打满。

## 多节点部署

当单节点坐席数、并发话务或可用性不满足需求时，扩展到多节点。核心问题是三件事：注册（谁都能接到来话）、媒体（语音往哪走）、数据（CDR 与录音归到哪）。

### 注册与目录共享

让任意节点都能处理来话与分机：

- **目录服务化（推荐）**：用 `mod_xml_curl` 把 `directory` section 指向业务后端，分机账号全部来自数据库，节点本身无状态（写法见 [动态拨号计划](/concepts/dynamic-dialplan)）；
- **注册库共享**：在 profile 上配置 `odbc-dsn` 把注册信息写入共享数据库（PostgreSQL/ODBC），节点间互见注册；同时可用 `switch.conf.xml` 的 `core-db-dsn` 把 core db 也外移（连接串支持 `pgsql://`、`mariadb://` 或 `dsn:用户:密码` 形式），集群场景还可设置 `switchname` 让多个节点共用同一套配置而互不干扰主机名；
- **来话分流**：中继侧（运营商或 SBC）把来话按策略分发到各节点，而不是所有节点都挂同一个中继。

### 媒体与网络

- 节点间、节点与坐席间的 RTP 尽量走**内网或专线**，跨公网时用 VPN（WireGuard/IPsec）或部署 SBC，避免媒体穿越 NAT 产生单通；
- 有公网地址的节点正确配置 profile 的 `ext-sip-ip`/`ext-rtp-ip`，云上安全组放行 RTP 端口段；
- 媒体瓶颈明显的场景评估开启 `bypass_media`（媒体旁路，FreeSWITCH 只控信令），但要与录音、监听需求权衡——旁路后 FreeSWITCH 看不到媒体，录音与 ASR 都会失效。

### 负载分担

| 方案 | 做法 | 适用 |
| ---- | ---- | ---- |
| DNS SRV | 域名返回多条 SRV 记录，终端/中继自行分流 | 中型部署，改动小 |
| SIP 前置代理 | Kamailio/OpenSIPS 做 dispatcher 分发到后端 FreeSWITCH | 中大型，需要健康检查与粘性 |
| TCP 负载均衡 | HAProxy/LVS 以 TCP 模式转发 5060 | 简单分流，需注意注册粘性与源地址 |
| 业务层分配 | 后端按号段/坐席分组决定 `originate` 走哪个节点的 ESL | 智能客服外呼场景最直接 |

经验法则：**注册与来话用前置代理分担，外呼与坐席分配由业务后端按 ESL 连接分发**。需要跨节点转接时，优先让两腿落在同一节点（转接目标跟随原节点），避免跨节点媒体搬运。

### CDR 与数据共享

- `mod_cdr_csv`：本地 CSV，默认写 `log/cdr-csv/`，适合小规模 + 集中采集；
- `mod_cdr_pg_csv`：直接写 PostgreSQL，多节点共用一张表，查询统计方便；
- `mod_xml_cdr`：把 CDR 以 XML POST 到收集服务，由后端入库，灵活度最高；
- 录音文件按"节点名 + UUID"命名或直接落对象存储，与 CDR 表里的 UUID 关联。

无论选哪种，保证**一通电话一条 CDR、一个唯一 UUID**，跨节点的转接靠 UUID 串起来。

## 监控与告警

### fs_cli 巡检命令

日常巡检与告警采集可以完全建立在这几条命令上：

| 命令 | 看什么 |
| ---- | ---- |
| `status` | 运行时长、当前会话数、SPS |
| `show channels count` | 当前通道数（告警阈值的主要来源） |
| `show calls count` | 桥接中的通话数 |
| `show registrations` | 注册分机数（坐席在线率的依据） |
| `sofia status` | 各 profile 是否 running |
| `sofia status profile internal` | SESSIONS、Registrations、失败计数等详细计数 |
| `show modules` | 关键模块（event_socket、sndfile 等）是否在位 |
| `fsctl loglevel err` | 临时调日志级别，降低排障噪音 |

### ESL 事件监控脚本

用标准库订阅核心心跳事件即可做最小监控（协议层写法同 [动态拨号计划](/concepts/dynamic-dialplan)）：

```python
# fs_watch.py — 订阅 HEARTBEAT，超阈值告警（标准库实现）
import json
import socket
import time
import urllib.request

HOST, PORT, PASSWORD = ("127.0.0.1", 8021, "ClueCon")
ALERT_WEBHOOK = "http://ops.internal/hooks/fs-alert"
MAX_SESSIONS = 400


def read_message(f):
    headers, body = {}, b""
    line = f.readline()
    while line not in (b"\n", b"\r\n"):
        k, _, v = line.decode(errors="replace").partition(":")
        headers[k.strip().lower()] = v.strip()
        line = f.readline()
    if "content-length" in headers:
        body = f.read(int(headers["content-length"]))
    return headers, body


def alert(text):
    try:
        req = urllib.request.Request(
            ALERT_WEBHOOK,
            data=json.dumps({"text": text}).encode(),
            headers={"Content-Type": "application/json"},
        )
        urllib.request.urlopen(req, timeout=5)
    except OSError:
        pass


def main():
    while True:
        try:
            s = socket.create_connection((HOST, PORT), timeout=5)
            f = s.makefile("rwb")
            read_message(f)                                   # auth/request
            f.write(f"auth {PASSWORD}\r\n\r\n".encode()); f.flush()
            read_message(f)
            f.write(b"event plain HEARTBEAT\r\n\r\n"); f.flush()
            read_message(f)
            while True:
                headers, body = read_message(f)
                if headers.get("content-type") != "text/event-plain":
                    continue
                fields = {}
                for line in body.decode(errors="replace").splitlines():
                    k, sep, v = line.partition(": ")
                    if sep:
                        fields[k.strip()] = v.strip()
                count = int(fields.get("Session-Count", "0") or 0)
                if count > MAX_SESSIONS:
                    alert(f"FreeSWITCH 会话数过高: {count}")
        except OSError as exc:
            alert(f"FreeSWITCH ESL 连接失败: {exc}")
        time.sleep(10)


if __name__ == "__main__":
    main()
```

`HEARTBEAT` 事件由核心周期性发出，携带 `Session-Count`、`Session-Per-Sec` 等计数头，非常适合做无侵入的容量告警；再配合 `event plain CHANNEL_HANGUP_COMPLETE` 统计话务量，就能画出流量曲线。

### 日志轮转

两层机制配合：

- **模块内轮转**：`autoload_configs/logfile.conf.xml` 中 `rollover`（按字节数滚动）、`maximum-rotate`（保留份数，启用后文件名不再带日期戳）、`rotate-on-hup`（收到 HUP 信号时滚动，默认开启）；
- **系统 logrotate**：按天切割并压缩，`postrotate` 里用 `fsctl send_sighup` 通知模块重开文件（该命令触发与 HUP 信号相同的滚动逻辑）：

```
/usr/local/freeswitch/log/freeswitch.log {
    daily
    rotate 14
    missingok
    notifempty
    compress
    delaycompress
    sharedscripts
    postrotate
        /usr/local/freeswitch/bin/fs_cli -x "fsctl send_sighup" >/dev/null 2>&1 || true
    endscript
}
```

CDR 与录音同样要轮转归档：CSV/录音按天打包上传对象存储后清理本地，`db/` 目录定期备份（core db 可在低峰期用 `fsctl` 相关维护或直接停写窗口备份）。

## 常见错误与排查

### 注册失败

**现象**：话机反复注册失败，`show registrations` 里没有该分机。

1. 确认 profile 在运行：`fs_cli -x "sofia status"`，再看 `sofia status profile internal` 的 `Registrations` 计数；
2. 打开信令跟踪再注册一次：`fs_cli -x "sofia profile internal siptrace on"`，观察是否收到 REGISTER、回了什么码；
3. 按返回码定位：
   - **根本收不到 REGISTER**：防火墙/安全组没放 5060，或 `apply-inbound-acl` 把来源 IP 拒了（看日志里的 ACL 拒绝记录）；
   - **401/403 反复出现**：密码不匹配（`vars.xml` 的 `default_password` 与分机文件 `password`）、`challenge-realm` 与话机配置的域不一致；
   - **404**：目录里没有该分机——新增分机后忘了 `reloadxml`，或 `domain` 与注册域名对不上；
4. 改完配置先 `fs_cli -x "reloadxml"`，必要时 `sofia profile internal rescan`；
5. 仍不行时把 `sofia loglevel all 9` 打开抓完整 Sofia 日志，查完记得关。

### 单通（一方听不到对方）

**现象**：能接通，但只有一方有声音，或双方都没声。

1. 判定方向：主叫听不到被叫还是反过来，让两端各说一句话确认；
2. 服务器上抓 RTP：`tcpdump -ni any udp portrange 16384-32768 -c 100`，看两个方向是否都有流量进出来往；
3. 只有一个方向有流 → 典型 NAT/防火墙问题：检查 `sofia status profile internal` 的 `Ext-RTP-IP`，确认云安全组放行了 RTP 端口段，终端侧检查其 NAT 设置；
4. 完全没有 RTP → SDP 协商失败或编码不支持：`show codecs` 确认双方共同编码，检查 profile 的 `inbound-codec-prefs`；WebRTC 与普通 SIP 互通还需确认 DTLS/SRTP 相关配置；
5. 排查期间可用 `uuid_dump <uuid>` 看通道上 `read_codec`/`write_codec`、`remote_media_ip`/`remote_media_port` 是否合理。

### 录音失败

**现象**：文件没生成，或文件为 0 秒。

1. 看通道变量：录音结束后 `record_seconds` 是否为 0（0 表示几乎没录到，通常是通道未应答就开始录，或对端静音被静音判定提前截断）；
2. 查权限与空间：`ls -ld /usr/local/freeswitch/recordings` 确认运行用户可写；`df -h` 看磁盘是否写满（录音目录写满也会拖垮整个系统）；
3. 确认格式支持：`show modules` 里 `mod_sndfile` 已加载，文件扩展名与实际格式一致；
4. 检查路径里的变量是否已展开：`uuid_dump <uuid>` 核对 `record_path` 类变量，路径含未设置的变量会写到错误位置或直接失败；
5. 订阅 `RECORD_STOP` 事件（`fs_cli` 里 `/event RECORD_STOP`）看 `Record-Filepath` 与错误信息。

### ESL 连不上

**现象**：`fs_cli` 报 socket error，或后端程序连接 8021 失败。

1. 先确认模块加载：本机 `fs_cli` 能连上就说明 mod_event_socket 在运行；连不上则看 `show modules` 与启动日志里 mod_event_socket 的加载记录；
2. 检查监听：`ss -lntp | grep 8021`；`listen-ip` 为 `127.0.0.1` 时远程必然连不上；
3. 检查密码：客户端 `auth` 必须与 `event_socket.conf.xml` 的 `password` 一致，默认 `ClueCon`；
4. 检查 ACL：配置了 `apply-inbound-acl` 时，来源 IP 不在名单内会被拒；
5. 端口被占用：`stop-on-bind-error` 开启时端口冲突会导致模块启动失败，看日志确认绑定错误；
6. 防火墙：8021 只对内网/管理网放行，公网绝不放行。

## 相关阅读

- [安装篇 · 在 Linux 上安装](/installation/linux)：源码安装与依赖；
- [网络设置](/configuration/network)：端口、防火墙与 NAT 的完整讲解；
- [核心配置文件](/configuration/core-files)：本章提到的 vars.xml、modules.conf.xml 细节；
- [附录 A · 配置文件详解](/appendix/configuration-files)：conf/ 目录逐文件参考。
