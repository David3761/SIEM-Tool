# Teammate 4 — AI Agents (Python)

## Role Overview

You run as a standalone Python service in `services/agents/`. You implement the two AI agents
that are the mandatory project requirement. You subscribe to Redis `alerts:new`, call a local
Ollama LLM, and write the AI analysis back to PostgreSQL. You also run analysis when incidents
are created — but since incidents are created via the Symfony API (Teammate 1), you poll
PostgreSQL for new incidents that have no AI analysis yet.

---

## User Stories Owned

| Story | Your role | API (Teammate 1) |
|---|---|---|
| US-04 | Write `ai_analysis` JSON to Alert row | `GET /api/alerts/{id}` returns it |
| US-11 | Write `timeline` JSON to Incident row | `GET /api/incidents/{id}` returns it |
| US-12 | Write `ai_remediation` JSON to Incident row | `GET /api/incidents/{id}` returns it |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Python 3.11 | Language |
| redis-py | Subscribe to `alerts:new`, publish to `alerts:updated` |
| psycopg2 | Read alerts/events/incidents, write AI analysis results |
| httpx | Call Ollama LLM API |
| pytest | Unit tests + agent evals |

---

## Context

### Why local Ollama instead of OpenAI?
The project requirement specifies small language models running locally. Ollama serves
open-source models (like `llama3.2:3b`) on the user's machine with no internet required
after the initial model download. The models will sometimes hallucinate — this is acceptable
per the project requirements.

### Why two separate agents?
Agent 1 (Threat Analyst) reacts to individual alerts — triggered immediately when a new alert
is created. It analyzes ONE alert in isolation.
Agent 2 (Incident Response) reacts to incidents (groups of related alerts) — triggered when
a new incident appears without AI analysis. It thinks holistically across multiple alerts.

### How does Agent 2 know when a new incident is created?
The Symfony API creates incidents (POST /api/incidents). Agent 2 polls PostgreSQL every 10
seconds for incidents where `ai_remediation IS NULL`. When it finds one, it runs analysis.
This is simpler than a dedicated Redis channel for incidents.

### Why publish `alerts:updated` after enriching an alert?
Teammate 1's Ratchet WebSocket server subscribes to `alerts:updated`. When you publish, the
browser immediately updates the AI analysis panel from a spinner to real content. Without this,
the user would need to refresh manually.

---

## Architecture Position

```
Redis "alerts:new"
        │
        ▼
[Agent 1 — Threat Analyst]
        │
        ├── SELECT alert + related events from PostgreSQL
        ├── POST http://ollama:11434/api/generate
        ├── UPDATE alerts SET ai_analysis WHERE id=...
        └── PUBLISH to Redis "alerts:updated"
                  └── Teammate 1 Ratchet WS → browser live update

PostgreSQL incidents WHERE ai_remediation IS NULL
        │ (polled every 10 seconds)
        ▼
[Agent 2 — Incident Response]
        │
        ├── SELECT all alerts + events for the incident
        ├── POST http://ollama:11434/api/generate
        └── UPDATE incidents SET ai_remediation, timeline WHERE id=...
```

---

## File Structure

```
services/agents/
├── agent1_threat_analyst.py  ← subscribes to alerts:new, enriches alerts
├── agent2_incident_response.py ← polls for new incidents, generates remediation
├── ollama_client.py          ← HTTP client for Ollama API
├── tests/
│   ├── test_agents.py        ← unit tests with mocked Ollama
│   └── test_agent_evals.py   ← quality evaluation tests
├── requirements.txt
└── Dockerfile
```

---

## Ollama Client

```python
# ollama_client.py

OLLAMA_URL = os.environ["OLLAMA_URL"]  # http://ollama:11434

async def generate(prompt: str, model: str = "llama3.2:3b") -> str:
    """Call Ollama and return raw text response. Raises on HTTP error."""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.post(f"{OLLAMA_URL}/api/generate", json={
            "model": model,
            "prompt": prompt,
            "stream": False,
            "options": {"temperature": 0.3, "num_predict": 600}
        })
        return resp.json()["response"]

async def generate_json(prompt: str, model: str = "llama3.2:3b") -> dict:
    """Call generate(), parse response as JSON. Retry once on parse failure.
    Return error dict if both attempts fail."""

async def ensure_model_available(model: str = "llama3.2:3b") -> None:
    """Pull the model if not already downloaded. Called at startup."""
```

