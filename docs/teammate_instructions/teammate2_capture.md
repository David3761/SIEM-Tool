# Teammate 2 — Network Capture & Traffic Processing

## Role Overview

You are the data source of the entire SIEM system. Without you, there is nothing to analyze,
no alerts to fire, no dashboard to show. Your job is to capture real network packets from the
host machine, parse them into a clean normalized schema, store them in PostgreSQL, and stream
them in real-time to Redis so the rest of the system reacts immediately.

You also own the traffic statistics engine (top IPs, top ports, protocol breakdown) and the
historical event search/filter API.

---

## User Stories Owned

| Story | Description |
|---|---|
| US-01 | Live inbound/outbound traffic on a dashboard (backend data source) |
| US-05 | Filter and search through historical traffic logs |
| US-07 | Traffic statistics: top IPs, top ports, protocol breakdown |

---

## Context — Why This Component Exists

### Why scapy?
`scapy` is a Python library that can capture raw network packets directly from a network
interface (like Wireshark does). It gives you access to every packet's source IP, destination
IP, ports, protocol, size, and TCP flags. This is the raw material everything else is built on.

### Why does the capture run in a separate container?
Packet capture requires root-level network access (`NET_RAW` capability). Running it separately
means we isolate the privileged code from the main API server. The capture container has
`network_mode: host` (sees real network interfaces) and publishes to Redis.

### Why publish to Redis instead of writing directly to PostgreSQL?
Speed. Writing to PostgreSQL on every packet would be too slow for high-traffic networks. Instead:
1. Capture every packet → publish to Redis immediately (microseconds)
2. Batch-write to PostgreSQL every 5 seconds (bulk insert)

The rule engine (P3) consumes from Redis in real-time. The database is for historical queries.

### Why does the capture service read config from the backend API?
The monitoring config (which interfaces/subnets to watch) is stored in PostgreSQL and managed
via the UI. The capture service fetches this config at startup and every 60 seconds so that
config changes made in the UI take effect without restarting the container.

---

## Architecture Position

```
Network interface (eth0, wlan0)
        │  raw packets
        ▼
[capture container]  ← reads config from GET http://localhost:8000/api/config
        │
        ├──► Redis "traffic:events"  (real-time, every packet)
        │         │
        │         ├──► Rule Engine (P3) subscribes → generates alerts
        │         └──► WebSocket handler (P1) subscribes → sends to browser
        │
        ├──► PostgreSQL network_events table  (bulk insert every 5 seconds)
        │
        └──► In-memory stats accumulator (flushed to stats every 30 seconds)

[backend container] — your API endpoints:
        GET  /api/events   → P5 frontend queries historical events
        GET  /api/stats    → P5 frontend fetches statistics
```

---

## What You Receive (Inputs)

1. **Raw network packets** from the OS network stack (via scapy)
2. **Monitoring config** from `GET http://localhost:8000/api/config` (fetched at startup + polling)
3. **HTTP GET requests** from the frontend (P5) to `/api/events` and `/api/stats`

---

## What You Produce (Outputs)

### 1. Redis message on channel `traffic:events`

Published for every captured packet. P3 (rule engine) and P1 (WebSocket) consume this.

```json
{
  "id": "3f2a1b4c-8d9e-4f5a-b6c7-d8e9f0a1b2c3",
  "timestamp": "2024-01-15T10:30:00.123456Z",
  "src_ip": "192.168.1.100",
  "dst_ip": "8.8.8.8",
  "src_port": 54321,
  "dst_port": 443,
  "protocol": "TCP",
  "bytes_sent": 1500,
  "direction": "outbound",
  "interface": "eth0",
  "flags": "SYN"
}
```

**Field rules:**
- `direction`: "outbound" if src_ip is in monitored_subnets, "inbound" if dst_ip is, "internal" if both are
- `flags`: TCP flags as string ("SYN", "SYN-ACK", "ACK", "FIN", "RST") or null for UDP/ICMP
- `protocol`: "TCP", "UDP", "ICMP", or "OTHER"
- `id`: generate a UUID4 at capture time
- ICMP packets: `src_port` and `dst_port` are null

### 2. PostgreSQL rows in `network_events` table

