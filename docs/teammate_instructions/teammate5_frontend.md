# Teammate 5 — Frontend (React / TypeScript)

## Role Overview

You build the entire user interface. Every user story has a visual component that you own.
You consume REST APIs from the Symfony backend (`http://localhost:8000`) and receive real-time
updates via WebSocket from the Ratchet server (`ws://localhost:8080`).

You do NOT implement any backend logic. You call APIs that your teammates build.

---

## User Stories Owned (UI side of every story)

| Story | Page / Component |
|---|---|
| US-01 | Dashboard — live traffic feed, real-time packet counter |
| US-02 | Alerts page — toast notification + alert row appears without refresh |
| US-03 | Alerts page — sortable filterable table with severity badges |
| US-04 | Alert detail — AI analysis panel |
| US-05 | Events page — searchable filterable table with pagination |
| US-06 | Settings page — monitoring config form |
| US-07 | Dashboard — stats charts (top IPs, protocol pie, port bar) |
| US-08 | Alerts page — Mark as False Positive button |
| US-09 | Alerts page — Export CSV / Export PDF buttons |
| US-10 | Settings page — Rule editor (create custom threshold rules) |
| US-11 | Incident detail — timeline component |
| US-12 | Incident detail — AI remediation panel |

---

## Tech Stack

| Tool | Purpose |
|---|---|
| React 18 + TypeScript | UI framework |
| Vite | Build tool |
| Tailwind CSS | Styling (dark theme) |
| TanStack Query (React Query v5) | API calls, caching, loading states |
| Axios | HTTP client |
| Recharts | Charts (bar, pie, line) |
| react-hot-toast | Toast notifications |
| react-router-dom v6 | Page routing |
| Vitest + Testing Library | Tests |
| msw | Mock API for tests |

---

## Context

### WebSocket — two ports
The Symfony backend serves REST on `:8000`. The Ratchet WebSocket server runs on `:8080`.
Your custom `useWebSocket` hook connects to `ws://localhost:8080`.

Message format (sent by Ratchet):
```json
{"type": "traffic_event", "data": { ...NetworkEvent }}
{"type": "new_alert",     "data": { ...Alert }}
{"type": "alert_updated", "data": { ...Alert with ai_analysis filled }}
```

### Why React Query?
Manages all GET request caching, background refetch, and loading/error states automatically.
Without it, every component needs its own fetch/loading/error boilerplate.

---

## TypeScript Types — Define in `src/types/index.ts`

```typescript
export interface NetworkEvent {
  id: string;
  timestamp: string;
  src_ip: string;
  dst_ip: string;
  src_port: number | null;
  dst_port: number | null;
  protocol: "TCP" | "UDP" | "ICMP" | "OTHER";
  bytes_sent: number;
  direction: "inbound" | "outbound" | "internal";
  interface: string;
  flags: string | null;
}

export interface AIAnalysis {
  threat_assessment: string;
  severity_justification: string;
  mitre_tactic: string;
  mitre_technique: string;
  confidence: number;
  is_false_positive_likely: boolean;
  recommended_action: string;
  iocs: string[];
  analyzed_at: string;
  error?: string;
}

export interface Alert {
  id: string;
  rule_id: string;
  rule_name: string;
  severity: "low" | "medium" | "high" | "critical";
  timestamp: string;
  status: "open" | "acknowledged" | "false_positive" | "resolved";
  triggering_event: NetworkEvent;
  related_event_ids: string[];
  ai_analysis: AIAnalysis | null;
  incident_id: string | null;
}

export interface TimelineEvent {
  timestamp: string;
  event: string;
  alert?: string;
  significance: string;
}

export interface AIRemediation {
  summary: string;
  attack_pattern: string;
  mitre_tactics: string[];
  mitre_techniques: string[];
  timeline: TimelineEvent[];
  remediation_steps: string[];
  iocs: string[];
  analyzed_at: string;
}

export interface Incident {
  id: string;
  title: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "in_progress" | "resolved";
  created_at: string;
  updated_at: string | null;
  alert_ids: string[];
  ai_remediation: AIRemediation | null;
  timeline: TimelineEvent[] | null;
}

export interface StatsResponse {
  time_range: string;
  total_events: number;
  total_bytes: number;
  events_per_minute: number;
  top_source_ips: { ip: string; event_count: number; bytes: number }[];
  top_destination_ips: { ip: string; event_count: number; bytes: number }[];
  top_ports: { port: number; protocol: string; event_count: number }[];
  protocol_breakdown: Record<string, number>;
  inbound_count: number;
  outbound_count: number;
  internal_count: number;
}

export interface MonitoringConfig {
  monitored_interfaces: string[];
  monitored_subnets: string[];
  excluded_ips: string[];
  updated_at: string | null;
}

export interface Rule {
  id: string;
  name: string;
  description: string;
  rule_type: string;
  severity: "low" | "medium" | "high" | "critical";
  config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}
```

---

## API Endpoints to Consume

All REST calls go to `http://localhost:8000/api`.