---

## Agent 1 — Threat Analyst

**Trigger**: new message on Redis `alerts:new`

**Steps:**
1. Parse alert from Redis message
2. `SELECT * FROM alerts WHERE id = %s` — fetch full alert row
3. `SELECT * FROM network_events WHERE id = ANY(%s)` — fetch up to 10 related events
4. `SELECT * FROM alerts WHERE triggering_event_id IN (SELECT id FROM network_events WHERE src_ip = %s) ORDER BY timestamp DESC LIMIT 5` — recent history from same IP
5. Build prompt (see below)
6. Call `ollama_client.generate_json(prompt)`
7. Add `analyzed_at` timestamp to result
8. `UPDATE alerts SET ai_analysis = %s::jsonb WHERE id = %s`
9. `PUBLISH alerts:updated` with full updated alert JSON

**On Ollama failure**: store `{"error": "Ollama unavailable", "analyzed_at": "..."}` in `ai_analysis`. Never crash.

### Prompt Template

```
You are a cybersecurity expert analyzing a network security alert.
Analyze the alert and respond ONLY with valid JSON.

ALERT: {rule_name} | Severity: {severity} | Time: {timestamp}

TRIGGERING EVENT:
{src_ip} -> {dst_ip}:{dst_port} via {protocol} ({flags}), {bytes_sent} bytes, {direction}

SAMPLE OF {related_count} RELATED EVENTS:
{related_events_text}

RECENT ALERTS FROM SAME SOURCE IP:
{recent_alerts_text}

Respond ONLY with this exact JSON:
{{"threat_assessment": "2-3 sentence explanation",
  "severity_justification": "why this severity is correct",
  "mitre_tactic": "one of: Reconnaissance, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact",
  "mitre_technique": "T-number and name",
  "confidence": 0.0 to 1.0,
  "is_false_positive_likely": true or false,
  "recommended_action": "specific immediate action",
  "iocs": ["list of suspicious IPs or domains"]}}
```

### Expected Output (stored in `alerts.ai_analysis`)

```json
{
  "threat_assessment": "This is highly likely a real port scan. The source IP 192.168.1.100 contacted 34 different ports in 45 seconds, matching a TCP SYN scan pattern used for reconnaissance.",
  "severity_justification": "HIGH because systematic scanning of 34+ ports indicates active reconnaissance of an internal machine.",
  "mitre_tactic": "Reconnaissance",
  "mitre_technique": "T1046 - Network Service Discovery",
  "confidence": 0.87,
  "is_false_positive_likely": false,
  "recommended_action": "Isolate 192.168.1.100 and investigate for malware.",
  "iocs": ["192.168.1.100"],
  "analyzed_at": "2024-01-15T10:30:08Z"
}
```

---

## Agent 2 — Incident Response

**Trigger**: poll `SELECT * FROM incidents WHERE ai_remediation IS NULL ORDER BY created_at DESC LIMIT 1` every 10 seconds

**Steps:**
1. Fetch incident row
2. `SELECT * FROM alerts WHERE id = ANY(%s)` — all alerts in the incident
3. For each alert, fetch its `related_event_ids` events from `network_events`
4. Sort all events chronologically to build a timeline
5. Build prompt (see below)
6. Call `ollama_client.generate_json(prompt)`
7. `UPDATE incidents SET ai_remediation = %s::jsonb, timeline = %s::jsonb WHERE id = %s`

### Prompt Template

