# Teammate 1 — Backend Core & Infrastructure (PHP / Symfony)

## Role Overview

You build the entire HTTP API and WebSocket server using PHP and Symfony.
You own the database schema (Doctrine ORM + migrations), all REST endpoints,
real-time WebSocket broadcasting (Ratchet), Docker Compose for the whole project,
and CI/CD pipelines.

Python services (Teammates 2, 3, 4) write directly to the shared PostgreSQL database
and publish events to Redis. You read that data and serve it to the frontend via REST.
Your Ratchet WebSocket server subscribes to Redis and pushes real-time events to the browser.

---

## User Stories Owned

| Story | Description |
|---|---|
| US-06 | Configure which IPs/subnets to monitor (GET/PUT /api/config) |

Every REST API endpoint in the project lives in your Symfony app.

---

## Tech Stack

| Tool | Purpose |
|---|---|
| Symfony 7 | PHP web framework |
| Doctrine ORM | Database models and migrations |
| Ratchet (`cboden/ratchet`) | PHP WebSocket server |
| predis/predis | Redis client for PHP |
| PHP 8.3 | Language |
| PostgreSQL | Main database |
| Redis | Event bus — you subscribe and broadcast |
| Docker | Containerization |
| GitHub Actions | CI/CD |

---

## Context

### Why Symfony?
Symfony is a mature PHP framework with excellent support for REST APIs via its controller
system, Doctrine ORM for database management, and a console command system that lets
Ratchet run as a long-lived worker process.

### Why Ratchet for WebSocket?
The frontend needs real-time updates (new alerts appearing, AI analysis completing) without
polling. Ratchet is the standard PHP WebSocket library. It runs as a separate Symfony console
command (`php bin/console app:websocket:serve`) on port 8080.

### How does Ratchet know what to broadcast?
Python services publish events to Redis channels. Ratchet subscribes to those channels
in its event loop and forwards each message as JSON to all connected browser clients.

### Why does the capture service call your API?
The monitoring config (which interfaces/subnets to watch) is stored in PostgreSQL and
editable via the frontend. The Python capture service polls `GET /api/config` every 60
seconds so that config changes take effect without restarting any container.

---

## Architecture Position

```
Browser ──HTTP:8000──► [Symfony REST API] ──► PostgreSQL (Doctrine)
Browser ──WS:8080───► [Ratchet WebSocket] ◄── Redis (subscribes to all channels)

Python services write to PostgreSQL directly and publish to Redis.
Symfony reads PostgreSQL to serve REST responses.
Ratchet subscribes to Redis and pushes to all connected browsers.
```

---

## Symfony Project Structure

Bootstrap with:
```bash
composer create-project symfony/skeleton backend
cd backend
composer require symfony/orm-pack predis/predis cboden/ratchet \
    symfony/uid symfony/validator league/csv dompdf/dompdf
```

Key files you create:
```
backend/
├── src/
│   ├── Controller/
│   │   ├── AlertController.php
│   │   ├── EventController.php
│   │   ├── IncidentController.php
│   │   ├── RuleController.php
│   │   └── ConfigController.php
│   ├── Entity/
│   │   ├── NetworkEvent.php
│   │   ├── Alert.php
│   │   ├── Incident.php
│   │   ├── Rule.php
│   │   └── MonitoringConfig.php
│   ├── Repository/
│   │   ├── NetworkEventRepository.php
│   │   ├── AlertRepository.php
│   │   └── IncidentRepository.php
│   └── Command/
│       └── WebSocketServeCommand.php
├── migrations/
├── tests/
└── composer.json
```

---

## Doctrine Entities — Full Specification

### NetworkEvent
```php
#[ORM\Entity, ORM\Table(name: 'network_events')]
class NetworkEvent {
    #[ORM\Id, ORM\Column(type: 'uuid')]   private string $id;
    #[ORM\Column(type: 'datetime_immutable')]  private \DateTimeImmutable $timestamp;
    #[ORM\Column(length: 45)]             private string $srcIp;
    #[ORM\Column(length: 45)]             private string $dstIp;
    #[ORM\Column(nullable: true)]         private ?int $srcPort;
    #[ORM\Column(nullable: true)]         private ?int $dstPort;
    #[ORM\Column(length: 10)]             private string $protocol;  // TCP UDP ICMP OTHER
    #[ORM\Column]                         private int $bytesSent;
    #[ORM\Column(length: 10)]             private string $direction; // inbound outbound internal
    #[ORM\Column(length: 20)]             private string $interface;
    #[ORM\Column(length: 20, nullable: true)] private ?string $flags;
}
```

