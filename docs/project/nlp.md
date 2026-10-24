# Natural Language Processing

ASR turns audio into text; NLP (Natural Language Processing) turns text into "action": what this call wants, what to ask about, and whether to announce next or transfer to a human. I break NLP into three fundamental capabilities, record how to connect Dialogflow and Rasa (both using only the Python standard library `urllib`, with no extra dependencies), and keep a **self-built intent rules fallback** — usable first when the budget is tight, and also a degraded-mode safety net once a cloud service is integrated.

## The Three Fundamental NLP Capabilities

Take a sentence as an example: **"I want to check last month's phone bill"**

### Intent Classification

Decide which business category this sentence belongs to. The previous sentence should classify as `check-bill`. The intent set of a customer service system is the business catalog, usually clustered and organized from historical recording transcriptions; common first-level intents include: check bill, change plan, report fault, change password, complaints and suggestions, transfer to human.

### Entity Extraction / Slot Filling

Pull structured fields out of the sentence. From the previous sentence: `time=last month`, `business type=phone bill`. Intent answers "what to do"; entities answer "what to do it on"; together they form an executable query condition.

### Dialogue Management

Decide the next step:

- **Slots complete** → execute the business action directly (query the database, announce the result);
- **Slots missing** → ask a follow-up ("Which month's bill would you like to check?"), i.e. multi-turn dialogue;
- **Recognition confused** → after one failed clarification, escalate (offer a rephrasing prompt or transfer to a human);
- **Sensitive intent hit** (complaint, cancel account) → transfer to a human immediately.

The vehicle for dialogue management is a **state machine** (the implementation is given in Implementing Smart Customer Service); the NLP service usually only answers "what does this sentence mean," and turn advancement is controlled by your business backend.

## Dialogflow Integration Approach

Dialogflow (the ES edition, i.e. the classic edition) bundles intent classification, entity extraction, and multi-turn management into a hosted service. There are two directions for combining it with a telephony system, and in production both are usually used at the same time:

1. **Active backend call (detectIntent)**: ASR produces text → the backend calls the Dialogflow REST API → the intent, entities, and reply script come back → the backend controls FreeSWITCH to play it. Control stays with you, which suits deep coordination with agents and ticketing;
2. **Dialogflow callback (fulfillment webhook)**: configure a webhook in the Dialogflow console; when an intent with fulfillment is hit, Dialogflow POSTs a JSON payload to your endpoint, and your endpoint returns the reply text. This suits cases where you want business logic orchestrated inside Dialogflow.

### detectIntent: Calling REST with the Standard Library

The API form (ES v2): `POST https://dialogflow.googleapis.com/v2/projects/{project_id}/agent/sessions/{session_id}:detectIntent`. For the session ID, it is recommended to use the call UUID directly, which naturally gives "one session per call."

```python
# dialogflow_client.py — Dialogflow ES detectIntent (standard library implementation)
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

Authentication note: the interface requires an OAuth 2.0 Bearer token. For development and debugging, `gcloud auth print-access-token` quickly yields a short-lived token; in production, exchange a token for a service account key, remember to cache it and refresh before expiry (tokens last about an hour), and do not mint a new one for every request.

> If you use Dialogflow CX (the new edition), the URL and request body structure differ (it introduces the flow/page concept); confirm which edition you are on before integrating.

### Fulfillment Webhook: Receiving Dialogflow's Callback

An endpoint configured as a webhook receives a POST shaped like `{"queryResult": {...}}` and only needs to return `{"fulfillmentText": "..."}`. Standard library implementation:

```python
# fulfillment.py — Dialogflow webhook receiver (standard library implementation)
import json
from http.server import BaseHTTPRequestHandler, HTTPServer

class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        body = self.rfile.read(int(self.headers.get("Content-Length", 0)))
        qr = json.loads(body.decode()).get("queryResult", {})
        intent = qr.get("intent", {}).get("displayName", "")
        params = qr.get("parameters", {})

        # Replace this with a real business query (e.g. checking a phone bill)
        reply = f"Received intent {intent}, parameters {params}"

        out = json.dumps({"fulfillmentText": reply}).encode()
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(out)))
        self.end_headers()
        self.wfile.write(out)

    def log_message(self, *args):   # silence the default access log
        pass

