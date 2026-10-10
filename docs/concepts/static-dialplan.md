# 静态拨号计划

静态拨号计划指写在 `conf/dialplan/` 下、经 `reloadxml` 装载的 XML 规则——路由逻辑全部落在文件里，可审计、可回滚，也是 FreeSWITCH 出厂默认的工作方式。

## 文件组织与加载顺序

```
conf/dialplan/
├── default.xml      # default context 的入口，include 下列分片
├── default/         # 分片目录
│   ├── 00-internal.xml   # 内部分机互拨
│   ├── 50-outbound.xml   # 外呼路由
│   └── 90-catchall.xml   # 兜底
├── public.xml       # public context（外部来话）
└── features.xml     # 特征码（忙转、免打扰等 * 码）
```

- context 内 extension 按**文件名与书写顺序**依次评估，用 `00-`/`50-`/`90-` 前缀明确匹配优先级；
- 不想新建分片时，也可直接改 `default.xml` 中的 `<include>` 列表组织加载；
- 修改后 `fs_cli -x "reloadxml"`，用 `fs_cli -x "xml_locate dialplan name default"` 核对生效结果。

## 规则字段逐个看

```xml
<extension name="local_extension" continue="false">
  <condition field="destination_number" expression="^(100[1-9])$" break="on-false">
    <action application="set" data="call_timeout=25"/>
    <action application="set" data="continue_on_fail=true"/>
    <action application="bridge" data="user/$1"/>
    <anti-action application="hangup" data="NO_ROUTE_DESTINATION"/>
  </condition>
</extension>
```

| 字段 | 含义 |
| ---- | ---- |
| `extension@name` | 扩展名，仅用于日志与定位 |
| `extension@continue` | 本 extension 命中后是否继续匹配后续 extension（默认 false） |
| `condition@field` | 被匹配的通道变量，默认可用 `destination_number`、`caller_id_number` 等 |
| `condition@expression` | PCRE 正则，捕获组可用 `$1`、`$2` 在 action 中引用 |
| `condition@break` | 匹配流程控制：`always`/`never`/`on-true`/`on-false`（默认 on-false：本 condition 不成立即停止本 extension） |
| `action@application` | 执行的 application 名（`fs_cli -x "show applications"` 查全量） |
| `action@data` | application 参数 |
| `anti-action@...` | condition 不成立时执行的动作 |

## 常用 application 速查

| application | 作用 | 典型用法 |
| ---- | ---- | ---- |
| `answer` | 应答 | 播提示音前先应答 |
| `set` | 设通道变量 | `set` `my_var=1` |
| `export` | 设变量并**带到对端腿** | 传主叫标记、录音开关 |
| `bridge` | 桥接到另一端点 | `user/1002`、`sofia/gateway/gw1/10086` |
| `transfer` | 转接到另一 extension/context | `transfer 1002 XML default` |
| `playback` | 播放音频 | `playback ${sound_prefix}/hello.wav` |
| `hangup` | 挂断（带原因码） | `hangup USER_BUSY` |
| `park` | 停放（保持，等待外部接走） | `park` 后用 `uuid_transfer` 取 |
| `sleep` | 暂停执行毫秒 | `sleep 1000` |
| `echo` | 回声测试（听到自己） | 测试媒体链路 |
| `record_session` | 录音 | `record_session /tmp/${uuid}.wav` |

## 实用模式

### 分时段路由

```xml
<extension name="office_hours">
  <condition field="destination_number" expression="^2000$"/>
  <condition field="${strftime(%H)}" expression="^(09|10|11|13|14|15|16|17)$">
    <action application="transfer" data="2000_realtime XML default"/>
  </condition>
  <anti-action application="bridge" data="user/2000"/>
</extension>
```

多个 condition 同一 extension 内按序求值，全部为真才执行 action（第一条只做号码过滤，第二条判断上班时段）。

### 通配外呼与网关

```xml
<extension name="outbound_via_gw">
  <condition field="destination_number" expression="^(\d{3,15})$">
    <action application="bridge" data="sofia/gateway/运营商网关/$1"/>
  </condition>
</extension>
```

`sofia/gateway/<网关名>/<号码>` 的网关定义在 `sip_profiles/external/` 下；网关配置示例见本手册模块详解篇。

### 特征码：通话中转接

features.xml 中定义的特征码在通话进行中生效（先按 `*98` 进入 feature 通道再拨号码，具体以你环境的 `features.xml` 为准），核心是 `transfer` 的调用方式：

```xml
<action application="transfer" data="1002 XML default"/>
```

## 校验与排障

1. `reloadxml` 后无报错——XML 解析错误会直接打印在控制台；
2. `xml_locate` 确认规则进了内存；
3. `/log debug` 拨打测试号，观察 `Processing ... in context` 与 application 执行日志；
4. 规则没命中时先查 `destination_number` 是否符合预期（`uuid_dump` 看变量真实值——正则里少写 `^`/`$` 是第一大坑）。

## 下一步

规则写死在文件里不够用时，转到 [动态拨号计划](/concepts/dynamic-dialplan)：用 Lua 脚本、mod_xml_curl 与 ESL 把路由交给代码与数据库。