### Alert
```php
#[ORM\Entity, ORM\Table(name: 'alerts')]
class Alert {
    #[ORM\Id, ORM\Column(type: 'uuid')]       private string $id;
    #[ORM\Column(length: 100)]                private string $ruleId;
    #[ORM\Column(length: 200)]                private string $ruleName;
    #[ORM\Column(length: 20)]                 private string $severity; // low medium high critical
    #[ORM\Column(type: 'datetime_immutable')] private \DateTimeImmutable $timestamp;
    #[ORM\Column(length: 30)]                 private string $status;   // open acknowledged false_positive resolved
    #[ORM\Column(type: 'uuid', nullable: true)]  private ?string $triggeringEventId;
    #[ORM\Column(type: 'json')]               private array $relatedEventIds = [];
    #[ORM\Column(type: 'json', nullable: true)]  private ?array $aiAnalysis = null;
    #[ORM\Column(type: 'uuid', nullable: true)]  private ?string $incidentId = null;
}
```

### Incident
```php
#[ORM\Entity, ORM\Table(name: 'incidents')]
class Incident {
    #[ORM\Id, ORM\Column(type: 'uuid')]       private string $id;
    #[ORM\Column(length: 300)]                private string $title;
    #[ORM\Column(type: 'text', nullable: true)]  private ?string $description;
    #[ORM\Column(length: 20)]                 private string $severity;
    #[ORM\Column(length: 30)]                 private string $status = 'open'; // open in_progress resolved
    #[ORM\Column(type: 'datetime_immutable')] private \DateTimeImmutable $createdAt;
    #[ORM\Column(type: 'datetime_immutable', nullable: true)] private ?\DateTimeImmutable $updatedAt;
    #[ORM\Column(type: 'json')]               private array $alertIds = [];
    #[ORM\Column(type: 'json', nullable: true)]  private ?array $aiRemediation = null;
    #[ORM\Column(type: 'json', nullable: true)]  private ?array $timeline = null;
}
```

### Rule
```php
#[ORM\Entity, ORM\Table(name: 'rules')]
class Rule {
    #[ORM\Id, ORM\Column(type: 'uuid')]       private string $id;
    #[ORM\Column(length: 200)]                private string $name;
    #[ORM\Column(type: 'text', nullable: true)]  private ?string $description;
    #[ORM\Column(length: 50)]                 private string $ruleType; // threshold
    #[ORM\Column(length: 20)]                 private string $severity;
    #[ORM\Column(type: 'json')]               private array $config;
    #[ORM\Column]                             private bool $enabled = true;
    #[ORM\Column(type: 'datetime_immutable')] private \DateTimeImmutable $createdAt;
}
```

### MonitoringConfig
```php
#[ORM\Entity, ORM\Table(name: 'monitoring_config')]
class MonitoringConfig {
    #[ORM\Id, ORM\Column]   private int $id = 1;   // always a single row
    #[ORM\Column(type: 'json')]  private array $monitoredInterfaces = ['eth0'];
    #[ORM\Column(type: 'json')]  private array $monitoredSubnets = ['0.0.0.0/0'];
    #[ORM\Column(type: 'json')]  private array $excludedIps = [];
    #[ORM\Column(type: 'datetime_immutable', nullable: true)] private ?\DateTimeImmutable $updatedAt;
}
```

---

## API Endpoints — Full Specification

### GET /api/events
Query params: `page`, `limit`(max 200), `src_ip`, `dst_ip`, `protocol`, `port` (matches src OR dst), `direction`, `from`, `to`

### GET /api/stats?range=1h
Valid ranges: `15m`, `1h`, `6h`, `24h`, `7d`

Response:
```json
{
  "time_range": "1h", "total_events": 8450, "total_bytes": 12582912,
  "events_per_minute": 140.8,
  "top_source_ips": [{"ip": "192.168.1.100", "event_count": 3200, "bytes": 4096000}],
  "top_destination_ips": [{"ip": "8.8.8.8", "event_count": 900, "bytes": 1200000}],
  "top_ports": [{"port": 443, "protocol": "TCP", "event_count": 4200}],
  "protocol_breakdown": {"TCP": 6800, "UDP": 1400, "ICMP": 250},
  "inbound_count": 3100, "outbound_count": 5200, "internal_count": 150
}
```

### GET /api/alerts
Query params: `status`, `severity`, `rule_id`, `from`, `to`, `page`, `limit`

### PATCH /api/alerts/{id}
Body: `{"status": "acknowledged"}` — valid values: `acknowledged`, `false_positive`, `resolved`
Returns 422 on invalid status.

### GET /api/alerts/export?format=csv|pdf
CSV: `Content-Type: text/csv` with headers: `id,rule_name,severity,timestamp,status,src_ip,dst_ip`
PDF: use dompdf, table layout with title showing date range

