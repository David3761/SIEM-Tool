# SIEM Tool

A Security Information and Event Management tool with real-time network traffic monitoring,
rule-based alert detection, and AI-powered threat analysis.

---

## Tech Stack

| Component | Language / Framework        |
|---|-----------------------------|
| REST API + SSE (Server-Sent Events) | PHP / Symfony 8 + Mercure   |
| Packet capture | Python / scapy              |
| Rule engine | Python                      |
| AI agents | Python / Ollama (local LLM) |
| Frontend | React / TypeScript          |
| Database | PostgreSQL (Doctrine ORM)   |
| Event bus | Redis                       |

---

## Project Structure

```
siem-tool/
├── backend/               # PHP / Symfony 8 — REST API + SSE via Mercure (Teammate 1)
│   ├── src/
│   │   ├── Controller/    # API Endpoints (Alert, Config, Event, Incident, Rule)
│   │   ├── Entity/        # Doctrine ORM Entities (Alert, Incident, NetworkEvent, etc.)
│   │   ├── Repository/    # Doctrine Repositories pt. operațiuni DB
│   │   └── Service/       # Servicii (ex. EventPublisher pt. SSE)
│   └── ...                # Alte foldere specifice Symfony (config, public, var, vendor)
├── services/              # Python standalone services
│   ├── capture/           # Packet capture, traffic stats (Teammate 2)
│   │   └── parsers/       # Packet normalization
│   ├── rules/             # Detection rule engine + alert creation (Teammate 3)
│   └── agents/            # AI Agents 1 and 2 — Ollama integration (Teammate 4)
├── frontend/              # React + TypeScript (Teammate 5)
│   └── src/
│       ├── api/           # API client functions
│       ├── components/
│       │   ├── alerts/    # Alert table, detail modal, AI analysis panel
│       │   ├── dashboard/ # Live traffic feed, stats charts
│       │   ├── incidents/ # Incident timeline, remediation panel
│       │   ├── layout/    # Sidebar, top bar
│       │   └── shared/    # Reusable components
│       ├── hooks/         # Hook pentru SSE (Server-Sent Events)
│       ├── pages/         # Dashboard, Alerts, Events, Incidents, Settings
│       ├── tests/         # Frontend tests
│       └── types/         # TypeScript type definitions
├── docs/
│   ├── diagrams/          # Architecture, ER diagram, sequence diagrams, state machines
│   ├── teammate_instructions/ # Per-teammate implementation guides
│   └── SIEM_backlog.md    # User stories and backlog
└── .github/
    ├── ISSUE_TEMPLATE/    # Bug report template
    └── workflows/         # CI/CD pipelines
```

---

## Documentation

- [Backlog / User Stories](docs/SIEM_backlog.md)
- [Architecture Diagram](docs/diagrams/architecture.md)
- [ER Diagram](docs/diagrams/er-diagram.md)
- [Sequence Diagram — Alert Flow](docs/diagrams/sequence-alert-flow.md)
- [Sequence Diagram — Incident Creation](docs/diagrams/sequence-incident.md)
- [Alert and Incident Lifecycle](docs/diagrams/alert-lifecycle.md)

### Teammate Instructions
- [Teammate 1 — PHP / Symfony — REST API, SSE (Mercure), Docker, CI/CD](docs/teammate_instructions/teammate1_infrastructure.md)
- [Teammate 2 — Python — Network Capture and Traffic Processing](docs/teammate_instructions/teammate2_capture.md)
- [Teammate 3 — Python — Rule Engine and Alert Management](docs/teammate_instructions/teammate3_rules_alerts.md)
- [Teammate 4 — Python — AI Agents (Ollama)](docs/teammate_instructions/teammate4_ai_agents.md)
- [Teammate 5 — React / TypeScript — Frontend](docs/teammate_instructions/teammate5_frontend.md)
