# Sequence Diagram — Packet Capture to Alert to AI Analysis

This diagram shows the full real-time flow from a raw network packet arriving on the network
interface all the way to the browser displaying an AI-enriched alert.

```mermaid
sequenceDiagram
    actor NI as Network Interface
    participant CAP as Capture Service
    participant RD as Redis
    participant RE as Rule Engine
    participant DB as PostgreSQL
    participant AI as Threat Analyst Agent
    participant OL as Ollama LLM
    participant WS as WebSocket Handler
    participant BR as Browser

    NI->>CAP: raw packet on eth0
    Note over CAP: parse src_ip, dst_ip, port, protocol, bytes, flags

    CAP->>RD: PUBLISH traffic:events
    Note over CAP,DB: buffered, bulk INSERT every 5 seconds
    CAP-->>DB: INSERT INTO network_events

    RD-->>RE: traffic:events message
    Note over RE: evaluate all enabled rules using sliding window

    alt Rule threshold NOT exceeded
        RE->>RE: update sliding window only
    else Rule threshold exceeded
        RE->>DB: INSERT Alert status=open ai_analysis=null
        RE->>RD: PUBLISH alerts:new

        RD-->>WS: alerts:new message
        WS->>BR: WebSocket new_alert event
        BR->>BR: show toast and prepend row to alerts table

        Note over AI: runs in background, does not block API
        RD-->>AI: alerts:new message
        AI->>DB: SELECT Alert and related NetworkEvents
        AI->>AI: build security analysis prompt

        AI->>OL: POST /api/generate model=llama3.2:3b
        Note over OL: local LLM inference 3-15 seconds
        OL-->>AI: response JSON

        AI->>AI: parse JSON response
        AI->>DB: UPDATE Alert SET ai_analysis
        AI->>RD: PUBLISH alerts:updated

        RD-->>WS: alerts:updated message
        WS->>BR: WebSocket alert_updated event
        BR->>BR: render AI panel with threat assessment and MITRE tactic
    end
```

---

# Sequence Diagram — User Views Historical Events (US-05)

```mermaid
sequenceDiagram
    actor User
    participant BR as Browser
    participant BE as Backend API
    participant DB as PostgreSQL

    User->>BR: opens Events page
    BR->>BE: GET /api/events?page=1&limit=50
    BE->>DB: SELECT FROM network_events ORDER BY timestamp DESC LIMIT 50
    DB-->>BE: rows
    BE-->>BR: items array with total=15420 and pages=309
    BR->>BR: render events table

    User->>BR: types 192.168.1.100 in src_ip filter
    Note over BR: debounce 400ms
    BR->>BE: GET /api/events?src_ip=192.168.1.100&page=1
    BE->>DB: SELECT WHERE src_ip=192.168.1.100
    DB-->>BE: filtered rows
    BE-->>BR: items array with total=342
    BR->>BR: update table with filtered results
```
