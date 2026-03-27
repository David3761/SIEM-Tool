# Teammate 1 — Backend Core & Infrastructure

## Role Overview

You are the foundation of the entire project. Every other teammate depends on what you build.
Your job is to: scaffold the FastAPI backend, define all database models, set up Docker Compose
for all 6 services, wire up the Redis client, build the CI/CD pipeline, and implement the
monitoring configuration API (US-06).

Nothing works without you finishing first. Coordinate with teammates early so they can start
plugging into your scaffold.

---

## User Stories Owned

| Story | Description |
|---|---|
| US-06 | As a network admin, I want to configure which IPs/subnets to monitor |

All other stories depend on your database models and project skeleton.

---

## Context — Why Each Piece Exists

### FastAPI
The backend API server. All other backend teammates (P2, P3, P4) add their own routers to this
app. The frontend (P5) calls this API. You define the app entrypoint and the shared core modules.

### PostgreSQL
The permanent store for everything: captured events, alerts, incidents, rules, and config.
All teammates read/write PostgreSQL through SQLAlchemy models you define. If you define a field
wrong, everyone breaks.

### Redis
A fast in-memory message bus. It is NOT used for permanent storage — only for real-time
communication between services:
- Capture service (P2) publishes raw events to Redis
- Rule engine (P3) subscribes to events, publishes alerts to Redis
- AI agents (P4) subscribe to alerts
- WebSocket handler (you) subscribes to everything and forwards to the browser (P5)

Redis enables millisecond-latency live updates without polling the database.

### Docker Compose
Defines all 6 containers and makes them talk to each other. You write the single
`docker-compose.yml` that the entire team uses to run the project locally.

### GitHub Actions CI/CD
Automated pipeline that runs on every pull request (lint + test) and on every merge to `main`
(build Docker images). Required for the project grade.

---

## Architecture Position

```
You own everything in this diagram:

  [docker-compose.yml]
       │
       ├── [postgres container]  ←── your SQLAlchemy models define the schema
       ├── [redis container]     ←── your redis_client.py is used by all teammates
       ├── [ollama container]    ←── configured by you, used by P4
       ├── [frontend container]  ←── Dockerfile written by P5, orchestrated by you
       ├── [capture container]   ←── Dockerfile written by P2, orchestrated by you
       └── [backend container]   ←── your FastAPI app, P2/P3/P4 add routers to it

  [GitHub Actions]
       ├── ci.yml  → runs on PR: lint, pytest
       └── cd.yml  → runs on merge to main: docker build
```

---

## What You Receive (Inputs)

- HTTP PUT requests from the frontend (P5) to update monitoring config
- HTTP GET requests from the frontend (P5) to read monitoring config
- The capture service (P2) reads the monitoring config from your API at startup

---

## What You Produce (Outputs)

1. **The FastAPI app skeleton** — P2, P3, P4 import and register their routers into `app/main.py`
2. **SQLAlchemy models** — used by all backend teammates to read/write the DB
3. **Redis client** — used by all backend teammates to publish/subscribe
4. **Docker Compose** — used by the whole team to run locally
5. **CI/CD pipeline** — runs automatically on GitHub
6. **Config API** — consumed by P2 (capture) and P5 (frontend settings page)

---

## File Structure You Own

```
siem-tool/
├── docker-compose.yml
├── Makefile
├── .github/
│   └── workflows/
│       ├── ci.yml
│       └── cd.yml
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── alembic.ini
    ├── alembic/
    │   └── versions/
    └── app/
        ├── main.py              ← FastAPI app, mounts all routers
        ├── core/
        │   ├── config.py        ← env var settings (DB URL, Redis URL, etc.)
        │   ├── database.py      ← SQLAlchemy engine + session
        │   └── redis_client.py  ← Redis connection + pub/sub helpers
        ├── models/
        │   ├── __init__.py
        │   ├── event.py         ← NetworkEvent model
        │   ├── alert.py         ← Alert model
        │   ├── incident.py      ← Incident model
        │   ├── rule.py          ← Rule model
        │   └── monitoring_config.py  ← MonitoringConfig model
        ├── api/
        │   ├── __init__.py
        │   ├── config.py        ← US-06: GET/PUT /api/config
        │   └── ws.py            ← WebSocket endpoint /ws
        └── schemas/
            ├── event.py         ← Pydantic schemas for NetworkEvent
            ├── alert.py         ← Pydantic schemas for Alert
            ├── incident.py      ← Pydantic schemas for Incident
            └── config.py        ← Pydantic schemas for MonitoringConfig
```

