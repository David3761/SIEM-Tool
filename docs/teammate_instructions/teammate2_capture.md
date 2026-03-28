# Teammate 2 — Network Capture & Traffic Processing (Python)

## Role Overview

You are the data source of the entire SIEM system. You run as a standalone Python service
in `services/capture/`. Your job is to capture raw network packets, parse them into a clean
normalized schema, write them to the shared PostgreSQL database, and stream them in real-time
to Redis so the rule engine and WebSocket broadcaster react immediately.

You also write the traffic statistics logic — the Symfony API (Teammate 1) calls SQL queries
that you design, but the data comes entirely from what you capture and store.

---

## User Stories Owned

| Story | Backend data source | API endpoint (owned by Teammate 1) |
|---|---|---|
| US-01 | Redis `traffic:events` stream | WebSocket broadcast |
| US-05 | `network_events` PostgreSQL table | `GET /api/events` |
| US-07 | `network_events` aggregations | `GET /api/stats` |

You write the data. Teammate 1 serves it.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Python 3.11 | Language |
| scapy | Packet capture and parsing |
| psycopg2 | Direct PostgreSQL writes (no ORM needed) |
| redis-py | Publish to Redis |
| httpx | Fetch monitoring config from Symfony API |
| pytest | Tests |

---

## Context

### Why a separate Python service?
Packet capture requires root-level OS access (`NET_RAW` capability). Running it isolated in
its own container means this privileged code never touches the PHP API server. The container
runs with `network_mode: host` so scapy can see the real network interfaces.

### Why write directly to PostgreSQL instead of going through the API?
At 100+ events/second, going through HTTP would be too slow and would flood the API.
Direct bulk inserts with psycopg2 every 5 seconds are much faster.

### Why also publish to Redis?
The rule engine (Teammate 3) needs to evaluate every packet in real-time — milliseconds after
capture, not 5 seconds later. Redis pub/sub delivers each event instantly. The database is
for historical queries; Redis is for real-time reaction.

### Why fetch config from the Symfony API?
The monitoring config (which interfaces/subnets to watch) is managed via the frontend UI and
stored in PostgreSQL. Fetching it from the API every 60 seconds means a network admin can
change the scope from the UI without restarting this container.

---

## Architecture Position

```
Network interfaces (eth0, wlan0)
        │ raw packets
        ▼
[services/capture/]
        │
        ├── PUBLISH to Redis "traffic:events"   (every packet, immediate)
        │         └── Teammate 3 rule engine subscribes
        │         └── Teammate 1 Ratchet WS server subscribes → browser
        │
        └── bulk INSERT to PostgreSQL network_events  (every 5 seconds)
                  └── Teammate 1 Symfony serves GET /api/events and GET /api/stats
```

---

## File Structure

```
services/capture/
├── sniffer.py        ← main capture loop, publishes to Redis, bulk inserts to PG
├── simulator.py      ← fake traffic generator for testing (no real network needed)
├── parsers/
│   └── packet_parser.py  ← converts scapy packet to normalized dict
├── tests/
│   └── test_capture.py
├── requirements.txt
└── Dockerfile
```

---

## What You Publish to Redis — `traffic:events`

Every captured packet is published as JSON immediately:

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
- `direction`: `outbound` if `src_ip` is in monitored_subnets, `inbound` if `dst_ip` is, `internal` if both
- `flags`: TCP flags string (`SYN`, `ACK`, `SYN-ACK`, `FIN`, `RST`) or `null` for UDP/ICMP
- `protocol`: `TCP`, `UDP`, `ICMP`, or `OTHER`
- `src_port` / `dst_port`: `null` for ICMP packets
- `id`: generate UUID4 at capture time

---

## What You Write to PostgreSQL — `network_events` table

Same fields as the Redis message. Bulk-insert every 5 seconds:

```python
# psycopg2 bulk insert (executemany)
INSERT INTO network_events
  (id, timestamp, src_ip, dst_ip, src_port, dst_port,
   protocol, bytes_sent, direction, interface, flags)
VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
```

The table schema is created by Teammate 1's Doctrine migration. You only INSERT, never
create tables.

---

## Simulator (for CI and testing)

`simulator.py` generates realistic fake traffic at ~100 events/second.
Controlled by env var `CAPTURE_MODE=simulate|live`.

Include these attack scenarios so the rule engine can be tested without real traffic:
- **Port scan**: one src_ip hitting 25 different dst_ports in 30 seconds
- **SSH brute force**: 15 TCP SYN packets to dst_port=22 from same src_ip in 20 seconds
- **ICMP flood**: 110 ICMP packets from one IP in 8 seconds