### POST /api/incidents
Body: `{"title": "...", "alert_ids": ["uuid1", "uuid2"]}`
Sets severity = max severity across all provided alerts. Returns 201.

### GET/PUT /api/config (US-06)
PUT validates each subnet with `inet_pton()` — returns 422 with field error on invalid CIDR.

---

## WebSocket Server

```php
// src/Command/WebSocketServeCommand.php
// Run with: php bin/console app:websocket:serve

class WebSocketServeCommand extends Command
{
    // On start: subscribe to Redis channels traffic:events, alerts:new, alerts:updated
    // For each message received from Redis: broadcast to all connected WS clients as:
    // {"type": "traffic_event"|"new_alert"|"alert_updated", "data": {decoded JSON}}
    // Handle client connect/disconnect gracefully
    // Runs on port 8080
}
```

---

## Docker Compose

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16
    environment: { POSTGRES_DB: siem, POSTGRES_USER: siem, POSTGRES_PASSWORD: siempassword }
    volumes: [postgres_data:/var/lib/postgresql/data]
    ports: ["5432:5432"]
    healthcheck: { test: ["CMD-SHELL","pg_isready -U siem"], interval: 5s, retries: 5 }

  redis:
    image: redis:7-alpine
    ports: ["6379:6379"]

  ollama:
    image: ollama/ollama:latest
    volumes: [ollama_models:/root/.ollama]
    ports: ["11434:11434"]

  backend:
    build: ./backend
    depends_on: { postgres: { condition: service_healthy } }
    environment:
      DATABASE_URL: postgresql://siem:siempassword@postgres:5432/siem
      REDIS_URL: redis://redis:6379
    ports: ["8000:8000", "8080:8080"]

  capture:
    build: ./services/capture
    network_mode: host
    cap_add: [NET_RAW, NET_ADMIN]
    environment:
      DATABASE_URL: postgresql://siem:siempassword@localhost:5432/siem
      REDIS_URL: redis://localhost:6379
      BACKEND_URL: http://localhost:8000
    depends_on: [redis, postgres]

  rules:
    build: ./services/rules
    environment:
      DATABASE_URL: postgresql://siem:siempassword@postgres:5432/siem
      REDIS_URL: redis://redis:6379
    depends_on: [redis, postgres]

  agents:
    build: ./services/agents
    environment:
      DATABASE_URL: postgresql://siem:siempassword@postgres:5432/siem
      REDIS_URL: redis://redis:6379
      OLLAMA_URL: http://ollama:11434
    depends_on: [redis, postgres, ollama]

  frontend:
    build: ./frontend
    ports: ["3000:80"]
    depends_on: [backend]

volumes:
  postgres_data:
  ollama_models:
```

---

## Makefile

```makefile
start:
	docker compose up -d

stop:
	docker compose down

logs:
	docker compose logs -f

migrate:
	docker compose exec backend php bin/console doctrine:migrations:migrate --no-interaction

test:
	docker compose exec backend php bin/phpunit
	cd frontend && npm test
```

---

## CI/CD

### .github/workflows/ci.yml
```yaml
name: CI
on:
  pull_request:
    branches: [main]
