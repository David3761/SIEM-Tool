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
