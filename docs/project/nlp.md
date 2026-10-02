# 第 15 章 · 自然语言处理

ASR 把音频变成文本，NLP（自然语言处理）负责把文本变成"动作"：这通电话想干什么、需要追问什么、接下来播报还是转人工。本章先讲清 NLP 的三项基础能力，再给出 Dialogflow 与 Rasa 两个主流平台的对接方式（均用 Python 标准库 `urllib`，不引入额外依赖），最后给出一个**自建意图规则兜底方案**——它既是没预算上平台时的起步方案，也是接了云服务之后的降级保险。

## NLP 的三项基础能力

以一句话为例：**"我想查一下上个月的话费账单"**

### 意图识别（Intent Classification）

判定这句话属于哪一类业务。上句应判为 `查话费`。客服系统的意图集合就是业务清单，通常从历史录音转写里聚类整理出来，常见的一级意图如：查话费、办套餐、报故障、修改密码、投诉建议、转人工。

### 实体抽取（Entity Extraction / Slot Filling）

从句子里抠出结构化字段。上句抽取：`时间=上个月`、`业务类型=话费账单`。意图只回答"做什么"，实体回答"对什么做"，二者合起来才是可执行的查询条件。

### 对话管理（Dialogue Management）

决定下一步：

- **槽位齐全** → 直接执行业务动作（查库、播报结果）；
- **槽位缺失** → 主动追问（"请问您要查询哪个月的账单？"），即多轮对话；
- **识别混乱** → 澄清一次仍失败则升级（换说法提示或转人工）；
- **命中敏感意图**（投诉、销户）→ 直接转人工。

对话管理的载体是**状态机**（第 16 章给出实现），NLP 服务通常只负责"这句话是什么意思"，轮次推进由你的业务后端控制。

## Dialogflow 集成思路

Dialogflow（ES 版，即经典版）把意图识别、实体抽取、多轮管理打包成一个托管服务。与电话系统的结合有两个方向，生产上通常同时使用：

1. **后端主动调用（detectIntent）**：ASR 出文本 → 后端调 Dialogflow REST API → 拿回意图、实体与应答话术 → 后端控制 FreeSWITCH 播报。控制权在你手里，适合与坐席、工单深度联动；
2. **Dialogflow 回调（fulfillment webhook）**：在 Dialogflow 控制台配置 webhook，命中带 fulfillment 的意图时 Dialogflow 会 POST 一段 JSON 到你的接口，由你的接口返回应答文本。适合把业务逻辑放在 Dialogflow 编排里。

### detectIntent：用标准库调用 REST

API 形态（ES v2）：`POST https://dialogflow.googleapis.com/v2/projects/{project_id}/agent/sessions/{session_id}:detectIntent`，会话 ID 建议直接用通话 UUID，天然做到"一通电话一个会话"。

```python
# dialogflow_client.py — Dialogflow ES detectIntent（标准库实现）
import json
import urllib.request

def detect_intent(project_id, session_id, text,
                  language_code="zh-CN", access_token=None):
    url = (f"https://dialogflow.googleapis.com/v2/projects/{project_id}"
           f"/agent/sessions/{session_id}:detectIntent")
    payload = {
        "queryInput": {
            "text": {"text": text, "languageCode": language_code}
        }
    }
    headers = {"Content-Type": "application/json"}
    if access_token:
        headers["Authorization"] = "Bearer " + access_token
    req = urllib.request.Request(
        url,
        data=json.dumps(payload).encode(),
        headers=headers,
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10) as resp:
        data = json.loads(resp.read().decode())
    qr = data["queryResult"]
    return {
        "intent": qr.get("intent", {}).get("displayName", "fallback"),
        "params": qr.get("parameters", {}),
        "reply": qr.get("fulfillmentText", ""),
        "confidence": qr.get("intentDetectionConfidence", 0.0),
    }
```

鉴权要点：接口需要 OAuth 2.0 Bearer token。开发调试可用 `gcloud auth print-access-token` 快速取一枚短期 token；生产环境用服务账号密钥换取 token，注意缓存并在过期前刷新（token 有效期约一小时），不要每次请求都换新。

> 若使用 Dialogflow CX（新版），URL 与请求体结构不同（引入 flow/page 概念），对接前先确认自己用的是哪个版本。

### fulfillment webhook：接住 Dialogflow 的回调

被配置为 webhook 的接口会收到形如 `{"queryResult": {...}}` 的 POST，返回 `{"fulfillmentText": "..."}` 即可。标准库实现：

```python
# fulfillment.py — Dialogflow webhook 接收端（标准库实现）
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        qr = json.loads(body.decode()).get("queryResult", {})
        intent = qr.get("intent", {}).get("displayName", "")
        params = qr.get("parameters", {})

        # 这里替换为真实业务查询（如查话费）
        reply = f"已收到意图 {intent}，参数 {params}"

        out = json.dumps({"fulfillmentText": reply}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *args):   # 静默默认访问日志
        pass

HTTPServer(("127.0.0.1", 9000), Handler).serve_forever()
```

