import type { NetworkEvent, Alert } from "../types";

// Simulates the Ratchet WebSocket server locally in dev mode.
// It monkey-patches the global WebSocket so useWebSocket.ts connects to this
// fake server instead of ws://localhost:8080.

const PROTOCOLS: NetworkEvent["protocol"][] = ["TCP", "UDP", "ICMP", "OTHER"];
const DIRECTIONS: NetworkEvent["direction"][] = ["inbound", "outbound", "internal"];
const SRC_IPS = ["192.168.1.105", "203.0.113.42", "10.0.0.12", "198.51.100.77", "172.16.0.20", "10.0.0.8"];
const DST_IPS = ["10.0.0.1", "10.0.0.5", "192.168.2.100", "8.8.8.8", "1.1.1.1"];

let counter = 1000;

function randomTrafficEvent(): NetworkEvent {
  const proto = PROTOCOLS[Math.floor(Math.random() * PROTOCOLS.length)];
  counter++;
  return {
    id: `live-${counter}`,
    timestamp: new Date().toISOString(),
    src_ip: SRC_IPS[Math.floor(Math.random() * SRC_IPS.length)],
    dst_ip: DST_IPS[Math.floor(Math.random() * DST_IPS.length)],
    src_port: proto !== "ICMP" ? 1024 + Math.floor(Math.random() * 60000) : null,
    dst_port: proto !== "ICMP" ? [22, 80, 443, 3306, 3389, 8080][Math.floor(Math.random() * 6)] : null,
    protocol: proto,
    bytes_sent: Math.floor(Math.random() * 65535),
    direction: DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)],
    interface: Math.random() > 0.5 ? "eth0" : "eth1",
    flags: proto === "TCP" ? ["SYN", "ACK", "PSH,ACK", "RST"][Math.floor(Math.random() * 4)] : null,
  };
}

const MOCK_NEW_ALERT: Alert = {
  id: `live-alert-${Date.now()}`,
  rule_id: "rule-001",
  rule_name: "Port Scan Detected",
  severity: "high",
  timestamp: new Date().toISOString(),
  status: "open",
  triggering_event: randomTrafficEvent(),
  related_event_ids: [],
  ai_analysis: null,
  incident_id: null,
};

// ── Fake WebSocket implementation ────────────────────────────────────────────

class FakeWebSocket extends EventTarget {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSING = 2;
  readonly CLOSED = 3;

  readyState: number = FakeWebSocket.CONNECTING;
  url: string;

  onopen: ((ev: Event) => void) | null = null;
  onclose: ((ev: CloseEvent) => void) | null = null;
  onmessage: ((ev: MessageEvent) => void) | null = null;
  onerror: ((ev: Event) => void) | null = null;

  private intervals: ReturnType<typeof setInterval>[] = [];

  constructor(url: string) {
    super();
    this.url = url;

    // Simulate async open
    setTimeout(() => {
      this.readyState = FakeWebSocket.OPEN;
      const event = new Event("open");
      this.onopen?.(event);
      this.dispatchEvent(event);
      this._startEmitting();
    }, 80);
  }

  private _push(data: object) {
    if (this.readyState !== FakeWebSocket.OPEN) return;
    const event = new MessageEvent("message", { data: JSON.stringify(data) });
    this.onmessage?.(event);
    this.dispatchEvent(event);
  }

  private _startEmitting() {
    // Traffic events every 1.5 seconds
    this.intervals.push(
      setInterval(() => {
        this._push({ type: "traffic_event", data: randomTrafficEvent() });
      }, 1500)
    );

    // Occasional new alert (every ~30 seconds, random jitter)
    const scheduleAlert = () => {
      const delay = 20000 + Math.random() * 20000;
      const t = setTimeout(() => {
        this._push({
          type: "new_alert",
          data: {
            ...MOCK_NEW_ALERT,
            id: `live-alert-${Date.now()}`,
            timestamp: new Date().toISOString(),
            severity: (["low", "medium", "high", "critical"] as const)[Math.floor(Math.random() * 4)],
            rule_name: ["Port Scan Detected", "SSH Brute Force", "High Bandwidth Outbound"][
              Math.floor(Math.random() * 3)
            ],
          },
        });
        scheduleAlert(); // reschedule
      }, delay);
      this.intervals.push(t as unknown as ReturnType<typeof setInterval>);
    };
    scheduleAlert();

    // alert_updated after 8 seconds (simulates AI analysis completing)
    this.intervals.push(
      setTimeout(() => {
        this._push({
          type: "alert_updated",
          data: {
            id: "alert-004",
            ai_analysis: {
              threat_assessment:
                "Outbound bandwidth spike detected. Traffic volume from 10.0.0.12 exceeded normal thresholds by 3x. Destination is a known cloud storage provider; may indicate data exfiltration or large backup operation.",
              severity_justification: "Destination is cloud storage; volume anomaly warrants investigation.",
              mitre_tactic: "TA0010 - Exfiltration",
              mitre_technique: "T1567 - Exfiltration Over Web Service",
              confidence: 65,
              is_false_positive_likely: true,
              recommended_action: "Verify with the asset owner whether a scheduled backup was running at this time.",
              iocs: ["10.0.0.12"],
              analyzed_at: new Date().toISOString(),
            },
          },
        });
      }, 8000) as unknown as ReturnType<typeof setInterval>
    );
  }

  send(_data: string) {
    // no-op for mock
  }

  close() {
    this.readyState = FakeWebSocket.CLOSED;
    this.intervals.forEach((id) => clearInterval(id));
    this.intervals = [];
    const event = new CloseEvent("close", { wasClean: true, code: 1000 });
    this.onclose?.(event);
    this.dispatchEvent(event);
  }

  // Stubs required by the WebSocket interface
  binaryType: BinaryType = "blob";
  bufferedAmount = 0;
  extensions = "";
  protocol = "";
  addEventListener = super.addEventListener.bind(this);
  removeEventListener = super.removeEventListener.bind(this);
}

export function installMockWebSocket() {
  // Only patch when trying to connect to the dev WS URL
  const OriginalWebSocket = window.WebSocket;
  (window as unknown as { WebSocket: typeof FakeWebSocket }).WebSocket = class extends FakeWebSocket {
    constructor(url: string, protocols?: string | string[]) {
      if (url === "ws://localhost:8080") {
        super(url);
      } else {
        return new OriginalWebSocket(url, protocols) as unknown as FakeWebSocket;
      }
    }
  } as unknown as typeof WebSocket;
}
