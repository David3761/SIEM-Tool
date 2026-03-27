# Teammate 3 — Rule Engine & Alert Management

## Role Overview

You are the detection brain of the SIEM. You subscribe to the real-time stream of network events
from Redis, evaluate every event against a set of configurable rules, and fire alerts when
something suspicious is detected. You also own the full alert lifecycle: listing, filtering,
acknowledging, marking false positives, and exporting reports.

You are the component that turns raw network traffic into actionable security intelligence.

---

## User Stories Owned

| Story | Description |
|---|---|
| US-02 | Instant alerts when a threat is detected |
| US-03 | List of all alerts with severity and timestamp |
| US-08 | Mark an alert as a false positive |
| US-09 | Export alerts to CSV/PDF |
| US-10 | Set custom threshold rules (e.g. >500 req/min = alert) |

---

## Context — Why This Component Exists

### Why a rule engine?
Network events are just data. The rule engine is what gives them meaning. A rule says:
"if source IP X makes more than 20 connections to different ports within 60 seconds → that's a
port scan → fire a high-severity alert." Without rules, the SIEM is just a packet logger.

### Why subscribe to Redis instead of polling PostgreSQL?
The rule engine needs to react in real-time — ideally within milliseconds of a packet being
captured. Polling PostgreSQL every second would miss bursts and add unnecessary load.
Redis pub/sub delivers each event as it arrives.

### Why keep a sliding window in memory?
Threshold rules (e.g. "more than 10 failed SSH attempts in 30 seconds") require tracking
counts over time. You maintain an in-memory dictionary keyed by (rule_id, src_ip) with
timestamps of recent matching events. This is much faster than querying the DB on every packet.

### Why does the alert get published back to Redis after creation?
The AI agent (P4) subscribes to `alerts:new` and runs analysis asynchronously. You fire the
alert first (so it appears in the UI immediately), then P4 enriches it with AI analysis later.

---

## Architecture Position

```
Redis "traffic:events"
        │  (every network event, in real-time)
        ▼
[Rule Engine — your subscriber]
        │
        ├── checks each event against all enabled rules
        │
        ├── if rule match:
        │       ├── creates Alert row in PostgreSQL
        │       └── publishes to Redis "alerts:new"  → P4 AI Agent subscribes
        │
        └── [in-memory sliding window for threshold rules]

[Alert API — your HTTP endpoints]
        │
        ├── GET  /api/alerts        → P5 frontend (list/filter)
        ├── GET  /api/alerts/{id}   → P5 frontend (detail view)
        ├── PATCH /api/alerts/{id}  → P5 frontend (acknowledge, false positive, resolve)
        ├── GET  /api/alerts/export → P5 frontend (download CSV or PDF)
        ├── GET  /api/rules         → P5 frontend (list rules)
        ├── POST /api/rules         → P5 frontend (create custom rule, US-10)
        ├── PUT  /api/rules/{id}    → P5 frontend (update rule)
        └── DELETE /api/rules/{id} → P5 frontend (delete rule)
```

---

## What You Receive (Inputs)

1. **Redis messages** from channel `traffic:events` (produced by P2 capture service)
2. **HTTP requests** from the frontend (P5) for alert management and rule CRUD

**Example input event from Redis:**
```json
{
  "id": "3f2a1b4c-8d9e-4f5a-b6c7-d8e9f0a1b2c3",
  "timestamp": "2024-01-15T10:30:00.123456Z",
  "src_ip": "192.168.1.100",
  "dst_ip": "8.8.8.8",
  "src_port": 54321,
  "dst_port": 443,
  "protocol": "TCP",
  "bytes_sent": 1500,
  "direction": "outbound",
  "interface": "eth0",
  "flags": "SYN"
}
```

---

## What You Produce (Outputs)

### 1. Alert created in PostgreSQL

