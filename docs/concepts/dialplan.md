# 路由与拨号计划 (Dialplan)

**拨号计划（dialplan）是 FreeSWITCH 的路由规则引擎**：一条来话进入 `CS_ROUTING` 状态后，FreeSWITCH 按 context → extension → condition 的层次逐条评估规则，决定应答、转接、桥接还是挂断。它回答的问题是——**"这个号码打进来，接下来会发生什么？"**

## 三层结构

```
context（上下文，隔离路由域）
 └── extension（扩展，对应一类号码）
      └── condition（条件，PCRE 正则匹配）
           └── action / anti-action（动作，命中/不命中时执行）
```

- **context**：路由的隔离域。内部分机通常在 `default`，外部来话在 `public`；分机文件里的 `user_context` 决定它的呼出走哪个 context；
- **extension**：命名的一组条件，条件全部满足才执行动作；
- **condition**：对通道变量做 PCRE 正则匹配，最常见的是 `destination_number`（被叫号码）；
- **action**：命中的动作；**anti-action**：不命中时的动作。

## 一次路由的完整流程

1. SIP INVITE 到达 profile（如 `internal`）；
2. 若是注册分机来电，构建 caller profile（主叫身份、来源 profile、context）；
3. 进入该 context 的拨号计划，从上到下逐个 extension 评估；
4. extension 内部逐个 condition 匹配（默认在首个失败的 condition 处停止本 extension）；
5. 全部命中 → 依序执行 `<action>`；有 `break="always"` 或 `continue="true"` 的规则继续参与后续匹配；
6. 没有任何 extension 命中 → 走 context 兜底（或直接挂断 `NO_ROUTE_DESTINATION`）。

## 最小可用示例

```xml
<include>
  <context name="default">

    <!-- 内部互拨：1001/1002 -->
    <extension name="local_extensions">
      <condition field="destination_number" expression="^(100[12])$">
        <action application="answer"/>
        <action application="bridge" data="user/$1"/>
      </condition>
    </extension>

    <!-- 挂断一切未知号码 -->
    <extension name="catch_all">
      <condition field="destination_number" expression="^.*$">
        <action application="hangup" data="NO_ROUTE_DESTINATION"/>
      </condition>
    </extension>

  </context>
</include>
```

匹配 `1002` 时：`local_extensions` 的正则捕获 `$1=1002`，`bridge` 发起 B 腿 `user/1002`——这正是 [呼叫 (Call)](/concepts/call) 一章描述的流程。

## 动作执行模型

- action 按**书写顺序**在 `CS_EXECUTE` 状态执行；`answer`/`bridge`/`hangup` 这类改变通话状态的动作会阻塞到结果返回；
- 大多数 action 是 mod_dptools 提供的 application；`fs_cli -x "show applications"` 列出全部；
- 需要分支逻辑时用 `<anti-action>`（条件不成立时执行）或转给脚本（见 [动态拨号计划](/concepts/dynamic-dialplan)）。

## 查询与排障

```bash
fs_cli -x "reloadxml"                      # 改完配置必做
fs_cli -x "xml_locate dialplan name default"   # 查看 default context 生效后的完整 XML
```

控制台把日志级别调到 debug 后拨打一次，路由过程会完整打印：

```bash
fs_cli
freeswitch@host> /log debug
# 观察形如 "Processing 1001 <1001>->1002 in context default" 的行
```

## 静态与动态两种写法

| 方式 | 载体 | 适合 |
| ---- | ---- | ---- |
| [静态拨号计划](/concepts/static-dialplan) | `conf/dialplan/*.xml` | 规则相对固定、要求可审计、性能优先 |
| [动态拨号计划](/concepts/dynamic-dialplan) | Lua 脚本 / mod_xml_curl / ESL | 规则来自数据库、需复杂逻辑、按业务实时变化 |

生产系统通常两者结合：固定路由走 XML，业务化路由（按用户归属、时段、计费）交给动态方案。

## 下一步

- [静态拨号计划](/concepts/static-dialplan)：XML 规则的字段级写法；
- [动态拨号计划](/concepts/dynamic-dialplan)：用脚本与 XML 网关接管路由。
