# 配置文件结构

FreeSWITCH 的配置是一棵以 XML 为骨架的树：根文件 `freeswitch.xml` 通过预处理指令把其它 XML"装配"进来，启动时一次性解析成内存中的配置模型。

## conf/ 目录总览

以源码安装（前缀 `/usr/local/freeswitch`）为例：

```
conf/
├── freeswitch.xml          # 根配置：装配其余文件，定义全局 section
├── vars.xml                # 全局变量定义（$${...}）
├── mime.types              # 内置 HTTP 服务文件类型表
├── dialplan/               # 拨号计划
│   ├── default.xml         # default context 主文件
│   ├── default/            # 被 default.xml <include> 进来的分片（demo 分机等）
│   ├── public.xml          # public context（来自外部的来话）
│   ├── public/             # public context 分片
│   ├── features.xml        # 特征码（呼叫转移等功能码）
│   ├── skinny-patterns.xml # SCCP 特征模式
│   └── skinny-patterns/    # SCCP 特征模式分片
├── directory/              # 用户目录（SIP 分机账号）
│   ├── default.xml         # default domain 域定义
│   └── default/            # 1000.xml, 1001.xml ... 每分机一文件
├── sip_profiles/           # SIP profile
│   ├── internal.xml        # 内部 profile（默认 5060，收分机注册）
│   ├── internal-ipv6.xml   # 内部 profile 的 IPv6 变体
│   ├── external.xml        # 外部 profile（默认 5080，对接运营商/网关）
│   ├── external-ipv6.xml   # 外部 profile 的 IPv6 变体
│   ├── external/           # 外部网关定义（gw1.xml ...）
│   └── external-ipv6/      # 外部网关 IPv6 定义
├── autoload_configs/       # 各模块的 autoload 配置
│   ├── modules.conf.xml    # ★ 决定启动时加载哪些模块
│   ├── acl.conf.xml        # 访问控制列表
│   ├── conference.conf.xml # 会议参数
│   ├── voicemail.conf.xml  # 语音信箱
│   ├── lua.conf.xml        # Lua 运行时
│   └── ...
├── ivr_menus/              # IVR 菜单定义
├── chatplan/               # 聊天计划（mod_dptools 的 chat 应用）
├── skinny_profiles/        # SCCP 话机 profile（用 mod_skinny 才需要）
└── lang/                   # 多语言提示音短语（Phrase）
```

模板里另有若干示例与模板文件（`config.FS0`、`extensions.conf`、`fur_elise.ttml`、`tetris.ttml`、`voicemail.tpl`、`web-vm.tpl` 等），只作演示，生产部署可删。vanilla 模板不含 TLS 证书目录：启用 TLS/WSS 时用 `scripts/gentls_cert` 生成自签证书，放到证书目录（默认 `conf/tls`，configure 的 `--with-certsdir` 可改）。

不同安装方式下个别子目录可能缺省，核心的 `freeswitch.xml`、`vars.xml`、`dialplan/`、`directory/`、`sip_profiles/`、`autoload_configs/` 六处始终存在。

## 加载机制：freeswitch.xml 与预处理

`freeswitch.xml` 是唯一入口。启动时它先经过预处理器（X-PRE-PROCESS），把声明的文件文本级拼接进来，再交给 XML 解析器：

```xml
<document type="freeswitch/xml">
  <X-PRE-PROCESS cmd="include" data="vars.xml"/>
  <section name="configuration" description="Configuration">
    <X-PRE-PROCESS cmd="include" data="autoload_configs/*.conf.xml"/>
  </section>
  <section name="dialplan" description="Dial Plan">
    <X-PRE-PROCESS cmd="include" data="dialplan/*.xml"/>
  </section>
  <section name="directory" description="Directory">
    <X-PRE-PROCESS cmd="include" data="directory/*.xml"/>
  </section>
</document>
```

要点：

- `X-PRE-PROCESS` 在**解析前**执行，支持 `include`（拼入文件）与 `set`（定义预处理变量）两种 `cmd`；
- 预处理变量写成 `$${name}`，在运行时可被 `${name}` 引用（区别见 [核心配置文件](/configuration/core-files)）；
- 由于是文本拼接，`X-PRE-PROCESS` 不能出现在 XML 注释里"注释掉"——它照样生效，这是新手最常踩的坑。

## 三个 section 的职责

| section | 内容 | 修改后生效方式 |
| ---- | ---- | ---- |
| `configuration` | 模块配置（autoload_configs 全家） | `reloadxml` + 对应模块重载 |
| `dialplan` | 拨号计划 | `reloadxml` 即可 |
| `directory` | 用户/分机目录 | `reloadxml`（注册缓存可选 `sofia profile internal rescan`） |

`reloadxml` 后配置进内存，但**已建立的通话不受影响**——这是热更新的边界，改 SIP profile 监听参数等仍需重启对应 profile。

## 目录文件怎么组织新增内容

实践约定：

- 新增分机：在 `directory/default/` 加 `1020.xml`（拷贝 `1000.xml` 改密码/号码），`reloadxml` 生效；
- 新增内网网关：在 `sip_profiles/external/` 加网关 XML，`fs_cli -x "sofia profile external rescan"` 装载；
- 新增拨号规则：优先放 `dialplan/default/` 下的独立分片（如 `90-myapp.xml`），利用文件名前缀控制匹配顺序——`default.xml` 按 `<X-PRE-PROCESS>` 的 include 顺序合并文件，编号越小越先匹配。

## 下一步

- [核心配置文件](/configuration/core-files)：三大核心文件的字段级讲解；
- [网络设置](/configuration/network)：profile 监听与 NAT；
- [静态拨号计划](/concepts/static-dialplan)：动手写第一条路由规则。