```json
{
  "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "rule_id": "port-scan-001",
  "rule_name": "Port Scan Detection",
  "severity": "high",
  "timestamp": "2024-01-15T10:30:05Z",
  "status": "open",
  "triggering_event_id": "3f2a1b4c-8d9e-4f5a-b6c7-d8e9f0a1b2c3",
  "related_event_ids": [
    "3f2a1b4c-...", "4a3b2c1d-...", "5b4c3d2e-..."
  ],
  "ai_analysis": null,
  "incident_id": null
}
```

### 2. Redis message on channel `alerts:new`

Same structure as above. P4 (AI agents) subscribes to this channel.

### 3. GET /api/alerts response

```json
{
  "items": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "rule_id": "port-scan-001",
      "rule_name": "Port Scan Detection",
      "severity": "high",
      "timestamp": "2024-01-15T10:30:05Z",
      "status": "open",
      "triggering_event": {
        "src_ip": "192.168.1.100",
        "dst_ip": "8.8.8.8",
        "protocol": "TCP",
        "dst_port": 443
      },
      "ai_analysis": null
    }
  ],
  "total": 42,
  "page": 1,
  "limit": 20,
  "pages": 3
}
```

### 4. Export CSV example

```
id,rule_name,severity,timestamp,status,src_ip,dst_ip,protocol,dst_port
a1b2c3d4,Port Scan Detection,high,2024-01-15T10:30:05Z,open,192.168.1.100,8.8.8.8,TCP,443
b2c3d4e5,SSH Brute Force,critical,2024-01-15T10:31:00Z,acknowledged,10.0.0.5,192.168.1.10,TCP,22
```

---

## Rule System — Full Specification

### Rule YAML File (default rules, loaded at startup)

Location: `backend/app/rules/default_rules.yaml`

```yaml
rules:
  - id: "port-scan-001"
    name: "Port Scan Detection"
    description: "Detects rapid connection attempts to multiple ports from a single source IP"
    type: "threshold"
    severity: "high"
    enabled: true
    config:
      metric: "unique_dst_ports"      # count distinct destination ports from src_ip
      window_seconds: 60
      threshold: 20                   # more than 20 unique dst ports in 60s = alert

  - id: "ssh-bruteforce-001"
    name: "SSH Brute Force"
    description: "Multiple TCP SYN to port 22 from same source"
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
    description: "Single IP sending unusually high traffic"
    type: "threshold"
    severity: "medium"
    enabled: true
    config:
      metric: "event_count"
      window_seconds: 60
      threshold: 500                  # US-10: configurable by user

  - id: "icmp-flood-001"
    name: "ICMP Flood"
    description: "Excessive ICMP packets (potential ping flood)"
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
    description: "High volume of DNS queries from single host"
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

### Rule Types

**threshold**: Count events matching optional filters within a sliding time window.
When count exceeds `threshold`, fire an alert with all matching event IDs as `related_event_ids`.

Supported metrics:
- `event_count`: count total matching events
- `unique_dst_ports`: count distinct destination ports (for port scan detection)
- `unique_dst_ips`: count distinct destination IPs

Optional filters (all are AND conditions):
- `filter_dst_port`: only count events to this port
- `filter_src_port`: only count events from this port
- `filter_protocol`: "TCP", "UDP", "ICMP"
- `filter_flags`: TCP flag string match

### Sliding Window Implementation

```python
# In-memory structure:
windows = {}
# Key: (rule_id, src_ip)   Value: deque of (timestamp, event_id, relevant_value)

def check_rule(rule: dict, event: dict) -> bool:
    key = (rule["id"], event["src_ip"])
    now = datetime.utcnow()
    window_seconds = rule["config"]["window_seconds"]
    threshold = rule["config"]["threshold"]

    # Remove entries older than the window
    if key not in windows:
        windows[key] = deque()
    while windows[key] and (now - windows[key][0][0]).seconds > window_seconds:
        windows[key].popleft()

    # Add current event
    windows[key].append((now, event["id"], get_metric_value(rule, event)))

    # Check if threshold exceeded
    if rule["config"]["metric"] == "unique_dst_ports":
        unique_values = len(set(entry[2] for entry in windows[key]))
        return unique_values >= threshold
    else:
        return len(windows[key]) >= threshold
