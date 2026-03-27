# Teammate 4 — AI Agents

## Role Overview

You implement the two AI agents that are the core differentiator of this SIEM tool. Without you,
the tool is just a packet logger with rules. With you, every alert gets an expert security
analysis and every incident gets a concrete remediation plan — generated automatically by a
local LLM running on the user's machine.

Your work directly satisfies the mandatory project requirement: **minimum 2 AI agents
integrated into the functionality**.

You own the Ollama container configuration, both agent implementations, the agent evaluation
framework, and the API endpoints that trigger/retrieve agent results.

---

## User Stories Owned

| Story | Description |
|---|---|
| US-04 | View the AI explanation for why something was flagged |
| US-11 | See a timeline view of an incident (AI reconstructs and explains the sequence) |
| US-12 | Receive AI-generated remediation suggestions for an incident |

---

## Context — Why Each Piece Exists

### Why Ollama?
Ollama is a local LLM server. It runs open-source language models (like Llama 3.2 3B) directly
on the user's machine, with no internet connection needed after the initial model download.
This satisfies the project requirement for "small language models running locally."
The model WILL sometimes hallucinate — that is acceptable per the project requirements.

### Why two separate agents?
- **Agent 1 (Threat Analyst)** reacts to individual alerts. It is event-driven: triggered
  immediately when a new alert is created. It analyzes ONE alert in isolation.
- **Agent 2 (Incident Response)** reacts to incidents, which are collections of related alerts.
  It thinks holistically: "given all these alerts together, what attack pattern is occurring,
  what is the full timeline, and what should we do?"

The separation reflects how real SOC (Security Operations Center) analysts work:
a Tier 1 analyst triages individual alerts, a Tier 2 analyst investigates incidents.

### Why subscribe to Redis instead of being called directly?
Both agents run asynchronously and must not block the API response. When P3 creates an alert,
the API immediately returns the alert to the frontend (status: open, ai_analysis: null).
Your agent then enriches it in the background. The frontend gets the AI analysis update via
WebSocket when it's ready.

### Why store results in PostgreSQL rather than returning them directly?
Results must persist. If a user refreshes the page, the AI analysis must still be there.
You write to the DB; the frontend fetches via the existing alert/incident API endpoints.

---

## Architecture Position

```
Redis "alerts:new"
        │  (new alert fired by P3 rule engine)
        ▼
[Agent 1 — Threat Analyst]
        │
        ├── fetches alert + related events from PostgreSQL
        ├── builds prompt with security context
        ├── POST → http://ollama:11434/api/generate
        ├── parses LLM response as JSON
        ├── writes ai_analysis to Alert row in PostgreSQL
        └── publishes updated alert to Redis "alerts:updated"
                │
                └──► P1 WebSocket handler → P5 frontend gets live update


[Incident API endpoint — POST /api/incidents] ← P5 frontend triggers
        │
        ▼
[Agent 2 — Incident Response]
        │
        ├── fetches all alerts in the incident + their events from PostgreSQL
        ├── builds chronological timeline
        ├── builds prompt with full incident context
        ├── POST → http://ollama:11434/api/generate
        ├── parses LLM response as JSON
        ├── writes ai_remediation + timeline to Incident row in PostgreSQL
        └── returns enriched incident to frontend
```

---

## What You Receive (Inputs)

### Agent 1 input (from Redis + PostgreSQL)

When you receive a message on `alerts:new`, the message contains the full alert. You then
fetch additional context from the database.

**Redis message format (same as Alert schema):**
```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "rule_id": "port-scan-001",
  "rule_name": "Port Scan Detection",
  "severity": "high",
  "timestamp": "2024-01-15T10:30:05Z",
  "status": "open",
  "triggering_event_id": "3f2a1b4c-8d9e-4f5a-b6c7-d8e9f0a1b2c3",
  "related_event_ids": ["3f2a1b4c-...", "4a3b2c1d-...", "..."],
  "ai_analysis": null,
  "incident_id": null
}
```

**Context you fetch from DB before calling Ollama:**
- The triggering NetworkEvent (src_ip, dst_ip, protocol, port, flags, timestamp)
- Up to 10 of the related NetworkEvents (to show the pattern)
- The last 5 alerts for the same src_ip (to check for repeat offender)

### Agent 2 input (from HTTP request + PostgreSQL)

