# Sequence Diagram — Incident Creation and AI Agent 2

This diagram shows how a security analyst creates an incident from multiple related alerts,
and how AI Agent 2 automatically produces a remediation plan and reconstructed timeline.

```mermaid
sequenceDiagram
    actor Analyst
    participant BR as Browser
    participant BE as Backend API
    participant DB as PostgreSQL
    participant AI as Incident Response Agent
    participant OL as Ollama LLM

    Analyst->>BR: selects 2 alerts in Alerts table
    Analyst->>BR: clicks Create Incident
    BR->>BR: opens incident creation modal
    Analyst->>BR: enters title and clicks Save

    BR->>BE: POST /api/incidents with title and alert_ids
    BE->>DB: INSERT Incident with severity=max of alert severities
    BE-->>BR: 201 Created with ai_remediation=null
    BR->>BR: navigate to IncidentDetail page with AI spinner

    Note over BE,AI: background task, does not block the 201 response
    BE->>AI: create_task analyze_incident

    AI->>DB: SELECT Incident and all Alerts and all NetworkEvents
    AI->>AI: sort all events by timestamp
    AI->>AI: build chronological timeline
    AI->>AI: compute unique IPs, duration, event count
    AI->>AI: build incident response prompt

    AI->>OL: POST /api/generate model=llama3.2:3b
    Note over OL: local LLM inference 10-30 seconds
    OL-->>AI: JSON response with remediation plan

    AI->>DB: UPDATE Incident SET ai_remediation and timeline

    Note over Analyst,BR: analyst refreshes or page polls
    BR->>BE: GET /api/incidents/:id
    BE->>DB: SELECT Incident
    DB-->>BE: incident with ai_remediation filled
    BE-->>BR: full incident object

    BR->>BR: render IncidentTimeline component
    BR->>BR: render RemediationPanel with steps
    BR->>Analyst: shows attack summary, MITRE tactics, remediation steps
```

---

# Sequence Diagram — User Configures Monitoring Scope (US-06)

```mermaid
sequenceDiagram
    actor Admin as Network Admin
    participant BR as Browser
    participant BE as Backend API
    participant DB as PostgreSQL
    participant CAP as Capture Service

    Admin->>BR: opens Settings page
    BR->>BE: GET /api/config
    BE->>DB: SELECT FROM monitoring_config WHERE id=1
    DB-->>BE: current config with interfaces and subnets
    BE-->>BR: MonitoringConfig object
    BR->>BR: populate form fields

    Admin->>BR: changes subnet to 192.168.1.0/24
    Admin->>BR: adds excluded IP 192.168.1.1
    Admin->>BR: clicks Save

    BR->>BE: PUT /api/config with updated subnets and excluded_ips
    BE->>BE: validate CIDR notation with ipaddress stdlib
    BE->>DB: UPDATE monitoring_config SET subnets and excluded_ips
    DB-->>BE: updated row
    BE-->>BR: updated MonitoringConfig
    BR->>BR: show success toast Configuration saved

    Note over CAP: next polling cycle within 60 seconds
    CAP->>BE: GET /api/config
    BE-->>CAP: updated config
    CAP->>CAP: update subnet filter to 192.168.1.0/24 only
```