| Method | URL | Used by |
|---|---|---|
| GET | `/api/events` | Events page |
| GET | `/api/stats?range=1h` | Dashboard charts |
| GET | `/api/alerts` | Alerts page |
| GET | `/api/alerts/{id}` | Alert detail modal |
| PATCH | `/api/alerts/{id}` | False positive, acknowledge |
| GET | `/api/alerts/export?format=csv` | Export button |
| POST | `/api/incidents` | Create incident from alerts |
| GET | `/api/incidents` | Incidents list |
| GET | `/api/incidents/{id}` | Incident detail |
| PATCH | `/api/incidents/{id}` | Update status |
| GET | `/api/config` | Settings page |
| PUT | `/api/config` | Save config |
| GET | `/api/rules` | Settings page rule list |
| POST | `/api/rules` | Create custom rule (US-10) |
| PUT | `/api/rules/{id}` | Edit rule |
| DELETE | `/api/rules/{id}` | Delete rule |

---

## File Structure

```
frontend/
├── src/
│   ├── types/index.ts
│   ├── api/
│   │   ├── client.ts       ← axios instance baseURL=http://localhost:8000
│   │   ├── events.ts
│   │   ├── alerts.ts
│   │   ├── incidents.ts
│   │   ├── stats.ts
│   │   ├── config.ts
│   │   └── rules.ts
│   ├── hooks/
│   │   └── useWebSocket.ts ← connects to ws://localhost:8080
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   └── TopBar.tsx
│   │   ├── shared/
│   │   │   ├── SeverityBadge.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── Pagination.tsx
│   │   │   └── LoadingSpinner.tsx
│   │   ├── dashboard/
│   │   │   ├── LiveTrafficFeed.tsx
│   │   │   ├── StatsWidget.tsx
│   │   │   ├── TopIPsChart.tsx
│   │   │   ├── ProtocolPieChart.tsx
│   │   │   └── TrafficTimeline.tsx
│   │   ├── alerts/
│   │   │   ├── AlertsTable.tsx
│   │   │   ├── AlertRow.tsx
│   │   │   ├── AlertDetail.tsx
│   │   │   ├── AIAnalysisPanel.tsx
│   │   │   └── AlertFilters.tsx
│   │   └── incidents/
│   │       ├── IncidentTimeline.tsx
│   │       └── RemediationPanel.tsx
│   ├── pages/
│   │   ├── Dashboard.tsx
│   │   ├── Alerts.tsx
│   │   ├── Events.tsx
│   │   ├── Incidents.tsx
│   │   ├── IncidentDetail.tsx
│   │   └── Settings.tsx
│   ├── tests/
│   │   ├── SeverityBadge.test.tsx
│   │   ├── AlertsTable.test.tsx
│   │   ├── AIAnalysisPanel.test.tsx
│   │   ├── LiveTrafficFeed.test.tsx
│   │   ├── AlertFilters.test.tsx
│   │   └── useWebSocket.test.ts
│   ├── App.tsx
│   └── main.tsx
├── public/
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

---

## WebSocket Hook

```typescript
// src/hooks/useWebSocket.ts
// Connects to ws://localhost:8080
// Auto-reconnects with exponential backoff (1s, 2s, 4s, max 30s)
// Accepts callbacks: onTrafficEvent, onNewAlert, onAlertUpdated
// Exposes: isConnected: boolean

export function useWebSocket(handlers: {
  onTrafficEvent?: (event: NetworkEvent) => void;
  onNewAlert?: (alert: Alert) => void;
  onAlertUpdated?: (alert: Alert) => void;
}): { isConnected: boolean }
```

---

## Visual Design

Dark theme throughout. Tailwind color palette:

```
Page background:   bg-slate-900
Card / surface:    bg-slate-800
Border:            border-slate-700
Primary text:      text-slate-100
Secondary text:    text-slate-400

Severity critical: text-red-400 / bg-red-900
Severity high:     text-orange-400 / bg-orange-900
Severity medium:   text-yellow-400 / bg-yellow-900
Severity low:      text-blue-400 / bg-blue-900

