# Teammate 3 — Rule Engine & Alert Management (Python)

## Role Overview

You run as a standalone Python service in `services/rules/`. You subscribe to the Redis
`traffic:events` channel, evaluate every event against detection rules, and INSERT alerts
into the shared PostgreSQL database when a rule threshold is exceeded. You also publish new
alerts to Redis so the WebSocket broadcaster delivers them to the browser instantly.

The REST API for alerts and rules is implemented by Teammate 1 (Symfony). You only write
to the database and publish to Redis — you do not expose any HTTP endpoints.

---

## User Stories Owned

| Story | Your role | API (Teammate 1) |
|---|---|---|
| US-02 | Detect threat, INSERT Alert, publish to Redis | WebSocket broadcast |
| US-03 | Write alert data to PostgreSQL | `GET /api/alerts` |
| US-08 | Write alert data (status field updated by Symfony) | `PATCH /api/alerts/{id}` |
| US-09 | Write alert data | `GET /api/alerts/export` |
| US-10 | YAML rule definitions, custom threshold support | `POST /api/rules` |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Python 3.11 | Language |
| redis-py | Subscribe to `traffic:events`, publish to `alerts:new` |
| psycopg2 | INSERT alerts into PostgreSQL |
| PyYAML | Load default rule definitions |
| pytest | Tests |

---

## Context

### Why Python for the rule engine?
The rule engine runs a continuous event loop subscribing to Redis. Python's async capabilities
and the scapy ecosystem make it the natural fit. Symfony handles the HTTP layer; Python handles
the real-time stream processing.

### Why does the rule engine write directly to PostgreSQL?
The rule engine creates alerts at high frequency (potentially many per second under attack).
Going through the Symfony API would add latency and create a bottleneck. Direct psycopg2
inserts are faster and simpler.

### Why publish to Redis after inserting to PostgreSQL?
Teammate 1's Ratchet WebSocket server subscribes to `alerts:new`. When you publish, Ratchet
immediately pushes the alert to all connected browsers — this is what makes US-02 (instant
alerts) work. If you only wrote to PostgreSQL, the browser would need to poll.

### What are default rules?
You ship 5 built-in detection rules as a YAML file. At startup, you INSERT any rules that
don't already exist in the `rules` PostgreSQL table. This seeds the database so Teammate 1's
`GET /api/rules` returns something useful on first run.

---

## Architecture Position

```
Redis "traffic:events"  ← published by Teammate 2 capture service
        │
        ▼
[services/rules/]  ← subscribes, evaluates rules, sliding window in memory
        │
        ├── INSERT Alert into PostgreSQL
        └── PUBLISH to Redis "alerts:new"
                  │
                  ├── Teammate 1 Ratchet WS server → browser (instant alert)
                  └── Teammate 4 AI agent → enriches alert with analysis
```

---

## File Structure

```
services/rules/
├── engine.py           ← main loop: subscribe, evaluate, insert, publish
├── loader.py           ← seeds default rules into PostgreSQL at startup
├── default_rules.yaml  ← 5 built-in detection rules
├── tests/
│   └── test_rules.py
├── requirements.txt
└── Dockerfile
```

---

## Default Rules — YAML Specification

```yaml
# services/rules/default_rules.yaml
rules:
  - id: "port-scan-001"
    name: "Port Scan Detection"
    description: "Detects rapid connections to many different ports from a single IP"
    type: "threshold"
    severity: "high"
    enabled: true
    config:
      metric: "unique_dst_ports"
      window_seconds: 60
      threshold: 20

  - id: "ssh-bruteforce-001"
    name: "SSH Brute Force"
    description: "Multiple TCP SYN packets to port 22 from the same source"
    type: "threshold"
    severity: "critical"
    enabled: true
    config:
      metric: "event_count"
      filter_dst_port: 22
      filter_protocol: "TCP"
      filter_flags: "SYN"
      window_seconds: 30
      threshold: 10

  - id: "high-traffic-001"
    name: "High Traffic Volume"
    description: "Single IP sending unusually high number of packets"
    type: "threshold"
    severity: "medium"
    enabled: true
    config:
      metric: "event_count"
      window_seconds: 60
      threshold: 500

  - id: "icmp-flood-001"
    name: "ICMP Flood"
    description: "Excessive ICMP packets from a single source"
    type: "threshold"
    severity: "medium"
    enabled: true
    config:
      metric: "event_count"
      filter_protocol: "ICMP"
      window_seconds: 10
      threshold: 100

  - id: "dns-unusual-001"
    name: "Unusual DNS Activity"
    description: "High volume of DNS queries from a single host"
    type: "threshold"
    severity: "low"
    enabled: true
    config:
      metric: "event_count"
      filter_dst_port: 53
      filter_protocol: "UDP"
      window_seconds: 60
      threshold: 200
```

---

## Sliding Window Implementation