```python
INTERNAL_IPS = ["192.168.1.100", "192.168.1.55", "192.168.1.10", "10.0.0.5"]
EXTERNAL_IPS = ["8.8.8.8", "1.1.1.1", "142.250.74.14"]
COMMON_PORTS = [80, 443, 22, 53, 8080, 3306, 5432]
```

---

## Config Polling

```python
async def fetch_config() -> dict:
    # GET http://localhost:8000/api/config
    # Returns: {"monitored_interfaces": [...], "monitored_subnets": [...], "excluded_ips": [...]}
    # Called at startup and every 60 seconds
    # On failure: keep using last known config, log warning
```

---

## Testing Requirements

Write tests in `services/capture/tests/test_capture.py`:

1. `parse_packet()` correctly extracts TCP with SYN flag
2. `parse_packet()` correctly extracts UDP
3. `parse_packet()` returns `None` for non-IP packets (ARP, etc.)
4. `determine_direction()` returns `outbound` for internal src, external dst
5. `determine_direction()` returns `inbound` for external src, internal dst
6. `determine_direction()` returns `internal` for both internal
7. Simulator publishes messages that are valid JSON with all required fields
8. Bulk insert batches correctly into a test PostgreSQL table

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the network capture service for a SIEM tool.
This is a standalone Python service in services/capture/.
It uses: scapy for packet capture, psycopg2 for PostgreSQL writes,
redis-py for publishing, httpx for HTTP calls.

The PostgreSQL table network_events already exists (created by a Symfony migration):
  id uuid, timestamp timestamptz, src_ip varchar(45), dst_ip varchar(45),
  src_port int nullable, dst_port int nullable, protocol varchar(10),
  bytes_sent int, direction varchar(10), interface varchar(20), flags varchar(20) nullable

Redis channel to publish to: "traffic:events"
Message format: JSON with fields: id, timestamp, src_ip, dst_ip, src_port, dst_port,
protocol, bytes_sent, direction, interface, flags

Implement:

1. services/capture/parsers/packet_parser.py
   - parse_packet(packet, monitored_subnets: list[str]) -> dict | None
     Returns None for non-IP packets.
     Extracts: src_ip, dst_ip, src_port (null for ICMP), dst_port (null for ICMP),
     protocol (TCP/UDP/ICMP/OTHER), bytes_sent (len(packet)), flags (TCP flags string or null).
     Determines direction: outbound if src_ip in any subnet, inbound if dst_ip in any subnet,
     internal if both, uses Python ipaddress stdlib for subnet matching.
     Parses TCP flags to string: SYN, ACK, SYN-ACK, FIN, RST, PSH (or combinations).
   - ip_in_subnet(ip: str, subnet: str) -> bool using ipaddress.ip_address in ipaddress.ip_network

2. services/capture/sniffer.py
   - Reads env vars: DATABASE_URL, REDIS_URL, BACKEND_URL, CAPTURE_MODE (simulate|live)
   - fetch_config(): GET {BACKEND_URL}/api/config, returns dict, retries on failure
   - Main loop:
     a. Fetch config at startup
     b. If CAPTURE_MODE=simulate: run simulator.py generate_traffic() instead of scapy
     c. If CAPTURE_MODE=live: use scapy AsyncSniffer on monitored_interfaces
     d. For each packet: parse_packet() -> if not None: publish to Redis immediately
     e. Buffer events in a list, bulk INSERT to PostgreSQL every 5 seconds using psycopg2
     f. Refresh config every 60 seconds (update interfaces/subnets filter)

3. services/capture/simulator.py
   - generate_traffic(): async generator yielding one event dict per iteration
   - Yields ~100 events/second with random IPs and ports from realistic sets
   - Every 30 seconds, inject a port scan scenario:
     same src_ip (192.168.1.100) sends TCP SYN to 25 different ports in quick succession
   - Every 45 seconds, inject SSH brute force:
     same src_ip sends 15 TCP SYN to dst_port=22 in 15 seconds

4. services/capture/requirements.txt
   scapy, psycopg2-binary, redis, httpx, pytest, pytest-asyncio

5. services/capture/Dockerfile
   FROM python:3.11-slim, install requirements, run sniffer.py

6. services/capture/tests/test_capture.py
   Tests using pytest (mock Redis and PostgreSQL with unittest.mock):
   - parse_packet correctly parses TCP SYN packet
   - parse_packet correctly parses UDP packet
   - parse_packet returns None for ARP packet
   - determine_direction returns correct values for all three cases
   - simulator yields events with all required fields
   - bulk insert batches 10 events into a single executemany call
```