Triggered by POST /api/incidents from the frontend. Request body:
```json
{
  "title": "Port scan followed by SSH brute force from 192.168.1.100",
  "alert_ids": [
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "b2c3d4e5-f6a7-8901-bcde-f12345678901"
  ]
}
```

You fetch all specified alerts + their events from the DB, sort them by timestamp, and build
the full incident context.

---

## What You Produce (Outputs)

### Agent 1 Output — ai_analysis JSON stored in Alert

This JSON is written to `Alert.ai_analysis` in PostgreSQL and forwarded to the frontend
via the `alerts:updated` Redis channel.

```json
{
  "threat_assessment": "This is highly likely a real port scan attack. The source IP 192.168.1.100 contacted 34 different destination ports on 8.8.8.8 within 45 seconds. This matches the classic TCP SYN scan pattern used for network reconnaissance.",
  "severity_justification": "Rated HIGH because: (1) systematic scanning of 34+ ports indicates active reconnaissance, (2) source is an internal IP which may indicate a compromised internal machine, (3) SYN-only flags with no SYN-ACK responses suggests stealth scanning.",
  "mitre_tactic": "Reconnaissance",
  "mitre_technique": "T1046 - Network Service Discovery",
  "confidence": 0.87,
  "is_false_positive_likely": false,
  "recommended_action": "Isolate 192.168.1.100 from network access immediately. Investigate what software initiated the scan. Check for malware infection on this host.",
  "iocs": ["192.168.1.100"],
  "analyzed_at": "2024-01-15T10:30:08Z"
}
```

### Agent 2 Output — ai_remediation JSON stored in Incident

```json
{
  "summary": "A two-stage attack was detected originating from internal IP 192.168.1.100. The attacker first performed network reconnaissance (port scan) to identify services, then launched a brute-force attack against the discovered SSH service on 192.168.1.10.",
  "attack_pattern": "Reconnaissance followed by credential attack (T1046 → T1110)",
  "mitre_tactics": ["Reconnaissance", "Initial Access"],
  "mitre_techniques": ["T1046 - Network Service Discovery", "T1110 - Brute Force"],
  "timeline": [
    {
      "timestamp": "2024-01-15T10:30:05Z",
      "event": "Port scan initiated from 192.168.1.100",
      "alert": "Port Scan Detection",
      "significance": "Reconnaissance phase begins"
    },
    {
      "timestamp": "2024-01-15T10:31:00Z",
      "event": "SSH brute force started against 192.168.1.10:22",
      "alert": "SSH Brute Force",
      "significance": "Exploitation phase — attacker found SSH service via scan"
    }
  ],
  "remediation_steps": [
    "1. IMMEDIATE: Block outbound connections from 192.168.1.100 at the firewall level",
    "2. IMMEDIATE: Change all SSH passwords on 192.168.1.10 and audit login history",
    "3. SHORT-TERM: Run antivirus/EDR scan on 192.168.1.100 — it may be compromised",
    "4. SHORT-TERM: Review /var/log/auth.log on 192.168.1.10 for successful logins during attack window",
    "5. LONG-TERM: Implement fail2ban on SSH services, consider key-based auth only",
    "6. LONG-TERM: Set up network segmentation to prevent internal lateral movement"
  ],
  "iocs": ["192.168.1.100", "192.168.1.10"],
  "analyzed_at": "2024-01-15T10:35:00Z"
}
```

---

## File Structure You Own

```
backend/
└── app/
    ├── agents/
    │   ├── __init__.py
    │   ├── ollama_client.py      ← HTTP client for Ollama API
    │   ├── threat_analyst.py     ← Agent 1: subscribes to alerts:new, enriches alerts
    │   └── incident_response.py  ← Agent 2: called on incident creation
    ├── api/
    │   └── incidents.py          ← POST/GET/PATCH /api/incidents
    └── tests/
        ├── test_agents.py        ← unit tests with mocked Ollama
        └── test_agent_evals.py   ← evaluation tests (quality checks)
```

---

## Ollama Client — Specification