Bulk-inserted every 5 seconds. Same fields as the Redis message.

### 3. GET /api/events response

```json
{
  "items": [
    {
      "id": "3f2a1b4c-8d9e-4f5a-b6c7-d8e9f0a1b2c3",
      "timestamp": "2024-01-15T10:30:00Z",
      "src_ip": "192.168.1.100",
      "dst_ip": "8.8.8.8",
      "src_port": 54321,
      "dst_port": 443,
      "protocol": "TCP",
      "bytes_sent": 1500,
      "direction": "outbound",
      "interface": "eth0",
      "flags": "SYN"
    }
  ],
  "total": 15420,
  "page": 1,
  "limit": 50,
  "pages": 309
}
```

### 4. GET /api/stats response

```json
{
  "time_range": "1h",
  "total_events": 8450,
  "total_bytes": 12582912,
  "events_per_minute": 140.8,
  "top_source_ips": [
    { "ip": "192.168.1.100", "event_count": 3200, "bytes": 4096000 },
    { "ip": "192.168.1.55",  "event_count": 1800, "bytes": 2048000 },
    { "ip": "10.0.0.5",      "event_count": 1200, "bytes": 1536000 }
  ],
  "top_destination_ips": [
    { "ip": "8.8.8.8",      "event_count": 900, "bytes": 1200000 },
    { "ip": "1.1.1.1",      "event_count": 750, "bytes": 900000 }
  ],
  "top_ports": [
    { "port": 443,  "protocol": "TCP", "event_count": 4200 },
    { "port": 80,   "protocol": "TCP", "event_count": 1500 },
    { "port": 53,   "protocol": "UDP", "event_count": 800 },
    { "port": 22,   "protocol": "TCP", "event_count": 200 }
  ],
  "protocol_breakdown": {
    "TCP": 6800,
    "UDP": 1400,
    "ICMP": 250,
    "OTHER": 0
  },
  "inbound_count": 3100,
  "outbound_count": 5200,
  "internal_count": 150
}
```

---

## File Structure You Own

```
backend/
└── app/
    ├── capture/
    │   ├── __init__.py
    │   └── sniffer.py       ← scapy capture loop + Redis publisher
    ├── parsers/
    │   ├── __init__.py
    │   └── packet_parser.py ← converts scapy packet → normalized dict
    ├── services/
    │   ├── __init__.py
    │   └── stats.py         ← in-memory stats accumulator + DB flush
    └── api/
        ├── events.py        ← GET /api/events (search/filter)
        └── stats.py         ← GET /api/stats
```

---

## Detailed Implementation Guide

### sniffer.py — The Main Loop

```python
# Pseudocode for the capture loop
async def main():
    config = await fetch_config()       # GET /api/api/config
    interfaces = config["monitored_interfaces"]  # e.g. ["eth0"]
    subnets = config["monitored_subnets"]        # e.g. ["192.168.1.0/24"]

    buffer = []   # packet buffer for bulk DB insert

    def packet_handler(packet):
        if not is_relevant(packet, subnets): return
        event = parse_packet(packet, subnets)  # → normalized dict
        redis.publish("traffic:events", event)  # immediate
        buffer.append(event)

    # Flush buffer to PostgreSQL every 5 seconds
    # Reload config every 60 seconds
    # Run scapy AsyncSniffer on all monitored interfaces
    sniffer = AsyncSniffer(iface=interfaces, prn=packet_handler, store=False)
    sniffer.start()
```

### packet_parser.py — The Parser