无论走哪个方向，**ASR 文本进入 Dialogflow 之前先做一遍本地规则过滤**（见本章末尾），能省下不少调用量。

## Rasa 集成

Rasa Open Source 是可自托管的开源对话框架，NLU（意图+实体）与对话管理（stories/rules）都在本地，适合"数据不能出内网"或希望自定义模型的团队。

### 启动服务

```bash
rasa run --enable-api --port 5005 --cors "*"
```

`--enable-api` 打开 HTTP API；REST 输入通道在 `credentials.yml` 中启用 `rest:` 通道后即可用。

### REST 通道对话

向 `/webhooks/rest/webhook` POST 消息，返回机器人的应答列表（多轮回复就是多个元素）：

```python
# rasa_client.py — Rasa Open Source REST 通道对接（标准库实现）
import json
import urllib.request

def chat(sender, text, base="http://127.0.0.1:5005", timeout=10):
    url = base + "/webhooks/rest/webhook"
    body = json.dumps({"sender": sender, "message": text}).encode()
    req = urllib.request.Request(
        url,
        data=body,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        messages = json.loads(resp.read().decode())
    # 每个元素形如 {"recipient_id": "...", "text": "..."}
    return [m.get("text", "") for m in messages if m.get("text")]
```

`sender` 传通话 UUID，即可维持同一通电话内的多轮上下文。

### 只要 NLU 结果

若对话管理想自己做（多数电话场景如此），可以只把 Rasa 当 NLU 用：`POST /model/parse`（同样需要 `--enable-api`），请求体 `{"text": "我要查话费"}`，返回意图名称、置信度与实体列表。这样 Rasa 的 stories 部分可以不用，状态机由你的后端承担。

### 与 FreeSWITCH 的衔接位置

无论 Dialogflow 还是 Rasa，衔接点都在业务后端的同一处：

```
ASR 文本 → (可选本地规则) → NLP 服务 → {意图, 实体, 应答} → 状态机 → FreeSWITCH 播报/转接
```

因此第 16 章的代码只依赖一个 `nlp(text, context) -> action` 函数，平台可以整体替换。

## 自建意图规则的兜底方案

### 什么时候需要它

- 起步期：意图只有十几个，还没到训练模型的体量；
- 降级期：云 NLP 超时或故障时，机器人不能"哑"；
- 过滤期：先拦掉"转人工""投诉"这类高频明确指令，减少外部调用。

### 关键词/正则打分

每条意图挂一组正则，命中数作为得分，取最高分为结论：

```python
# rule_nlu.py — 关键词/正则意图兜底（标准库实现）
import re

RULES = [
    ("查话费", [r"话费", r"账单", r"余额", r"(本月|上月|这个月).{0,4}(费用|消费)"]),
    ("办套餐", [r"套餐", r"资费", r"(升级|更换|改).{0,3}套餐"]),
    ("报故障", [r"断网", r"上不了网", r"网络.{0,4}(断|慢|故障)", r"修不好"]),
    ("转人工", [r"人工", r"真人", r"投诉", r"找客服"]),
]
COMPILED = [(name, [re.compile(p) for p in pats]) for name, pats in RULES]


def classify(text):
    """返回 (意图, 置信度)。无可信命中时返回 ("fallback", 0.0)。"""
    hits = []
    for name, patterns in COMPILED:
        score = sum(1 for p in patterns if p.search(text))
        if score:
            hits.append((name, score))
    if not hits:
        return "fallback", 0.0
    name, score = max(hits, key=lambda kv: kv[1])
    # 粗略归一化：命中 2 条及以上视为高置信
    return name, min(score / 2.0, 1.0)
```

配套三条工程约定：

- **规则文件与代码分离**：规则放进配置表（数据库或 YAML），让客服运营人员能自己加词，避免每次改词都发版；
- **置信度阈值与降级话术绑定**：低于阈值不要硬猜，播报"抱歉没听清，您可以说查话费、办套餐或报故障"做一次澄清；
- **永远保留转人工出口**：无论 NLP 多可靠，"人工"关键词直达坐席的逻辑放在所有规则之前。

### 平台方案与规则方案的配合

| 阶段 | 方案 |
| ---- | ---- |
| 原型验证 | 纯规则 + 固定话术 |
| 小规模上线 | 规则过滤 + 云 NLP（Dialogflow 等） |
| 私有化生产 | Rasa 自托管 + 规则兜底 |
| 任何阶段 | "转人工/投诉"直达坐席的规则前置 |

## 相关阅读

- [第 14 章 · 语音识别与合成](/project/asr-tts)：NLP 的上游——转写文本从哪来；
- [第 16 章 · 实现智能客服功能](/project/implementation)：NLP 结果如何驱动会话状态机与坐席转接；
- [脚本与编程接口](/advanced/scripting)：Lua 侧与后端协作时的脚本能力边界。