```python
# app/agents/ollama_client.py

OLLAMA_URL = settings.OLLAMA_URL  # http://ollama:11434

async def generate(prompt: str, model: str = "llama3.2:3b") -> str:
    """
    Call Ollama generate endpoint.
    Returns the raw text response from the LLM.
    Raises OllamaError if Ollama is unavailable.
    """
    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(
            f"{OLLAMA_URL}/api/generate",
            json={
                "model": model,
                "prompt": prompt,
                "stream": False,
                "options": {
                    "temperature": 0.3,   # lower = more deterministic, better for security analysis
                    "num_predict": 500    # limit response length
                }
            }
        )
        return response.json()["response"]

async def generate_json(prompt: str, model: str = "llama3.2:3b") -> dict:
    """
    Same as generate() but parses the response as JSON.
    Retries once if JSON parsing fails (LLMs sometimes produce malformed JSON).
    Falls back to a default error structure if both attempts fail.
    """

async def ensure_model_available(model: str = "llama3.2:3b") -> None:
    """
    Checks if model is downloaded. If not, pulls it.
    Called at application startup.
    POST /api/pull with {"name": model}
    """
```

---

## Agent 1 — Threat Analyst: Prompt Template

```
You are a cybersecurity expert analyzing a network security alert.
Analyze the following alert and provide your assessment in valid JSON format.

ALERT DETAILS:
Rule: {rule_name}
Severity: {severity}
Time: {timestamp}

TRIGGERING EVENT:
Source IP: {src_ip}
Destination IP: {dst_ip}
Protocol: {protocol}
Destination Port: {dst_port}
TCP Flags: {flags}
Bytes: {bytes_sent}
Direction: {direction}

RELATED EVENTS SAMPLE ({related_count} total events triggered this rule):
{related_events_summary}

RECENT ALERTS FROM SAME SOURCE IP:
{recent_alerts_summary}

Respond ONLY with valid JSON in this exact format:
{{
  "threat_assessment": "2-3 sentence explanation of what this alert means",
  "severity_justification": "Why this severity level is appropriate",
  "mitre_tactic": "One of: Reconnaissance, Initial Access, Execution, Persistence, Privilege Escalation, Defense Evasion, Credential Access, Discovery, Lateral Movement, Collection, Command and Control, Exfiltration, Impact",
  "mitre_technique": "T-number and name, e.g. T1046 - Network Service Discovery",
  "confidence": 0.0 to 1.0,
  "is_false_positive_likely": true or false,
  "recommended_action": "Specific immediate action to take",
  "iocs": ["list", "of", "suspicious", "IPs", "or", "domains"]
}}
```

### related_events_summary format (inject into prompt):
```
- 10:30:01Z: 192.168.1.100 → 8.8.8.8:21 (TCP SYN, 60 bytes)
- 10:30:02Z: 192.168.1.100 → 8.8.8.8:22 (TCP SYN, 60 bytes)
- 10:30:02Z: 192.168.1.100 → 8.8.8.8:23 (TCP SYN, 60 bytes)
... (showing 10 of 34 total events)
```

---

## Agent 2 — Incident Response: Prompt Template

```
You are a senior incident responder investigating a security incident.
Analyze the following incident and provide a structured response plan in valid JSON.

INCIDENT: {title}

ALERTS IN THIS INCIDENT ({alert_count} alerts):
{alerts_summary}

FULL TIMELINE OF EVENTS ({event_count} total network events):
{timeline_summary}

UNIQUE SOURCE IPs INVOLVED: {unique_src_ips}
UNIQUE DESTINATION IPs INVOLVED: {unique_dst_ips}
TIME SPAN: {start_time} to {end_time} ({duration_minutes} minutes)

Respond ONLY with valid JSON in this exact format:
{{
  "summary": "2-3 sentence high-level description of the attack",
  "attack_pattern": "Name of the attack pattern/chain",
  "mitre_tactics": ["list", "of", "tactics"],
  "mitre_techniques": ["T-number - Name", "T-number - Name"],
  "timeline": [
    {{"timestamp": "ISO datetime", "event": "description", "alert": "rule name or null", "significance": "why this matters"}}
  ],
  "remediation_steps": [
    "1. Step with timing indicator (IMMEDIATE/SHORT-TERM/LONG-TERM)",
    "2. Next step"
  ],
  "iocs": ["suspicious IPs/domains/hashes"],
  "analyzed_at": "ISO datetime of analysis"
}}
```

---

## Incident API Endpoints

### POST /api/incidents
Creates an incident from a list of alert IDs. Triggers Agent 2 asynchronously.

**Request:**
```json
{
  "title": "Port scan followed by SSH brute force from 192.168.1.100",
  "description": "Optional manual description",
  "alert_ids": ["a1b2c3d4-...", "b2c3d4e5-..."]
}
```