```
You are a senior incident responder. Analyze this security incident and respond ONLY with valid JSON.

INCIDENT: {title}

ALERTS ({alert_count} total):
{alerts_summary}

TIME SPAN: {start_time} to {end_time} ({duration_minutes} minutes)
SOURCE IPs INVOLVED: {unique_src_ips}
DESTINATION IPs INVOLVED: {unique_dst_ips}

TIMELINE SAMPLE:
{timeline_text}

Respond ONLY with this exact JSON:
{{"summary": "2-3 sentence high-level description",
  "attack_pattern": "name of the attack chain",
  "mitre_tactics": ["list of tactics"],
  "mitre_techniques": ["T-number - Name"],
  "timeline": [{{"timestamp": "ISO datetime", "event": "description", "significance": "why this matters"}}],
  "remediation_steps": ["1. IMMEDIATE: ...", "2. SHORT-TERM: ...", "3. LONG-TERM: ..."],
  "iocs": ["suspicious IPs or domains"],
  "analyzed_at": "ISO datetime"}}
```

### Expected Output (stored in `incidents.ai_remediation`)

```json
{
  "summary": "A two-stage attack from internal IP 192.168.1.100. Attacker first performed network reconnaissance, then launched SSH brute force against a discovered service.",
  "attack_pattern": "Reconnaissance followed by credential attack",
  "mitre_tactics": ["Reconnaissance", "Initial Access"],
  "mitre_techniques": ["T1046 - Network Service Discovery", "T1110 - Brute Force"],
  "timeline": [
    {"timestamp": "2024-01-15T10:30:05Z", "event": "Port scan from 192.168.1.100", "significance": "Reconnaissance begins"},
    {"timestamp": "2024-01-15T10:31:00Z", "event": "SSH brute force against 192.168.1.10:22", "significance": "Exploitation attempt"}
  ],
  "remediation_steps": [
    "1. IMMEDIATE: Block all outbound connections from 192.168.1.100 at the firewall",
    "2. IMMEDIATE: Change SSH passwords on 192.168.1.10 and check auth logs",
    "3. SHORT-TERM: Run antivirus scan on 192.168.1.100",
    "4. LONG-TERM: Implement fail2ban and key-based SSH auth only"
  ],
  "iocs": ["192.168.1.100", "192.168.1.10"],
  "analyzed_at": "2024-01-15T10:35:00Z"
}
```

---

## Agent Evaluation Tests (Required for Grade)

Evaluations check output quality, not just that code runs.

```python
# services/agents/tests/test_agent_evals.py

EVAL_SCENARIOS = [
    {
        "name": "Port scan",
        "alert": {"rule_name": "Port Scan Detection", "severity": "high",
                  "src_ip": "192.168.1.100", "protocol": "TCP", "related_count": 34},
        "expect_mitre_tactic": "Reconnaissance",
        "expect_false_positive": False,
        "min_confidence": 0.6,
    },
    {
        "name": "DNS server false positive",
        "alert": {"rule_name": "Unusual DNS Activity", "severity": "low",
                  "src_ip": "192.168.1.1", "protocol": "UDP", "related_count": 210},
        "expect_false_positive": True,   # typical DNS server, should be FP
        "max_confidence": 0.5,
    },
]

def test_agent1_output_is_valid_json()  # must always return parseable JSON
def test_agent1_has_all_required_fields()  # all fields present
def test_agent1_confidence_is_float_between_0_and_1()
def test_agent1_port_scan_identifies_reconnaissance()  # mitre_tactic check
def test_agent2_remediation_has_at_least_3_steps()
def test_agent2_timeline_is_chronological()  # timestamps in order
def test_agent_handles_ollama_failure_gracefully()  # error dict, no crash
```

---

## Testing Requirements

Write tests in `services/agents/tests/test_agents.py`:

1. Agent 1 builds correct prompt from alert + events
2. Agent 1 stores error dict when Ollama is unavailable (does not crash)
3. Agent 1 handles invalid JSON from LLM (retries, then falls back)
4. Agent 2 sorts timeline events chronologically
5. Agent 2 correctly derives attack pattern from multiple alerts
6. All required output fields are always present

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the AI agent service for a SIEM tool.
This is a standalone Python service in services/agents/.
It uses: redis-py (async), psycopg2 (sync), httpx (async).

