import type {
  Alert,
  NetworkEvent,
  Incident,
  StatsResponse,
  MonitoringConfig,
  Rule,
  PaginatedResponse,
  AIAnalysis,
  AIRemediation,
} from "../types";

// ─── Network Events ───────────────────────────────────────────────────────────

export const mockEvents: NetworkEvent[] = [
  {
    id: "evt-001",
    timestamp: new Date(Date.now() - 5000).toISOString(),
    src_ip: "192.168.1.105",
    dst_ip: "10.0.0.1",
    src_port: 54321,
    dst_port: 22,
    protocol: "TCP",
    bytes_sent: 2048,
    direction: "inbound",
    interface: "eth0",
    flags: "SYN",
  },
  {
    id: "evt-002",
    timestamp: new Date(Date.now() - 12000).toISOString(),
    src_ip: "10.0.0.45",
    dst_ip: "8.8.8.8",
    src_port: 43210,
    dst_port: 53,
    protocol: "UDP",
    bytes_sent: 128,
    direction: "outbound",
    interface: "eth0",
    flags: null,
  },
  {
    id: "evt-003",
    timestamp: new Date(Date.now() - 25000).toISOString(),
    src_ip: "172.16.0.20",
    dst_ip: "172.16.0.1",
    src_port: null,
    dst_port: null,
    protocol: "ICMP",
    bytes_sent: 64,
    direction: "internal",
    interface: "eth1",
    flags: null,
  },
  {
    id: "evt-004",
    timestamp: new Date(Date.now() - 40000).toISOString(),
    src_ip: "203.0.113.42",
    dst_ip: "10.0.0.5",
    src_port: 6667,
    dst_port: 443,
    protocol: "TCP",
    bytes_sent: 15360,
    direction: "inbound",
    interface: "eth0",
    flags: "ACK",
  },
  {
    id: "evt-005",
    timestamp: new Date(Date.now() - 55000).toISOString(),
    src_ip: "10.0.0.12",
    dst_ip: "192.168.2.100",
    src_port: 80,
    dst_port: 35678,
    protocol: "TCP",
    bytes_sent: 8192,
    direction: "internal",
    interface: "eth1",
    flags: "PSH,ACK",
  },
  {
    id: "evt-006",
    timestamp: new Date(Date.now() - 70000).toISOString(),
    src_ip: "198.51.100.77",
    dst_ip: "10.0.0.1",
    src_port: 12345,
    dst_port: 3389,
    protocol: "TCP",
    bytes_sent: 512,
    direction: "inbound",
    interface: "eth0",
    flags: "SYN",
  },
  {
    id: "evt-007",
    timestamp: new Date(Date.now() - 90000).toISOString(),
    src_ip: "10.0.0.8",
    dst_ip: "1.1.1.1",
    src_port: 56789,
    dst_port: 53,
    protocol: "UDP",
    bytes_sent: 72,
    direction: "outbound",
    interface: "eth0",
    flags: null,
  },
  {
    id: "evt-008",
    timestamp: new Date(Date.now() - 110000).toISOString(),
    src_ip: "192.168.1.200",
    dst_ip: "10.0.0.254",
    src_port: 44444,
    dst_port: 161,
    protocol: "UDP",
    bytes_sent: 256,
    direction: "internal",
    interface: "eth1",
    flags: null,
  },
];