---

## Database Models — Full Specification

Define all of these in SQLAlchemy. Use UUIDs as primary keys (except MonitoringConfig).

### NetworkEvent (`network_events` table)

```python
class NetworkEvent(Base):
    __tablename__ = "network_events"

    id           = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    timestamp    = Column(DateTime(timezone=True), nullable=False, index=True)
    src_ip       = Column(String(45), nullable=False, index=True)   # supports IPv6
    dst_ip       = Column(String(45), nullable=False, index=True)
    src_port     = Column(Integer, nullable=True)
    dst_port     = Column(Integer, nullable=True, index=True)
    protocol     = Column(String(10), nullable=False)  # "TCP", "UDP", "ICMP"
    bytes_sent   = Column(Integer, nullable=False, default=0)
    direction    = Column(String(10), nullable=False)  # "inbound", "outbound", "internal"
    interface    = Column(String(20), nullable=False)  # "eth0", "wlan0"
    flags        = Column(String(20), nullable=True)   # TCP flags: "SYN", "SYN-ACK", etc.
```

### Alert (`alerts` table)

```python
class Alert(Base):
    __tablename__ = "alerts"

    id                = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    rule_id           = Column(String(100), nullable=False, index=True)
    rule_name         = Column(String(200), nullable=False)
    severity          = Column(String(20), nullable=False)  # "low","medium","high","critical"
    timestamp         = Column(DateTime(timezone=True), nullable=False, index=True)
    status            = Column(String(30), nullable=False, default="open")
                        # "open", "acknowledged", "false_positive", "resolved"
    triggering_event_id = Column(UUID(as_uuid=True), ForeignKey("network_events.id"))
    related_event_ids = Column(JSON, nullable=False, default=list)  # list of UUID strings
    ai_analysis       = Column(JSON, nullable=True)  # filled by AI Agent 1 (P4)
    incident_id       = Column(UUID(as_uuid=True), ForeignKey("incidents.id"), nullable=True)
```

### Incident (`incidents` table)

```python
class Incident(Base):
    __tablename__ = "incidents"

    id             = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    title          = Column(String(300), nullable=False)
    description    = Column(Text, nullable=True)
    severity       = Column(String(20), nullable=False)
    status         = Column(String(30), nullable=False, default="open")
                     # "open", "in_progress", "resolved"
    created_at     = Column(DateTime(timezone=True), default=func.now())
    updated_at     = Column(DateTime(timezone=True), onupdate=func.now())
    alert_ids      = Column(JSON, nullable=False, default=list)
    ai_remediation = Column(JSON, nullable=True)  # filled by AI Agent 2 (P4)
    timeline       = Column(JSON, nullable=True)  # list of timeline events
```

### Rule (`rules` table)

```python
class Rule(Base):
    __tablename__ = "rules"

    id          = Column(UUID(as_uuid=True), primary_key=True, default=uuid4)
    name        = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    rule_type   = Column(String(50), nullable=False)  # "threshold", "pattern", "blacklist"
    severity    = Column(String(20), nullable=False)
    config      = Column(JSON, nullable=False)  # rule-specific params (see P3 doc)
    enabled     = Column(Boolean, nullable=False, default=True)
    created_at  = Column(DateTime(timezone=True), default=func.now())
```

### MonitoringConfig (`monitoring_config` table)

```python
class MonitoringConfig(Base):
    __tablename__ = "monitoring_config"

    id                   = Column(Integer, primary_key=True, default=1)  # always 1 row
    monitored_interfaces = Column(JSON, nullable=False, default=["eth0"])
    monitored_subnets    = Column(JSON, nullable=False, default=["0.0.0.0/0"])
    excluded_ips         = Column(JSON, nullable=False, default=[])
    updated_at           = Column(DateTime(timezone=True), onupdate=func.now())
```

---

## API Endpoints to Implement (US-06)

### GET /api/config
Returns current monitoring configuration.

**Request:** No body.

**Response (200):**
```json
{
  "monitored_interfaces": ["eth0", "wlan0"],
  "monitored_subnets": ["192.168.1.0/24", "10.0.0.0/8"],
  "excluded_ips": ["192.168.1.1", "10.0.0.1"],
  "updated_at": "2024-01-15T10:00:00Z"
}
```