**Response (201):**
```json
{
  "id": "c3d4e5f6-...",
  "title": "Port scan followed by SSH brute force from 192.168.1.100",
  "severity": "critical",
  "status": "open",
  "created_at": "2024-01-15T10:35:00Z",
  "alert_ids": ["a1b2c3d4-...", "b2c3d4e5-..."],
  "ai_remediation": null,
  "timeline": null
}
```

Agent 2 runs in the background. `ai_remediation` and `timeline` are populated asynchronously,
then the updated incident can be fetched via GET /api/incidents/{id}.

**Severity derivation**: use the highest severity across all included alerts.

### GET /api/incidents
Returns list of incidents (paginated, ordered by created_at desc).

### GET /api/incidents/{id}
Returns full incident including ai_remediation and timeline (null until Agent 2 finishes).

### PATCH /api/incidents/{id}
Update status: "open" → "in_progress" → "resolved".

---

## Agent Evaluation Framework (Required for Grade)

You must write evaluation tests that measure agent output quality. These are NOT just unit tests
— they measure whether the AI produces useful output.

```python
# backend/tests/test_agent_evals.py

# Eval scenario definitions
EVAL_SCENARIOS = [
    {
        "name": "Port scan detection",
        "alert": {
            "rule_name": "Port Scan Detection",
            "severity": "high",
            "src_ip": "192.168.1.100",
            "dst_ip": "8.8.8.8",
            "protocol": "TCP",
            "related_count": 34,
        },
        "expected_mitre_tactic": "Reconnaissance",
        "expected_false_positive": False,
        "min_confidence": 0.6,
    },
    {
        "name": "DNS flood false positive (internal DNS server)",
        "alert": {
            "rule_name": "Unusual DNS Activity",
            "severity": "low",
            "src_ip": "192.168.1.1",   # typical DNS server IP
            "dst_ip": "8.8.8.8",
            "protocol": "UDP",
            "related_count": 210,
        },
        "expected_false_positive": True,   # DNS server behavior is normal
        "max_confidence": 0.5,
    }
]

def test_agent1_mitre_tactic_accuracy():
    """Agent 1 should identify Reconnaissance for port scan."""
    # Mock Ollama with a realistic response
    # Check that mitre_tactic == "Reconnaissance"

def test_agent1_output_is_valid_json():
    """Agent 1 must always return parseable JSON, even with bad input."""

def test_agent1_confidence_is_float_in_range():
    """Confidence must be 0.0-1.0 float."""

def test_agent1_required_fields_present():
    """All required JSON fields must be present in every response."""
    required = ["threat_assessment", "severity_justification", "mitre_tactic",
                "confidence", "is_false_positive_likely", "recommended_action"]

def test_agent2_remediation_steps_not_empty():
    """Agent 2 must produce at least 3 remediation steps."""

def test_agent2_timeline_is_chronological():
    """Events in the timeline must be in ascending timestamp order."""

def test_agent_graceful_ollama_failure():
    """If Ollama is unavailable, agents must not crash — store error message in ai_analysis."""
```

---

## Handling Ollama Failures Gracefully

Ollama may be slow, unavailable, or return malformed JSON. Always handle this:

