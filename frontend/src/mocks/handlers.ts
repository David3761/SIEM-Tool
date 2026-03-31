import { http, HttpResponse, delay } from "msw";
import {
  mockAlerts,
  mockEvents,
  mockIncidents,
  mockStats,
  mockConfig,
  mockRules,
  paginate,
} from "./mockData";
import type { Alert, Rule } from "../types";

// In-memory state so mutations persist during the session
let alerts = [...mockAlerts];
let incidents = [...mockIncidents];
let config = { ...mockConfig };
let rules = [...mockRules];

export const handlers = [
  // ── Events ────────────────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/events", async ({ request }) => {
    await delay(300);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 50);
    const protocol = url.searchParams.get("protocol");
    const direction = url.searchParams.get("direction");
    const srcIp = url.searchParams.get("src_ip");
    const dstIp = url.searchParams.get("dst_ip");
    const port = url.searchParams.get("port");

    let filtered = [...mockEvents];
    if (protocol) filtered = filtered.filter((e) => e.protocol === protocol);
    if (direction) filtered = filtered.filter((e) => e.direction === direction);
    if (srcIp) filtered = filtered.filter((e) => e.src_ip.includes(srcIp));
    if (dstIp) filtered = filtered.filter((e) => e.dst_ip.includes(dstIp));
    if (port) {
      const p = Number(port);
      filtered = filtered.filter((e) => e.src_port === p || e.dst_port === p);
    }

    return HttpResponse.json(paginate(filtered, page, limit));
  }),

  // ── Stats ─────────────────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/stats", async () => {
    await delay(200);
    return HttpResponse.json(mockStats);
  }),

  // ── Alerts — export (must come before /:id) ───────────────────────────────
  http.get("http://localhost:8000/api/alerts/export", async ({ request }) => {
    await delay(500);
    const url = new URL(request.url);
    const format = url.searchParams.get("format") ?? "csv";

    const csvContent = [
      "id,rule_name,severity,status,src_ip,dst_ip,timestamp",
      ...alerts.map(
        (a) =>
          `${a.id},${a.rule_name},${a.severity},${a.status},${a.triggering_event.src_ip},${a.triggering_event.dst_ip},${a.timestamp}`
      ),
    ].join("\n");

    const blob = new Blob([csvContent], { type: format === "csv" ? "text/csv" : "application/pdf" });
    return new HttpResponse(blob, {
      headers: {
        "Content-Type": format === "csv" ? "text/csv" : "application/pdf",
        "Content-Disposition": `attachment; filename="alerts.${format}"`,
      },
    });
  }),

  // ── Alerts — list ────────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/alerts", async ({ request }) => {
    await delay(350);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") ?? 1);
    const limit = Number(url.searchParams.get("limit") ?? 20);
    const severity = url.searchParams.get("severity");
    const status = url.searchParams.get("status");
    const search = url.searchParams.get("search");
    const sortBy = url.searchParams.get("sort_by") ?? "timestamp";
    const sortDir = url.searchParams.get("sort_dir") ?? "desc";

    let filtered = [...alerts];
    if (severity) filtered = filtered.filter((a) => a.severity === severity);
    if (status) filtered = filtered.filter((a) => a.status === status);
    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.rule_name.toLowerCase().includes(q) ||
          a.triggering_event.src_ip.includes(q) ||
          a.triggering_event.dst_ip.includes(q)
      );
    }

    filtered.sort((a, b) => {
      let aVal: string | number = a[sortBy as keyof Alert] as string | number ?? "";
      let bVal: string | number = b[sortBy as keyof Alert] as string | number ?? "";
      if (typeof aVal === "string") aVal = aVal.toLowerCase();
      if (typeof bVal === "string") bVal = bVal.toLowerCase();
      const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
      return sortDir === "asc" ? cmp : -cmp;
    });

    return HttpResponse.json(paginate(filtered, page, limit));
  }),

  // ── Alerts — single ──────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/alerts/:id", async ({ params }) => {
    await delay(200);
    const alert = alerts.find((a) => a.id === params.id);
    if (!alert) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(alert);
  }),

  // ── Alerts — patch ───────────────────────────────────────────────────────
  http.patch("http://localhost:8000/api/alerts/:id", async ({ request, params }) => {
    await delay(300);
    const body = (await request.json()) as Partial<Alert>;
    const idx = alerts.findIndex((a) => a.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    alerts[idx] = { ...alerts[idx], ...body };
    return HttpResponse.json(alerts[idx]);
  }),

  // ── Incidents — list ─────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/incidents", async () => {
    await delay(300);
    return HttpResponse.json(incidents);
  }),

  // ── Incidents — single ───────────────────────────────────────────────────
  http.get("http://localhost:8000/api/incidents/:id", async ({ params }) => {
    await delay(200);
    const incident = incidents.find((i) => i.id === params.id);
    if (!incident) return new HttpResponse(null, { status: 404 });
    return HttpResponse.json(incident);
  }),

  // ── Incidents — create ───────────────────────────────────────────────────
  http.post("http://localhost:8000/api/incidents", async ({ request }) => {
    await delay(400);
    const body = await request.json() as { title: string; description?: string; severity: string; alert_ids: string[] };
    const newIncident = {
      id: `inc-${Date.now()}`,
      title: body.title,
      description: body.description ?? null,
      severity: body.severity as "low" | "medium" | "high" | "critical",
      status: "open" as const,
      created_at: new Date().toISOString(),
      updated_at: null,
      alert_ids: body.alert_ids ?? [],
      ai_remediation: null,
      timeline: [],
    };
    incidents = [newIncident, ...incidents];
    return HttpResponse.json(newIncident, { status: 201 });
  }),

  // ── Incidents — patch ────────────────────────────────────────────────────
  http.patch("http://localhost:8000/api/incidents/:id", async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Record<string, unknown>;
    const idx = incidents.findIndex((i) => i.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    incidents[idx] = { ...incidents[idx], ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(incidents[idx]);
  }),

  // ── Config ────────────────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/config", async () => {
    await delay(200);
    return HttpResponse.json(config);
  }),

  http.put("http://localhost:8000/api/config", async ({ request }) => {
    await delay(350);
    const body = await request.json() as typeof config;
    config = { ...body, updated_at: new Date().toISOString() };
    return HttpResponse.json(config);
  }),

  // ── Rules ─────────────────────────────────────────────────────────────────
  http.get("http://localhost:8000/api/rules", async () => {
    await delay(250);
    return HttpResponse.json(rules);
  }),

  http.post("http://localhost:8000/api/rules", async ({ request }) => {
    await delay(400);
    const body = await request.json() as Omit<Rule, "id" | "created_at">;
    const newRule: Rule = {
      id: `rule-${Date.now()}`,
      created_at: new Date().toISOString(),
      ...body,
    };
    rules = [...rules, newRule];
    return HttpResponse.json(newRule, { status: 201 });
  }),

  http.put("http://localhost:8000/api/rules/:id", async ({ request, params }) => {
    await delay(300);
    const body = await request.json() as Partial<Rule>;
    const idx = rules.findIndex((r) => r.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    rules[idx] = { ...rules[idx], ...body };
    return HttpResponse.json(rules[idx]);
  }),

  http.delete("http://localhost:8000/api/rules/:id", async ({ params }) => {
    await delay(300);
    const idx = rules.findIndex((r) => r.id === params.id);
    if (idx === -1) return new HttpResponse(null, { status: 404 });
    rules = rules.filter((r) => r.id !== params.id);
    return new HttpResponse(null, { status: 204 });
  }),
];