```python
from scapy.all import IP, TCP, UDP, ICMP

def parse_packet(packet, monitored_subnets: list[str]) -> dict | None:
    """
    Convert a scapy packet to our normalized event schema.
    Returns None if packet is not IP-based (skip ARP, etc.)
    """
    if not packet.haslayer(IP):
        return None

    ip = packet[IP]
    event = {
        "id": str(uuid4()),
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "src_ip": ip.src,
        "dst_ip": ip.dst,
        "src_port": None,
        "dst_port": None,
        "protocol": "OTHER",
        "bytes_sent": len(packet),
        "direction": determine_direction(ip.src, ip.dst, monitored_subnets),
        "interface": packet.sniffed_on or "unknown",
        "flags": None,
    }

    if packet.haslayer(TCP):
        tcp = packet[TCP]
        event["protocol"] = "TCP"
        event["src_port"] = tcp.sport
        event["dst_port"] = tcp.dport
        event["flags"] = parse_tcp_flags(tcp.flags)  # "SYN", "ACK", etc.

    elif packet.haslayer(UDP):
        udp = packet[UDP]
        event["protocol"] = "UDP"
        event["src_port"] = udp.sport
        event["dst_port"] = udp.dport

    elif packet.haslayer(ICMP):
        event["protocol"] = "ICMP"

    return event

def determine_direction(src_ip: str, dst_ip: str, subnets: list[str]) -> str:
    src_internal = any(ip_in_subnet(src_ip, s) for s in subnets)
    dst_internal = any(ip_in_subnet(dst_ip, s) for s in subnets)
    if src_internal and dst_internal: return "internal"
    if src_internal: return "outbound"
    if dst_internal: return "inbound"
    return "outbound"  # fallback
```

### events.py — Search API

**Query parameters for GET /api/events:**

| Parameter | Type | Example | Description |
|---|---|---|---|
| `page` | int | `1` | Page number (1-indexed) |
| `limit` | int | `50` | Items per page (max 200) |
| `src_ip` | string | `192.168.1.100` | Filter by source IP (exact or prefix match) |
| `dst_ip` | string | `8.8.8.8` | Filter by destination IP |
| `protocol` | string | `TCP` | "TCP", "UDP", "ICMP" |
| `port` | int | `443` | Matches src_port OR dst_port |
| `direction` | string | `outbound` | "inbound", "outbound", "internal" |
| `from` | ISO datetime | `2024-01-15T10:00:00Z` | Start of time range |
| `to` | ISO datetime | `2024-01-15T11:00:00Z` | End of time range |

**Example request:**
```
GET /api/events?protocol=TCP&port=22&from=2024-01-15T10:00:00Z&limit=20
```

### stats.py — Statistics API

**Query parameters for GET /api/stats:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `range` | string | `1h` | "15m", "1h", "6h", "24h", "7d" |

Stats are computed with SQL aggregation queries against the `network_events` table.
Top IPs and top ports: use ORDER BY COUNT(*) DESC LIMIT 10.

---

## Traffic Data Simulator (for testing without a real network)

Create `backend/app/capture/simulator.py`. This runs instead of the real sniffer during tests
and CI. It generates realistic fake packets at ~100 events/second.

```python
# simulator.py — generates fake traffic for testing
COMMON_IPS = ["192.168.1.100", "192.168.1.55", "10.0.0.5", "8.8.8.8", "1.1.1.1"]
COMMON_PORTS = [80, 443, 22, 53, 8080, 3306, 5432]

async def simulate_traffic():
    while True:
        event = {
            "id": str(uuid4()),
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "src_ip": random.choice(COMMON_IPS),
            "dst_ip": random.choice(COMMON_IPS),
            "src_port": random.randint(1024, 65535),
            "dst_port": random.choice(COMMON_PORTS),
            "protocol": random.choice(["TCP", "TCP", "TCP", "UDP", "ICMP"]),
            "bytes_sent": random.randint(64, 9000),
            "direction": random.choice(["inbound", "outbound"]),
            "interface": "eth0",
            "flags": random.choice(["SYN", "ACK", "SYN-ACK", None]),
        }
        await redis_client.publish("traffic:events", event)
        await asyncio.sleep(0.01)  # 100 events/sec
```

Use an environment variable `CAPTURE_MODE=simulate|live` to switch between real and simulated.
This makes CI/CD work without a real network interface.

---

## Testing Requirements

Write tests in `backend/tests/test_capture.py`:

1. Test `parse_packet()` correctly identifies TCP with SYN flag
2. Test `parse_packet()` correctly identifies UDP
3. Test `parse_packet()` returns None for non-IP packets
4. Test `determine_direction()` for inbound, outbound, and internal cases
5. Test GET /api/events with no filters returns paginated results
6. Test GET /api/events with `protocol=TCP` filter
7. Test GET /api/events with `port=443` filter
8. Test GET /api/stats returns correct protocol_breakdown counts
9. Test simulator publishes to Redis and messages are received

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the network capture and traffic processing module for a SIEM tool.
The project uses Python, FastAPI, scapy, SQLAlchemy (async), Redis (async), and PostgreSQL.