HTTPServer(("127.0.0.1", 9000), Handler).serve_forever()
```

Whichever direction you take, **run the ASR text through a local rule filter before it enters Dialogflow** (see the self-built rules fallback section below); it saves a lot of API calls.

## Rasa Integration

Rasa Open Source is a self-hostable open-source dialogue framework: NLU (intent + entities) and dialogue management (stories/rules) all run locally, which suits teams where "data cannot leave the internal network" or who want to customize models.

### Starting the Service

```bash
rasa run --enable-api --port 5005 --cors "*"
```

`--enable-api` turns on the HTTP API; the REST input channel is available once the `rest:` channel is enabled in `credentials.yml`.

### Conversing over the REST Channel

POST a message to `/webhooks/rest/webhook` and it returns a list of bot replies (a multi-turn reply is several elements):

```python
# rasa_client.py — Rasa Open Source REST channel integration (standard library implementation)
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
    # each element is shaped like {"recipient_id": "...", "text": "..."}
    return [m.get("text", "") for m in messages if m.get("text")]
```

Pass the call UUID as `sender` to maintain multi-turn context within the same call.

### Only the NLU Result

If you want to do dialogue management yourself (as in most telephony scenarios), you can use Rasa purely as NLU: `POST /model/parse` (also requires `--enable-api`), with the request body `{"text": "I want to check my bill"}`, returning the intent name, confidence, and entity list. That way Rasa's stories part can be skipped and the state machine is carried by your backend.

### Where It Connects to FreeSWITCH

Whether Dialogflow or Rasa, the connection point is the same place in the business backend:

```
ASR text → (optional local rules) → NLP service → {intent, entities, reply} → state machine → FreeSWITCH play/transfer
```

So the smart customer service implementation code depends on only one `nlp(text, context) -> action` function, and the platform can be swapped out wholesale.

## Self-built Intent Rules as a Fallback

### When You Need It

- Starting out: there are only a dozen or so intents, not yet at the scale where a model needs training;
- Degrading: when cloud NLP times out or fails, the bot cannot go silent;
- Filtering: intercept frequent, unambiguous instructions such as "transfer to human" and "complaint" first to cut external calls.

### Keyword/Regex Scoring

Each intent carries a set of regexes; the number of hits is the score, and the highest score is the conclusion:

```python
# rule_nlu.py — keyword/regex intent fallback (standard library implementation)
import re

RULES = [
    ("check-bill", [r"bill", r"invoice", r"balance", r"(this month|last month).{0,4}(charge|spending)"]),
    ("change-plan", [r"plan", r"rate plan", r"(upgrade|switch|change).{0,3}plan"]),
    ("report-fault", [r"outage", r"no internet", r"network.{0,4}(down|slow|fault)", r"unfixable"]),
    ("transfer-human", [r"human", r"real person", r"complaint", r"find service"]),
]
COMPILED = [(name, [re.compile(p) for p in pats]) for name, pats in RULES]


def classify(text):
    """Return (intent, confidence). Return ("fallback", 0.0) when no credible match."""
    hits = []
    for name, patterns in COMPILED:
        score = sum(1 for p in patterns if p.search(text))
        if score:
            hits.append((name, score))
    if not hits:
        return "fallback", 0.0
    name, score = max(hits, key=lambda kv: kv[1])
    # Rough normalization: two or more hits count as high confidence
    return name, min(score / 2.0, 1.0)
```

Three engineering conventions to go with it:

- **Separate rule files from code**: put rules in a config table (database or YAML) so customer service operations staff can add words themselves, avoiding a release every time a word changes;
- **Bind the confidence threshold to the degraded script**: below the threshold, do not guess — announce "Sorry, I did not catch that; you can say check bill, change plan, or report fault" for one round of clarification;
- **Always keep a transfer-to-human exit**: however reliable NLP is, put the logic where the "human" keyword goes straight to an agent before all other rules.

### How Platform Solutions and Rule Solutions Work Together

| Stage | Approach |
| ---- | ---- |
| Prototype validation | Pure rules + fixed scripts |
| Small-scale launch | Rule filtering + cloud NLP (Dialogflow and the like) |
| Privatized production | Self-hosted Rasa + rules as fallback |
| Any stage | Rules routing "transfer to human/complaint" straight to an agent, placed first |

## Related Reading

- [Speech Recognition and Synthesis](/project/asr-tts): NLP's upstream — where the transcribed text comes from;
- [Implementing Smart Customer Service](/project/implementation): how NLP results drive the session state machine and agent transfer;
- [Scripting and Programming Interfaces](/advanced/scripting): the scripting capability boundary when Lua side and backend collaborate.

## References

- [Wikipedia · Natural language processing](https://en.wikipedia.org/wiki/Natural_language_processing)
- [Wikipedia · Voice recognition](https://en.wikipedia.org/wiki/Voice_recognition)

<!-- BACKLINKS-AUTO -->
## Related Pages

- [resources](/appendix/resources.md)
- [glossary](/glossary.md)
- [knowledge](/knowledge.md)
- [README](README.md)
- [asr-tts](asr-tts.md)
