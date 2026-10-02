# 核心配置文件

本页深入三个最常打交道的文件：根文件 `freeswitch.xml`、全局变量 `vars.xml`、模块加载表 `autoload_configs/modules.conf.xml`。

## freeswitch.xml：配置的根

它本身几乎不写业务逻辑，只做两件事：装配其它文件、声明配置的 section 布局（见 [配置文件结构](/configuration/config-files)）。日常运维很少改它，改得最多的是它装配进来的三个部分：

- `vars.xml` —— 全局变量；
- `autoload_configs/*.conf.xml` —— 模块配置；
- `dialplan/`、`directory/`、`sip_profiles/` —— 路由、用户、中继。

## vars.xml：全局变量与两类变量语法

`vars.xml` 在预处理阶段执行大量 `$${...}` 赋值，典型片段：

```xml
<X-PRE-PROCESS cmd="set" data="sound_prefix=$${sounds_dir}/en/us/callie"/>
<X-PRE-PROCESS cmd="set" data="default_password=1234"/>
<X-PRE-PROCESS cmd="set" data="domain_name=$${local_ip_v4}"/>
```

**`$${var}` 与 `${var}` 的区别是 FreeSWITCH 配置的第一道坎：**

| 写法 | 求值时机 | 作用域 | 典型用途 |
| ---- | ---- | ---- | ---- |
| `$${var}` | 预处理/启动时 | 全局 | `sound_prefix`、`domain_name` 等启动常量 |
| `${var}` | 每次使用时 | 当前通道（channel variable） | `${destination_number}`、`${caller_id_number}` |

要点：

- `$${}` 只在 `reloadxml`（或重启）时重新求值；`${}` 在通话过程中动态求值，优先读通道变量，找不到再回落到全局 `$${}` 值；
- 通道变量可以由拨号计划 `set`、`originate` 的花括号参数、SIP 头部映射等途径注入；
- 修改 `$${}` 变量后要 `reloadxml`；在 `fs_cli` 里可用 `global_getvar` 查看全部全局变量。

## modules.conf.xml：决定加载哪些模块

`autoload_configs/modules.conf.xml` 是模块总闸，每个模块一行：

```xml
<configuration name="modules.conf" description="Modules">
  <load module="mod_console"/>
  <load module="mod_logfile"/>
  <load module="mod_event_socket"/>
  <load module="mod_sofia"/>
  <load module="mod_loopback"/>
  <load module="mod_commands"/>
  <load module="mod_dptools"/>
  <load module="mod_dialplan_xml"/>
  <!-- 不需要的模块注释掉即可 -->
  <!-- <load module="mod_voicemail"/> -->
</configuration>
```

- 注释一行 `<load>` 再 `reloadxml`，该模块在下次启动时不再加载；正在运行的模块可临时卸载：`fs_cli -x "unload mod_voicemail"`；
- 模块间有依赖：`mod_dptools`（大量 application 的提供者）与 `mod_commands`（大量 api 命令的提供者）几乎必须保留；
- 每个模块自己的参数在同名 `.conf.xml` 里（如 `mod_sofia` 的 profile 在 `sip_profiles/`）。

## directory/default/1000.xml：一个分机长什么样

分机文件是理解注册与认证的钥匙（节选）：

```xml
<include>
  <user id="1000">
    <params>
      <param name="password" value="1234"/>
      <param name="vm-password" value="1000"/>
    </params>
    <variables>
      <variable name="toll_allow" value="domestic,international,local"/>
      <variable name="accountcode" value="1000"/>
      <variable name="user_context" value="default"/>
      <variable name="effective_caller_id_name" value="Extension 1000"/>
      <variable name="effective_caller_id_number" value="1000"/>
    </variables>
  </user>
</include>
```

- `params` 里的 `password` 就是该分机的 SIP 注册密码——**上线前务必改掉默认的 `1234`**，公网机器上弱密码分机几分钟内就会被扫描注册；
- `user_context` 决定该分机呼出时进入哪个 context 的拨号计划（默认 `default`）；
- `variables` 会在该分机参与的通话通道上生效，供拨号计划引用。

## sip_profiles/internal.xml：SIP 的门面

节选关键参数（完整参数见 [网络设置](/configuration/network)）：

```xml
<profile name="internal">
  <param name="context" value="default"/>
  <param name="sip-port" value="$${internal_sip_port}"/>   <!-- 默认 5060 -->
  <param name="dialplan" value="XML"/>
  <param name="dtmf-mode" value="rfc2833"/>
  <param name="local-network-acl" value="localnets.auto"/>
  <param name="apply-inbound-acl" value="localnets.auto"/>
  <param name="ws-binding" value=":5066"/>                 <!-- WebRTC WebSocket -->
  <param name="wss-binding" value=":7443"/>                <!-- WebRTC over TLS -->
</profile>
```

`context` 指明：从这个 profile 进来的呼叫，交给 `dialplan/` 下哪个 context 处理。

## 改完配置的检查清单

1. `fs_cli -x "reloadxml"`，观察控制台无 XML 解析报错；
2. `fs_cli -x "global_getvar domain_name"`（或 `global_getvar` 列出全部全局变量）确认取值生效；
3. 涉及 SIP 参数的，`fs_cli -x "sofia status profile internal"` 核对运行值；
4. 打一通测试呼叫，`fs_cli -x "show channels"` 观察通道变量。

## 下一步

- [网络设置](/configuration/network)：把端口、防火墙与 NAT 调通；
- [通道 (Channel)](/concepts/channel)：搞懂 `${var}` 背后的通道变量模型。