```python
try:
    result = await ollama_client.generate_json(prompt)
except OllamaError:
    result = {
        "threat_assessment": "AI analysis unavailable — Ollama service unreachable.",
        "severity_justification": "Manual review required.",
        "mitre_tactic": "Unknown",
        "confidence": 0.0,
        "is_false_positive_likely": None,
        "recommended_action": "Manually investigate this alert.",
        "iocs": [],
        "analyzed_at": datetime.utcnow().isoformat() + "Z",
        "error": "Ollama unavailable"
    }
```

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the AI agent subsystem for a SIEM (Security Information and Event
Management) tool. The project uses Python, FastAPI, async SQLAlchemy, Redis (async), and Ollama
(local LLM API at http://ollama:11434).

The following SQLAlchemy models are already defined by a teammate:
- Alert: id, rule_id, rule_name, severity, timestamp, status, triggering_event_id,
  related_event_ids (JSON list), ai_analysis (JSON nullable), incident_id (UUID FK nullable)
- NetworkEvent: id, timestamp, src_ip, dst_ip, src_port, dst_port, protocol, bytes_sent,
  direction, interface, flags
- Incident: id, title, description, severity, status, created_at, updated_at,
  alert_ids (JSON list), ai_remediation (JSON nullable), timeline (JSON nullable)

Redis channels:
  Subscribe from: "alerts:new"
  Publish to:     "alerts:updated"

Your task is to implement:

1. backend/app/agents/ollama_client.py
   - async generate(prompt, model="llama3.2:3b") → str: calls POST /api/generate on Ollama
   - async generate_json(prompt, model) → dict: calls generate(), parses JSON, retries once
     on parse failure, returns error dict if both fail
   - async ensure_model_available(model) → None: calls GET /api/tags to check if model exists,
     if not calls POST /api/pull (this is blocking/slow — do it at startup)
   - Use temperature=0.3, num_predict=600

2. backend/app/agents/threat_analyst.py
   - async run_threat_analyst(): subscribes to Redis "alerts:new", for each alert:
     a. Fetch alert from DB
     b. Fetch triggering event and up to 10 related events from DB
     c. Fetch last 5 alerts for same src_ip from DB
     d. Build prompt using the EXACT template (I will provide it)
     e. Call ollama_client.generate_json()
     f. Add "analyzed_at" field to result
     g. Update Alert.ai_analysis in DB
     h. Publish updated alert to Redis "alerts:updated"
   - Handle Ollama errors gracefully: store error dict in ai_analysis, never crash

   Prompt template to use (fill {placeholders}):
   "You are a cybersecurity expert analyzing a network security alert.
   Analyze the following alert and provide your assessment in valid JSON.

   ALERT DETAILS:
   Rule: {rule_name} | Severity: {severity} | Time: {timestamp}

   TRIGGERING EVENT:
   {src_ip} → {dst_ip}:{dst_port} via {protocol} ({flags}), {bytes_sent} bytes, {direction}

   SAMPLE OF {related_count} RELATED EVENTS:
   {related_events_text}

   RECENT ALERTS FROM SAME SOURCE:
   {recent_alerts_text}

   Respond ONLY with this JSON:
   {{"threat_assessment": str, "severity_justification": str, "mitre_tactic": str,
     "mitre_technique": str, "confidence": float, "is_false_positive_likely": bool,
     "recommended_action": str, "iocs": [str]}}"

3. backend/app/agents/incident_response.py
   - async analyze_incident(incident_id: UUID, db: AsyncSession) → dict:
     a. Fetch incident with its alerts from DB
     b. Fetch all events referenced in all alert.related_event_ids
     c. Sort events by timestamp to build timeline
     d. Build prompt (template provided below)
     e. Call ollama_client.generate_json()
     f. Update Incident.ai_remediation and Incident.timeline in DB
     g. Return the full incident object

   Prompt template:
   "You are a senior incident responder. Analyze this incident and respond ONLY in JSON.

   INCIDENT: {title}
   ALERTS ({alert_count}): {alerts_summary}
   TIME SPAN: {start_time} to {end_time}
   SOURCE IPs: {unique_src_ips} | DESTINATION IPs: {unique_dst_ips}

   TIMELINE SAMPLE:
   {timeline_text}

   JSON format:
   {{"summary": str, "attack_pattern": str, "mitre_tactics": [str], "mitre_techniques": [str],
     "timeline": [{{"timestamp": str, "event": str, "significance": str}}],
     "remediation_steps": [str], "iocs": [str], "analyzed_at": str}}"

4. backend/app/api/incidents.py
   - POST /api/incidents: creates incident, derives severity from max alert severity,
     runs analyze_incident() as asyncio background task, returns 201 immediately
   - GET /api/incidents: paginated list ordered by created_at desc
   - GET /api/incidents/{id}: full incident including ai_remediation and timeline
   - PATCH /api/incidents/{id}: update status only

5. backend/tests/test_agents.py
   Unit tests with Ollama mocked (monkeypatch generate_json):
   - Agent 1 correctly builds prompt with event data
   - Agent 1 handles invalid JSON from LLM (tests fallback)
   - Agent 1 handles Ollama unavailable (tests error dict stored)
   - Agent 2 correctly orders timeline chronologically
   - All required fields present in output

6. backend/tests/test_agent_evals.py
   Evaluation tests (Ollama mocked with realistic responses):
   - Port scan → expects mitre_tactic "Reconnaissance"
   - ICMP flood → expects mitre_tactic "Impact" or "Reconnaissance"
   - SSH brute force → expects is_false_positive_likely: false, confidence > 0.7
   - confidence is always float between 0.0 and 1.0
   - remediation_steps has >= 3 items for any incident

Start run_threat_analyst() as a background task in app/main.py startup.
Call ensure_model_available() at startup before starting agents.
```
