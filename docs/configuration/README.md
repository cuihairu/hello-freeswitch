# FreeSWITCH 的基本配置

FreeSWITCH 的全部行为由 `conf/` 目录下的 XML 配置驱动。理解这套配置体系，是上手 FreeSWITCH 最关键的一步——它决定了哪些模块加载、号码如何路由、用户如何注册。

## 配置目录在哪里

| 安装方式 | 配置路径 |
| ---- | ---- |
| 源码编译（默认前缀） | `/usr/local/freeswitch/conf` |
| 官方 deb/rpm 包 | `/etc/freeswitch` |
| Windows 安装包 | `C:\Program Files\FreeSWITCH\conf` |

## 配置的三条主线

1. **模块与全局**：`freeswitch.xml`（根文件）+ `vars.xml`（全局变量）+ `autoload_configs/`（各模块配置，如 `modules.conf.xml` 决定加载哪些模块）；
2. **用户目录**：`directory/`——分机（SIP 账号）定义，默认 `1000-1019` 等在 `directory/default/` 下；
3. **路由与中继**：`dialplan/`（拨号计划，决定号码去哪）+ `sip_profiles/`（SIP profile，决定 FreeSWITCH 在哪个地址/端口收发 SIP）。

## 让配置生效

XML 改完后必须重新加载才生效：

```bash
# 重新解析并加载全部 XML 配置
fs_cli -x "reloadxml"

# 常见的按域重载
fs_cli -x "reloadacl"                 # ACL 列表
fs_cli -x "sofia profile internal restart"   # 重启 SIP profile（改了 sip_profiles 后）
fs_cli -x "reload mod_conference"     # 重载单个模块（先 unload 再 load 的语义由 reload 完成）
```

> 改 `sip_profiles` 用 `sofia profile <name> rescan` 可平滑重扫，改动监听地址/端口等核心参数则需 `restart`。

## 本节内容

- [配置文件结构](/configuration/config-files)——`conf/` 目录逐项说明与加载机制；
- [核心配置文件](/configuration/core-files)——`freeswitch.xml`、`vars.xml`、`modules.conf.xml` 深入；
- [网络设置](/configuration/network)——端口、防火墙与 NAT。

基础配置完成后，读 [核心概念](/concepts/session) 理解呼叫在 FreeSWITCH 内部如何流动。