PostgreSQL tables (read and update, created by Symfony):
  alerts: id uuid, rule_id, rule_name, severity, timestamp, status,
          triggering_event_id uuid, related_event_ids jsonb, ai_analysis jsonb nullable, incident_id uuid nullable
  network_events: id uuid, timestamp, src_ip, dst_ip, src_port, dst_port,
                  protocol, bytes_sent, direction, interface, flags
  incidents: id uuid, title, severity, status, created_at, alert_ids jsonb,
             ai_remediation jsonb nullable, timeline jsonb nullable

Redis channels:
  Subscribe from: "alerts:new"
  Publish to:     "alerts:updated"

Ollama API: POST {OLLAMA_URL}/api/generate
  Body: {"model": "llama3.2:3b", "prompt": "...", "stream": false, "options": {"temperature": 0.3}}
  Response: {"response": "...text..."}

Implement:

1. services/agents/ollama_client.py
   - async generate(prompt, model="llama3.2:3b") -> str
   - async generate_json(prompt, model) -> dict: calls generate(), json.loads(), retries once,
     returns {"error": "parse failed", "analyzed_at": "..."} on second failure
   - async ensure_model_available(model): GET /api/tags to check, POST /api/pull if missing

2. services/agents/agent1_threat_analyst.py
   - async run(): subscribe to Redis "alerts:new", for each message:
     a. Fetch full alert from PostgreSQL
     b. Fetch up to 10 related events by related_event_ids
     c. Fetch last 5 alerts from same src_ip
     d. Format related_events_text as: "10:30:01Z: 192.168.1.100 -> 8.8.8.8:21 (TCP SYN)"
     e. Format recent_alerts_text as: "10:29:00Z: SSH Brute Force (critical)"
     f. Build prompt using the exact template provided
     g. Call generate_json(prompt)
     h. Add "analyzed_at" field with current UTC ISO timestamp
     i. UPDATE alerts SET ai_analysis WHERE id
     j. PUBLISH "alerts:updated" with full alert JSON including ai_analysis
   - On any exception from Ollama: store {"error": "...", "analyzed_at": "..."} in ai_analysis

3. services/agents/agent2_incident_response.py
   - async run(): every 10 seconds poll:
     SELECT * FROM incidents WHERE ai_remediation IS NULL ORDER BY created_at DESC LIMIT 1
     If found:
     a. Fetch all alerts by alert_ids
     b. Fetch all events referenced in each alert's related_event_ids
     c. Sort all events by timestamp (chronological)
     d. Build timeline_text: "10:30:05Z: TCP SYN 192.168.1.100->8.8.8.8:21"
     e. Build alerts_summary: "Port Scan Detection (high), SSH Brute Force (critical)"
     f. Build prompt using exact template provided
     g. Call generate_json(prompt)
     h. Add "analyzed_at" to result
     i. UPDATE incidents SET ai_remediation, timeline WHERE id
     (Store the timeline array from the LLM response in incidents.timeline)

4. A main.py that runs both agents concurrently using asyncio.gather() and calls
   ensure_model_available() at startup before starting agents.

5. services/agents/requirements.txt: redis, psycopg2-binary, httpx, pytest, pytest-asyncio

6. services/agents/Dockerfile: FROM python:3.11-slim, install requirements, run main.py

7. services/agents/tests/test_agents.py
   Mock psycopg2 with unittest.mock, mock ollama_client.generate_json:
   - Agent 1 builds prompt containing src_ip and rule_name
   - Agent 1 updates alert ai_analysis with LLM result
   - Agent 1 stores error dict when Ollama raises exception
   - Agent 1 handles generate_json returning error dict (stores it, does not crash)
   - Agent 2 sorts events chronologically before building prompt

8. services/agents/tests/test_agent_evals.py
   Mock generate_json to return realistic but controllable responses:
   - Port scan scenario: response must have mitre_tactic="Reconnaissance"
   - Confidence field must always be float between 0.0 and 1.0
   - All required fields must be present in every response
   - remediation_steps must have at least 3 items
   - timeline array must be in chronological order
```