jobs:
  test-backend:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16
        env: { POSTGRES_DB: siem_test, POSTGRES_USER: siem, POSTGRES_PASSWORD: siempassword }
        ports: ["5432:5432"]
        options: --health-cmd pg_isready --health-interval 5s --health-retries 5
      redis:
        image: redis:7-alpine
        ports: ["6379:6379"]
    steps:
      - uses: actions/checkout@v4
      - uses: shivammathur/setup-php@v2
        with: { php-version: "8.3" }
      - run: composer install
        working-directory: backend
      - run: php bin/console doctrine:migrations:migrate --no-interaction
        working-directory: backend
        env: { DATABASE_URL: postgresql://siem:siempassword@localhost:5432/siem_test }
      - run: php bin/phpunit
        working-directory: backend
        env: { DATABASE_URL: postgresql://siem:siempassword@localhost:5432/siem_test }
  test-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20" }
      - run: npm ci && npm test
        working-directory: frontend
```

### .github/workflows/cd.yml
```yaml
name: CD
on:
  push:
    branches: [main]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker build -t backend ./backend
      - run: docker build -t siem-frontend ./frontend
```

---

## AI Prompt — Give This Exactly to Claude

```
You are implementing the backend API and WebSocket server for a SIEM tool using PHP 8.3,
Symfony 7, Doctrine ORM, and Ratchet (cboden/ratchet) for WebSocket.

DATABASE ENTITIES in PostgreSQL (create as Doctrine entities with full annotations):

NetworkEvent (table: network_events): id uuid PK, timestamp datetime_immutable, src_ip string(45),
dst_ip string(45), src_port int nullable, dst_port int nullable, protocol string (TCP/UDP/ICMP/OTHER),
bytes_sent int, direction string (inbound/outbound/internal), interface string, flags string nullable

Alert (table: alerts): id uuid PK, rule_id string, rule_name string, severity string
(low/medium/high/critical), timestamp datetime_immutable, status string
(open/acknowledged/false_positive/resolved), triggering_event_id uuid nullable,
related_event_ids json array, ai_analysis json nullable, incident_id uuid nullable

Incident (table: incidents): id uuid PK, title string, description text nullable, severity string,
status string (open/in_progress/resolved), created_at datetime_immutable, updated_at nullable,
alert_ids json array, ai_remediation json nullable, timeline json nullable

Rule (table: rules): id uuid PK, name string, description text nullable, rule_type string,
severity string, config json, enabled bool, created_at datetime_immutable

MonitoringConfig (table: monitoring_config): id int PK (always 1), monitored_interfaces json,
monitored_subnets json, excluded_ips json, updated_at datetime_immutable nullable

REDIS CHANNELS (published by Python services — you SUBSCRIBE and broadcast via WebSocket):
  traffic:events  →  broadcast as {"type": "traffic_event", "data": {...}}
  alerts:new      →  broadcast as {"type": "new_alert", "data": {...}}
  alerts:updated  →  broadcast as {"type": "alert_updated", "data": {...}}

IMPLEMENT:

1. All five Doctrine entity classes with ORM attributes
2. Doctrine migrations for all five tables
3. A DataFixture that inserts MonitoringConfig id=1 with defaults if it does not exist

4. REST controllers returning JSON, all list endpoints return:
   {"items":[...], "total": int, "page": int, "limit": int, "pages": int}

   AlertController:
   - GET /api/alerts — filterable by status, severity, rule_id, from, to. Include nested
     triggering_event data in each alert response.
   - GET /api/alerts/{id} — 404 if not found
   - PATCH /api/alerts/{id} — update status only, 422 on invalid status value
   - GET /api/alerts/export?format=csv|pdf — apply same filters as list endpoint.
     CSV uses league/csv. PDF uses dompdf with a table showing id,rule_name,severity,timestamp,status.

   EventController:
   - GET /api/events — filterable by src_ip, dst_ip, protocol, port (matches src OR dst),
     direction, from, to
   - GET /api/events/{id} — 404 if not found
   - GET /api/stats?range=15m|1h|6h|24h|7d — aggregate queries using Doctrine QueryBuilder:
     top 10 source IPs by count, top 10 destination IPs, top 10 ports with protocol,
     protocol breakdown counts, total events, total bytes, events per minute,
     inbound/outbound/internal counts

   IncidentController:
   - POST /api/incidents — body: {title, alert_ids[]}. Derive severity = max of all alert severities.
     Returns 201.
   - GET /api/incidents — paginated list ordered by created_at DESC
   - GET /api/incidents/{id} — 404 if not found
   - PATCH /api/incidents/{id} — update status only

   RuleController:
   - GET /api/rules
   - POST /api/rules
   - PUT /api/rules/{id}
   - DELETE /api/rules/{id} — soft delete: set enabled=false, return 204

   ConfigController:
   - GET /api/config
   - PUT /api/config — validate each subnet in monitored_subnets using inet_pton(),
     return 422 with {"field": "monitored_subnets", "error": "Invalid CIDR: ..."} on failure

5. WebSocketServeCommand (src/Command/WebSocketServeCommand.php):
   Command name: app:websocket:serve
   - Creates a Ratchet WsServer running on port 8080
   - Uses predis to subscribe to channels: traffic:events, alerts:new, alerts:updated
   - On each Redis message: decodes JSON, wraps as {"type": "...", "data": {...}},
     broadcasts to ALL currently connected WebSocket clients
   - Tracks connected clients in an SplObjectStorage
   - Handles onOpen, onClose, onError gracefully

6. docker-compose.yml with all 7 services as specified (backend ports 8000+8080,
   capture with network_mode:host and cap_add NET_RAW/NET_ADMIN, ollama with volume)

7. Makefile: start, stop, logs, migrate, test targets

8. .github/workflows/ci.yml: runs on PR to main, uses real postgres+redis services,
   runs composer install + doctrine migrations + phpunit for backend,
   npm ci + npm test for frontend

9. .github/workflows/cd.yml: runs on push to main, builds backend and frontend Docker images

10. PHPUnit tests in backend/tests/:
    - GET /api/config returns default config
    - PUT /api/config with valid data updates it
    - PUT /api/config with invalid CIDR returns 422
    - GET /api/alerts returns paginated response
    - PATCH /api/alerts/{id} with valid status updates it
    - PATCH /api/alerts/{id} with invalid status returns 422
```
