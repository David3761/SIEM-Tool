# Raport — Folosirea uneltelor de AI în dezvoltarea proiectului SIEM

Acest document descrie cum am folosit instrumentele de AI în fiecare etapă a dezvoltării proiectului, conform cerinței MDS de a maximiza utilizarea AI-ului în toate fazele.

---

## 1. Unelte folosite

| Unealtă | Model / Versiune | Rol |
|---|---|---|
| Claude Code (Anthropic) | Claude Opus 4.7 / Sonnet 4.6 | Generare cod, debugging, refactorizare, code review |
| GitHub Copilot | GPT-4 / Codex | Autocomplete în VS Code pentru cod boilerplate |
| ChatGPT | GPT-4o | Brainstorming arhitectură, explicații, depanare |
| Ollama (local) | llama3.2:3b | **Parte din produs** — Agenții 1 și 2 (analiza alertelor, plan de remediere) |

> *Notă:* Ollama nu este o unealtă de dezvoltare — este integrat în produsul final ca motor LLM local pentru cei 2 agenți AI cerinți.

---

## 2. Folosirea AI per etapă

### 2.1 Planificare & User Stories
- **ChatGPT / Claude** au fost folosite pentru a brainstormul user stories realiste pentru un SIEM, în special pentru personaje (network admin, security analyst) și criterii de acceptare.
- Backlogul rezultat a fost rafinat manual pentru a se potrivi domeniului.

### 2.2 Arhitectură & Diagrame
- **Claude** a fost folosit pentru a propune arhitectura pe componente (capture → Redis → rules → agents → backend → frontend) pe baza cerințelor funcționale.
- Diagramele Mermaid din `docs/diagrams/` (architecture, ER, sequence, lifecycle) au fost generate cu ajutorul Claude și ajustate manual.

### 2.3 Implementare backend (PHP / Symfony)
- **Claude Code** a generat scheletul controlerelor REST (Alert, Event, Incident, Rule, Config, Dns), entitățile Doctrine, repository-urile cu QueryBuilder dinamic, și serviciul `EventPublisher` pentru Mercure.
- **Copilot** a completat boilerplate-ul (getters/setters, annotations Doctrine).
- Rezolvarea bug-urilor de migrare Doctrine și a problemelor de tip UUID vs integer a fost făcută în pereche cu Claude.

### 2.4 Implementare servicii Python
- **Claude Code** a scris:
  - Sniffer-ul scapy (`services/capture/sniffer.py`) cu modul live + simulate
  - Motorul de reguli cu ferestre glisante și deduplicare (`services/rules/engine.py`)
  - Cei 2 agenți AI (`agent1_threat_analyst.py`, `agent2_incident_response.py`) inclusiv prompt engineering și parsing JSON robust
  - Clientul Ollama cu retry logic

### 2.5 Implementare frontend (React/TypeScript)
- **Claude Code** a generat majoritatea componentelor React: Dashboard, AlertsTable, AlertFilters, AlertDetail, IncidentDetail, RemediationPanel, AIAnalysisPanel, chart-urile Recharts.
- Hook-urile custom (`useWebSocket`, `useDnsSetting`) au fost scrise cu Claude.
- Toate styling-urile Tailwind au fost generate cu AI.

### 2.6 Testing
- **Claude Code** a scris testele unitare:
  - Frontend (Vitest): `AlertsTable.test.tsx`, `AlertFilters.test.tsx`, `AIAnalysisPanel.test.tsx`, `LiveTrafficFeed.test.tsx`, `SeverityBadge.test.tsx`, `useWebSocket.test.ts`
  - Backend services (pytest): `test_rules.py`, `test_capture.py`, `test_agents.py`
  - **Evaluări LLM**: `test_agent_evals.py` — testează că prompturile agenților produc output JSON valid și conform schemei

### 2.7 Debugging & Code Review
- **Claude Code** în mod interactiv a fost folosit pentru:
  - Identificarea problemelor N+1 query (AlertController)
  - Detectarea race conditions Redis ↔ Agent 1
  - Sincronizarea câmpurilor între agent output și TypeScript types (`is_false_positive` vs `is_false_positive_likely`, `executive_summary` vs `summary`, etc.)
  - Optimizarea Agent 2 (de la ~50s la ~12s prin reducerea dimensiunii promptului)
  - Defensive null guards în RemediationPanel pentru a evita crash-uri

### 2.8 DevOps & Infrastructure
- **Claude Code** a configurat:
  - `docker-compose.yml` cu cele 12 servicii
  - Dockerfile-uri pentru PHP, agenți, capture, frontend
  - Entrypoint pentru rulare `composer install` automat la pornirea containerului
  - Acest workflow CI (`.github/workflows/ci.yml`)
  - Makefile-ul pentru build și migrații

### 2.9 Documentație
- **Claude** a scris:
  - `docs/EXECUTIVE_SUMMARY.md`
  - Instrucțiunile per coleg (`docs/teammate_instructions/*.md`)
  - Acest raport
  - Comentariile inline din cod

---

## 3. Exemple concrete de prompt-uri folosite

> Selecție din interacțiunile reale cu Claude Code în timpul dezvoltării.

- *"Review the whole pipeline the traffic goes through. identify any errors/inconsistencies"* → a dus la identificarea schemei greșite UUID vs integer
- *"check the backend. especially the way events/alerts are handled. do you see anything that can be better (especially for a live demo)"* → a produs 7 fix-uri concrete (N+1, prompt mismatch, ollama timeout etc.)
- *"why is the incidents tab always empty"* → a identificat că `createIncident` exista în API dar nu era apelat din UI nicăieri
- *"there is a problem with agent 2. agent 2 takes too long to respond"* → analiza prompt size vs output tokens, fix prin reducerea câmpurilor cerute LLM-ului

---

## 4. Limitări observate

- **Halucinări LLM (Ollama)**: llama3.2:3b uneori generează JSON invalid sau câmpuri lipsă → am adăugat retry logic în `ollama_client.py` și fallback dicts.
- **Field naming drift**: Inițial Claude a generat câmpuri în agenții Python cu nume diferite față de tipurile TypeScript din frontend → am rezolvat prin normalizare în frontend (`normalizeRemediation`).
- **Context window**: Pentru schimbări mari, a fost necesar să spargem refactor-urile în pași mici pentru ca Claude să mențină context coerent.

---

## 5. Concluzie

Estimăm că **peste 85% din codul proiectului a fost generat cu ajutorul AI** (Claude Code în principal, Copilot pentru completări), iar restul de ~15% reprezintă ajustări manuale, integrare și debugging. Toate aspectele cerute (planificare, design, implementare, testare, documentație, CI/CD) au implicat utilizarea de unelte AI conform cerinței.
