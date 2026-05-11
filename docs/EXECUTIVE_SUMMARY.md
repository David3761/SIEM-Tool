# SIEM Tool — Executive Summary

## Overview

This project is a **Security Information and Event Management (SIEM)** platform built as a team project for the MDS university course. It monitors network traffic in real time, detects threats using rule-based analysis, enriches alerts with AI-generated context, and presents everything through a live web dashboard.

The system is fully containerized with Docker Compose and runs entirely on a local machine — including the AI inference server.

---

## What It Does

| Capability | Description |
|---|---|
| **Traffic Capture** | Sniffs raw packets from real network interfaces using Scapy |
| **Threat Detection** | Evaluates traffic against 5 built-in rules using sliding-window algorithms |
| **AI Analysis** | Runs a local LLM (Ollama llama3.2:3b) to contextualize every alert |
| **Incident Management** | Groups related alerts into incidents with AI-generated remediation plans |
| **Real-time Dashboard** | Streams live events and alerts to the browser via Server-Sent Events |
| **Export & Reporting** | Exports filtered alerts to CSV or PDF |

---

## Architecture

The system is composed of 12 Docker services organized into 4 layers:

```
[ Network Interface ]
         |
    [ Capture ]  ←── Python/Scapy, host network mode
         |
      [ Redis ]  ←── Pub/sub event bus
       /     \
[ Rules ]  [ Relay ]
    |           |
    |       [ Mercure ]  ←── SSE broker
    |           |
[ Agents ]  [ Frontend ]  ←── React, port 5173
    |
[ PostgreSQL ]  ←── Persistent store
    |
[ PHP/Symfony ]  ←── REST API, port 8000
```

### Services

| Service | Language / Image | Role |
|---|---|---|
| `capture` | Python / Scapy | Sniffs packets, publishes to Redis, bulk-inserts to PostgreSQL |
| `rules` | Python | Sliding-window rule engine, fires alerts |
| `agents` | Python / Ollama | LLM threat analyst + incident response agent |
| `relay` | PHP / Symfony | Reads Redis, pushes to Mercure hub |
| `php` | PHP 8.4 / Symfony 8 | REST API (alerts, events, incidents, rules, config) |
| `mercure` | dunglas/mercure | SSE broker for real-time browser updates |
| `frontend` | React 18 / TypeScript | Web dashboard |
| `postgres` | PostgreSQL 16 | Primary database |
| `redis` | Redis 7 | Inter-service pub/sub message bus |
| `ollama` | ollama/ollama | Local LLM inference server |
| `nginx` | Nginx | Reverse proxy for the PHP backend |
| `adminer` | adminer | Database admin UI (dev only) |

---

## Data Flow

```
1. capture   → sniffs packet → publishes to Redis [traffic:events]
2. rules     → receives event → evaluates rule windows
                → threshold exceeded → INSERT alert → PostgreSQL
                                     → publish [alerts:new] → Redis
3. agents    → receives [alerts:new] → fetches context from PostgreSQL
                → calls Ollama LLM → UPDATE alert.ai_analysis → PostgreSQL
                                   → publish [alerts:updated] → Redis
4. relay     → receives all Redis channels → publishes to Mercure hub
5. frontend  → EventSource connected to Mercure → updates UI in real time
6. browser   → GET /api/alerts, /api/events, /api/incidents → PHP REST API → PostgreSQL
```

---

## Threat Detection Rules

The rules engine uses **threshold-based sliding windows** grouped by source IP. A 60-second cooldown prevents duplicate alerts.

| Rule | Severity | Trigger |
|---|---|---|
| Port Scan Detection | High | 20+ unique destination ports within 60 seconds |
| SSH Brute Force | Critical | 10+ SYN packets to port 22 within 30 seconds |
| High Traffic Volume | Medium | 500+ packets within 60 seconds |
| ICMP Flood | Medium | 100+ ICMP packets within 10 seconds |
| Unusual DNS Activity | Low | 200+ UDP packets to port 53 within 60 seconds |

Rules are stored in PostgreSQL and editable from the Settings page without restarting the engine.

---

## AI Analysis

### Agent 1 — Threat Analyst
Triggered by every new alert. Sends the alert context (rule, IPs, ports, related events, recent alerts from the same source) to the LLM and writes structured output back to the alert:

- MITRE ATT&CK tactic and technique mapping
- Confidence score (0.0–1.0)
- False positive flag
- Risk score (1–10)
- Recommended action

### Agent 2 — Incident Response
Polls PostgreSQL every 10 seconds for incidents without a remediation plan. Sends the full incident timeline to the LLM and writes back:

- Executive summary
- Root cause analysis
- Step-by-step remediation (IMMEDIATE / SHORT-TERM / LONG-TERM)
- Containment actions
- Affected assets
- Escalation flag

**LLM**: Ollama `llama3.2:3b`, temperature 0.3, runs fully locally with no external API calls.

---

## Frontend Pages

| Page | Purpose |
|---|---|
| **Dashboard** | Live traffic feed, stats (total events, bytes, events/min, open alerts), protocol charts, top IPs |
| **Alerts** | Paginated alert table with filters, AI analysis panel, status management, CSV/PDF export |
| **Events** | Paginated network event list with IP/protocol/port filters |
| **Incidents** | Incident list; detail view with event timeline and AI remediation plan |
| **Settings** | Monitoring config (interfaces, subnets, excluded IPs) and rule management |

---

## Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, TailwindCSS, Vite, React Query, Recharts |
| Backend API | PHP 8.4, Symfony 8, Doctrine ORM |
| Capture & Rules | Python 3.11, Scapy, asyncio, psycopg2 |
| AI Agents | Python 3.11, httpx, Ollama (llama3.2:3b) |
| Real-time | Mercure (SSE), Redis pub/sub |
| Database | PostgreSQL 16 |
| Infrastructure | Docker, Docker Compose, Nginx |

---

## Ports at a Glance

| URL | Service |
|---|---|
| `http://localhost:5173` | Frontend (React dev server) |
| `http://localhost:8000` | Backend REST API |
| `http://localhost:3000` | Mercure SSE hub |
| `http://localhost:8081` | Adminer (DB admin) |
| `http://localhost:11434` | Ollama (LLM API) |

---

## Project Structure

```
siem-tool/
├── backend/          # PHP/Symfony REST API
├── frontend/         # React TypeScript dashboard
├── services/
│   ├── capture/      # Packet sniffer
│   ├── rules/        # Rule engine + default_rules.yaml
│   └── agents/       # AI agents (threat analyst + incident response)
├── docker/           # Dockerfiles per service
├── docs/             # This file and architecture diagrams
└── docker-compose.yml
```
