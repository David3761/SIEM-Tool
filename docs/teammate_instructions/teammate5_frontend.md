# Teammate 5 — Frontend

## Role Overview

You build the entire user interface. Every user story has a visual component that you own.
You consume HTTP REST APIs from the backend and receive real-time updates via WebSocket.
Your job is to make the SIEM tool usable, fast, and clear — a security analyst should be able
to understand what is happening on their network within seconds of opening the app.

You do NOT implement any backend logic. You call APIs that your teammates build.

---

## User Stories Owned (UI side of every story)

| Story | Page/Component |
|---|---|
| US-01 | Dashboard — live traffic feed + real-time packet counter |
| US-02 | Alerts page — toast notification + live alert appears without refresh |
| US-03 | Alerts page — sortable, filterable table with severity badges |
| US-04 | Alert detail — AI analysis panel showing threat assessment |
| US-05 | Events page — searchable, filterable table with pagination |
| US-06 | Settings page — interface and subnet configuration form |
| US-07 | Dashboard — statistics widgets (top IPs chart, protocol pie chart, port bar chart) |
| US-08 | Alerts page — "Mark as False Positive" button on each alert |
| US-09 | Alerts page — "Export" button (CSV/PDF download) |
| US-10 | Settings page — Rule editor (create custom threshold rules) |
| US-11 | Incident detail — timeline component showing event sequence |
| US-12 | Incident detail — AI remediation panel with step-by-step instructions |

---

## Context — Why This Component Exists

### Why React + TypeScript?
React gives us a component model that makes the real-time dashboard manageable.
TypeScript catches API contract mismatches at compile time — critical when integrating with
a backend built by 4 different people.

### Why Tailwind CSS?
Utility-first CSS means you spend time on layout and behavior, not naming CSS classes.
A dark-themed security dashboard is achievable in hours with Tailwind.

### Why WebSocket for real-time?
The live traffic dashboard (US-01) and instant alert notifications (US-02) would require
polling the API every second without WebSockets. WebSockets let the server push events to
the browser the moment they happen, with no polling overhead.

### Why React Query (TanStack Query)?
Manages all API calls, caching, background refetching, and loading/error states automatically.
Without it, you would write the same fetch/loading/error boilerplate in every component.

### Why Recharts?
The traffic statistics (US-07) require charts: bar chart for top ports, pie chart for
protocols, line chart for traffic over time. Recharts is the simplest React chart library.

---

## Architecture Position

```
Browser
  │
  ├── HTTP GET/POST/PATCH → backend:8000/api/*  (via React Query)
  │
  └── WebSocket ws://localhost:8000/ws
        │
        ├── type: "traffic_event"  → live traffic feed (US-01)
        ├── type: "new_alert"      → instant alert toast (US-02) + alerts table update
        └── type: "alert_updated" → AI analysis panel appears (US-04)
```

---

## What You Receive (Inputs)

### REST API Endpoints (all served from `http://localhost:8000`)

**Events:**
- `GET /api/events` → `{ items: NetworkEvent[], total, page, limit, pages }`
- `GET /api/events/{id}` → `NetworkEvent`

**Alerts:**
- `GET /api/alerts` → `{ items: Alert[], total, page, limit, pages }`
- `GET /api/alerts/{id}` → `Alert`
- `PATCH /api/alerts/{id}` → `Alert` (body: `{ status: string }`)
- `GET /api/alerts/export?format=csv|pdf` → file download

**Incidents:**
- `POST /api/incidents` → `Incident` (body: `{ title, alert_ids }`)
- `GET /api/incidents` → `{ items: Incident[], total, page, limit, pages }`
- `GET /api/incidents/{id}` → `Incident`
- `PATCH /api/incidents/{id}` → `Incident`

**Stats:**
- `GET /api/stats?range=1h|6h|24h|7d` → `StatsResponse`

**Config:**
- `GET /api/config` → `MonitoringConfig`
- `PUT /api/config` → `MonitoringConfig`