### PUT /api/config
Updates monitoring configuration (full replace).

**Request body:**
```json
{
  "monitored_interfaces": ["eth0"],
  "monitored_subnets": ["192.168.1.0/24"],
  "excluded_ips": []
}
```

**Response (200):** Same as GET response with updated `updated_at`.

**Validation rules:**
- `monitored_interfaces`: non-empty list of strings
- `monitored_subnets`: valid CIDR notation (use `ipaddress` stdlib to validate)
- `excluded_ips`: valid IPv4/IPv6 addresses

---

## WebSocket Endpoint — /ws

This is the real-time channel to the frontend. You implement the endpoint; other teammates
publish messages to Redis and this handler forwards them to all connected browser clients.

```python
# app/api/ws.py
@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    # Subscribe to Redis channels: "traffic:events", "alerts:new", "alerts:updated"
    # Forward every message received from Redis to this WebSocket client
    # Handle disconnect gracefully
```

**Message format sent to frontend:**
```json
{ "type": "traffic_event", "data": { ...NetworkEvent fields... } }
{ "type": "new_alert",     "data": { ...Alert fields... } }
{ "type": "alert_updated", "data": { ...Alert fields with ai_analysis filled... } }
```

---

## Docker Compose — Full Specification

```yaml
# docker-compose.yml
version: "3.9"

services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_DB: siem
      POSTGRES_USER: siem
      POSTGRES_PASSWORD: siempassword
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U siem"]
      interval: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s

  ollama:
    image: ollama/ollama:latest
    volumes:
      - ollama_models:/root/.ollama
    ports:
      - "11434:11434"

  backend:
    build: ./backend
    depends_on:
      postgres: { condition: service_healthy }
      redis:    { condition: service_healthy }
    environment:
      DATABASE_URL: postgresql://siem:siempassword@postgres:5432/siem
      REDIS_URL: redis://redis:6379
      OLLAMA_URL: http://ollama:11434
    ports:
      - "8000:8000"
    volumes:
      - ./backend:/app  # hot reload in dev

  capture:
    build: ./backend
    command: python -m app.capture.sniffer
    network_mode: host        # must see real network interfaces
    cap_add: [NET_RAW, NET_ADMIN]
    environment:
      REDIS_URL: redis://localhost:6379   # host network → use localhost
      DATABASE_URL: postgresql://siem:siempassword@localhost:5432/siem
      BACKEND_URL: http://localhost:8000
    depends_on:
      - redis
      - postgres

  frontend:
    build: ./frontend
    ports:
      - "3000:80"
    depends_on:
      - backend

volumes:
  postgres_data:
  ollama_models:
```

---

## CI/CD Pipeline

### .github/workflows/ci.yml (runs on every PR)

```yaml
name: CI

on:
  pull_request:
    branches: [main]

jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env:
          POSTGRES_DB: siem_test
          POSTGRES_USER: siem
          POSTGRES_PASSWORD: siempassword
        ports: ["5432:5432"]
        options: >-
          --health-cmd pg_isready
          --health-interval 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with: { python-version: "3.11" }
      - run: pip install -r backend/requirements.txt
      - run: pip install ruff pytest pytest-asyncio httpx
      - run: ruff check backend/
      - run: pytest backend/tests/ -v
        env:
          DATABASE_URL: postgresql://siem:siempassword@localhost:5432/siem_test
          REDIS_URL: redis://localhost:6379

  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci
        working-directory: frontend
      - run: npm run lint
        working-directory: frontend
      - run: npm run test
        working-directory: frontend
```

### .github/workflows/cd.yml (runs on merge to main)

```yaml
name: CD

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Build backend image
        run: docker build -t siem-backend ./backend
      - name: Build frontend image
        run: docker build -t siem-frontend ./frontend
```

---

## Redis Client — Specification

```python
# app/core/redis_client.py
import redis.asyncio as aioredis

# CHANNELS (all teammates must use these exact names):
CHANNEL_TRAFFIC_EVENTS = "traffic:events"   # P2 publishes, backend WS handler subscribes
CHANNEL_ALERTS_NEW     = "alerts:new"       # P3 publishes, P4 subscribes
CHANNEL_ALERTS_UPDATED = "alerts:updated"   # P4 publishes, backend WS handler subscribes

async def get_redis() -> aioredis.Redis:
    """Dependency injection for FastAPI routes."""

async def publish(channel: str, message: dict) -> None:
    """Serialize message to JSON and publish to channel."""

async def subscribe(channel: str):
    """Return an async generator that yields messages from channel."""
```