// Generate extra events for pagination
for (let i = 9; i <= 60; i++) {
  const protocols: NetworkEvent["protocol"][] = ["TCP", "UDP", "ICMP", "OTHER"];
  const directions: NetworkEvent["direction"][] = ["inbound", "outbound", "internal"];
  mockEvents.push({
    id: `evt-${String(i).padStart(3, "0")}`,
    timestamp: new Date(Date.now() - i * 15000).toISOString(),
    src_ip: `10.${Math.floor(i / 10)}.${i % 10}.${(i * 7) % 255}`,
    dst_ip: `192.168.1.${(i * 3) % 255}`,
    src_port: 1024 + (i * 137) % 60000,
    dst_port: [80, 443, 22, 53, 3306, 8080][i % 6],
    protocol: protocols[i % 4],
    bytes_sent: (i * 1337) % 65535,
    direction: directions[i % 3],
    interface: i % 2 === 0 ? "eth0" : "eth1",
    flags: i % 3 === 0 ? "SYN" : i % 3 === 1 ? "ACK" : null,
  });
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────

const fullAnalysis: AIAnalysis = {
  threat_assessment:
    "High-confidence port scan activity detected originating from 192.168.1.105. The source IP attempted connections on 47 distinct ports within a 60-second window, consistent with automated reconnaissance tooling (nmap or masscan signature).",
  severity_justification:
    "Multiple sequential SYN packets targeting common service ports (22, 80, 443, 3306, 8080) with no corresponding ACK responses indicate a classic TCP half-open scan.",
  mitre_tactic: "TA0043 - Reconnaissance",
  mitre_technique: "T1046 - Network Service Scanning",
  confidence: 91,
  is_false_positive_likely: false,
  recommended_action:
    "Block 192.168.1.105 at the perimeter firewall immediately. Investigate whether this IP belongs to an internal asset performing authorized scanning. If unauthorized, escalate to Incident Response.",
  iocs: ["192.168.1.105", "port-scan", "nmap-signature", "T1046"],
  analyzed_at: new Date(Date.now() - 30000).toISOString(),
};

const bruteForceAnalysis: AIAnalysis = {
  threat_assessment:
    "Credential brute-force attack detected against SSH service on port 22. Over 300 authentication failures from 203.0.113.42 in the past 5 minutes suggest automated password spraying.",
  severity_justification:
    "Volume and velocity of failed authentication attempts exceed normal thresholds by 15x. Pattern matches known Mirai variant behavior.",
  mitre_tactic: "TA0006 - Credential Access",
  mitre_technique: "T1110.001 - Brute Force: Password Guessing",
  confidence: 97,
  is_false_positive_likely: false,
  recommended_action:
    "Immediately block 203.0.113.42 at firewall. Enable fail2ban if not already active. Audit SSH logs for any successful logins from this IP. Consider disabling password authentication in favor of key-based auth.",
  iocs: ["203.0.113.42", "ssh-brute-force", "mirai-pattern", "T1110.001"],
  analyzed_at: new Date(Date.now() - 120000).toISOString(),
};

const rdpAnalysis: AIAnalysis = {
  threat_assessment:
    "Suspicious RDP connection attempt from external IP 198.51.100.77 targeting port 3389. Source IP appears in threat intelligence feeds as associated with ransomware distribution infrastructure.",
  severity_justification:
    "External RDP access combined with threat intel correlation elevates severity to critical. RDP is a primary initial access vector for ransomware operators.",
  mitre_tactic: "TA0001 - Initial Access",
  mitre_technique: "T1133 - External Remote Services",
  confidence: 84,
  is_false_positive_likely: false,
  recommended_action:
    "Block 198.51.100.77 immediately. Disable external RDP or move behind VPN. Audit all recent successful RDP sessions. Check for lateral movement indicators.",
  iocs: ["198.51.100.77", "rdp-attack", "ransomware-c2", "T1133"],
  analyzed_at: new Date(Date.now() - 300000).toISOString(),
};

// ─── Alerts ───────────────────────────────────────────────────────────────────

export const mockAlerts: Alert[] = [
  {
    id: "alert-001",
    rule_id: "rule-001",
    rule_name: "Port Scan Detected",
    severity: "high",
    timestamp: new Date(Date.now() - 5 * 60000).toISOString(),
    status: "open",
    triggering_event: mockEvents[0],
    related_event_ids: ["evt-002", "evt-003", "evt-004"],
    ai_analysis: fullAnalysis,
    incident_id: "inc-001",
  },
  {
    id: "alert-002",
    rule_id: "rule-002",
    rule_name: "SSH Brute Force",
    severity: "critical",
    timestamp: new Date(Date.now() - 8 * 60000).toISOString(),
    status: "acknowledged",
    triggering_event: mockEvents[3],
    related_event_ids: ["evt-005", "evt-006"],
    ai_analysis: bruteForceAnalysis,
    incident_id: "inc-001",
  },
  {
    id: "alert-003",
    rule_id: "rule-003",
    rule_name: "External RDP Access",
    severity: "critical",
    timestamp: new Date(Date.now() - 15 * 60000).toISOString(),
    status: "open",
    triggering_event: mockEvents[5],
    related_event_ids: [],
    ai_analysis: rdpAnalysis,
    incident_id: null,
  },
  {
    id: "alert-004",
    rule_id: "rule-004",
    rule_name: "High Bandwidth Outbound",
    severity: "medium",
    timestamp: new Date(Date.now() - 22 * 60000).toISOString(),
    status: "open",
    triggering_event: mockEvents[4],
    related_event_ids: ["evt-007"],
    ai_analysis: null, // still analyzing
    incident_id: null,
  },
  {
    id: "alert-005",
    rule_id: "rule-001",
    rule_name: "Port Scan Detected",
    severity: "low",
    timestamp: new Date(Date.now() - 35 * 60000).toISOString(),
    status: "false_positive",
    triggering_event: mockEvents[7],
    related_event_ids: [],
    ai_analysis: {
      ...fullAnalysis,
      confidence: 23,
      is_false_positive_likely: true,
      threat_assessment: "Low-confidence scan detection. Pattern matches routine network discovery tools used by IT operations team.",
    },
    incident_id: null,
  },
  {
    id: "alert-006",
    rule_id: "rule-005",
    rule_name: "ICMP Flood",
    severity: "medium",
    timestamp: new Date(Date.now() - 50 * 60000).toISOString(),
    status: "resolved",
    triggering_event: mockEvents[2],
    related_event_ids: [],
    ai_analysis: {
      threat_assessment: "ICMP flood detected from internal subnet. Likely a misconfigured monitoring tool pinging all hosts.",
      severity_justification: "Internal source reduces risk but traffic volume is still abnormal.",
      mitre_tactic: "TA0040 - Impact",
      mitre_technique: "T1498 - Network Denial of Service",
      confidence: 62,
      is_false_positive_likely: true,
      recommended_action: "Identify the source host and review monitoring configuration.",
      iocs: ["172.16.0.20"],
      analyzed_at: new Date(Date.now() - 45 * 60000).toISOString(),
    },
    incident_id: null,
  },
  {
    id: "alert-007",
    rule_id: "rule-006",
    rule_name: "DNS Tunneling Suspected",
    severity: "high",
    timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
    status: "open",
    triggering_event: mockEvents[6],
    related_event_ids: ["evt-008"],
    ai_analysis: {
      threat_assessment: "Anomalous DNS query patterns detected. Unusually long TXT record queries and high query frequency suggest DNS tunneling for data exfiltration.",
      severity_justification: "DNS tunneling is a common exfiltration technique. Payload size and frequency exceeds normal DNS traffic by 40x.",
      mitre_tactic: "TA0010 - Exfiltration",
      mitre_technique: "T1048.003 - Exfiltration Over Unencrypted Protocol",
      confidence: 78,
      is_false_positive_likely: false,
      recommended_action: "Block outbound DNS to non-authoritative resolvers. Inspect DNS logs for domain generation algorithm patterns. Consider DNS sinkholes.",
      iocs: ["10.0.0.8", "dns-tunnel", "T1048.003"],
      analyzed_at: new Date(Date.now() - 60 * 60000).toISOString(),
    },
    incident_id: null,
  },
  {
    id: "alert-008",
    rule_id: "rule-007",
    rule_name: "Lateral Movement Detected",
    severity: "critical",
    timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
    status: "open",
    triggering_event: mockEvents[4],
    related_event_ids: ["evt-001", "evt-002", "evt-003"],
    ai_analysis: {
      threat_assessment: "Lateral movement pattern detected. Host 10.0.0.12 is connecting to multiple internal hosts on administrative ports (22, 3389, 445) in rapid succession.",
      severity_justification: "Sequential internal connection attempts to administrative services is a hallmark of post-exploitation lateral movement.",
      mitre_tactic: "TA0008 - Lateral Movement",
      mitre_technique: "T1021 - Remote Services",
      confidence: 88,
      is_false_positive_likely: false,
      recommended_action: "Isolate host 10.0.0.12 immediately. Preserve forensic image. Review all authentication logs from this host. Check for persistence mechanisms.",
      iocs: ["10.0.0.12", "lateral-movement", "T1021"],
      analyzed_at: new Date(Date.now() - 85 * 60000).toISOString(),
    },
    incident_id: "inc-001",
  },
];

// ─── Incidents ────────────────────────────────────────────────────────────────

const remediationPlan: AIRemediation = {
  summary:
    "A coordinated multi-stage attack has been identified. An external actor performed reconnaissance (port scan), gained initial access via SSH brute force, and is now conducting lateral movement within the network. Immediate containment is required.",
  attack_pattern: "Reconnaissance → Initial Access → Lateral Movement",
  mitre_tactics: ["TA0043 - Reconnaissance", "TA0006 - Credential Access", "TA0008 - Lateral Movement"],
  mitre_techniques: ["T1046", "T1110.001", "T1021"],
  timeline: [
    {
      timestamp: new Date(Date.now() - 90 * 60000).toISOString(),
      event: "Port scan initiated from 192.168.1.105",
      alert: "alert-001",
      significance: "Initial reconnaissance phase began",
    },
    {
      timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
      event: "SSH brute force attack started against 10.0.0.1",
      alert: "alert-002",
      significance: "Attacker identified open SSH service and began credential attack",
    },
    {
      timestamp: new Date(Date.now() - 40 * 60000).toISOString(),
      event: "Successful SSH authentication from 203.0.113.42",
      significance: "Attacker gained foothold on the network",
    },
    {
      timestamp: new Date(Date.now() - 25 * 60000).toISOString(),
      event: "Lateral movement detected — 10.0.0.12 connecting to multiple hosts",
      alert: "alert-008",
      significance: "Attacker is now moving through the network using compromised credentials",
    },
  ],
  remediation_steps: [
    "IMMEDIATE: Isolate host 10.0.0.12 from the network by disabling its switch port or applying an ACL",
    "IMMEDIATE: Block IPs 192.168.1.105 and 203.0.113.42 at the perimeter firewall",
    "IMMEDIATE: Force password reset for all accounts that logged in from 203.0.113.42",
    "SHORT-TERM: Audit all successful SSH logins in the past 24 hours for anomalous activity",
    "SHORT-TERM: Deploy SSH key-based authentication and disable password-based SSH login",
    "SHORT-TERM: Review firewall rules — SSH should not be exposed directly to the internet",
    "SHORT-TERM: Run a full vulnerability scan on all internal hosts",
    "LONG-TERM: Implement network segmentation to prevent lateral movement",
    "LONG-TERM: Deploy an EDR solution on all endpoints to detect post-exploitation activity",
    "LONG-TERM: Establish a Zero Trust architecture to limit blast radius of future compromises",
  ],
  iocs: ["192.168.1.105", "203.0.113.42", "10.0.0.12", "ssh-brute-force", "T1046", "T1110.001", "T1021"],
  analyzed_at: new Date(Date.now() - 20 * 60000).toISOString(),
};

export const mockIncidents: Incident[] = [
  {
    id: "inc-001",
    title: "Coordinated Multi-Stage Intrusion Attempt",
    description: "External actor performed port scan, SSH brute force, and lateral movement within a 90-minute window.",
    severity: "critical",
    status: "in_progress",
    created_at: new Date(Date.now() - 90 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 20 * 60000).toISOString(),
    alert_ids: ["alert-001", "alert-002", "alert-008"],
    ai_remediation: remediationPlan,
    timeline: remediationPlan.timeline,
  },
  {
    id: "inc-002",
    title: "DNS Tunneling Exfiltration Campaign",
    description: "Suspected data exfiltration via DNS tunneling from internal host 10.0.0.8.",
    severity: "high",
    status: "open",
    created_at: new Date(Date.now() - 65 * 60000).toISOString(),
    updated_at: null,
    alert_ids: ["alert-007"],
    ai_remediation: null, // still generating
    timeline: [
      {
        timestamp: new Date(Date.now() - 65 * 60000).toISOString(),
        event: "Anomalous DNS query volume detected from 10.0.0.8",
        alert: "alert-007",
        significance: "DNS tunneling pattern identified",
      },
    ],
  },
  {
    id: "inc-003",
    title: "Resolved: ICMP Flood from Monitoring Tool",
    description: null,
    severity: "low",
    status: "resolved",
    created_at: new Date(Date.now() - 120 * 60000).toISOString(),
    updated_at: new Date(Date.now() - 30 * 60000).toISOString(),
    alert_ids: ["alert-006"],
    ai_remediation: {
      summary: "False positive. The ICMP flood originated from a misconfigured Nagios monitoring instance.",
      attack_pattern: "N/A - Internal misconfiguration",
      mitre_tactics: [],
      mitre_techniques: [],
      timeline: [],
      remediation_steps: [
        "IMMEDIATE: Reconfigure Nagios check intervals to reduce ICMP frequency",
        "SHORT-TERM: Add monitoring host IPs to exclusion list in SIEM rules",
      ],
      iocs: [],
      analyzed_at: new Date(Date.now() - 35 * 60000).toISOString(),
    },
    timeline: [],
  },
];

// ─── Stats ────────────────────────────────────────────────────────────────────

export const mockStats: StatsResponse = {
  time_range: "1h",
  total_events: 4821,
  total_bytes: 52428800,
  events_per_minute: 80.4,
  top_source_ips: [
    { ip: "192.168.1.105", event_count: 847, bytes: 12582912 },
    { ip: "203.0.113.42", event_count: 612, bytes: 8388608 },
    { ip: "10.0.0.12", event_count: 445, bytes: 5242880 },
    { ip: "198.51.100.77", event_count: 388, bytes: 2097152 },
    { ip: "172.16.0.20", event_count: 271, bytes: 1048576 },
    { ip: "10.0.0.8", event_count: 234, bytes: 786432 },
    { ip: "10.0.0.45", event_count: 198, bytes: 524288 },
    { ip: "192.168.2.100", event_count: 155, bytes: 393216 },
  ],
  top_destination_ips: [
    { ip: "10.0.0.1", event_count: 923, bytes: 15728640 },
    { ip: "8.8.8.8", event_count: 412, bytes: 1048576 },
    { ip: "1.1.1.1", event_count: 387, bytes: 786432 },
    { ip: "10.0.0.5", event_count: 344, bytes: 4194304 },
    { ip: "192.168.1.1", event_count: 298, bytes: 2097152 },
  ],
  top_ports: [
    { port: 443, protocol: "TCP", event_count: 1245 },
    { port: 80, protocol: "TCP", event_count: 987 },
    { port: 22, protocol: "TCP", event_count: 634 },
    { port: 53, protocol: "UDP", event_count: 512 },
    { port: 3389, protocol: "TCP", event_count: 388 },
    { port: 3306, protocol: "TCP", event_count: 201 },
    { port: 8080, protocol: "TCP", event_count: 178 },
  ],
  protocol_breakdown: {
    TCP: 3245,
    UDP: 987,
    ICMP: 445,
    OTHER: 144,
  },
  inbound_count: 2134,
  outbound_count: 1456,
  internal_count: 1231,
};

// ─── Config ───────────────────────────────────────────────────────────────────

export const mockConfig: MonitoringConfig = {
  monitored_interfaces: ["eth0", "eth1"],
  monitored_subnets: ["10.0.0.0/24", "192.168.1.0/24", "172.16.0.0/16"],
  excluded_ips: ["10.0.0.254", "192.168.1.1"],
  updated_at: new Date(Date.now() - 2 * 24 * 60 * 60000).toISOString(),
};

// ─── Rules ────────────────────────────────────────────────────────────────────

export const mockRules: Rule[] = [
  {
    id: "rule-001",
    name: "Port Scan Detector",
    description: "Triggers when a single source IP hits more than 20 distinct ports within 60 seconds",
    rule_type: "threshold",
    severity: "high",
    config: { port_threshold: 20, time_window_seconds: 60 },
    enabled: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-002",
    name: "SSH Brute Force",
    description: "Detects more than 10 failed SSH authentication attempts from a single IP in 5 minutes",
    rule_type: "threshold",
    severity: "critical",
    config: { failed_attempts: 10, time_window_seconds: 300, port: 22 },
    enabled: true,
    created_at: new Date(Date.now() - 30 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-003",
    name: "External RDP Access",
    description: "Alerts when RDP (port 3389) is accessed from an external IP address",
    rule_type: "geo_block",
    severity: "critical",
    config: { port: 3389, block_external: true },
    enabled: true,
    created_at: new Date(Date.now() - 25 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-004",
    name: "High Bandwidth Outbound",
    description: "Triggers when a single host transfers more than 50MB outbound in one hour",
    rule_type: "bandwidth",
    severity: "medium",
    config: { bytes_threshold: 52428800, direction: "outbound", time_window_seconds: 3600 },
    enabled: true,
    created_at: new Date(Date.now() - 20 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-005",
    name: "ICMP Flood",
    description: "Detects ICMP packet floods exceeding 1000 packets per minute",
    rule_type: "rate",
    severity: "medium",
    config: { protocol: "ICMP", packets_per_minute: 1000 },
    enabled: false,
    created_at: new Date(Date.now() - 15 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-006",
    name: "DNS Tunneling",
    description: "Identifies anomalous DNS query patterns indicative of DNS tunneling",
    rule_type: "anomaly",
    severity: "high",
    config: { query_frequency_threshold: 100, txt_record_size_threshold: 200 },
    enabled: true,
    created_at: new Date(Date.now() - 10 * 24 * 60 * 60000).toISOString(),
  },
  {
    id: "rule-007",
    name: "Lateral Movement",
    description: "Detects a single host connecting to more than 5 internal hosts on admin ports within 10 minutes",
    rule_type: "correlation",
    severity: "critical",
    config: { internal_host_threshold: 5, time_window_seconds: 600, admin_ports: [22, 3389, 445, 5985] },
    enabled: true,
    created_at: new Date(Date.now() - 5 * 24 * 60 * 60000).toISOString(),
  },
];

// ─── Paginator helper ─────────────────────────────────────────────────────────

export function paginate<T>(items: T[], page: number, limit: number): PaginatedResponse<T> {
  const start = (page - 1) * limit;
  return {
    items: items.slice(start, start + limit),
    total: items.length,
    page,
    limit,
    pages: Math.max(1, Math.ceil(items.length / limit)),
  };
}