The SQLAlchemy model for NetworkEvent is already defined by a teammate with these fields:
  id (UUID PK), timestamp (DateTime), src_ip (String), dst_ip (String), src_port (Int nullable),
  dst_port (Int nullable), protocol (String: "TCP"/"UDP"/"ICMP"/"OTHER"), bytes_sent (Int),
  direction (String: "inbound"/"outbound"/"internal"), interface (String), flags (String nullable)

The Redis client (already implemented by teammate 1) has:
  publish(channel: str, message: dict) → publishes JSON to channel
  Channel to publish to: "traffic:events"

Your task is to implement:

1. backend/app/parsers/packet_parser.py
   - parse_packet(packet, monitored_subnets) → dict | None
     Converts a scapy packet to the NetworkEvent schema dict.
     Returns None for non-IP packets.
     Determines direction: "outbound" if src_ip in monitored_subnets,
     "inbound" if dst_ip in monitored_subnets, "internal" if both.
     Parse TCP flags to human-readable string: "SYN", "ACK", "SYN-ACK", "FIN", "RST", "PSH".
     ICMP packets have null src_port and dst_port.
   - ip_in_subnet(ip: str, subnet: str) → bool using Python's ipaddress stdlib

2. backend/app/capture/sniffer.py
   - Fetches monitoring config from http://localhost:8000/api/config at startup
   - Uses scapy AsyncSniffer on monitored_interfaces
   - For each packet: parses it, publishes to Redis "traffic:events" immediately
   - Batches events in a list, bulk-inserts to PostgreSQL every 5 seconds
   - Refreshes config from API every 60 seconds (so UI changes take effect without restart)
   - Reads env var CAPTURE_MODE: if "simulate" → runs simulator instead of real sniffer

3. backend/app/capture/simulator.py
   - Generates realistic fake NetworkEvent dicts at ~100/second
   - Uses realistic IPs: 192.168.1.x for internal, 8.8.8.8/1.1.1.1/etc for external
   - Publishes to Redis "traffic:events"
   - Generates port scan scenario occasionally: same src_ip hitting 20+ different dst_ports in 10 seconds
   - Generates SSH brute force scenario occasionally: many connections to port 22 from same IP

4. backend/app/services/stats.py
   - compute_stats(range_str: str, db: AsyncSession) → dict
     range_str: "15m", "1h", "6h", "24h", "7d"
     Returns: total_events, total_bytes, events_per_minute,
              top_source_ips (top 10 by event_count with bytes),
              top_destination_ips (top 10),
              top_ports (top 10 by event_count with protocol),
              protocol_breakdown (dict TCP/UDP/ICMP/OTHER counts),
              inbound_count, outbound_count, internal_count
     Use SQLAlchemy async queries with GROUP BY and ORDER BY COUNT DESC.

5. backend/app/api/events.py
   - GET /api/events with query params: page(int,default=1), limit(int,default=50,max=200),
     src_ip(str,optional), dst_ip(str,optional), protocol(str,optional), port(int,optional),
     direction(str,optional), from(datetime,optional), to(datetime,optional)
   - port filter matches src_port OR dst_port
   - Returns: {"items": [...], "total": int, "page": int, "limit": int, "pages": int}
   - GET /api/events/{id} returns single event or 404

6. backend/app/api/stats.py
   - GET /api/stats?range=1h
   - Valid ranges: "15m", "1h", "6h", "24h", "7d"
   - Returns the full stats dict from compute_stats()

7. backend/tests/test_capture.py
   - Tests for parse_packet (TCP, UDP, ICMP, non-IP)
   - Tests for determine_direction (inbound, outbound, internal)
   - Tests for GET /api/events pagination and filters
   - Tests for GET /api/stats
   Use pytest-asyncio and httpx.AsyncClient. Mock the DB with an in-memory SQLite for tests.

Register the events and stats routers in app/main.py with prefix="/api".
All FastAPI routes must use async def and Depends(get_db) for database sessions.
```
