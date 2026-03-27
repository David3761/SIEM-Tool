# SIEM Tool

A Security Information and Event Management tool with real-time network traffic monitoring, rule-based alert detection, and AI-powered threat analysis.

---

## Project Structure

```
siem-tool/
├── backend/
│   ├── app/
│   │   ├── agents/        # AI agents — Threat Analyst (Agent 1) and Incident Response (Agent 2)
│   │   ├── api/           # HTTP route handlers and WebSocket endpoint
│   │   ├── capture/       # Network packet capture and traffic simulator
│   │   ├── core/          # App config, database connection, Redis client
│   │   ├── models/        # Database models
│   │   ├── parsers/       # Packet parsing and normalization
│   │   ├── rules/         # Detection rule engine and default rules
│   │   ├── schemas/       # Request/response schemas
│   │   └── services/      # Business logic — stats, export
│   └── tests/             # Automated tests and agent evaluations
├── frontend/
│   ├── public/
│   └── src/
│       ├── api/           # API client functions
│       ├── components/
│       │   ├── alerts/    # Alert table, detail modal, AI analysis panel
│       │   ├── dashboard/ # Live traffic feed, stats charts
│       │   ├── incidents/ # Incident timeline, remediation panel
│       │   ├── layout/    # Sidebar, top bar
│       │   └── shared/    # Reusable components (badges, pagination, spinner)
│       ├── hooks/         # Custom React hooks (WebSocket, etc.)
│       ├── pages/         # Page components (Dashboard, Alerts, Events, Incidents, Settings)
│       ├── tests/         # Frontend component and hook tests
│       └── types/         # TypeScript type definitions
├── docs/
│   ├── diagrams/          # Architecture, ER diagram, sequence diagrams, state machines
│   ├── teammate_instructions/ # Per-teammate implementation guides with AI prompts
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
- [Alert & Incident Lifecycle](docs/diagrams/alert-lifecycle.md)

### Teammate Instructions
- [Teammate 1 — Backend Core & Infrastructure](docs/teammate_instructions/teammate1_infrastructure.md)
- [Teammate 2 — Network Capture & Traffic Processing](docs/teammate_instructions/teammate2_capture.md)
- [Teammate 3 — Rule Engine & Alert Management](docs/teammate_instructions/teammate3_rules_alerts.md)
- [Teammate 4 — AI Agents](docs/teammate_instructions/teammate4_ai_agents.md)
- [Teammate 5 — Frontend](docs/teammate_instructions/teammate5_frontend.md)