```

---

## API Endpoints — Full Specification

### GET /api/alerts

| Parameter | Type | Example | Description |
|---|---|---|---|
| `status` | string | `open` | "open", "acknowledged", "false_positive", "resolved" |
| `severity` | string | `high` | "low", "medium", "high", "critical" |
| `rule_id` | string | `port-scan-001` | Filter by specific rule |
| `from` | ISO datetime | `2024-01-15T00:00:00Z` | Start of time range |
| `to` | ISO datetime | `2024-01-15T23:59:59Z` | End of time range |
| `page` | int | `1` | Page number |
| `limit` | int | `20` | Items per page (max 100) |

### PATCH /api/alerts/{id}

Updates alert status.

**Request body:**
```json
{ "status": "false_positive" }
```
Valid statuses: `"acknowledged"`, `"false_positive"`, `"resolved"`

**Response (200):** Full alert object with updated status.
**Response (404):** Alert not found.
**Response (422):** Invalid status value.

### GET /api/alerts/export

| Parameter | Type | Default | Description |
|---|---|---|---|
| `format` | string | `csv` | "csv" or "pdf" |
| `status` | string | optional | Filter by status |
| `severity` | string | optional | Filter by severity |
| `from` | ISO datetime | optional | Start of time range |
| `to` | ISO datetime | optional | End of time range |

**CSV response:** Content-Type: `text/csv`, Content-Disposition: `attachment; filename=alerts_export_20240115.csv`

**PDF response:** Use `reportlab` library. Include: title with date range, summary table (total alerts, by severity, by status), detailed table with columns (timestamp, rule, severity, status, src_ip, dst_ip).

### GET /api/rules
Returns all rules (from DB, including user-created ones).

### POST /api/rules (US-10)

**Request body:**
```json
{
  "name": "Very High Traffic",
  "description": "Alert when a single IP sends more than 500 requests per minute",
  "rule_type": "threshold",
  "severity": "high",
  "config": {
    "metric": "event_count",
    "window_seconds": 60,
    "threshold": 500
  }
}
```

**Response (201):** Full rule object with generated `id` and `created_at`.

### PUT /api/rules/{id}
Full update of a rule. Same body as POST. Returns updated rule.

### DELETE /api/rules/{id}
Returns 204. Soft-delete preferred (set `enabled=false`) so historical alerts still reference valid rules.

---

## File Structure You Own

```
backend/
└── app/
    ├── rules/
    │   ├── __init__.py
    │   ├── engine.py            ← subscribes to Redis, evaluates rules, creates alerts
    │   ├── default_rules.yaml   ← built-in detection rules
    │   └── loader.py            ← loads YAML rules into DB at startup
    ├── services/
    │   └── exporter.py          ← CSV and PDF export logic
    └── api/
        ├── alerts.py            ← all alert endpoints
        └── rules.py             ← all rule CRUD endpoints