**Rules:**
- `GET /api/rules` → `Rule[]`
- `POST /api/rules` → `Rule`
- `PUT /api/rules/{id}` → `Rule`
- `DELETE /api/rules/{id}` → `204`

### WebSocket Messages (`ws://localhost:8000/ws`)

```typescript
type WSMessage =
  | { type: "traffic_event"; data: NetworkEvent }
  | { type: "new_alert";     data: Alert }
  | { type: "alert_updated"; data: Alert }
```

### TypeScript Types (define in `src/types/index.ts`)

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

export interface TimelineEvent {
  timestamp: string;
  event: string;
  alert?: string;
  significance: string;
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
```

---

## File Structure You Own

```
frontend/
├── Dockerfile
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx                  ← routing + layout
    ├── types/
    │   └── index.ts             ← all TypeScript types above
    ├── api/
    │   ├── client.ts            ← axios instance with base URL
    │   ├── events.ts            ← event API calls
    │   ├── alerts.ts            ← alert API calls
    │   ├── incidents.ts         ← incident API calls
    │   ├── stats.ts             ← stats API calls
    │   ├── config.ts            ← config API calls
    │   └── rules.ts             ← rules API calls
    ├── hooks/
    │   └── useWebSocket.ts      ← WebSocket connection + message handling
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx      ← navigation: Dashboard, Alerts, Events, Incidents, Settings
    │   │   └── TopBar.tsx       ← real-time connection status indicator
    │   ├── shared/
    │   │   ├── SeverityBadge.tsx   ← colored badge: low/medium/high/critical
    │   │   ├── StatusBadge.tsx     ← colored badge for alert/incident status
    │   │   ├── Pagination.tsx      ← reusable pagination component
    │   │   └── LoadingSpinner.tsx
    │   ├── dashboard/
    │   │   ├── LiveTrafficFeed.tsx  ← scrolling list of recent events (US-01)
    │   │   ├── StatsWidget.tsx      ← single stat box (total events, total bytes, etc.)
    │   │   ├── TopIPsChart.tsx      ← horizontal bar chart (US-07)
    │   │   ├── ProtocolPieChart.tsx ← donut chart (US-07)
    │   │   └── TrafficTimeline.tsx  ← events/min over time line chart (US-07)
    │   ├── alerts/
    │   │   ├── AlertsTable.tsx      ← filterable, sortable table (US-03)
    │   │   ├── AlertRow.tsx         ← single row with severity badge + actions
    │   │   ├── AlertDetail.tsx      ← modal/drawer with full alert + AI analysis (US-04)
    │   │   ├── AIAnalysisPanel.tsx  ← shows ai_analysis content (US-04)
    │   │   └── AlertFilters.tsx     ← filter bar: status, severity, date range (US-03, US-05)
    │   └── incidents/
    │       ├── IncidentTimeline.tsx ← vertical timeline component (US-11)
    │       └── RemediationPanel.tsx ← shows remediation_steps + mitre techniques (US-12)
    └── pages/
        ├── Dashboard.tsx       ← live traffic + stats (US-01, US-07)
        ├── Alerts.tsx          ← alert table + filters + export (US-02, US-03, US-08, US-09)
        ├── Events.tsx          ← event log with search/filter (US-05)
        ├── Incidents.tsx       ← incident list
        ├── IncidentDetail.tsx  ← single incident with timeline + AI remediation (US-11, US-12)
        └── Settings.tsx        ← config form + rule editor (US-06, US-10)
```

---

## Page-by-Page Specification

### Dashboard.tsx (US-01, US-07)

Layout: 4 stat widgets on top, then two columns: left = live traffic feed, right = charts.

**Stat widgets:** Total Events (last 1h), Total Bytes, Events/Min, Active Alerts count.

**Live Traffic Feed** (LiveTrafficFeed.tsx):
- Maintains a local state array (max 100 items) of recent NetworkEvent objects
- On WebSocket message `{ type: "traffic_event" }`: prepend to array, trim to 100
- Each row: `[timestamp] [direction arrow] src_ip:src_port → dst_ip:dst_port [protocol badge] [bytes]`
- Direction: ▲ for outbound (red), ▼ for inbound (green), ↔ for internal (gray)
- Auto-scrolls to top as new events arrive
- Shows "Receiving live data..." badge in top-right when WebSocket is connected

**Charts** use `GET /api/stats?range=1h` data, refreshed every 30 seconds:
- TopIPsChart: horizontal bar chart, top 5 source IPs by event count
- ProtocolPieChart: donut chart with TCP/UDP/ICMP slices
- TrafficTimeline: line chart of events/min over time (needs stats data bucketed by minute)

### Alerts.tsx (US-02, US-03, US-08, US-09)

**AlertsTable columns:**
| Column | Content |
|---|---|
| Severity | `<SeverityBadge>` (critical=red, high=orange, medium=yellow, low=blue) |
| Time | Relative time ("2 minutes ago") |
| Rule | Rule name |
| Source | src_ip:src_port |
| Destination | dst_ip:dst_port |
| Protocol | TCP/UDP/ICMP badge |
| Status | `<StatusBadge>` |
| AI | Spinner if ai_analysis is null, checkmark if present |
| Actions | "View", "Acknowledge", "False Positive" buttons |

**Filter bar (AlertFilters.tsx):**
- Severity dropdown (All, Low, Medium, High, Critical)
- Status dropdown (All, Open, Acknowledged, False Positive, Resolved)
- Date range picker (From / To)
- Search input (searches rule_name and src_ip)

**Real-time updates (US-02):**
- WebSocket `new_alert` → show toast notification ("New alert: Port Scan Detection — HIGH")
  and prepend to table without full page reload
- WebSocket `alert_updated` → update the specific row's AI badge from spinner to checkmark

**Export (US-09):**
- "Export CSV" button → `GET /api/alerts/export?format=csv` → triggers file download
- "Export PDF" button → `GET /api/alerts/export?format=pdf` → triggers file download
- Apply current filters to the export URL

**Mark as False Positive (US-08):**
- Button on each row → `PATCH /api/alerts/{id}` with `{ status: "false_positive" }`
- On success: update row status badge optimistically

**Alert Detail Modal (US-04):**
- Opens when user clicks "View" on a row
- Shows full event details: all NetworkEvent fields
- Shows "AI Analysis" section:
  - If `ai_analysis === null`: "AI analysis in progress..." spinner
  - If `ai_analysis.error`: "AI unavailable" warning
  - Otherwise: threat_assessment text, MITRE tactic/technique, confidence bar (0-100%),
    recommended_action in a callout box, IOCs as tags

### Events.tsx (US-05)

Table with columns: Timestamp, Source IP, Source Port, Destination IP, Destination Port,
Protocol, Direction, Bytes, Flags.

**Filters (inline above table):**
- Protocol select (All/TCP/UDP/ICMP)
- Port input (filters src OR dst port)
- Source IP input
- Destination IP input
- Direction select
- Date range

All filters are query params on `GET /api/events`. Debounce text inputs by 400ms.
Show total count: "Showing 1-50 of 15,420 events"

### IncidentDetail.tsx (US-11, US-12)

**IncidentTimeline.tsx:**
```
10:30:05  [PORT SCAN DETECTION — HIGH]
          192.168.1.100 contacted 34 unique ports on 8.8.8.8 in 45 seconds
          ── Reconnaissance phase begins ──

10:31:00  [SSH BRUTE FORCE — CRITICAL]
          192.168.1.100 sent 15 SYN packets to 192.168.1.10:22 in 30s
          ── Exploitation phase ──
```
Each entry: timestamp on left, alert name + severity badge, event description, significance text.

**RemediationPanel.tsx (US-12):**
- Shows `ai_remediation.summary` in a blue info box
- Shows `ai_remediation.attack_pattern` and MITRE techniques as tags
- Shows numbered `remediation_steps` list, color-coded by timing:
  - Steps starting with "IMMEDIATE:" → red background
  - Steps starting with "SHORT-TERM:" → orange background
  - Steps starting with "LONG-TERM:" → yellow background
- Shows IOCs as monospace code tags
- If `ai_remediation === null`: "AI analysis in progress..." spinner

### Settings.tsx (US-06, US-10)

**Monitoring Configuration (US-06):**
- Loads from `GET /api/config`
- Multi-value text inputs for: Monitored Interfaces, Monitored Subnets, Excluded IPs
- Save button → `PUT /api/config`
- Show success toast on save, show validation errors inline

**Rule Editor (US-10):**
- Table of all existing rules with enable/disable toggle
- "Add Rule" button → opens modal with form:
  - Name (text input)
  - Description (textarea)
  - Severity (select: low/medium/high/critical)
  - Metric (select: event_count / unique_dst_ports)
  - Threshold (number input)
  - Window (number input, seconds)
  - Filter by port (optional number)
  - Filter by protocol (optional select)
- Save → `POST /api/rules`

---

## WebSocket Hook Specification

```typescript
// src/hooks/useWebSocket.ts
export function useWebSocket(handlers: {
  onTrafficEvent?: (event: NetworkEvent) => void;
  onNewAlert?: (alert: Alert) => void;
  onAlertUpdated?: (alert: Alert) => void;
}) {
  // Connects to ws://localhost:8000/ws
  // Reconnects automatically on disconnect (exponential backoff, max 30s)
  // Parses incoming JSON messages and calls the appropriate handler
  // Exposes: isConnected (boolean)
}
```

Usage in Dashboard:
```typescript
const { isConnected } = useWebSocket({
  onTrafficEvent: (event) => setEvents(prev => [event, ...prev].slice(0, 100)),
  onNewAlert: (alert) => {
    toast.error(`New alert: ${alert.rule_name} — ${alert.severity.toUpperCase()}`);
    setAlerts(prev => [alert, ...prev]);
  },
});
```

---

## Visual Design

Use a **dark theme** suitable for a security dashboard (dark grays, not pure black).

Color palette:
```
Background:     #0f172a  (slate-900)
Card/Surface:   #1e293b  (slate-800)
Border:         #334155  (slate-700)
Text primary:   #f1f5f9  (slate-100)
Text secondary: #94a3b8  (slate-400)

Severity - Critical: #ef4444  (red-500)
Severity - High:     #f97316  (orange-500)
Severity - Medium:   #eab308  (yellow-500)
Severity - Low:      #3b82f6  (blue-500)

Status - Open:          #ef4444  (red-500)
Status - Acknowledged:  #f97316  (orange-500)
Status - False Positive: #6b7280 (gray-500)
Status - Resolved:      #22c55e  (green-500)
```

---

## package.json Key Dependencies

```json
{
  "dependencies": {
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "react-router-dom": "^6.23.0",
    "@tanstack/react-query": "^5.35.0",
    "axios": "^1.6.8",
    "recharts": "^2.12.0",
    "react-hot-toast": "^2.4.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.379.0"
  },
  "devDependencies": {
    "typescript": "^5.4.0",
    "vite": "^5.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "tailwindcss": "^3.4.0",
    "vitest": "^1.6.0",
    "@testing-library/react": "^15.0.0",
    "@testing-library/user-event": "^14.5.0",
    "msw": "^2.3.0"
  }
}
```

---

## Testing Requirements

Write tests in `frontend/src/tests/`:

1. `SeverityBadge.test.tsx` — renders correct color for each severity level
2. `AlertsTable.test.tsx` — renders list of alerts, clicking "False Positive" calls PATCH
3. `AIAnalysisPanel.test.tsx` — shows spinner when ai_analysis is null, shows content when present
4. `LiveTrafficFeed.test.tsx` — adds new event to top of list when received via WebSocket
5. `AlertFilters.test.tsx` — changing severity dropdown updates URL search params
6. `useWebSocket.test.ts` — reconnects after disconnect, parses messages correctly

Use `msw` (Mock Service Worker) to mock API calls in tests. Use `@testing-library/react` for
component rendering and interaction tests.

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the complete frontend for a SIEM (Security Information and Event
Management) tool. The stack is: React 18, TypeScript, Vite, Tailwind CSS (dark theme),
TanStack Query (React Query v5), Axios, Recharts, react-hot-toast, react-router-dom v6.

The backend runs at http://localhost:8000.
WebSocket runs at ws://localhost:8000/ws.

TYPESCRIPT TYPES (use these exactly):
[paste the full TypeScript interfaces block from the "TypeScript Types" section above]

YOUR TASK: Implement the following files:

src/types/index.ts — all TypeScript interfaces as defined above

src/api/client.ts — axios instance with baseURL="http://localhost:8000"

src/api/alerts.ts — functions:
  getAlerts(params: AlertFilters) → PaginatedResponse<Alert>
  getAlert(id: string) → Alert
  updateAlertStatus(id: string, status: string) → Alert
  exportAlerts(format: "csv"|"pdf", filters: AlertFilters) → Blob (for file download)

src/api/events.ts — getEvents(params: EventFilters) → PaginatedResponse<NetworkEvent>
src/api/stats.ts — getStats(range: string) → StatsResponse
src/api/config.ts — getConfig() → MonitoringConfig, updateConfig(data) → MonitoringConfig
src/api/rules.ts — getRules(), createRule(data), updateRule(id, data), deleteRule(id)
src/api/incidents.ts — getIncidents(), getIncident(id), createIncident(data), updateIncident(id, data)

src/hooks/useWebSocket.ts — custom hook that:
  - Connects to ws://localhost:8000/ws
  - Auto-reconnects on disconnect with exponential backoff (1s, 2s, 4s, max 30s)
  - Accepts { onTrafficEvent, onNewAlert, onAlertUpdated } callbacks
  - Exposes isConnected: boolean

PAGES to implement (use react-router-dom routes):
  /            → Dashboard: 4 stat widgets + LiveTrafficFeed + 3 charts
  /alerts      → AlertsTable with filters, export buttons, false-positive toggle, detail modal
  /events      → EventsTable with search/filter inputs
  /incidents   → IncidentsList
  /incidents/:id → IncidentDetail with IncidentTimeline + RemediationPanel
  /settings    → MonitoringConfig form + Rule editor

VISUAL DESIGN:
- Dark theme using Tailwind: bg-slate-900 for page, bg-slate-800 for cards, borders border-slate-700
- Severity colors: critical=red-500, high=orange-500, medium=yellow-500, low=blue-500
- Status colors: open=red, acknowledged=orange, false_positive=gray, resolved=green
- Use lucide-react for all icons
- All tables must have hover states (hover:bg-slate-700)
- All buttons: rounded, with loading state (disabled + spinner) during async operations

KEY BEHAVIORS:
- LiveTrafficFeed: maintains last 100 events, new events appear at top, smooth scroll
- New alert WebSocket message: show toast AND add to alerts table without page reload
- Alert updated WebSocket message: update the specific alert in the table (replace by id)
- AI analysis panel: show skeleton/spinner when ai_analysis is null
- Export buttons: trigger real file download using URL.createObjectURL(blob)
- All text inputs in filters: debounce 400ms before querying
- All forms: show inline validation errors, success toast on save

TESTS to implement using Vitest + @testing-library/react + msw:
- SeverityBadge renders correct color class for each severity
- AlertsTable renders alerts from mocked API response
- Clicking "Mark False Positive" calls PATCH endpoint
- AIAnalysisPanel shows spinner when ai_analysis=null, content when present
- useWebSocket hook reconnects after simulated disconnect
- LiveTrafficFeed prepends new events from WebSocket to the list

Use TanStack Query's useQuery for all GET requests and useMutation for POST/PATCH/DELETE.
Use react-hot-toast for success/error notifications.
All API error states must show a user-friendly error message, never a raw error object.
```
