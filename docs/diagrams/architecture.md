# System Architecture Diagram

## Component Architecture

```mermaid
flowchart TB
    Browser(["Browser\nlocalhost:3000"])

    subgraph HOST["Host Machine"]
        NIF["Network Interfaces\neth0 / wlan0"]

        subgraph DOCKER["Docker Network - bridge"]
            FE["Frontend\nReact + Nginx :80"]
            BE["Backend\nFastAPI :8000"]
            PG[("PostgreSQL\n:5432")]
            RD[("Redis\npub/sub :6379")]
            OL["Ollama\nLLM server :11434"]
        end

        subgraph HOST_NET["Host Network - network_mode: host"]
            CAP["Capture Service\nscapy NET_RAW + NET_ADMIN"]
        end
    end

    Browser -->|"HTTP :3000"| FE
    Browser -->|"WebSocket :8000/ws"| BE
    FE -->|"REST API /api/*"| BE

    BE -->|"SQL queries"| PG
    BE -->|"subscribe pub/sub"| RD
    BE -->|"HTTP /api/generate"| OL

    CAP -->|"PUBLISH traffic:events"| RD
    CAP -->|"bulk INSERT every 5s"| PG
    CAP -->|"GET /api/config every 60s"| BE
    NIF -->|"raw packets"| CAP
```

---

## Data Flow Summary

| Flow | From | To | Transport | Frequency |
|---|---|---|---|---|
| Raw packets | Network interface | Capture service | OS kernel | Every packet |
| Normalized events | Capture service | Redis `traffic:events` | Redis pub/sub | Every packet |
| Bulk event storage | Capture service | PostgreSQL | SQL INSERT | Every 5 seconds |
| Config polling | Capture service | Backend API | HTTP GET | Every 60 seconds |
| Real-time events | Redis | WebSocket clients | WebSocket | Every packet |
| New alerts | Rule Engine | Redis `alerts:new` | Redis pub/sub | On rule match |
| Alert enrichment | AI Agent 1 | Redis `alerts:updated` | Redis pub/sub | ~3-10s after alert |
| UI updates | Backend WebSocket | Browser | WebSocket | Real-time |
| API queries | Browser | Backend | HTTP REST | On user interaction |
| LLM inference | AI Agents | Ollama | HTTP POST | On alert/incident |

---

## Port Exposure Map

| Service | Internal Port | Exposed to Host | Purpose |
|---|---|---|---|
| Frontend (Nginx) | 80 | 3000 | Serve React app to browser |
| Backend (FastAPI) | 8000 | 8000 | REST API + WebSocket |
| PostgreSQL | 5432 | 5432 | Direct DB access (dev only) |
| Redis | 6379 | 6379 | Debug access (dev only) |
| Ollama | 11434 | 11434 | LLM API (dev only) |
| Capture | host | host | Must see real network interfaces |