---

## requirements.txt

```
fastapi==0.111.0
uvicorn[standard]==0.29.0
sqlalchemy==2.0.30
alembic==1.13.1
asyncpg==0.29.0
psycopg2-binary==2.9.9
redis==5.0.4
python-dotenv==1.0.1
pydantic==2.7.1
pydantic-settings==2.2.1
httpx==0.27.0
pytest==8.2.0
pytest-asyncio==0.23.6
ruff==0.4.4
```

---

## Testing Requirements

Write tests in `backend/tests/test_infrastructure.py`:

1. Test that the database connects and all tables are created
2. Test GET /api/config returns default config on fresh DB
3. Test PUT /api/config updates and validates correctly
4. Test PUT /api/config with invalid CIDR returns 422
5. Test WebSocket connects successfully

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the backend core and infrastructure for a SIEM (Security Information and
Event Management) tool. The project uses FastAPI, PostgreSQL (SQLAlchemy + Alembic),
Redis (for real-time pub/sub), and is containerized with Docker Compose.

Your task is to implement the following files exactly as described:

PROJECT STRUCTURE:
backend/
  app/
    main.py              - FastAPI app that mounts routers from api/config.py and api/ws.py
    core/
      config.py          - Pydantic Settings reading DATABASE_URL, REDIS_URL, OLLAMA_URL from env
      database.py        - Async SQLAlchemy engine, Base, get_db dependency
      redis_client.py    - Async redis client with publish() and subscribe() helpers
                           Channels: "traffic:events", "alerts:new", "alerts:updated"
    models/
      event.py           - NetworkEvent SQLAlchemy model (fields: id UUID PK, timestamp, src_ip,
                           dst_ip, src_port, dst_port, protocol, bytes_sent, direction, interface, flags)
      alert.py           - Alert model (fields: id, rule_id, rule_name, severity, timestamp,
                           status["open","acknowledged","false_positive","resolved"], triggering_event_id FK,
                           related_event_ids JSON, ai_analysis JSON nullable, incident_id FK nullable)
      incident.py        - Incident model (fields: id, title, description, severity, status,
                           created_at, updated_at, alert_ids JSON, ai_remediation JSON nullable,
                           timeline JSON nullable)
      rule.py            - Rule model (fields: id, name, description, rule_type, severity,
                           config JSON, enabled bool, created_at)
      monitoring_config.py - MonitoringConfig model (single row, id=1, monitored_interfaces JSON,
                           monitored_subnets JSON, excluded_ips JSON, updated_at)
    schemas/             - Pydantic v2 schemas mirroring each model for request/response
    api/
      config.py          - GET /api/config and PUT /api/config
                           PUT validates CIDR with Python ipaddress stdlib
                           Returns 422 with clear error message on invalid subnet
      ws.py              - WebSocket /ws endpoint
                           Subscribes to all three Redis channels
                           Forwards to all connected WebSocket clients as JSON:
                           {"type": "traffic_event"|"new_alert"|"alert_updated", "data": {...}}
                           Handles client disconnect gracefully

DOCKER COMPOSE: Write docker-compose.yml with services: postgres, redis, ollama, backend, capture, frontend.
  - capture uses network_mode: host and cap_add: [NET_RAW, NET_ADMIN]
  - backend depends_on postgres (healthy) and redis (healthy)
  - volumes: postgres_data, ollama_models

MAKEFILE: Write a Makefile with targets: start, stop, logs, status, migrate, test

CI/CD: Write .github/workflows/ci.yml that on pull_request runs:
  - ruff linting
  - pytest with a real postgres and redis test service (not mocks)
Write .github/workflows/cd.yml that on push to main builds the Docker images.

Use async SQLAlchemy throughout. Use dependency injection (Depends) for DB sessions and Redis.
Create an Alembic migration for all models.
Add a startup event in main.py that: creates all tables if they don't exist, inserts the default
MonitoringConfig row (id=1) if it doesn't exist.

Write pytest tests for:
- DB connection and table creation
- GET /api/config (returns default)
- PUT /api/config with valid data
- PUT /api/config with invalid CIDR (expects 422)
- WebSocket connection

Use httpx.AsyncClient and pytest-asyncio for all tests.
```
