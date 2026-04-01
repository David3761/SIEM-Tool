import { http, HttpResponse } from "msw";
import type { Alert, NetworkEvent, PaginatedResponse } from "../types";

export const mockAlert: Alert = {
  id: "alert-1",
  rule_id: "rule-1",
  rule_name: "Port Scan Detected",
  severity: "high",
  timestamp: "2024-01-15T10:30:00Z",
  status: "open",
  triggering_event: {
    id: "event-1",
    timestamp: "2024-01-15T10:30:00Z",
    src_ip: "192.168.1.100",
    dst_ip: "10.0.0.1",
    src_port: 54321,
    dst_port: 80,
    protocol: "TCP",
    bytes_sent: 1024,
    direction: "inbound",
    interface: "eth0",
    flags: "SYN",
  },
  related_event_ids: ["event-2", "event-3"],
  ai_analysis: {
    threat_assessment: "High-confidence port scan activity detected.",
    severity_justification: "Multiple ports targeted in rapid succession.",
    mitre_tactic: "Discovery",
    mitre_technique: "T1046 - Network Service Discovery",
    confidence: 87,
    is_false_positive_likely: false,
    recommended_action: "Block source IP and investigate.",
    iocs: ["192.168.1.100", "port-scan"],
    analyzed_at: "2024-01-15T10:30:05Z",
  },
  incident_id: null,
};

export const mockAlertNullAnalysis: Alert = {
  ...mockAlert,
  id: "alert-2",
  ai_analysis: null,
};

export const mockAlertErrorAnalysis: Alert = {
  ...mockAlert,
  id: "alert-3",
  ai_analysis: {
    ...mockAlert.ai_analysis!,
    error: "OpenAI timeout after 30s",
  },
};

export const mockEvent: NetworkEvent = {
  id: "event-1",
  timestamp: "2024-01-15T10:30:00Z",
  src_ip: "192.168.1.100",
  dst_ip: "10.0.0.1",
  src_port: 54321,
  dst_port: 80,
  protocol: "TCP",
  bytes_sent: 1024,
  direction: "inbound",
  interface: "eth0",
  flags: "SYN",
};

export const handlers = [
  http.get("http://localhost:8000/api/alerts", () => {
    const response: PaginatedResponse<Alert> = {
      items: [mockAlert, mockAlertNullAnalysis],
      total: 2,
      page: 1,
      limit: 20,
      pages: 1,
    };
    return HttpResponse.json(response);
  }),

  http.get("http://localhost:8000/api/alerts/:id", ({ params }) => {
    const alerts: Record<string, Alert> = {
      "alert-1": mockAlert,
      "alert-2": mockAlertNullAnalysis,
      "alert-3": mockAlertErrorAnalysis,
    };
    const alert = alerts[params.id as string];
    if (!alert) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(alert);
  }),

  http.patch("http://localhost:8000/api/alerts/:id", async ({ request, params }) => {
    const body = (await request.json()) as { status: Alert["status"] };
    return HttpResponse.json({ ...mockAlert, id: params.id as string, status: body.status });
  }),
];