Status open:          text-red-400
Status acknowledged:  text-orange-400
Status false_positive: text-slate-400
Status resolved:      text-green-400
```

---

## Key Page Behaviors

**Dashboard (US-01, US-07):**
- `LiveTrafficFeed`: maintains last 100 events in state, new WS `traffic_event` messages prepend to list
- Stats widgets: total events, total bytes, events/min, open alerts count
- Charts from `GET /api/stats?range=1h`, refreshed every 30 seconds

**Alerts page (US-02, US-03, US-08, US-09):**
- WS `new_alert` message → `toast.error("New alert: Port Scan — HIGH")` + prepend row
- WS `alert_updated` message → replace matching row in table (update AI badge from spinner to checkmark)
- "Mark as False Positive" → `PATCH /api/alerts/{id}` with `{status: "false_positive"}`
- Export buttons → `GET /api/alerts/export?format=csv` → `URL.createObjectURL(blob)` for download

**Alert Detail Modal (US-04):**
- If `ai_analysis === null` → show spinner with "AI analysis in progress..."
- If `ai_analysis.error` → show warning banner
- Otherwise → show `threat_assessment`, MITRE tactic/technique, confidence as progress bar, `recommended_action` in callout

**Events page (US-05):**
- All filter inputs debounced 400ms before query
- `port` filter applied to both `src_port` and `dst_port`

**Incident Detail (US-11, US-12):**
- `IncidentTimeline`: vertical timeline with timestamps on left, alert badge + significance text
- `RemediationPanel`: numbered steps colored by timing prefix (IMMEDIATE=red, SHORT-TERM=orange, LONG-TERM=yellow)
- If `ai_remediation === null` → show spinner

**Settings page (US-06, US-10):**
- Config form: multi-value inputs for interfaces, subnets, excluded IPs → `PUT /api/config`
- Rule editor: table of rules with enable toggle → `POST /api/rules` for new rules

---

## Testing Requirements

```typescript
// SeverityBadge.test.tsx — renders correct color class for each severity
// AlertsTable.test.tsx — renders rows from mocked API, PATCH called on FP click
// AIAnalysisPanel.test.tsx — shows spinner when null, content when filled, error when error field
// LiveTrafficFeed.test.tsx — WS message prepends to list, list capped at 100 items
// AlertFilters.test.tsx — filter change updates query params after debounce
// useWebSocket.test.ts — reconnects after disconnect, routes messages to correct handler
```

Use `msw` to mock all API calls. Use `@testing-library/react` for rendering.

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the complete frontend for a SIEM tool.
Stack: React 18, TypeScript, Vite, Tailwind CSS (dark theme), TanStack Query v5,
Axios, Recharts, react-hot-toast, react-router-dom v6, Vitest, Testing Library, msw.

REST API base URL: http://localhost:8000/api
WebSocket URL:     ws://localhost:8080

[Paste the full TypeScript interfaces block from the "TypeScript Types" section above]

IMPLEMENT:

src/types/index.ts — all interfaces above

src/api/client.ts — axios instance with baseURL="http://localhost:8000"

src/api/alerts.ts — getAlerts(params), getAlert(id), updateAlertStatus(id, status),
  exportAlerts(format, params) -> Blob

src/api/events.ts — getEvents(params) -> PaginatedResponse<NetworkEvent>
src/api/stats.ts  — getStats(range: string) -> StatsResponse
src/api/config.ts — getConfig(), updateConfig(data)
src/api/rules.ts  — getRules(), createRule(data), updateRule(id, data), deleteRule(id)
src/api/incidents.ts — getIncidents(), getIncident(id), createIncident(data), updateIncident(id, data)

src/hooks/useWebSocket.ts:
  Connects to ws://localhost:8080
  Exponential backoff reconnect: 1s, 2s, 4s, 8s... max 30s
  Accepts { onTrafficEvent, onNewAlert, onAlertUpdated } callbacks
  Returns { isConnected: boolean }

PAGES (react-router-dom):
  /              Dashboard: 4 stat widgets + LiveTrafficFeed + TopIPsChart + ProtocolPieChart + TrafficTimeline
  /alerts        AlertsTable + filters + export buttons + false positive + detail modal with AI panel
  /events        Events table with all filter inputs (debounced 400ms)
  /incidents     Incidents list
  /incidents/:id IncidentDetail with IncidentTimeline + RemediationPanel
  /settings      MonitoringConfig form + Rule editor table with enable toggles

WEBSOCKET BEHAVIORS:
  new_alert   → toast.error("New alert: {rule_name} - {SEVERITY}") + prepend to alerts list
  alert_updated → find alert by id in list, replace it (updates AI badge from spinner to checkmark)
  traffic_event → prepend to live feed, trim to 100 items max

AI ANALYSIS PANEL:
  ai_analysis === null → animated spinner + "AI analysis in progress..."
  ai_analysis.error   → yellow warning box with error message
  otherwise           → threat_assessment text, MITRE tactic/technique badges,
                        confidence as a progress bar (0-100%), recommended_action in blue callout,
                        IOCs as monospace code tags

REMEDIATION PANEL:
  ai_remediation === null → spinner
  otherwise → summary in blue info box, attack_pattern + MITRE technique tags,
              numbered remediation_steps list where steps starting with IMMEDIATE get red bg,
              SHORT-TERM get orange bg, LONG-TERM get yellow bg

EXPORT:
  CSV/PDF buttons call GET /api/alerts/export?format=csv|pdf with current filters
  Use URL.createObjectURL(blob) to trigger file download

DARK THEME: bg-slate-900 page, bg-slate-800 cards, border-slate-700 borders
USE lucide-react for all icons
ALL async operations: show loading state (disabled button + spinner), error toast on failure
ALL text filter inputs: debounce 400ms before querying

TESTS using Vitest + Testing Library + msw:
  SeverityBadge: correct Tailwind class per severity level
  AlertsTable: renders mocked alerts, calls PATCH on FP button click
  AIAnalysisPanel: spinner when null, content when filled, warning when error field present
  LiveTrafficFeed: prepends new events, caps list at 100
  useWebSocket: reconnects after simulated close event
```