```python
from collections import deque
from datetime import datetime

# In-memory state — keyed by (rule_id, src_ip)
windows = {}   # (rule_id, src_ip) -> deque of (timestamp, event_id, metric_value)
last_alert = {}  # (rule_id, src_ip) -> datetime of last alert fired

def evaluate_rule(rule: dict, event: dict) -> tuple[bool, list[str]]:
    """
    Returns (should_alert, list_of_related_event_ids).
    """
    key = (rule["id"], event["src_ip"])
    now = datetime.utcnow()
    window_secs = rule["config"]["window_seconds"]

    # Skip if we already alerted for this rule+src_ip in the last 60 seconds
    if key in last_alert and (now - last_alert[key]).seconds < 60:
        return False, []

    if key not in windows:
        windows[key] = deque()

    # Expire old entries
    while windows[key] and (now - windows[key][0][0]).total_seconds() > window_secs:
        windows[key].popleft()

    # Check optional filters
    cfg = rule["config"]
    if "filter_dst_port" in cfg and event.get("dst_port") != cfg["filter_dst_port"]:
        return False, []
    if "filter_protocol" in cfg and event.get("protocol") != cfg["filter_protocol"]:
        return False, []
    if "filter_flags" in cfg and event.get("flags") != cfg["filter_flags"]:
        return False, []

    # Add current event
    metric_value = event.get("dst_port") if cfg["metric"] == "unique_dst_ports" else 1
    windows[key].append((now, event["id"], metric_value))

    # Evaluate threshold
    if cfg["metric"] == "unique_dst_ports":
        count = len(set(entry[2] for entry in windows[key]))
    else:
        count = len(windows[key])

    if count >= cfg["threshold"]:
        last_alert[key] = now
        related_ids = [entry[1] for entry in windows[key]]
        return True, related_ids

    return False, []
```

---

## Alert INSERT — PostgreSQL Schema

```python
# psycopg2 insert when rule fires
INSERT INTO alerts
  (id, rule_id, rule_name, severity, timestamp, status,
   triggering_event_id, related_event_ids, ai_analysis, incident_id)
VALUES
  (%s, %s, %s, %s, NOW(), 'open', %s, %s::jsonb, NULL, NULL)
```

---

## Alert Published to Redis — `alerts:new`

Same structure as what's in PostgreSQL, serialized as JSON:

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "rule_id": "port-scan-001",
  "rule_name": "Port Scan Detection",
  "severity": "high",
  "timestamp": "2024-01-15T10:30:05Z",
  "status": "open",
  "triggering_event_id": "3f2a1b4c-...",
  "related_event_ids": ["3f2a1b4c-...", "4a3b2c1d-..."],
  "ai_analysis": null,
  "incident_id": null
}
```

---

## Rule Loading at Startup

```python
# loader.py — called once at startup
# For each rule in default_rules.yaml:
#   SELECT id FROM rules WHERE id = %s
#   If not found: INSERT INTO rules (...) VALUES (...)
# This ensures default rules are seeded once and user edits via the UI are preserved.
```

---

## Testing Requirements

Write tests in `services/rules/tests/test_rules.py`:

1. Port scan rule fires correctly at 20 unique ports
2. Port scan rule does NOT fire at 19 unique ports
3. SSH brute force rule fires at 10 SYN packets to port 22
4. SSH brute force rule does NOT fire for non-SYN packets
5. Rule does NOT fire again within 60 seconds of last alert (duplicate prevention)
6. Sliding window correctly expires events older than `window_seconds`
7. `filter_dst_port` correctly filters out non-matching events
8. `filter_protocol` correctly filters out non-matching protocols
9. Loader inserts default rules only when they don't exist

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the rule engine service for a SIEM tool.
This is a standalone Python service in services/rules/.
It uses: redis-py (async) for pub/sub, psycopg2 for PostgreSQL writes, PyYAML for rules.

The PostgreSQL tables already exist (created by a Symfony migration):
  alerts: id uuid, rule_id varchar, rule_name varchar, severity varchar, timestamp timestamptz,
          status varchar default 'open', triggering_event_id uuid nullable,
          related_event_ids jsonb, ai_analysis jsonb nullable, incident_id uuid nullable
  rules:  id uuid, name varchar, description text, rule_type varchar, severity varchar,
          config jsonb, enabled bool, created_at timestamptz

Redis channels:
  Subscribe from: "traffic:events"
  Publish to:     "alerts:new"

Implement:

1. services/rules/default_rules.yaml
   Five rules: port-scan-001 (unique_dst_ports >= 20 in 60s, high),
   ssh-bruteforce-001 (event_count TCP SYN port 22 >= 10 in 30s, critical),
   high-traffic-001 (event_count >= 500 in 60s, medium),
   icmp-flood-001 (event_count ICMP >= 100 in 10s, medium),
   dns-unusual-001 (event_count UDP port 53 >= 200 in 60s, low)

2. services/rules/loader.py
   load_default_rules(conn): reads YAML, inserts each rule only if id not already in rules table.
   Generates UUID for id, sets created_at=NOW(), enabled=true.

3. services/rules/engine.py
   - Reads env vars: DATABASE_URL, REDIS_URL
   - At startup: call load_default_rules(), then load all enabled rules from DB into memory
   - Subscribe to Redis "traffic:events" using redis-py async
   - For each event received:
     a. Parse JSON
     b. For each enabled rule: call evaluate_rule(rule, event)
     c. If returns (True, related_ids): INSERT alert into PostgreSQL, PUBLISH to "alerts:new"
   - Sliding window: in-memory dict keyed by (rule_id, src_ip)
     using deque of (timestamp, event_id, metric_value)
   - Supports metrics: "event_count" and "unique_dst_ports"
   - Supports filters: filter_dst_port, filter_protocol, filter_flags (all optional, AND logic)
   - Duplicate prevention: do not fire same rule for same src_ip within 60s of last alert
   - Reload rules from DB every 5 minutes (to pick up rules created via the API)

4. services/rules/requirements.txt: redis, psycopg2-binary, pyyaml, pytest, pytest-asyncio

5. services/rules/Dockerfile: FROM python:3.11-slim, install requirements, run engine.py

6. services/rules/tests/test_rules.py
   Unit tests using pytest (mock Redis and psycopg2):
   - Port scan fires at threshold, not below
   - SSH brute force fires correctly with filters
   - Duplicate prevention blocks second alert within 60s
   - Sliding window expires old entries
   - filter_dst_port excludes non-matching events
   - loader inserts rules not in DB, skips existing ones
```