```

---

## Startup Behavior

At application startup, `loader.py` should:
1. Read `default_rules.yaml`
2. For each rule in the YAML, check if it already exists in the DB (by `rule_id`)
3. If not → insert it
4. If yes → skip (don't overwrite user modifications)

This means default rules are seeded once and users can then modify them via the API.

---

## Testing Requirements

Write tests in `backend/tests/test_rules_alerts.py`:

1. Test port scan rule fires correctly when 20+ unique ports in 60s
2. Test SSH brute force rule fires at threshold 10
3. Test rule does NOT fire below threshold
4. Test sliding window correctly expires old events
5. Test GET /api/alerts returns paginated results
6. Test GET /api/alerts with `severity=critical` filter
7. Test PATCH /api/alerts/{id} updates status to "false_positive"
8. Test PATCH /api/alerts/{id} with invalid status returns 422
9. Test GET /api/alerts/export?format=csv returns valid CSV with correct headers
10. Test POST /api/rules creates a new rule and it appears in GET /api/rules

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the rule engine and alert management system for a SIEM tool.
The project uses Python, FastAPI, SQLAlchemy (async), Redis (async), PostgreSQL, and reportlab.

The following SQLAlchemy models are already defined by a teammate:

Alert model fields:
  id (UUID PK), rule_id (String), rule_name (String), severity (String),
  timestamp (DateTime), status (String: "open"/"acknowledged"/"false_positive"/"resolved"),
  triggering_event_id (UUID FK → network_events), related_event_ids (JSON list of UUID strings),
  ai_analysis (JSON nullable), incident_id (UUID FK nullable)

NetworkEvent model fields:
  id (UUID PK), timestamp, src_ip, dst_ip, src_port, dst_port, protocol, bytes_sent,
  direction, interface, flags

Rule model fields:
  id (UUID PK), name, description, rule_type, severity, config (JSON), enabled (bool), created_at

Redis client (already implemented) has:
  publish(channel: str, message: dict) → publishes JSON to channel
  subscribe(channel: str) → async generator yielding dicts
  Channels: subscribe from "traffic:events", publish to "alerts:new"

Your task is to implement:

1. backend/app/rules/default_rules.yaml
   Define 5 detection rules with these IDs:
   "port-scan-001" (unique_dst_ports >= 20 in 60s, severity: high)
   "ssh-bruteforce-001" (event_count for TCP SYN to port 22 >= 10 in 30s, severity: critical)
   "high-traffic-001" (event_count >= 500 in 60s, severity: medium)
   "icmp-flood-001" (event_count for ICMP >= 100 in 10s, severity: medium)
   "dns-unusual-001" (event_count for UDP port 53 >= 200 in 60s, severity: low)

2. backend/app/rules/loader.py
   load_default_rules(db: AsyncSession) → reads YAML, inserts rules not already in DB

3. backend/app/rules/engine.py
   - Async function run_rule_engine() that:
     a. Subscribes to Redis "traffic:events"
     b. For each event received, evaluates ALL enabled rules from the DB
     c. Uses a deque-based in-memory sliding window keyed by (rule_id, src_ip)
     d. Supports metrics: "event_count" and "unique_dst_ports"
     e. Supports optional filters: filter_dst_port, filter_protocol, filter_flags
     f. When threshold exceeded: creates Alert in DB with all related_event_ids,
        publishes the alert to Redis "alerts:new"
     g. Prevents duplicate alerts: don't fire the same rule for the same src_ip within 60s
        of the last alert for that combination

4. backend/app/api/alerts.py
   - GET /api/alerts (paginated, filterable by status, severity, rule_id, from, to)
     Response: {"items": [...], "total": int, "page": int, "limit": int, "pages": int}
     Include triggering_event data nested in each alert (join with network_events)
   - GET /api/alerts/{id} → single alert with full triggering_event nested, 404 if not found
   - PATCH /api/alerts/{id} → update status only, validate status enum, 422 on invalid
   - GET /api/alerts/export?format=csv|pdf&status=&severity=&from=&to=
     CSV: headers = id,rule_name,severity,timestamp,status,src_ip,dst_ip,protocol,dst_port
     PDF: use reportlab to build a table with title "SIEM Alert Export — {date_range}"

5. backend/app/api/rules.py
   - GET /api/rules → list all rules (enabled and disabled)
   - POST /api/rules → create rule, validate rule_type is "threshold"
   - PUT /api/rules/{id} → full update
   - DELETE /api/rules/{id} → soft delete (set enabled=False), 404 if not found

6. backend/app/services/exporter.py
   - export_to_csv(alerts: list[Alert]) → returns str (CSV content)
   - export_to_pdf(alerts: list[Alert], date_range: str) → returns bytes (PDF content)
     Use reportlab.platypus with a SimpleDocTemplate and a Table.

7. backend/tests/test_rules_alerts.py
   Tests: sliding window threshold behavior (fires at threshold, not before),
   rule filters (only counts matching protocol/port), duplicate alert prevention,
   GET /api/alerts pagination, PATCH status update, CSV export format.

Call run_rule_engine() as a background task in app/main.py startup event.
Register alerts and rules routers with prefix="/api".
```
