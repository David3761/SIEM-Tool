# Alert Lifecycle — State Machine Diagram

```mermaid
stateDiagram-v2
    direction LR

    [*] --> open : Rule threshold exceeded

    open --> acknowledged : Analyst acknowledges
    open --> false_positive : Analyst marks as FP
    open --> resolved : Directly resolved
    open --> in_incident : Grouped into incident

    acknowledged --> false_positive : Marked as FP after review
    acknowledged --> resolved : Threat contained
    acknowledged --> in_incident : Grouped into incident

    in_incident --> resolved : Parent incident resolved

    false_positive --> [*]
    resolved --> [*]
```

**Transitions via API:**
| Transition | Endpoint |
|---|---|
| Any status | `PATCH /api/alerts/{id}` with `{ "status": "..." }` |
| Group into incident | `POST /api/incidents` with `alert_ids` list |

**Notes:**
- Alert is created with `status = open` and `ai_analysis = null`
- AI Agent 1 fills `ai_analysis` asynchronously within seconds of creation
- An alert grouped into an incident gets `incident_id` set and AI Agent 2 analyzes the whole incident

---

# Incident Lifecycle — State Machine Diagram

```mermaid
stateDiagram-v2
    direction LR

    [*] --> open : Analyst creates incident from alerts

    open --> in_progress : Investigation started
    in_progress --> resolved : Threat contained
    open --> resolved : Quick resolution

    resolved --> [*]
```

**Notes:**
- Incident is created via `POST /api/incidents` with a list of `alert_ids`
- AI Agent 2 runs immediately after creation as a background task
- `ai_remediation` and `timeline` fields start as null and are filled by Agent 2

---

# Rule Evaluation Flow

```mermaid
flowchart TD
    E[New NetworkEvent from Redis]
    E --> L[Load all enabled rules from DB]
    L --> FR[For each Rule]

    FR --> F{Event matches rule filters}
    F -- No --> NEXT[Skip this rule]
    F -- Yes --> W[Add to sliding window keyed by rule and src_ip]

    W --> EX[Expire entries older than window_seconds]
    EX --> M{Which metric}

    M -- event_count --> C1[Count all entries in window]
    M -- unique_dst_ports --> C2[Count distinct dst_ports in window]

    C1 --> T{Count exceeds threshold}
    C2 --> T

    T -- No --> NEXT
    T -- Yes --> D{Already alerted for same rule and src_ip in last 60s}

    D -- Yes --> NEXT
    D -- No --> A[INSERT Alert in PostgreSQL]
    A --> P[PUBLISH to Redis alerts:new]
    P --> NEXT
    NEXT --> FR
```
