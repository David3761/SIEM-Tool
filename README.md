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
├── docker-compose.yml         # Container orchestration (Redis, Postgres, AI Agents, etc.)
├── backend/                   # PHP / Symfony 8 — REST API + SSE via Mercure (Teammate 1)
│   ├── src/
│   │   ├── Controller/        # API Endpoints (Alert, Config, Event, Incident, Rule)
│   │   ├── Entity/            # Doctrine ORM Entities (Alert, Incident, NetworkEvent, etc.)
│   │   ├── Repository/        # Doctrine Repositories pt. operațiuni DB
│   │   └── Service/           # Servicii (ex. EventPublisher pt. SSE)
│   └── ...                    # Alte foldere specifice Symfony (config, public, var, vendor)
├── services/                  # Python standalone services
│   ├── capture/               # Packet capture, traffic stats (Teammate 2)
│   │   └── parsers/           # Packet normalization
│   ├── rules/                 # Detection rule engine + alert creation (Teammate 3)
│   └── agents/                # AI Agents 1 and 2 — Ollama integration (Teammate 4)
│       ├── tests/             # Unit tests and LLM evaluation with Pytest
│       ├── agent1_threat_analyst.py    # Redis listener & AI threat analysis
│       ├── agent2_incident_response.py # Postgres poller & AI remediation plans
│       ├── main.py            # Async runner for both agents
│       ├── ollama_client.py   # AI model communication wrapper
│       ├── Dockerfile         # Container definition for the AI agents
│       └── requirements.txt   # Python dependencies
├── frontend/                  # React + TypeScript (Teammate 5)
│   └── src/
│       ├── api/               # API client functions
│       ├── components/
│       │   ├── alerts/        # Alert table, detail modal, AI analysis panel
│       │   ├── dashboard/     # Live traffic feed, stats charts
│       │   ├── incidents/     # Incident timeline, remediation panel
│       │   ├── layout/        # Sidebar, top bar
│       │   └── shared/        # Reusable components
│       ├── hooks/             # Hook pentru SSE (Server-Sent Events)
│       ├── pages/             # Dashboard, Alerts, Events, Incidents, Settings
│       ├── tests/             # Frontend tests
│       └── types/             # TypeScript type definitions
├── docs/
│   ├── diagrams/              # Architecture, ER diagram, sequence diagrams, state machines
│   ├── teammate_instructions/ # Per-teammate implementation guides
│   └── SIEM_backlog.md        # User stories and backlog
└── .github/
    ├── ISSUE_TEMPLATE/        # Bug report template
    └── workflows/             # CI/CD pipelines
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

---

## MDS — Grading Criteria Coverage

This section maps each grading criterion from the lab requirements to where it lives in the repository.

### A. Implementation (10 pts)

| Criterion | Location |
|---|---|
| Working application (live demo) | Run `make build` — full stack via Docker Compose |
| ≥ 2 AI agents (functional, local LLM) | [Agent 1 — Threat Analyst](services/agents/agent1_threat_analyst.py) + [Agent 2 — Incident Response](services/agents/agent2_incident_response.py), both using local Ollama (`llama3.2:3b`) |
| Offline demo recording | [https://drive.google.com/file/d/1c85MTo51U6TJjuxtAysE-oai_bCYVMFR/view?usp=sharing] |
| Original topic | SIEM tool — not covered by the "Dezvoltarea aplicațiilor web" semester 1 course |

### B. Software Development Process with AI (10 pts)

| Criterion | Pts | Location |
|---|---|---|
| User stories (≥ 10) + backlog | 2 | [docs/SIEM_backlog.md](docs/SIEM_backlog.md) — 16 user stories |
| Diagrams (UML / architecture / workflows) | 1 | [Architecture](docs/diagrams/architecture.md) · [ER](docs/diagrams/er-diagram.md) · [Sequence: Alert Flow](docs/diagrams/sequence-alert-flow.md) · [Sequence: Incident](docs/diagrams/sequence-incident.md) · [Alert/Incident Lifecycle](docs/diagrams/alert-lifecycle.md) |
| Git: branches, merges, PRs, ≥ 5 commits/student | 1 | GitHub: 12+ merged PRs, multiple feature branches (`backend`, `frontend`, `feature/sniffer`, `feature/rules-engine`, `integrare-agenti`, `fix-issue-18`, `issue/fix-race-condition`, etc.) |
| Automated tests + agent evals | 2 | Frontend: [frontend/src/tests/](frontend/src/tests/) (Vitest) · Services: [services/rules/tests/](services/rules/tests/), [services/capture/tests/](services/capture/tests/), [services/agents/tests/](services/agents/tests/) including [test_agent_evals.py](services/agents/tests/test_agent_evals.py) |
| Bug report → PR resolution | 1 | GitHub Issues + closing PRs (commits referencing `Fixes #18`, `Closes #11`, etc.); [bug report template](.github/ISSUE_TEMPLATE/) |
| CI/CD pipeline | 1 | [.github/workflows/ci.yml](.github/workflows/ci.yml) — runs frontend typecheck + tests, PHP lint, Python pytest, Docker build validation on every PR |
| AI tools usage report | 2 | [docs/AI_TOOLS_USAGE.md](docs/AI_TOOLS_USAGE.md) |

### Additional documentation
- [Executive Summary](docs/EXECUTIVE_SUMMARY.md) — project overview and outcomes
